//-----------------------------------------------------
// Getters and Setters 
//-----------------------------------------------------

let settings = {};

async function loadSettings() {
    settings = await fetch("/api/settings")
        .then(r => r.json());
}

async function loadAccounts() {
        const response = await fetch(`/api/accounts`);
        if (!response.ok) {
            throw new Error("Unable to load accounts");
        }
        return await response.json();
}

function getSelectedAccountId() {
    const accountId = localStorage.getItem("selectedAccount");
    return accountId ? Number(accountId) : null;
}

function setSelectedAccountId(accountId) {
    localStorage.setItem("selectedAccount", Number(accountId));
}

async function getAccountCategories() {
    const response = await fetch(`/api/account-categories`);
    accountCategories = await response.json();
    return accountCategories;
}

//-----------------------------------------------------
// Formatting
//-----------------------------------------------------

function formatCurrency(cents) {
    // check for a string before doing numerical logic
    if (cents === "TBD") {
        return "TBD";
    }
    return (cents / 100).toLocaleString("en-US", {
        style: "currency",
        currency: "USD"
    });
}

function formatMonthLabel(dateString) {
    const month = Number(dateString.slice(5, 7));
    return MONTH_NAMES[month - 1];
}

const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function formatMonthYear(year, month) {
    return `${MONTH_NAMES[month - 1]} ${year}`;
}

function formatYearLabel(dateString) {
    return dateString.slice(0, 4);
}

// adds a [+] or [-] depending on the state of expansion, also adds html attributes (pass in empty string if not needed)
function addExpandCollapseMarker(text, attr, expanded)
{
    marker = expanded ? "[-]" : "[+]";
    text += `<span class="expand-toggle" ` + attr + ` style="cursor:pointer; color: #ef4444;">` + marker + `</span>`;
    return text;
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

async function populateAccountDropdown(select, accounts) {
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

    let accountId = getSelectedAccountId();
    if (accountId && select.querySelector(`option[value="${accountId}"]`)) {
        select.value = String(accountId);
    } else if (select.options.length > 0) {
        accountId = Number(select.options[0].value);
        select.value = String(accountId);
        setSelectedAccountId(accountId);
    }
    return accountId;
}
