const DEFAULT_GRANULARITY = "month";
const STORAGE_KEYS = {
    granularity: "savingsSummaryGranularity",
    expanded: "savingsSummaryExpanded",
    includeGains: "savingsChartsIncludeGains",
    view: "savingsSummaryView"
};

let lastSavingsData = null;
let lastGranularity = DEFAULT_GRANULARITY;

function getSavedView() {
    return localStorage.getItem(STORAGE_KEYS.view) === "graph" ? "graph" : "table";
}

function setSavedView(view) {
    localStorage.setItem(STORAGE_KEYS.view, view);
}

function buildViewToggleButtons(current) {
    return `
        <div class="savings-toggle-group">
            <button class="savings-toggle-button ${current === "table" ? "active" : ""}" data-view="table">Table</button>
            <button class="savings-toggle-button ${current === "graph" ? "active" : ""}" data-view="graph">Graph</button>
        </div>
    `;
}

// Shows either the table or the graphs, never both. The "include gains" checkbox only matters for graphs.
function applyView(view) {
    const showGraph = view === "graph";
    document.getElementById("savings").hidden = showGraph;
    document.getElementById("savings-charts").hidden = !showGraph;

    const gainsLabel = document.querySelector(".svc-checkbox");
    if (gainsLabel) gainsLabel.hidden = !showGraph;

    const viewToggle = document.getElementById("savings-view-toggle");
    if (viewToggle) viewToggle.innerHTML = buildViewToggleButtons(view);

    // Charts measure their width when drawn, so redraw now that they're visible.
    if (showGraph && lastSavingsData) renderSavingsCharts(lastSavingsData, lastGranularity);
}

function getSavedIncludeGains() {
    return localStorage.getItem(STORAGE_KEYS.includeGains) !== "false";
}

function setSavedIncludeGains(value) {
    localStorage.setItem(STORAGE_KEYS.includeGains, value ? "true" : "false");
}

// One chart point per row. Yearly points use the monthly averages, like the first yearly table.
function normalizeSavingsChartPoint(row, granularity) {
    const prefix = granularity === "year" ? "avg_monthly_" : "";
    return {
        heading: granularity === "month" ? formatMonthYear(row.year, row.month) : `${row.year} (monthly avg)`,
        year: row.year,
        month: granularity === "month" ? row.month : null,
        cashIncome: row[`${prefix}cash_income`],
        totalIncome: row[`${prefix}total_income`],
        spending: row[`${prefix}spending`],
        cashSavings: row[`${prefix}cash_savings`],
        investmentGains: row[`${prefix}investment_gains`],
        totalSavings: row[`${prefix}total_savings`],
        spendingAvg12: granularity === "month" ? row.spending_avg_12m : null,
        cashSavingsAvg12: granularity === "month" ? row.cash_savings_avg_12m : null,
    };
}

function renderSavingsCharts(data, granularity) {
    const target = document.getElementById("savings-charts");
    if (!target || typeof SavingsCharts === "undefined") return;

    if (!data || !Array.isArray(data.rows) || data.rows.length === 0) {
        SavingsCharts.clear(target);
        return;
    }

    let running = 0;
    const points = data.rows
        .map(row => ({ row, key: granularity === "month" ? row.year * 12 + row.month : row.year }))
        .sort((a, b) => a.key - b.key)
        .map(({ row }) => normalizeSavingsChartPoint(row, granularity));
    SavingsCharts.render(target, { points, includeGains: getSavedIncludeGains(), granularity });
}

function getSavingsSummaryUrl(granularity) {
    return `/api/analytics/savings-summary?granularity=${encodeURIComponent(granularity)}`;
}

function buildToggleButtons(currentGranularity) {
    return `
        <div class="savings-toggle-group">
            <button class="savings-toggle-button ${currentGranularity === "month" ? "active" : ""}" data-granularity="month">Monthly</button>
            <button class="savings-toggle-button ${currentGranularity === "year" ? "active" : ""}" data-granularity="year">Yearly</button>
        </div>
    `;
}

function getSavedExpandedState() {
    return localStorage.getItem(STORAGE_KEYS.expanded) === "true";
}

function setSavedExpandedState(value) {
    localStorage.setItem(STORAGE_KEYS.expanded, value ? "true" : "false");
}

// this function decides the column labels, format, values, etc. based on the table being built
function normalizeSavingsRow(row, granularity, sourceIds, useTotals) {
    const prefix = (granularity === "year" && !useTotals)  ? "avg_monthly_" : "";

    const normalized = {
        label: granularity === "month" ? formatMonthYear(row.year, row.month) : row.year,
        sortKey: granularity === "month" ? row.year * 12 + row.month : row.year,
        incomeBySource: row[`${prefix}income_by_source`] || {},
        cashIncome: row[`${prefix}cash_income`],
        investmentIncome: row[`${prefix}investment_gains`],
        totalIncome: row[`${prefix}total_income`],
        spending: row[`${prefix}spending`],
        cashSavings: row[`${prefix}cash_savings`],
        totalSavings: row[`${prefix}total_savings`],
    };

    normalized.incomeBySource = sourceIds.reduce((memo, sourceId) => {
        memo[String(sourceId)] = normalized.incomeBySource[String(sourceId)] || 0;
        return memo;
    }, {});

    return normalized;
}

function buildColumnDescriptors(incomeSources, expanded) {
    const columns = [];
    columns.push({label: "", isCurrency: false, canBeNeg: false, dividerAfter: true, getValue: row => row.label});

    if (expanded) {
        incomeSources.forEach((source, i) => {
            const isLast = i === incomeSources.length - 1;
            columns.push({
                label: source.name, isCurrency: true, canBeNeg: false,
                dividerAfter: isLast,   // line after the last income source ("Other")
                getValue: row => row.incomeBySource[String(source.id)] || 0
            });
        });
    }
    columns.push({label: "Cash Income", isCurrency: true, canBeNeg: false, isToggle: true, getValue: row => row.cashIncome});

    columns.push({label: "Investment Gains", isCurrency: true, canBeNeg: true, getValue: row => row.investmentIncome});
    columns.push({label: "Total Income", isCurrency: true, canBeNeg: false, dividerAfter: true, getValue: row => row.totalIncome});
    columns.push({label: "Spending", isCurrency: true, canBeNeg: false, dividerAfter: true, getValue: row => row.spending});
    columns.push({label: "Cash Increase", isCurrency: true, canBeNeg: true, getValue: row => row.cashSavings});
    columns.push({label: "Total Increase", isCurrency: true, canBeNeg: true, getValue: row => row.totalSavings});
    return columns;
}

// Builds tables for the page
function buildTables(data, granularity, expanded) {
    if (!data || !Array.isArray(data.rows) || data.rows.length === 0) {
        return `<p>No savings summary data available.</p>`;
    }
    // if granularity is set to year, build two tables, otherwise just need one
    table1 = buildSavingsTable(data, granularity, expanded);
    table2 = granularity === "year" ? buildSavingsTable(data, granularity, expanded, true) : ``;
    return `${table1} ${table2}`;
}

// Generic function to build a table, can build any of the 3 established versions (monthly, averages, or totals)
function buildSavingsTable(data, granularity, expanded, useTotals = false) {
    const incomeSources = Array.isArray(data.income_sources) ? data.income_sources : [];
    const sourceIds = incomeSources.map(source => source.id);
    
    const normalizedRows = data.rows
        .map(row => normalizeSavingsRow(row, granularity, sourceIds, useTotals))
        .sort((a, b) => b.sortKey - a.sortKey);

    const columns = buildColumnDescriptors(incomeSources, expanded);
    columns[0].label = granularity === "month" ? "Month" : "Year";
    const headerName = granularity === "month" ? "Monthly Totals" : useTotals ? "Yearly Totals" : "Monthly Averages";
    
    return buildTable(normalizedRows, columns, {
        title: headerName,
        tableClass: "data-table savings-summary-table",
        wrapperClass: "table-wrapper savings-summary-wrapper",
        expanded
    });
}

async function loadSavingsSummary(granularity = DEFAULT_GRANULARITY) {
    const container = document.getElementById("savings");
    if (!container) { return; }

    const expanded = getSavedExpandedState();
    localStorage.setItem(STORAGE_KEYS.granularity, granularity);
    container.innerHTML = `<div class="savings-summary-loading">Loading ${granularity} summary...</div>`;

    try {
        const response = await fetch(getSavingsSummaryUrl(granularity));
        if (!response.ok) {
            throw new Error("Unable to load savings summary");
        }

        const data = await response.json();
        lastSavingsData = data;
        lastGranularity = granularity;
        const toggleContainer = document.getElementById("savings-toggle");
        if (toggleContainer) toggleContainer.innerHTML = buildToggleButtons(granularity);
        container.innerHTML = buildTables(data, granularity, expanded);
        initSelectableTable(container);
        renderSavingsCharts(data, granularity);

        document.querySelectorAll("#savings-toggle .savings-toggle-button").forEach(button => {
            button.addEventListener("click", () => {
                const selectedGranularity = button.dataset.granularity;
                if (selectedGranularity && selectedGranularity !== granularity) {
                    loadSavingsSummary(selectedGranularity);
                }
            });
        });

        const toggles = container.querySelectorAll(".expand-toggle");
        toggles.forEach(toggle => {
            toggle.addEventListener("click", () => {
                setSavedExpandedState(!expanded);
                loadSavingsSummary(granularity);
            });
        });
    } catch (error) {
        container.innerHTML = `<p>${error.message}</p>`;
        renderSavingsCharts(null, granularity);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();

    const viewToggle = document.getElementById("savings-view-toggle");
    viewToggle.addEventListener("click", (event) => {
        const button = event.target.closest("[data-view]");
        if (!button) return;
        setSavedView(button.dataset.view);
        applyView(button.dataset.view);
    });
    applyView(getSavedView());

    const includeGainsBox = document.getElementById("savings-include-gains");
    if (includeGainsBox) {
        includeGainsBox.checked = getSavedIncludeGains();
        includeGainsBox.addEventListener("change", () => {
            setSavedIncludeGains(includeGainsBox.checked);
            if (lastSavingsData) renderSavingsCharts(lastSavingsData, lastGranularity);
        });
    }
    const savedGranularity = localStorage.getItem(STORAGE_KEYS.granularity) || DEFAULT_GRANULARITY;
    await loadSavingsSummary(savedGranularity);
});
