//-----------------------------------------------------
// Utilities
//-----------------------------------------------------

const DASHBOARD_BLURBS = {
    net_worth: "All assets minus all debts.",
    retirement: "Retirement and HSA accounts only.",
    non_retirement: "Everything outside retirement funds.",
    cash: "Checking and savings balances only.",
    spendable: "Cash and investments you could spend."
};

function renderDashboardCard(key, data, { heading = "h3", mainClass = "main-balance" } = {}) {
    const d = data || { current: 0, "1m": 0, "1y": 0 };
    const blurb = DASHBOARD_BLURBS[key];
    return `
        <div class="dashboard-card">
            <${heading}>${formatTypeLabel(key)}</${heading}>
            ${blurb ? `<p class="dashboard-blurb">${blurb}</p>` : ""}
            <p class="${mainClass}">${formatCurrency(d.current)}</p>
            <div class="growth-stats">
                <small><span>1M: ${renderGrowth(d.current, d["1m"])}</span></small>
                <small><span>1Y: ${renderGrowth(d.current, d["1y"])}</span></small>
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
        container.innerHTML = renderDashboardCard("net_worth", dashboard.net_worth, { heading: "h2", mainClass: "" });
        
        const keys = ["retirement", "non_retirement", "cash", "spendable"];
        const grid = document.createElement("div");
        grid.className = "dashboard-grid";
        grid.innerHTML = keys.map(key => renderDashboardCard(key, dashboard.categories[key])).join("");
        container.appendChild(grid);
    } catch (error) {
        container.innerHTML = `<p>${error.message}</p>`;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();
    loadDashboard();
});
