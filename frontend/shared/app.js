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

function formatTypeLabel(key) { 
    // Example: "net_worth" -> "Net Worth", "spendable" -> "Spendable"
    return key
        .split("_")

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

const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function formatMonthYear(year, month) {
    return `${MONTH_NAMES[month - 1]} ${year}`;
}

function formatMonthYearLabel(dateString) {
    const year = dateString.slice(0, 4);
    const month = Number(dateString.slice(5, 7));
    return formatMonthYear(year, month);
}

// adds a [+] or [-] depending on the state of expansion, also adds html attributes (pass in empty string if not needed)
function addExpandCollapseMarker(text, attr, expanded)
{
    color = expanded ? "color: #3b82f6;" : "color: #ef4444;";
    marker = expanded ? "[-]" : "[+]";
    text += `<span class="expand-toggle" ` + color + attr + ` style="cursor:pointer;">` + marker + `</span>`;
    return text;
}

function getGrowthFormatting(value) {
    const colorClass =
        value > 0 ? "growth-positive" :
        value < 0 ? "growth-negative" :
        "growth-neutral";
    return `class="${colorClass}"`
}

//-----------------------------------------------------
// Utilities
//-----------------------------------------------------

function buildTable(rows, columns, options = {}) {
    const { title, tableClass = "data-table", wrapperClass = "table-wrapper", expanded } = options;

    const headerCells = columns.map(col => {
        const label = col.isToggle ? addExpandCollapseMarker(col.label, "", expanded) : col.label;
        return `<th>${label}</th>`;
    }).join("");

    const bodyRows = rows.map((row, i) => {
        const yearChanged = i > 0 && row.year !== rows[i - 1].year;
        const rowClass = yearChanged ? "table-data-row year-boundary" : "table-data-row";

        const cells = columns.map(col => {
            const value = col.getValue(row);
            const colorAttr = col.canBeNeg ? getGrowthFormatting(value) : "";
            const otherAttr = col.isCurrency ? `data-numeric data-value="${value}"` : '';

            let display;
            if (col.dashIfEmpty && !value) {
                display = "-";
            } else if (col.isCurrency) {
                display = formatCurrency(value);
            } else {
                display = value;
            }
            if (col.isBold) display = `<strong>${display}</strong>`;

            return `<td ${colorAttr} ${otherAttr}>${display}</td>`;
        }).join("");

        return `<tr class="${rowClass}">${cells}</tr>`;
    }).join("");

    return `<div class="${wrapperClass}">
        ${title ? `<h2>${title}</h2>` : ""}
        <table class="${tableClass}">
            <thead><tr>${headerCells}</tr></thead>
            <tbody>${bodyRows}</tbody>
        </table>
    </div>`;
}

// debug
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
