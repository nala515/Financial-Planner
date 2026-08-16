const MONTH_INPUT_FORMAT = "YYYY-MM";

function buildMonthValue(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}

function getAccountOptions(accounts, selectedAccountIds = []) {
    return accounts
        .filter((account) => !selectedAccountIds.includes(account.id))
        .map((account) => `<option value="${account.id}">${account.name}</option>`)
        .join("");
}

function refreshAllRowOptions() {
    const rows = getAllRows();
    const selectedIdsInUse = getSelectedAccountIds();

    rows.forEach((row) => {
        const accountSelect = row.querySelector("select");
        const currentValue = Number(accountSelect?.value || 0);
        const otherSelections = selectedIdsInUse.filter((id) => id !== currentValue);

        accountSelect.innerHTML = `<option value="">Select account</option>${getAccountOptions(
            window.__monthlyEntryAccounts || [],
            otherSelections,
        )}`;

        if (currentValue) {
            accountSelect.value = String(currentValue);
        }
    });
}

function setupRow(row, accounts, selectedAccountIds = []) {
    const accountSelect = row.querySelector("select");
    const balanceInput = row.querySelector("input[data-role='balance']");
    const contributionInput = row.querySelector("input[data-role='contribution']");
    const removeButton = row.querySelector("button[data-role='remove-row']");

    window.__monthlyEntryAccounts = accounts;
    accountSelect.innerHTML = `<option value="">Select account</option>${getAccountOptions(accounts, selectedAccountIds)}`;

    const refreshOptions = () => {
        const rows = getAllRows();
        const selectedIdsInUse = rows
            .map((candidateRow) => Number(candidateRow.querySelector("select")?.value || 0))
            .filter((id) => id > 0);

        const currentAccountId = Number(accountSelect.value || 0);
        const otherSelections = selectedIdsInUse.filter((id) => id !== currentAccountId);

        accountSelect.innerHTML = `<option value="">Select account</option>${getAccountOptions(accounts, otherSelections)}`;
        if (currentAccountId) {
            accountSelect.value = String(currentAccountId);
        }
    };

    accountSelect.addEventListener("change", () => {
        refreshAllRowOptions();
        updateSaveButtonState();
    });

    if (removeButton) {
        removeButton.addEventListener("click", () => {
            const allRows = document.querySelectorAll(".batch-entry-row");
            if (allRows.length <= 1) {
                return;
            }
            row.remove();
            updateSaveButtonState();
        });
    }

    balanceInput.addEventListener("input", updateSaveButtonState);
    contributionInput.addEventListener("input", updateSaveButtonState);
    accountSelect.addEventListener("change", updateSaveButtonState);
}

function getSelectedAccountIds() {
    return [...document.querySelectorAll(".batch-entry-row select")]
        .map((select) => Number(select.value || 0))
        .filter((value) => value > 0);
}

function getAllRows() {
    return [...document.querySelectorAll(".batch-entry-row")];
}

function updateSaveButtonState() {
    const monthValue = document.getElementById("monthly-entry-month")?.value;
    const rows = getAllRows();
    const statusBox = document.getElementById("monthly-entry-status");
    const saveButton = document.getElementById("save-monthly-entry-batch");

    if (!saveButton) {
        return;
    }

    if (!monthValue) {
        saveButton.disabled = true;
        statusBox.textContent = "No month selected.";
        statusBox.className = "batch-entry-status batch-entry-status-hint";
        return;
    }

    const selectedAccountIds = [];
    let hasDuplicateAccount = false;
    let hasMissingAccountOrBalance = false;
    let hasContributionIssue = false;

    rows.forEach((row) => {
        const accountId = Number(row.querySelector("select")?.value || 0);
        const balanceValue = row.querySelector("input[data-role='balance']")?.value.trim();
        const contributionValue = row.querySelector("input[data-role='contribution']")?.value.trim();

        if (accountId) {
            if (selectedAccountIds.includes(accountId)) {
                hasDuplicateAccount = true;
            }
            selectedAccountIds.push(accountId);
        }

        if (!accountId || !balanceValue || Number.isNaN(Number(balanceValue))) {
            hasMissingAccountOrBalance = true;
        }

        if (contributionValue !== "" && Number.isNaN(Number(contributionValue))) {
            hasContributionIssue = true;
        }
    });

    if (hasDuplicateAccount) {
        saveButton.disabled = true;
        statusBox.textContent = "Two or more rows have the same account selected.";
        statusBox.className = "batch-entry-status batch-entry-status-hint";
        return;
    }

    if (hasMissingAccountOrBalance) {
        saveButton.disabled = true;
        statusBox.textContent = "A row is missing an account or has an invalid/empty balance.";
        statusBox.className = "batch-entry-status batch-entry-status-hint";
        return;
    }

    if (hasContributionIssue) {
        saveButton.disabled = true;
        statusBox.textContent = "Contribution field contains a non-numeric value.";
        statusBox.className = "batch-entry-status batch-entry-status-hint";
        return;
    }

    saveButton.disabled = rows.length === 0;
    if (saveButton.disabled) {
        statusBox.textContent = "A row is missing an account or has an invalid/empty balance.";
        statusBox.className = "batch-entry-status batch-entry-status-hint";
        return;
    }

    statusBox.textContent = "";
    statusBox.className = "batch-entry-status";
}

function addEntryRow(accounts) {
    const rowsContainer = document.getElementById("monthly-entry-rows");
    const row = document.createElement("div");
    row.className = "batch-entry-row";
    row.innerHTML = `
        <div class="batch-entry-fields">
            <select aria-label="Account"></select>
            <input type="number" step="0.01" min="0" data-role="balance" placeholder="Balance" />
            <input type="number" step="0.01" min="0" data-role="contribution" placeholder="Contribution" />
            <button type="button" data-role="remove-row" class="secondary-button">Remove</button>
        </div>
    `;

    const selectedAccountIds = getSelectedAccountIds();
    setupRow(row, accounts, selectedAccountIds);
    rowsContainer.appendChild(row);
    refreshAllRowOptions();
    updateSaveButtonState();
}

async function loadAddEntryPage() {
    const container = document.getElementById("add-entry");
    if (!container) {
        return;
    }

    const accounts = await loadAccounts();

    container.innerHTML = `
        <div class="batch-entry-panel">
            <div class="batch-entry-toolbar">
                <label>
                    <span>Snapshot month</span>
                    <input id="monthly-entry-month" type="month" value="${buildMonthValue()}" />
                </label>
                <button id="add-monthly-entry-row" type="button" class="primary-button">Add Row</button>
            </div>
            <div id="monthly-entry-rows" class="batch-entry-rows"></div>
            <div class="batch-entry-actions">
                <button id="save-monthly-entry-batch" type="button" class="primary-button" disabled>Save All</button>
            </div>
            <div id="monthly-entry-status" class="batch-entry-status" aria-live="polite"></div>
        </div>
    `;

    document.getElementById("monthly-entry-month").addEventListener("input", updateSaveButtonState);
    document.getElementById("add-monthly-entry-row").addEventListener("click", () => addEntryRow(accounts));

    document.getElementById("save-monthly-entry-batch").addEventListener("click", async () => {
        const monthValue = document.getElementById("monthly-entry-month")?.value;
        const rows = getAllRows();
        const statusBox = document.getElementById("monthly-entry-status");

        const payload = {
            snapshot_date: `${monthValue}-01`,
            entries: rows.map((row) => {
                const accountSelect = row.querySelector("select");
                const balanceInput = row.querySelector("input[data-role='balance']");
                const contributionInput = row.querySelector("input[data-role='contribution']");

                return {
                    account_id: Number(accountSelect.value),
                    balance_cents: Math.round(Number(balanceInput.value || 0) * 100),
                    contribution_cents: Math.round(Number(contributionInput.value || 0) * 100),
                };
            }),
        };

        try {
            const response = await fetch("/api/monthly-entry-batch", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(body.detail || "Unable to save monthly entries.");
            }

            statusBox.textContent = "Saved successfully.";
            statusBox.className = "batch-entry-status batch-entry-status-success";
            updateSaveButtonState();
        } catch (error) {
            statusBox.textContent = error.message;
            statusBox.className = "batch-entry-status batch-entry-status-error";
        }
    });

    addEntryRow(accounts);
    updateSaveButtonState();
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();
    await loadAddEntryPage();
});
