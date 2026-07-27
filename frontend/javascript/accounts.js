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
