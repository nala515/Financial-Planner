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

// Builds tables for the page
function buildTables(data, granularity, expanded) {
    if (!data || !Array.isArray(data.rows) || data.rows.length === 0) {
        return `<p>No savings summary data available.</p>`;
    }
    // if granularity is set to year, build two tables, otherwise just need one
    table1 = buildTable(data, granularity, expanded);
    table2 = granularity === "year" ? buildTable(data, expanded, true) : ``;
    return `${table1} ${table2}`;
}

// Generic function to build a table, can build any of the 3 established versions (monthly, averages, or totals)
function buildTable(data, granularity, expanded, useTotals = false) {
    const incomeSources = Array.isArray(data.income_sources) ? data.income_sources : [];
    const sourceIds = incomeSources.map(source => source.id);
    
    const normalizedRows = data.rows
        .map(row => normalizeSavingsRow(row, granularity, sourceIds, useTotals))
        .sort((a, b) => b.sortKey - a.sortKey);

    const columns = buildColumnDescriptors(incomeSources, expanded);
    columns[0].label = granularity === "month" ? "Month" : "Year";

    const headerName = granularity === "month" ? "Monthly Totals" : useTotals ? "Yearly Totals" : "Monthly Averages";
    
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
    
    return `<div class="table-wrapper savings-summary-wrapper">
                <table class="data-table savings-summary-table">
                    <h2>${headerName}</h2>
                    <thead><tr>${headerCells}</tr></thead>
                    <tbody>${bodyRows}</tbody>
                </table>
            </div>`;
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
});
