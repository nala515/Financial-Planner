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


async function loadAccounts() {
    const div = document.getElementById("accounts");
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
            return;
        }

        const list = document.createElement("ul");
        list.className = "account-list";

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
