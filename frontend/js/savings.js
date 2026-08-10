const DEFAULT_GRANULARITY = "month";

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

// Converts a raw API row (monthly or yearly shape) into one common shape so
// the rendering code doesn't need to branch on granularity for every field.
function normalizeSavingsRow(row, granularity) {
    if (granularity === "month") {
        return {
            label: formatMonthYear(row.year, row.month),
            sortKey: row.year * 12 + row.month,
            cashIncome: row.cash_income,
            totalIncome: row.total_income,
            expenses: row.expenses,
            cashSavings: row.cash_savings,
            totalSavings: row.total_savings
        };
    }

    return {
        label: row.year,
        sortKey: row.year,
        cashIncome: row.avg_monthly_cash_income,
        totalIncome: row.avg_monthly_total_income,
        expenses: row.avg_monthly_expenses,
        cashSavings: row.avg_monthly_cash_savings,
        totalSavings: row.avg_monthly_total_savings
    };
}

function buildSavingsTable(rows, granularity) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return `<p>No savings summary data available.</p>`;
    }

    const normalizedRows = rows
        .map(row => normalizeSavingsRow(row, granularity))
        .sort((a, b) => b.sortKey - a.sortKey);

    const headerLabel = granularity === "month" ? "Month" : "Year";

    const bodyRows = normalizedRows.map(row => `
        <tr class="table-data-row">
            <td>${row.label}</td>
            <td>${formatCurrency(row.cashIncome)}</td>
            <td>${formatCurrency(row.totalIncome)}</td>
            <td>${formatCurrency(row.expenses)}</td>
            <td>${formatCurrency(row.cashSavings)}</td>
            <td>${formatCurrency(row.totalSavings)}</td>
        </tr>
    `).join("");

    return `
        <div class="table-wrapper savings-summary-wrapper">
            <table class="data-table savings-summary-table">
                <thead>
                    <tr>
                        <th>${headerLabel}</th>
                        <th>Cash Income</th>
                        <th>Total Income</th>
                        <th>Expenses</th>
                        <th>Cash Savings</th>
                        <th>Total Savings</th>
                    </tr>
                </thead>
                <tbody>
                    ${bodyRows}
                </tbody>
            </table>
        </div>
    `;
}

async function loadSavingsSummary(granularity = DEFAULT_GRANULARITY) {
    const container = document.getElementById("savings");
    if (!container) {
        return;
    }

    localStorage.setItem("savingsSummaryGranularity", granularity);
    container.innerHTML = `<div class="savings-summary-loading">Loading ${granularity} summary...</div>`;

    try {
        const response = await fetch(getSavingsSummaryUrl(granularity));
        if (!response.ok) {
            throw new Error("Unable to load savings summary");
        }

        const rows = await response.json();
        container.innerHTML = `${buildToggleButtons(granularity)}${buildSavingsTable(rows, granularity)}`;

        container.querySelectorAll(".savings-toggle-button").forEach(button => {
            button.addEventListener("click", () => {
                const selectedGranularity = button.dataset.granularity;
                if (selectedGranularity && selectedGranularity !== granularity) {
                    loadSavingsSummary(selectedGranularity);
                }
            });
        });
    } catch (error) {
        container.innerHTML = `<p>${error.message}</p>`;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();
    const savedGranularity = localStorage.getItem("savingsSummaryGranularity") || DEFAULT_GRANULARITY;
    await loadSavingsSummary(savedGranularity);
});