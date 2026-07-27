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

//-----------------------------------------------------
// Summary (Balance + Contributions + Growth)
//-----------------------------------------------------

async function loadSummary() {
    const selector = document.getElementById("account-selector");
    const tbody = document.getElementById("summary-body");

    if (!selector || !tbody) {
        return;
    }

    try {
        const response = await fetch(`/api/accounts`);

        if (!response.ok) {
            throw new Error("Unable to load accounts");
        }

        const accounts = await response.json();
        selector.innerHTML = "";

        if (!Array.isArray(accounts) || accounts.length === 0) {
            selector.innerHTML = '<option value="">No accounts available</option>';
            tbody.innerHTML = '<tr><td colspan="4">No accounts found yet.</td></tr>';
            return;
        }

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "Select an account";
        selector.appendChild(defaultOption);

        accounts.forEach(account => {
            const option = document.createElement("option");
            option.value = account.id;
            option.textContent = account.name;
            selector.appendChild(option);
        });

        const params = new URLSearchParams(window.location.search);
        const accountId = getSelectedAccountId();

        if (accountId) {
            selector.value = accountId;
            await loadSummaryForAccount(accountId);
        }
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4">${error.message}</td></tr>`;
    }
}

async function loadSummaryForAccount(accountId) {
    const tbody = document.getElementById("summary-body");

    if (!tbody) {
        return;
    }

    if (!accountId) {
        tbody.innerHTML = '<tr><td colspan="4">No account selected.</td></tr>';
        return;
    }

    try {
        // Assumption: pull full history. Adjust the start date if you'd
        // rather default to something like "this year" or the account's
        // creation date.
        const start = "2000-01-01";
        const end = new Date().toISOString().split("T")[0];

        const response = await fetch(
            `/api/accounts/${accountId}/summary?start=${start}&end=${end}`
        );

        if (!response.ok) {
            throw new Error("Unable to load summary");
        }

        const rows = await response.json();
        tbody.innerHTML = "";

        if (!Array.isArray(rows) || rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No monthly data found.</td></tr>';
            return;
        }

        const sortedRows = [...rows].sort(
            (a, b) => new Date(b.month) - new Date(a.month)
        );

        const groupedRows = sortedRows.reduce((groups, row) => {
            const year = formatYearLabel(row.month);
            if (!groups[year]) {
                groups[year] = [];
            }
            groups[year].push(row);
            return groups;
        }, {});

        const years = Object.keys(groupedRows).sort((a, b) => Number(b) - Number(a));

        years.forEach(year => {
            const yearRow = document.createElement("tr");
            yearRow.className = "summary-year-row";
            yearRow.innerHTML = `<td colspan="4">${year}</td>`;
            tbody.appendChild(yearRow);

            groupedRows[year].forEach(row => {
                const tr = document.createElement("tr");
                tr.className = "summary-data-row";

                const growthClass =
                    row.investment_return > 0 ? "growth-positive" :
                    row.investment_return < 0 ? "growth-negative" :
                    "growth-neutral";

                tr.innerHTML = `
                    <td>${formatMonthLabel(row.month)}</td>
                    <td>${formatCurrency(row.ending_balance)}</td>
                    <td>${formatCurrency(row.contributions)}</td>
                    <td class="${growthClass}">${formatCurrency(row.growth)}</td>
                    <td class="${growthClass}">${formatCurrency(row.investment_return)}</td>
                `;
                tbody.appendChild(tr);
            });
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4">${error.message}</td></tr>`;
    }
}

//-----------------------------------------------------
// Utilities
//-----------------------------------------------------

function getSelectedAccountId() {
    return localStorage.getItem("selectedAccount");
}

function setSelectedAccountId(accountId) {
    localStorage.setItem("selectedAccount", accountId);
}

function formatCurrency(cents) {
    return (cents / 100).toLocaleString("en-US", {
        style: "currency",
        currency: "USD"
    });
}

function formatMonthLabel(snapshotDate) {
    const date = new Date(snapshotDate);
    return date.toLocaleDateString("en-US", { month: "long" });
}

function formatYearLabel(snapshotDate) {
    const date = new Date(snapshotDate);
    return date.getFullYear().toString();
}

//-----------------------------------------------------
// Initialization
//-----------------------------------------------------

// nothing currently
