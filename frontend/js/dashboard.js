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
        netWorth.className = "dashboard-card";
        netWorth.innerHTML = `
            <h2>Net Worth</h2>
            <p>${formatCurrency(dashboard.net_worth || 0)}</p>
        `;
        container.appendChild(netWorth);

        const categories = document.createElement("div");
        categories.className = "dashboard-grid";
        categories.innerHTML = `
            <div class="dashboard-card"><h3>Retirement</h3><p>${formatCurrency(dashboard.categories?.retirement || 0)}</p></div>
            <div class="dashboard-card"><h3>Non-retirement</h3><p>${formatCurrency(dashboard.categories?.non_retirement || 0)}</p></div>
            <div class="dashboard-card"><h3>Cash</h3><p>${formatCurrency(dashboard.categories?.cash || 0)}</p></div>
            <div class="dashboard-card"><h3>Spendable</h3><p>${formatCurrency(dashboard.categories?.spendable || 0)}</p></div>
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
