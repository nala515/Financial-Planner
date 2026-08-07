//-----------------------------------------------------
// Getters and Setters 
//-----------------------------------------------------

let settings = {};
let accountCategories = null;

async function loadSettings() {
    settings = await fetch("/api/settings")
        .then(r => r.json());
}

function getSelectedAccountId() {
    return localStorage.getItem("selectedAccount");
}

function setSelectedAccountId(accountId) {
    localStorage.setItem("selectedAccount", accountId);
}

async function getAccountCategories() {
    if (accountCategories) {
        return accountCategories;
    }
    const response = await fetch(`/api/account-categories`);
    accountCategories = await response.json();
    return accountCategories;
}

//-----------------------------------------------------
// Formatting
//-----------------------------------------------------

function formatCurrency(cents) {
    return (cents / 100).toLocaleString("en-US", {
        style: "currency",
        currency: "USD"
    });
}

function formatMonthLabel(snapshotDate) {
    const date = new Date(snapshotDate);
    return date.toLocaleDateString("en-US", { month: "long" });
}

function formatYearLabel(snapshotDate) {
    const date = new Date(snapshotDate);
    return date.getFullYear().toString();
}

//-----------------------------------------------------
// Utilities
//-----------------------------------------------------

async function sendDebugMsg(msg) {
    try {
        await fetch("/api/debug", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify({ msg: msg })
        });
    } catch (error) {
        console.error("Failed to send debug log to Uvicorn:", error);
    }
}

function getDropdownGroup(categoryName) {
    if (categoryName === "Retirement" ||
        categoryName === "Investment" ||
        categoryName === "Cash") {
        return categoryName;
    }

    // HSA, 529, or anything else
    return "Other";
}

function sortAccountsForDropdown(accounts) {

    const groupOrder = {
        "Retirement": 0,
        "Investment": 1,
        "Cash": 2,
        "Other": 3
    };

    return [...accounts].sort((a, b) => {

        const groupA = getDropdownGroup(a.category);
        const groupB = getDropdownGroup(b.category);

        if (groupA !== groupB) {
            return groupOrder[groupA] - groupOrder[groupB];
        }

        return a.name.localeCompare(b.name);
    });
}

async function populateAccountSelector(select, accounts) {
    select.innerHTML = "";

    const sortedAccounts = sortAccountsForDropdown(accounts);

    const groupNames = [
        "Retirement",
        "Investment",
        "Cash",
        "Other"
    ];

    groupNames.forEach(groupName => {

        const groupAccounts = sortedAccounts.filter(account =>
            getDropdownGroup(account.category) === groupName
        );

        if (groupAccounts.length === 0) {
            return;
        }

        const optgroup = document.createElement("optgroup");
        optgroup.label = groupName;

        groupAccounts.forEach(account => {

            const option = document.createElement("option");
            option.value = account.id;
            option.textContent = account.name;
            option.dataset.category = account.category;

            optgroup.appendChild(option);
        });

        select.appendChild(optgroup);
    });
}