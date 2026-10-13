//-----------------------------------------------------
// Account Summary (balances + contributions + growth for any set of accounts)
//-----------------------------------------------------

const ACCOUNT_SUMMARY_PREFS_KEY = "accountSummaryPrefs";
const DEFAULT_SUMMARY_GRANULARITY = "month";

let summaryGranularity = DEFAULT_SUMMARY_GRANULARITY;
let summaryRequestId = 0;   // lets a slow response be ignored if the selection changed while it was loading

//-----------------------------------------------------
// Saved preferences (localStorage, per browser)
//-----------------------------------------------------

function loadSummaryPrefs() {
    const defaults = { granularity: DEFAULT_SUMMARY_GRANULARITY, selectedIds: null };
    try {
        const raw = JSON.parse(localStorage.getItem(ACCOUNT_SUMMARY_PREFS_KEY));
        if (!raw || typeof raw !== "object") return defaults;
        return {
            granularity: raw.granularity === "year" ? "year" : "month",
            selectedIds: Array.isArray(raw.selectedIds) ? raw.selectedIds.filter(Number.isInteger) : null,
        };
    } catch (error) {
        return defaults;
    }
}

function saveSummaryPrefs(selectedIds) {
    try {
        localStorage.setItem(ACCOUNT_SUMMARY_PREFS_KEY, JSON.stringify({
            granularity: summaryGranularity,
            selectedIds,
        }));
    } catch (error) {
        // Private windows and blocked storage just mean nothing is remembered.
    }
}

//-----------------------------------------------------
// Row normalization + column descriptors
//-----------------------------------------------------

// Picks the right fields for monthly vs yearly rows. A monthly balance is the entry for that month;
// a yearly balance is the year-end balance (the backend's end_* fields).
function normalizeAccountSummaryRow(row, granularity) {
    const isMonth = granularity === "month";

    let label;
    if (isMonth) {
        label = formatMonthYear(row.year, row.month);
    } else if (!row.complete) {
        label = `${row.year} (YTD)`;
    } else if (row.months < 12) {
        label = `${row.year} (${row.months} mo)`;
    } else {
        label = String(row.year);
    }

    return {
        label,
        year: isMonth ? row.year : null,   // buildTable draws a divider when year changes; yearly rows don't need one
        sortKey: isMonth ? row.year * 12 + row.month : row.year,
        balance: isMonth ? row.total_balance : row.end_total_balance,
        investedBalance: isMonth ? row.invested_balance : row.end_invested_balance,
        cashBalance: isMonth ? row.cash_balance : row.end_cash_balance,
        contributions: row.contributions,
        gain: row.gain,
        returnPct: row.return_pct,
    };
}

// Cash/credit accounts only get balance columns; invested accounts also get contributions, gain and return.
function buildAccountSummaryColumnDescriptors(data, granularity) {
    const isMonth = granularity === "month";
    const columns = [
        { label: isMonth ? "Month" : "Year", getValue: row => row.label },
        { label: isMonth ? "Balance" : "Year-End Balance", getValue: row => row.balance, isCurrency: true, isBold: true },
    ];

    if (data.has_invested && data.has_cash) {
        columns.push(
            { label: "Invested", getValue: row => row.investedBalance, isCurrency: true },
            { label: "Cash & Credit", getValue: row => row.cashBalance, isCurrency: true }
        );
    }

    if (data.has_invested) {
        columns.push(
            { label: "Contributions", getValue: row => row.contributions, isCurrency: true, dashIfEmpty: true },
            { label: "Gain", getValue: row => row.gain, isCurrency: true, canBeNeg: true, dashIfEmpty: true },
            { label: "Return", getValue: row => row.returnPct, isPercent: true, canBeNeg: true, dashIfEmpty: true }
        );
    }
    return columns;
}

// One chart point per row, oldest first. Yearly points are the year-end values (the backend's end_* fields),
// and the current year ends at the latest entry.
function normalizeAccountSummaryChartPoint(row, granularity, latest) {
    if (granularity === "month") {
        const heading = formatMonthYear(row.year, row.month);
        return {
            year: row.year, month: row.month, heading,
            invested: row.invested_balance, cash: row.cash_balance, total: row.total_balance,
            moneyIn: row.money_in, gain: row.cumulative_gain,
        };
    }

    const heading = row.complete ? `End of ${row.year}` : `Latest entry, ${formatMonthYear(latest.year, latest.month)}`;
    return {
        year: row.year, month: null, heading,
        invested: row.end_invested_balance, cash: row.end_cash_balance, total: row.end_total_balance,
        moneyIn: row.end_money_in, gain: row.end_cumulative_gain,
    };
}

function buildAccountSummaryChartData(data, granularity) {
    const points = data.rows
        .map(row => ({ row, key: granularity === "month" ? row.year * 12 + row.month : row.year }))
        .sort((a, b) => a.key - b.key)
        .map(({ row }) => normalizeAccountSummaryChartPoint(row, granularity, data.latest));
    return { points, hasInvested: data.has_invested, hasCash: data.has_cash };
}

function renderAccountSummaryChart(data, granularity) {
    const chartContainer = document.getElementById("summary-chart");
    if (!chartContainer || typeof AccountSummaryChart === "undefined") return;
    AccountSummaryChart.render(chartContainer, buildAccountSummaryChartData(data, granularity));
}

function clearAccountSummaryChart() {
    const chartContainer = document.getElementById("summary-chart");
    if (chartContainer && typeof AccountSummaryChart !== "undefined") AccountSummaryChart.clear(chartContainer);
}

//-----------------------------------------------------
// Rendering
//-----------------------------------------------------

function buildGranularityToggle(current) {
    return `
        <button class="savings-toggle-button ${current === "month" ? "active" : ""}" data-granularity="month">Monthly</button>
        <button class="savings-toggle-button ${current === "year" ? "active" : ""}" data-granularity="year">Yearly</button>
    `;
}

// Headline numbers as of the latest entry. For invested accounts: balance = opening + contributions + gain.
function buildAccountSummaryStats(data) {
    if (!data.latest) return "";
    const latest = data.latest;

    const tiles = [];
    if (data.has_cash) {
        tiles.push({ label: "Total Balance", value: latest.total_balance });
    }
    if (data.has_cash && data.has_invested) {
        tiles.push({ label: "Cash & Credit", value: latest.cash_balance });
    }
    if (data.has_invested) {
        tiles.push(
            { label: "Invested Balance", value: latest.invested_balance },
            { label: "Opening Balance", value: latest.opening_balance },
            { label: "Total Contributions", value: latest.cumulative_contributions },
            { label: "Total Investment Gain", value: latest.cumulative_gain, colored: true }
        );
    }

    const cards = tiles.map(tile => {
        const colorClass = !tile.colored ? "" : tile.value > 0 ? "growth-positive" : tile.value < 0 ? "growth-negative" : "";
        return `
            <div class="dashboard-card">
                <h3 class="acs-tile-label">${tile.label}</h3>
                <p class="acs-tile-value ${colorClass}">${formatCurrency(tile.value)}</p>
            </div>`;
    }).join("");

    const asOf = formatMonthYear(latest.year, latest.month);
    return `
        <p class="dashboard-blurb">As of the latest entry, ${asOf}</p>
        <div class="dashboard-grid acs-tiles">${cards}</div>`;
}

function buildAccountSummaryTable(data, granularity) {
    const rows = data.rows
        .map(row => normalizeAccountSummaryRow(row, granularity))
        .sort((a, b) => b.sortKey - a.sortKey);
    const columns = buildAccountSummaryColumnDescriptors(data, granularity);
    return buildTable(rows, columns, {
        title: granularity === "month" ? "Monthly" : "Yearly",
        tableClass: "data-table acs-table",
        wrapperClass: "table-wrapper",
    });
}

//-----------------------------------------------------
// Main function
//-----------------------------------------------------

async function loadAccountSummary() {
    const statsContainer = document.getElementById("summary-stats");
    const tableContainer = document.getElementById("summary");
    if (!statsContainer || !tableContainer) return;

    const selected = AccountFilter.getSelectedAccounts();
    saveSummaryPrefs(selected.map(account => account.id));

    if (selected.length === 0) {
        statsContainer.innerHTML = "";
        clearAccountSummaryChart();
        tableContainer.innerHTML = "<p>Select at least one account.</p>";
        return;
    }

    const requestId = ++summaryRequestId;
    const chartContainer = document.getElementById("summary-chart");
    if (chartContainer) chartContainer.classList.add("acs-chart-loading");   // the old chart stays, dimmed, until the new data arrives
    tableContainer.innerHTML = `<p>Loading ${summaryGranularity} summary...</p>`;

    try {
        const params = new URLSearchParams();
        selected.forEach(account => params.append("account_ids", account.id));
        params.set("granularity", summaryGranularity);

        const response = await fetch(`/api/analytics/account-summary?${params}`);
        if (!response.ok) {
            throw new Error("Unable to load account summary");
        }
        const data = await response.json();
        if (requestId !== summaryRequestId) return;   // a newer request has already replaced this one

        if (!Array.isArray(data.rows) || data.rows.length === 0) {
            statsContainer.innerHTML = "";
            clearAccountSummaryChart();
            tableContainer.innerHTML = "<p>No data found for the selected accounts.</p>";
            return;
        }

        statsContainer.innerHTML = buildAccountSummaryStats(data);
        renderAccountSummaryChart(data, summaryGranularity);
        tableContainer.innerHTML = buildAccountSummaryTable(data, summaryGranularity);
    } catch (error) {
        if (requestId !== summaryRequestId) return;
        statsContainer.innerHTML = "";
        clearAccountSummaryChart();
        tableContainer.innerHTML = `<p>${error.message}</p>`;
    } finally {
        if (requestId === summaryRequestId && chartContainer) chartContainer.classList.remove("acs-chart-loading");
    }
}

//-----------------------------------------------------
// Event listener
//-----------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();

    const prefs = loadSummaryPrefs();
    summaryGranularity = prefs.granularity;

    // Monthly / Yearly toggle
    const toggle = document.getElementById("summary-toggle");
    toggle.innerHTML = buildGranularityToggle(summaryGranularity);
    toggle.addEventListener("click", (event) => {
        const button = event.target.closest("[data-granularity]");
        if (!button || button.dataset.granularity === summaryGranularity) return;
        summaryGranularity = button.dataset.granularity;
        toggle.innerHTML = buildGranularityToggle(summaryGranularity);
        loadAccountSummary();
    });

    // Account filter: every account is selectable, cash and credit included
    let accounts, categories, views;
    try {
        [accounts, categories, views] = await Promise.all([
            fetch("/api/accounts").then(r => r.json()),
            getAccountCategories(),
            getAccountViews(),
        ]);
    } catch (error) {
        document.getElementById("summary").innerHTML = "<p>Unable to load accounts.</p>";
        return;
    }

    const summaryViews = { invested: { invested: true } };
    ["retirement", "non_retirement", "cash", "net_worth"].forEach(key => {
        if (views[key]) summaryViews[key] = views[key];
    });

    // /summary?account=5 (the link on the Accounts page) selects just that account; otherwise restore the saved selection
    const linkedId = Number(new URLSearchParams(location.search).get("account"));
    const initialSelectedIds = Number.isInteger(linkedId) && linkedId > 0 ? [linkedId] : prefs.selectedIds;

    AccountFilter.init({
        container: "#account-filter-container",
        accounts,
        categories,
        views: summaryViews,
        defaultView: "invested",
        initialSelectedIds,
        onChange: () => loadAccountSummary(),
    });
});
