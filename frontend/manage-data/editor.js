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


async function populateAccountCategoryOptions(select) {
    if (!select) {
        return;
    }
    const categories = await getAccountCategories();
    select.innerHTML = "";

    Object.keys(categories)
        .sort()
        .forEach(categoryName => {
            const option = document.createElement("option");
            option.value = categoryName;
            option.textContent = categoryName;
            select.appendChild(option);
        });
}

// uses selected account's info to populate the fields
async function populateFormsWithAccountData(accountId) {
    await populateAccountCategoryOptions(document.getElementById("account-category"));
    const selectedAccount = accountCache.find(a => a.id === accountId);
    if (selectedAccount) {
        populateAccountForm(selectedAccount);
        await populateBalances(accountId);
        await populateContributions(accountId);
    }
}

async function populateBalances(accountId) {
    const container = document.getElementById("balances-list-container");
    const response = await fetch(`/api/accounts/${accountId}/balances`);
    const balances = await response.json();

    if (!Array.isArray(balances) || balances.length === 0) {
        container.innerHTML = '<div class="editor-row">No balances found.</div>';
        return;
    }

    container.innerHTML = balances.map(b => `
        <div class="editor-row">
            <span>${b.date}</span>
            <input type="number" name="balance" value="${b.balance_cents / 100}" step="0.01">
            <input type="hidden" name="date" value="${formatMonthYearLabel(b.date)}">
        </div>
    `).join('');
}

async function populateContributions(accountId) {
    const container = document.getElementById("contributions-list-container");
    const response = await fetch(`/api/accounts/${accountId}/contributions`);
    const contributions = await response.json();

    if (!Array.isArray(contributions) || contributions.length === 0) {
        container.innerHTML = '<div class="editor-row">No contributions found.</div>';
        return;
    }

    container.innerHTML = contributions.map(c => `
        <div class="editor-row">
            <span>${c.date}</span>
            <input type="number" name="amount" value="${c.amount_cents / 100}" step="0.01">
            <input type="hidden" name="date" value="${formatMonthLabel(c.date)} ${formatYearLabel(c.date)}">
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

    const accountId = Number(selector.value);
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
        const accounts = await loadAccounts();
        accountCache = Array.isArray(accounts) ? accounts : [];
        const accountId = await populateAccountDropdown(selector, accounts); // returns accountId

        if (accountId) {
            populateFormsWithAccountData(accountId);
        }
    } catch (error) {
        console.error(error);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();

    // populate account dropdown and form
    await initializeEditor(); // Fetches accounts and populates selector

    const selector = document.getElementById("account-selector");
    const accountForm = document.getElementById("account-form");
    const resetButton = document.getElementById("reset-account-details");

    // Account selector logic
    if (selector) {
        selector.addEventListener("change", async (event) => {
            accountId = Number(event.target.value);
            if (!accountId) return;
            setSelectedAccountId(accountId);
            await populateFormsWithAccountData(accountId);
        });
    }
    // Reset button
    if (resetButton) {
        resetButton.addEventListener("click", async () => {
            accountId = Number(selector.value);
            if (accountId) {
                await populateFormsWithAccountData(accountId);
            }
        });
    }
    // Update account
    if (accountForm) {
        accountForm.addEventListener("submit", handleAccountUpdate);
    }
});
