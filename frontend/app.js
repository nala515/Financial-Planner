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
                <a href="balances.html?accountId=${account.id}">View balances</a>
            `;
            list.appendChild(item);
        });

        div.appendChild(list);
    } catch (error) {
        div.innerHTML = `<p>${error.message}</p>`;
    }
}

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

function formatCurrency(cents) {
    const dollars = Math.floor(cents / 100);
    const centsPart = Math.abs(cents % 100).toString().padStart(2, "0");
    return `$${dollars}.${centsPart}`;
}

function formatMonthLabel(snapshotDate) {
    const date = new Date(snapshotDate);
    return date.toLocaleDateString("en-US", { month: "long" });
}

function formatYearLabel(snapshotDate) {
    const date = new Date(snapshotDate);
    return date.getFullYear().toString();
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

document.addEventListener("DOMContentLoaded", () => {
    loadDashboard();
    loadAccounts();
    loadBalances();

    const selector = document.getElementById("account-selector");
    const container = document.getElementById("balances");
    const form = document.getElementById("account-form");

    if (selector) {
        selector.addEventListener("change", (event) => {
            const accountId = event.target.value;
            const selectedAccount = accountCache.find(account => account.id === Number(accountId));
            if (selectedAccount) {
                populateAccountForm(selectedAccount);
            }
        });
    }

    if (form) {
        form.addEventListener("submit", handleAccountUpdate);
    }

    if (selector && container) {
        selector.addEventListener("change", async (event) => {
            const accountId = event.target.value;
            await loadBalancesForAccount(accountId, container);
        });
    }
});
