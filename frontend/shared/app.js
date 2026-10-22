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

async function getAccountCategories() {
    const response = await fetch(`/api/account-categories`);
    accountCategories = await response.json();
    return accountCategories;
}

async function getAccountViews() {
    const response = await fetch(`/api/account-views`);
    accountViews = await response.json();
    return accountViews;
}

//-----------------------------------------------------
// Formatting
//-----------------------------------------------------


function formatTypeLabel(key) {
    // net_worth -> "Net Worth", spendable -> "Spendable"
    return key
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

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

// null/undefined (e.g. a month with no gain yet) shows as a dash
function formatPercent(value) {
    if (value === null || value === undefined) {
        return "-";
    }
    return `${value.toFixed(2)}%`;
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
        const divider = col.dividerAfter ? " data-divider" : "";
        return `<th${divider}>${label}</th>`;
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
            } else if (col.isPercent) {
                display = formatPercent(value);
            } else {
                display = value;
            }
            if (col.isBold) display = `<strong>${display}</strong>`;
            const dividerAttr = col.dividerAfter ? "data-divider" : "";
            return `<td ${colorAttr} ${otherAttr} ${dividerAttr}>${display}</td>`;
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
