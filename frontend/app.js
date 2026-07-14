const apiBaseUrl = "http://127.0.0.1:8000";

async function loadAccounts() {
    const div = document.getElementById("accounts");

    if (!div) {
        return;
    }

    try {
        const response = await fetch(`${apiBaseUrl}/accounts`);

        if (!response.ok) {
            throw new Error("Unable to load accounts");
        }

        const accounts = await response.json();
        div.innerHTML = "";

        if (!Array.isArray(accounts) || accounts.length === 0) {
            div.innerHTML = "<p>No accounts found yet.</p>";
            return;
        }

        const list = document.createElement("ul");
        list.className = "account-list";

        accounts.forEach(account => {
            const item = document.createElement("li");
            item.className = "account-card";
            item.innerHTML = `
                <strong>${account.name}</strong>
                <span>${account.account_type}</span>
                <small>${account.shared ? "Shared" : "Personal"}</small>
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
        const response = await fetch(`${apiBaseUrl}/accounts`);

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
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

async function loadBalancesForAccount(accountId, container) {
    if (!accountId) {
        container.innerHTML = "<p>No account selected.</p>";
        return;
    }

    try {
        const response = await fetch(`${apiBaseUrl}/accounts/${accountId}/balances`);

        if (!response.ok) {
            throw new Error("Unable to load balances");
        }

        const balances = await response.json();
        container.innerHTML = "";

        if (!Array.isArray(balances) || balances.length === 0) {
            container.innerHTML = "<p>No monthly balances found.</p>";
            return;
        }

        const list = document.createElement("ul");
        list.className = "account-list";

        balances.forEach(balance => {
            const item = document.createElement("li");
            item.className = "account-card";
            item.innerHTML = `
                <strong>${formatMonthLabel(balance.snapshot_date)}</strong>
                <span>${formatCurrency(balance.balance_cents)}</span>
            `;
            list.appendChild(item);
        });

        container.appendChild(list);
    } catch (error) {
        container.innerHTML = `<p>${error.message}</p>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadAccounts();
    loadBalances();

    const selector = document.getElementById("account-selector");
    const container = document.getElementById("balances");

    if (selector && container) {
        selector.addEventListener("change", async (event) => {
            const accountId = event.target.value;
            await loadBalancesForAccount(accountId, container);
        });
    }
});