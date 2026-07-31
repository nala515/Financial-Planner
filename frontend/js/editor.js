//-----------------------------------------------------
// Editor
//-----------------------------------------------------

let accountCache = [];

//-----------------------------------------------------
// Populating forms
//-----------------------------------------------------

function populateAccountForm(account) {
    document.getElementById("account-name").value = account.name || "";
    document.getElementById("account-category").value = account.category || "Cash";
    document.getElementById("account-shared").checked = Boolean(account.shared);
}

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

function loadBalancesEditor(accountId) {
    const container = document.getElementById("balances-list-container");
    const response = await fetch(`/api/accounts/${accountId}/balances`);
    const balances = await response.json();

    container.innerHTML = balances.map(b => `
        <div class="editor-row">
            <span>${b.snapshot_date}</span>
            <input type="number" name="balance" value="${b.balance_cents / 100}" step="0.01">
            <input type="hidden" name="date" value="${b.snapshot_date}">
        </div>
    `).join('');
}

function loadConributionsEditor(accountId) {
    const container = document.getElementById("contributions-list-container");
    const response = await fetch(`/api/accounts/${accountId}/contributions`);
    const contributions = await response.json();

    container.innerHTML = contributions.map(c => `
        <div class="editor-row">
            <span>${c.date}</span>
            <input type="number" name="amount" value="${c.amount_cents / 100}" step="0.01">
            <input type="hidden" name="date" value="${c.date}">
        </div>
    `).join('');
}

//-----------------------------------------------------
// Handling updates
//-----------------------------------------------------

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
        await initializeEditor();
    } catch (error) {
        status.textContent = error.message;
    }
}


//-----------------------------------------------------
// Page setup
//-----------------------------------------------------

async function initializeEditor() {
    const selector = document.getElementById("account-selector");

    try {
        const response = await fetch(`/api/accounts`);

        if (!response.ok) {
            throw new Error("Unable to load accounts");
        }

        const accounts = await response.json();
        accountCache = Array.isArray(accounts) ? accounts : [];

        if (!Array.isArray(accounts) || accounts.length === 0) {
            if (selector) {
                selector.innerHTML = '<option value="">No accounts</option>';
            }
            return;
        }

        if (selector) {
            selector.innerHTML = '<option value="">Select an account</option>';
            populateAccountCategoryOptions(document.getElementById("account-category"));

            accounts.forEach(account => {
                const option = document.createElement("option");
                option.value = account.id;
                option.textContent = account.name;
                selector.appendChild(option);
            });
        }
    } catch (error) {
        console.error(error);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();
    await initializeEditor(); // Fetches accounts and populates selector

    const selector = document.getElementById("account-selector");
    const accountForm = document.getElementById("account-form");
    const resetButton = document.getElementById("reset-account-details");

    // Account selector logic
    if (selector) {
        selector.addEventListener("change", (event) => {
            const accountId = Number(event.target.value);
            if (!accoundId) return;
            
            const selectedAccount = accountCache.find(a => a.id === accountId);
            if (selectedAccount) {
                populateAccountForm(selectedAccount);
                await loadBalancesEditor(accountId);
                await loadContributionsEditor(accountId);
            } else {
                form.reset(); // Clear if "Select an account" is chosen
            }
        });
    }
    // Reset Button Logic
    if (resetButton) {
        resetButton.addEventListener("click", () => {
            const accountId = Number(selector.value);
            const original = accountCache.find(a => a.id === accountId);
            if (original) populateAccountForm(original);
        });
    }
    // Update account logic
    if (accountForm) {
        accountForm.addEventListener("submit", handleAccountUpdate);
    }
});
