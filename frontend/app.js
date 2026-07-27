//-----------------------------------------------------
// Accounts
//-----------------------------------------------------

let accountCache = [];

function populateAccountCategoryOptions(select) {
    if (!select) {
        return;
    }

    const categories = ["Cash", "Investment", "Retirement", "HSA", "529"];
    select.innerHTML = "";

    categories.forEach(category => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
    });
}

function populateAccountForm(account) {
    const selector = document.getElementById("account-selector");
    const nameInput = document.getElementById("account-name");
    const categorySelect = document.getElementById("account-category");
    const sharedInput = document.getElementById("account-shared");

    if (!account || !selector || !nameInput || !categorySelect || !sharedInput) {
        return;
    }

    selector.value = account.id;
    nameInput.value = account.name || "";
    categorySelect.value = account.category || "Cash";
    sharedInput.checked = Boolean(account.shared);
}

async function loadAccounts() {
    const div = document.getElementById("accounts");
    const selector = document.getElementById("account-selector");

    if (!div) {
        return;
    }

    try {
        const response = await fetch(`/api/accounts`);

        if (!response.ok) {
            throw new Error("Unable to load accounts");
        }

        const accounts = await response.json();
        accountCache = Array.isArray(accounts) ? accounts : [];
        div.innerHTML = "";

        if (!Array.isArray(accounts) || accounts.length === 0) {
            div.innerHTML = "<p>No accounts found yet.</p>";
            if (selector) {
                selector.innerHTML = '<option value="">Select an account</option>';
            }
            return;
        }

        const list = document.createElement("ul");
        list.className = "account-list";

        if (selector) {
            selector.innerHTML = '<option value="">Select an account</option>';
            populateAccountCategoryOptions(document.getElementById("account-category"));

            accounts.forEach(account => {
                const option = document.createElement("option");
                option.value = account.id;
                option.textContent = account.name;
                selector.appendChild(option);
            });

            const selectedAccountId = selector.value || accountCache[0]?.id;
            if (selectedAccountId) {
                const selectedAccount = accountCache.find(account => account.id === Number(selectedAccountId));
                if (selectedAccount) {
                    populateAccountForm(selectedAccount);
                }
            }
        }

        accounts.forEach(account => {
            const item = document.createElement("li");
            item.className = "account-card";
            item.innerHTML = `
                <strong>${account.name}</strong>
                <small>${account.category || "Cash"}</small>
                <small>${account.shared ? "Shared" : "Personal"}</small>
                <small>${account.category_attributes?.retirement ? "Retirement" : "Non-retirement"}</small>
                <a href="/balances?accountId=${account.id}">View balances</a>
            `;
            list.appendChild(item);
        });

        div.appendChild(list);
    } catch (error) {
        div.innerHTML = `<p>${error.message}</p>`;
    }
}

async function handleAccountUpdate(event) {
    event.preventDefault();

    const selector = document.getElementById("account-selector");
    const status = document.getElementById("account-form-status");
    const nameInput = document.getElementById("account-name");
    const categorySelect = document.getElementById("account-category");
    const sharedInput = document.getElementById("account-shared");

    if (!selector || !status || !nameInput || !categorySelect || !sharedInput) {
        return;
    }

    const accountId = selector.value;
    if (!accountId) {
        status.textContent = "Please select an account first.";
        return;
    }

    const payload = {
        name: nameInput.value.trim(),
        shared: sharedInput.checked,
        category: categorySelect.value,
    };

    try {
        const response = await fetch(`/api/accounts/${accountId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error("Unable to update account");
        }

        status.textContent = "Account updated.";
        await loadAccounts();
    } catch (error) {
        status.textContent = error.message;
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
// Balances
//-----------------------------------------------------

async function loadBalances() {
    const container = document.getElementById("balances");
    const selector = document.getElementById("account-selector");

    if (!container || !selector) {
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
            container.innerHTML = "<p>No accounts found yet.</p>";
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
        const accountId = params.get("accountId");

        if (accountId) {
            selector.value = accountId;
            await loadBalancesForAccount(accountId, container);
        }
    } catch (error) {
        container.innerHTML = `<p>${error.message}</p>`;
    }
}

async function loadBalancesForAccount(accountId, container) {
    if (!accountId) {
        container.innerHTML = "<p>No account selected.</p>";
        return;
    }

    try {
        const response = await fetch(`/api/accounts/${accountId}/balances`);

        if (!response.ok) {
            throw new Error("Unable to load balances");
        }

        const balances = await response.json();
        container.innerHTML = "";

        if (!Array.isArray(balances) || balances.length === 0) {
            container.innerHTML = "<p>No monthly balances found.</p>";
            return;
        }

        const sortedBalances = [...balances].sort((a, b) => new Date(b.snapshot_date) - new Date(a.snapshot_date));
        const groupedBalances = sortedBalances.reduce((groups, balance) => {
            const year = formatYearLabel(balance.snapshot_date);
            if (!groups[year]) {
                groups[year] = [];
            }
            groups[year].push(balance);
            return groups;
        }, {});

        const years = Object.keys(groupedBalances).sort((a, b) => Number(b) - Number(a));
        const list = document.createElement("ul");
        list.className = "account-list";

        years.forEach(year => {
            const yearSection = document.createElement("li");
            yearSection.className = "account-card year-section";
            yearSection.innerHTML = `<strong>${year}</strong>`;
            list.appendChild(yearSection);

            groupedBalances[year].forEach(balance => {
                const item = document.createElement("li");
                item.className = "account-card balance-row";
                item.innerHTML = `
                    <span>${formatMonthLabel(balance.snapshot_date)}</span>
                    <span>${formatCurrency(balance.balance_cents)}</span>
                `;
                list.appendChild(item);
            });
        });

        container.appendChild(list);
    } catch (error) {
        container.innerHTML = `<p>${error.message}</p>`;
    }
}

//-----------------------------------------------------
// Contributions
//-----------------------------------------------------

async function loadContributions() {
    const container = document.getElementById("contributions");
    const selector = document.getElementById("account-selector");

    if (!container || !selector) {
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
            container.innerHTML = "<p>No accounts found yet.</p>";
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
        const accountId = params.get("accountId");

        if (accountId) {
            selector.value = accountId;
            await loadContributionsForAccount(accountId, container);
        }
    } catch (error) {
        container.innerHTML = `<p>${error.message}</p>`;
    }
}

async function loadContributionsForAccount(accountId, container) {
    if (!accountId) {
        container.innerHTML = "<p>No account selected.</p>";
        return;
    }

    try {
        const response = await fetch(`/api/accounts/${accountId}/contributions`);

        if (!response.ok) {
            throw new Error("Unable to load contributions");
        }

        const contributions = await response.json();
        container.innerHTML = "";

        if (!Array.isArray(contributions) || contributions.length === 0) {
            container.innerHTML = "<p>No monthly contributions found.</p>";
            return;
        }

        const sortedContributions = [...contributions].sort((a, b) => new Date(b.date) - new Date(a.date));
        const groupedContributions = sortedContributions.reduce((groups, contribution) => {
            const year = formatYearLabel(contribution.date);
            if (!groups[year]) {
                groups[year] = [];
            }
            groups[year].push(contribution);
            return groups;
        }, {});

        const years = Object.keys(groupedContributions).sort((a, b) => Number(b) - Number(a));
        const list = document.createElement("ul");
        list.className = "account-list";

        years.forEach(year => {
            const yearSection = document.createElement("li");
            yearSection.className = "account-card year-section";
            yearSection.innerHTML = `<strong>${year}</strong>`;
            list.appendChild(yearSection);

            groupedContributions[year].forEach(contribution => {
                const item = document.createElement("li");
                item.className = "account-card balance-row";
                item.innerHTML = `
                    <span>${formatMonthLabel(contribution.date)}</span>
                    <span>${formatCurrency(contribution.amount_cents)}</span>
                `;
                list.appendChild(item);
            });
        });

        container.appendChild(list);
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
        const accountId = params.get("accountId");

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
