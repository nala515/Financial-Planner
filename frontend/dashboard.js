//-----------------------------------------------------
// Utilities
//-----------------------------------------------------

const DASHBOARD_BLURBS = {
    net_worth: "All assets minus all debts.",
    retirement: "Retirement and HSA accounts only.",
    non_retirement: "Cash and investments, includes 529 but not HSA.",
    cash: "Checking and savings balances only.",
    spendable: "Cash and investments you could spend."
};

function renderDashboardCard(key, data, { heading = "h3", mainClass = "main-balance" } = {}) {
    const d = data || { current: 0, "1m": 0, "1y": 0 };
    const blurb = DASHBOARD_BLURBS[key];
    const href = `/balances?filter=${encodeURIComponent(key)}`;
    return `
        <div class="dashboard-card">
            <${heading}>${formatTypeLabel(key)}</${heading}>
            ${blurb ? `<p class="dashboard-blurb">${blurb}</p>` : ""}
            <p class="${mainClass}">${formatCurrency(d.current)}</p>
            <div class="growth-stats">
                <small><span>1M: ${renderGrowth(d.current, d["1m"])}</span></small>
                <small><span>1Y: ${renderGrowth(d.current, d["1y"])}</span></small>
            </div>
            <small class="dashboard-card-link"><a href="${href}">View balances</a></small>
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

function renderMonthlyChange(data) {
    const rows = [
        { label: "Previous month's net worth", value: data.previous_net_worth },
        { label: "Contributions", value: data.contributions },
        { label: "Investment gains", value: data.investment_gains, signed: true },
        { label: "Spending", value: data.spending },
        { label: "This month's net worth", value: data.current_net_worth, bold: true },
    ];

    const items = rows.map(row => {
        let valueHtml;
        if (row.value === null || row.value === undefined) {
            valueHtml = `<span class="growth-neutral">--</span>`;
        } else if (row.signed) {
            valueHtml = `<span ${getGrowthFormatting(row.value)}>${formatCurrency(row.value)}</span>`;
        } else {
            valueHtml = formatCurrency(row.value);
        }
        return `
            <div class="monthly-change-item">
                <div class="monthly-change-label">${row.label}</div>
                <div class="monthly-change-value${row.bold ? " monthly-change-total" : ""}">${valueHtml}</div>
            </div>`;
    }).join("");

    const period = `${formatMonthYearLabel(data.previous_month)} to ${formatMonthYearLabel(data.current_month)}`;
    return `
        <div class="dashboard-card monthly-change">
            <h2>Monthly Change</h2>
            <p class="dashboard-blurb">${period}</p>
            ${items}
        </div>`;
}

async function loadMonthlyChange(container) {
    try {
        const response = await fetch(`/api/dashboard/monthly-change`);
        if (!response.ok) {
            throw new Error("Unable to load monthly change");
        }
        const data = await response.json();
        if (!data) {
            return;
        }
        const section = document.createElement("div");
        section.innerHTML = renderMonthlyChange(data);
        container.appendChild(section);
    } catch (error) {
        const message = document.createElement("p");
        message.textContent = error.message;
        container.appendChild(message);
    }
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
        
        const keys = Object.keys(dashboard.categories)
        const grid = document.createElement("div");
        grid.className = "dashboard-grid";
        grid.innerHTML = keys.map(key => renderDashboardCard(key, dashboard.categories[key])).join("");
        container.appendChild(grid);
        await loadMonthlyChange(container);
    } catch (error) {
        container.innerHTML = `<p>${error.message}</p>`;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();
    loadDashboard();
});
