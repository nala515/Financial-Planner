const DEFAULT_GRANULARITY = "month";
const STORAGE_KEYS = {
    granularity: "savingsSummaryGranularity",
    expanded: "savingsSummaryExpanded"
};

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

function normalizeSavingsRow(row, granularity, sourceIds) {
    const normalized = {
        label: granularity === "month" ? formatMonthYear(row.year, row.month) : row.year,
        sortKey: granularity === "month" ? row.year * 12 + row.month : row.year,
        incomeBySource: row.income_by_source || {},
        cashIncome: granularity === "month" ? row.cash_income : row.avg_monthly_cash_income,
        investmentIncome: granularity === "month" ? row.investment_gains : row.avg_monthly_investment_gains,
        totalIncome: granularity === "month" ? row.total_income : row.avg_monthly_total_income,
        spending: granularity === "month" ? row.spending : row.avg_monthly_spending,
        cashSavings: granularity === "month" ? row.cash_savings : row.avg_monthly_cash_savings,
        totalSavings: granularity === "month" ? row.total_savings : row.avg_monthly_total_savings,
    };

    normalized.incomeBySource = sourceIds.reduce((memo, sourceId) => {
        memo[String(sourceId)] = normalized.incomeBySource[String(sourceId)] || 0;
        return memo;
    }, {});

    return normalized;
}

function buildColumnDescriptors(incomeSources, expanded) {
    const columns = [];
    columns.push({label: "", isCurrency: false, getValue: row => row.label});

    if (expanded) {
        incomeSources.forEach(source => {
            columns.push({label: source.name, isCurrency: true, getValue: row => row.incomeBySource[String(source.id)] || 0});
        });
    }
    columns.push({label: "Cash Income", isCurrency: true, isToggle: true, getValue: row => row.cashIncome});

    columns.push({label: "Investment Gains", isCurrency: true, getValue: row => row.investmentIncome});
    columns.push({label: "Total Income", isCurrency: true, getValue: row => row.totalIncome});
    columns.push({label: "Spending", isCurrency: true, getValue: row => row.spending});
    columns.push({label: "Cash Savings", isCurrency: true, getValue: row => row.cashSavings});
    columns.push({label: "Total Increase", isCurrency: true, getValue: row => row.totalSavings});
    return columns;
}

function buildMonthlyAvgsTable(data, granularity, expanded) {
    if (!data || !Array.isArray(data.rows) || data.rows.length === 0) {
        return `<p>No savings summary data available.</p>`;
    }

    const incomeSources = Array.isArray(data.income_sources) ? data.income_sources : [];
    const sourceIds = incomeSources.map(source => source.id);

    const normalizedRows = data.rows
        .map(row => normalizeSavingsRow(row, granularity, sourceIds))
        .sort((a, b) => b.sortKey - a.sortKey);

    const columns = buildColumnDescriptors(incomeSources, expanded);
    columns[0].label = granularity === "month" ? "Month" : "Year";

    const headerCells = columns.map(col => {
        const label = col.isToggle ? addExpandCollapseMarker(col.label, "", expanded) : col.label;
        return `<th>${label}</th>`;
    }).join("");

    const bodyRows = normalizedRows.map(row => `
        <tr class="table-data-row">
            ${columns.map(col => {
                const value = col.getValue(row);
                return `<td>${col.isCurrency ? formatCurrency(value) : value}</td>`;
            }).join("")}
        </tr>
    `).join("");

    return `
        <div class="table-wrapper savings-summary-wrapper">
            <table class="data-table savings-summary-table">
                <thead><tr>${headerCells}</tr></thead>
                <tbody>${bodyRows}</tbody>
            </table>
        </div>
    `;
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
        container.innerHTML = `${buildToggleButtons(granularity)}${buildMonthlyAvgsTable(data, granularity, expanded)}`;

        container.querySelectorAll(".savings-toggle-button").forEach(button => {
            button.addEventListener("click", () => {
                const selectedGranularity = button.dataset.granularity;
                if (selectedGranularity && selectedGranularity !== granularity) {
                    loadSavingsSummary(selectedGranularity);
                }
            });
        });

        const toggle = container.querySelector(".expand-toggle");
        if (toggle) {
            toggle.addEventListener("click", () => {
                setSavedExpandedState(!expanded);
                loadSavingsSummary(granularity);
            });
        }
    } catch (error) {
        container.innerHTML = `<p>${error.message}</p>`;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();
    const savedGranularity = localStorage.getItem(STORAGE_KEYS.granularity) || DEFAULT_GRANULARITY;
    await loadSavingsSummary(savedGranularity);
});
