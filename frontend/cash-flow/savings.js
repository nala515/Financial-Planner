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
    columns.push({label: "", isCurrency: false, canBeNeg: false, getValue: row => row.label});

    if (expanded) {
        incomeSources.forEach(source => {
            columns.push({label: source.name, isCurrency: true, canBeNeg: false, getValue: row => row.incomeBySource[String(source.id)] || 0});
        });
    }
    columns.push({label: "Cash Income", isCurrency: true, canBeNeg: false, isToggle: true, getValue: row => row.cashIncome});

    columns.push({label: "Investment Gains", isCurrency: true, canBeNeg: true, getValue: row => row.investmentIncome});
    columns.push({label: "Total Income", isCurrency: true, canBeNeg: false, getValue: row => row.totalIncome});
    columns.push({label: "Spending", isCurrency: true, canBeNeg: false, getValue: row => row.spending});
    columns.push({label: "Cash Savings", isCurrency: true, canBeNeg: true, getValue: row => row.cashSavings});
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
        container.innerHTML = `${buildToggleButtons(granularity)}${buildTables(data, granularity, expanded)}`;

        container.querySelectorAll(".savings-toggle-button").forEach(button => {
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
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();
    const savedGranularity = localStorage.getItem(STORAGE_KEYS.granularity) || DEFAULT_GRANULARITY;
    await loadSavingsSummary(savedGranularity);
    initSelectableTable(document.getElementById('savings'));
});
