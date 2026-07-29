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
    if (!div) {
        return;
    }

    try {
        const [accountsResponse, balancesResponse] = await Promise.all([
            fetch(`/api/accounts`),
            fetch(`/api/balances`),
        ]);

        if (!accountsResponse.ok) {
            throw new Error("Unable to load accounts");
        }
        if (!balancesResponse.ok) {
            throw new Error("Unable to load balances");
        }

        const accounts = await accountsResponse.json();
        const balances = await balancesResponse.json();

        accountCache = Array.isArray(accounts) ? accounts : [];
        div.innerHTML = "";

        if (!Array.isArray(accounts) || accounts.length === 0) {
            div.innerHTML = "<p>No accounts found yet.</p>";
            return;
        }

        // Find the most recent balance per account
        const latestBalanceByAccount = {};
        balances.forEach(b => {
            const existing = latestBalanceByAccount[b.account_id];
            if (!existing || new Date(b.date) > new Date(existing.date)) {
                latestBalanceByAccount[b.account_id] = b;
            }
        });

        const list = document.createElement("ul");
        list.className = "account-list";

        accounts.forEach(account => {
            const latest = latestBalanceByAccount[account.id];
            const balanceDisplay = latest
                ? formatCurrency(latest.balance_cents)
                : "No balance yet";

            const item = document.createElement("li");
            item.className = "account-card account-card-row";
            item.innerHTML = `
                <div class="account-card-info">
                    <strong>${account.name}</strong>
                    <small>${account.category || "Cash"}</small>
                    <small>${account.shared ? "Shared" : "Personal"}</small>
                    <small>${account.category_attributes?.retirement ? "Retirement" : "Non-retirement"}</small>
                    <a href="/balances">View balances</a>
                </div>
                <div class="account-card-balance">${balanceDisplay}</div>
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
