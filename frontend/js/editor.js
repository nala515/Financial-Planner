//-----------------------------------------------------
// Editor
//-----------------------------------------------------

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
