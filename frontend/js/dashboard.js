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
    const colorClass = isPositive ? 'growth-positive' : 'growth-negative';

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
        const nw = dashboard.net_worth || { current: 0, "1m": 0, "1y": 0 };
        netWorth.className = "dashboard-card";
        netWorth.innerHTML = `
            <h2>Net Worth</h2>
            <p>${formatCurrency(dashboard.nw.current)}</p>
            <div class="growth-stats">
                <span>1M: ${renderGrowth(nw.current, nw['1m'])}</span>
                <span>1Y: ${renderGrowth(nw.current, nw['1y'])}</span>
            </div>
        `;
        container.appendChild(netWorth);

        const categories = document.createElement("div");
        categories.className = "dashboard-grid";

        const keys = ["retirement", "non_retirement", "cash", "spendable"];
        categories.innerHTML = keys.map(key => {
            const data = dashboard.categories[key] || { current: 0, "1m": 0, "1y": 0 };
            return `
                <div class="dashboard-card">
                    <h3>${formatTypeLabel(key)}</h3>
                    <p class="main-balance">${formatCurrency(data.current)}</p>
                    <div class="growth-stats">
                        <span>1M: ${renderGrowth(data.current, data['1m'])}</span>
                        <span>1Y: ${renderGrowth(data.current, data['1y'])}</span>
                    </div>
                </div>
            `;
        }).join('');
        container.appendChild(categories);
    } catch (error) {
        container.innerHTML = `<p>${error.message}</p>`;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();
    loadDashboard();
});
