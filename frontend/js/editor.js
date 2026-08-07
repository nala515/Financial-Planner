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

    const categories = await getAccountCategories();
    select.innerHTML = "";

    categories.forEach(category => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
    });
}

async function loadBalancesEditor(accountId) {
    const container = document.getElementById("balances-list-container");
    const response = await fetch(`/api/accounts/${accountId}/balances`);
    const balances = await response.json();

    container.innerHTML = balances.map(b => `
        <div class="editor-row">
            <span>${b.date}</span>
            <input type="number" name="balance" value="${b.balance_cents / 100}" step="0.01">
            <input type="hidden" name="date" value="${formatMonthLabel(b.date)} ${formatYearLabel(b.date)}">
        </div>
    `).join('');
}

async function loadContributionsEditor(accountId) {
    const container = document.getElementById("contributions-list-container");
    const response = await fetch(`/api/accounts/${accountId}/contributions`);
    const contributions = await response.json();

    container.innerHTML = contributions.map(c => `
        <div class="editor-row">
            <span>${c.date}</span>
            <input type="number" name="amount" value="${c.amount_cents / 100}" step="0.01">
            <input type="hidden" name="date" value="${formatMonthLabel(c.date)} ${formatYearLabel(c.date)}">
        </div>
    `).join('');
}

async function loadSettingsEditor() {
    const container = document.getElementById("settings-list-container");
    if (!container) return;

    if (!settings || Object.keys(settings).length === 0) {
        await loadSettings();
    }

    container.innerHTML = `
        <div class="editor-row">
            <span>Group Cash Accounts</span>
            <input type="checkbox" id="setting-group-cash" ${settings.group_cash_accounts ? 'checked' : ''}>
        </div>
        <div class="editor-row">
            <span>Hide Disabled Accounts</span>
            <input type="checkbox" id="setting-hide-disabled" ${settings.hide_disabled_accounts ? 'checked' : ''}>
        </div>
        <div class="editor-row">
            <span>Show Retirement Accounts</span>
            <input type="checkbox" id="setting-show-retirement" ${settings.show_retirement_accounts ? 'checked' : ''}>
        </div>
        <div class="form-actions">
            <button type="submit" class="primary-button">Save Settings</button>
            <p id="settings-form-status" class="form-status"></p>
        </div>
    `;
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

async function handleSettingsUpdate(event) {
    event.preventDefault();
    const status = document.getElementById("settings-form-status");

    // 1. Collect the data from the checkboxes
    const updatedSettings = {
        group_cash_accounts: document.getElementById("setting-group-cash").checked,
        hide_disabled_accounts: document.getElementById("setting-hide-disabled").checked,
        show_retirement_accounts: document.getElementById("setting-show-retirement").checked
    };

    try {
        // 2. Send to the FastAPI backend
        const response = await fetch("/api/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedSettings)
        });

        if (response.ok) {
            // 3. Update the global variable in app.js so other pages/functions stay in sync
            settings = await response.json();
            
            status.textContent = "Settings saved successfully!";
            status.className = "form-status success";
            setTimeout(() => status.textContent = "", 3000);
        } else {
            throw new Error("Failed to save settings.");
        }
    } catch (error) {
        status.textContent = "Error: " + error.message;
        status.className = "form-status error";
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
    await loadSettingsEditor();
    const selector = document.getElementById("account-selector");
    const accountForm = document.getElementById("account-form");
    const resetButton = document.getElementById("reset-account-details");

    // Account selector logic
    if (selector) {
        selector.addEventListener("change", async (event) => {
            const accountId = Number(event.target.value);
            if (!accountId) return;
            
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
    // Reset button
    if (resetButton) {
        resetButton.addEventListener("click", async () => {
            const accountId = Number(selector.value);
            const original = accountCache.find(a => a.id === accountId);
            if (original) {
                populateAccountForm(original);
                await loadBalancesEditor(accountId);
                await loadContributionsEditor(accountId);
            }
        });
    }
    // Update settings
    const settingsForm = document.getElementById("settings-update-form");
    if (settingsForm) {
        settingsForm.addEventListener("submit", handleSettingsUpdate);
    }
    // Update account
    if (accountForm) {
        accountForm.addEventListener("submit", handleAccountUpdate);
    }
});
