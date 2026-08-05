//-----------------------------------------------------
// Dashboard
//-----------------------------------------------------

// Assuming dates are in YYYY-MM-DD format
const sortedDates = Object.keys(rowsByDate).sort().reverse();
const currentMonth = sortedDates;
const lastMonth = sortedDates[2]; // One month ago
const lastYear = sortedDates[3]; // Twelve months ago

function generateCategoryCard(categoryName, accountsInCategory) {
    let currentTotal = 0;
    let monthAgoTotal = 0;
    let yearAgoTotal = 0;

    accountsInCategory.forEach(acc => {
        currentTotal += (rowsByDate[currentMonth]?.[acc.id] || 0);
        monthAgoTotal += (rowsByDate[lastMonth]?.[acc.id] || 0);
        yearAgoTotal += (rowsByDate[lastYear]?.[acc.id] || 0);
    });

    return `
        <div class="dashboard-card">
            <h3>${categoryName}</h3>
            <p class="main-balance">${formatCurrency(currentTotal)}</p>
            <div class="growth-stats">
                <div>1M: ${renderGrowth(currentTotal, monthAgoTotal)}</div>
                <div>1Y: ${renderGrowth(currentTotal, yearAgoTotal)}</div>
            </div>
        </div>
    `;
}

function renderGrowth(currentCents, pastCents) {
    if (pastCents === undefined || pastCents === null) return `<span class="growth-neutral">--</span>`;
    
    const diff = currentCents - pastCents;
    const isPositive = diff >= 0;
    const arrow = isPositive ? '▲' : '▼';
    const colorClass = isPositive ? 'growth-up' : 'growth-down';

    return `
        <span class="${colorClass}">
            ${arrow} ${formatCurrency(Math.abs(diff))}
        </span>
    `;
}


async function loadDashboard() {
    const container = document.getElementById("dashboard");

    if (!container) {
        return;
    }

    try {
        const response = await fetch(`/api/dashboard`);
        if (!response.ok) {
            throw new Error("Unable to load dashboard");
        }

        const dashboard = await response.json();
        container.innerHTML = "";

        const netWorth = document.createElement("div");
        netWorth.className = "dashboard-card";
        netWorth.innerHTML = `
            <h2>Net Worth</h2>
            <p>${formatCurrency(dashboard.net_worth || 0)}</p>
        `;
        container.appendChild(netWorth);

        const categories = document.createElement("div");
        categories.className = "dashboard-grid";

        const ret = dashboard.categories?.retirement || { current: 0, "1m": 0, "1y": 0 };
        const nonRet = dashboard.categories?.non_retirement || { current: 0, "1m": 0, "1y": 0 };
        const cash = dashboard.categories?.cash || { current: 0, "1m": 0, "1y": 0 };
        const spend = dashboard.categories?.spendable || { current: 0, "1m": 0, "1y": 0 };
        categories.innerHTML = `
            <div class="dashboard-card">
                <h3>Retirement</h3>
                <p class="main-balance">${formatCurrency(ret.current)}</p>
                <div class="growth-stats">
                    <span>1M: ${renderGrowth(ret.current, ret['1m'])}</span>
                    <span>1Y: ${renderGrowth(ret.current, ret['1y'])}</span>
                </div>
            </div>
            <div class="dashboard-card">
                <h3>Non-retirement</h3>
                <p class="main-balance">${formatCurrency(nonRet.current)}</p>
                <div class="growth-stats">
                    <span>1M: ${renderGrowth(nonRet.current, nonRet['1m'])}</span>
                    <span>1Y: ${renderGrowth(nonRet.current, nonRet['1y'])}</span>
                </div>
            </div>
            <div class="dashboard-card">
                <h3>Cash</h3>
                <p class="main-balance">${formatCurrency(cash.current)}</p>
                <div class="growth-stats">
                    <span>1M: ${renderGrowth(cash.current, cash['1m'])}</span>
                    <span>1Y: ${renderGrowth(cash.current, cash['1y'])}</span>
                </div>
            </div>
            <div class="dashboard-card">
                <h3>Spendable</h3>
                <p class="main-balance">${formatCurrency(spend.current)}</p>
                <div class="growth-stats">
                    <span>1M: ${renderGrowth(spend.current, spend['1m'])}</span>
                    <span>1Y: ${renderGrowth(spend.current, spend['1y'])}</span>
                </div>
            </div>
        `;
        container.appendChild(categories);
    } catch (error) {
        container.innerHTML = `<p>${error.message}</p>`;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();
    loadDashboard();
});
