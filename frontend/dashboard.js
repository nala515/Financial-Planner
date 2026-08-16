//-----------------------------------------------------
// Utilities
//-----------------------------------------------------

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

function formatTypeLabel(key) { 
    // Example: "net_worth" -> "Net Worth", "spendable" -> "Spendable"
    return key
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

//-----------------------------------------------------
// Dashboard
//-----------------------------------------------------

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
            <p>${formatCurrency(nw.current)}</p>
            <div class="growth-stats">
                <small><span>1M: ${renderGrowth(nw.current, nw['1m'])}</span></small>
                <small><span>1Y: ${renderGrowth(nw.current, nw['1y'])}</span></small>
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
                        <small><span>1M: ${renderGrowth(data.current, data['1m'])}</span></small>
                        <small><span>1Y: ${renderGrowth(data.current, data['1y'])}</span></small>
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
