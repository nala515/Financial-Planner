//-----------------------------------------------------
// Filtering and type-selection
//-----------------------------------------------------

// Track multiple toggle states in one object
let expandedStates = {
    MyCash: false,
    JointCash: false,
    HSA: false,
    529: false,
    Investment: false,
    Retirement: false
};

// filter accounts by type to only show the ones requested
function filterAccountsByType(accounts, categories, type) {
    return accounts.filter(acc => {
        const categoryInfo = categories[acc.category];
        // If an account's category isn't in the mapping for some reason,
        // exclude it rather than crash or silently include it.
        return categoryInfo ? categoryInfo[type] === true : false;
    });
}

function formatTypeLabel(key) {
    // net_worth -> "Net Worth", spendable -> "Spendable"
    return key
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

async function populateTypeSelector() {
    const categories = await getAccountCategories();
    const typeSelector = document.getElementById("type-selector");

    // Derive descriptor keys from any one category entry, since all
    // entries share the same shape (retirement, spendable, invested, net_worth)
    const firstCategory = Object.values(categories)[0];
    const descriptorKeys = Object.keys(firstCategory || {});

    typeSelector.innerHTML = "";
    descriptorKeys.forEach(key => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = formatTypeLabel(key);
        if (key === "net_worth") {
            option.selected = true;
        }
        typeSelector.appendChild(option);
    });
}

//-----------------------------------------------------
// Prep for building table
//-----------------------------------------------------

// Groups filtered accounts into per-category columns, collapsing multi-account groups behind a +/- toggle.
//    Input: raw accounts
//    Output: account-column objects
function groupAccountsIntoColumns(accounts, settings) {
    const columns = [];
    // categories for grouping
    const groups = ["MyCash", "JointCash", "HSA", "529", "Investment", "Retirement"];

    const groupedAccounts = accounts.reduce((map, acc) => {
        let groupKey;

        // Logic to determine which bucket the account belongs to
        if (acc.category === "Cash") {
            groupKey = acc.shared ? "JointCash" : "MyCash";
        } else {
            groupKey = acc.category; // HSA, Investment, Retirement
        }
        // Initialize the array if it doesn't exist yet
        if (!map[groupKey]) map[groupKey] = [];
        map[groupKey].push(acc);
        return map;
    }, {});

    groups.forEach(groupName => {
        const groupMembers = groupedAccounts[groupName] || [];
        const isExpanded = expandedStates[groupName];

        // if no accounts match, do nothing
        if(groupMembers.length === 0) {
            //
        }
        // if one account, add the individual account
        else if (groupMembers.length === 1) {
            groupMembers.forEach(acc => {
                columns.push({ id: acc.id, name: acc.name, isGroup: false });
            });
        }
        // if multiple accounts and they're expanded, show all with a minus toggle
        else if (isExpanded) {
            const lastIndex = groupMembers.length - 1;
            groupMembers.forEach((acc, index) => {
                let displayName = acc.name;
                // add the [-] toggle to the last account
                if (index === lastIndex) {
                    attr = ` data-category="${groupName}" `;
                    displayName = addExpandCollapseMarker(acc.name, attr, isExpanded);
                }
                columns.push({ id: acc.id, name: displayName, isGroup: false });
            });
        }
        // if multiple accounts and they're collapsed, show all with a plus toggle
        else {
            attr = ` data-category="${groupName}" `;
            columns.push({
                id: `${groupName}_group`,
                name: addExpandCollapseMarker(groupName, attr, isExpanded),
                isGroup: true,
                memberAccountIds: groupMembers.map(m => m.id)
            });
        }
    });

    return columns;
}

// Converts display columns into the {label, getValue, ...} descriptors buildTable() expects.
//    Input: account-column objects
//    Output: descriptor objects
function buildBalanceColumnDescriptors(accountColumns) {
    const columns = [
        { label: "Month", getValue: row => row.monthLabel }
    ];

    accountColumns.forEach(col => {
        columns.push({
            label: col.name, // already contains the [+]/[-] toggle HTML, if any
            getValue: row => row[col.id],
            isCurrency: true,
            dashIfEmpty: true
        });
    });

    columns.push({
        label: "Total",
        getValue: row => row.total,
        isCurrency: true,
        isBold: true
    });

    return columns;
}

// Flattens one date's balances across all display columns into a single row object, with a running total.
function normalizeBalanceRow(dateStr, rowsByDate, accountColumns) {
    const row = {
        dateStr,
        year: Number(dateStr.slice(0, 4)),
        monthLabel: formatMonthYearLabel(dateStr),
        sortKey: dateStr
    };

    let total = 0;
    accountColumns.forEach(col => {
        let cents = 0;
        if (col.isGroup) {
            col.memberAccountIds.forEach(accountId => {
                cents += (rowsByDate[dateStr][accountId] || 0);
            });
        } else {
            cents = rowsByDate[dateStr][col.id] || 0;
        }
        row[col.id] = cents;
        total += cents;
    });
    row.total = total;
    return row;
}

//-----------------------------------------------------
// Main function
//-----------------------------------------------------

// Fetches accounts/balances/settings, applies the type filter, and renders the balances table.
async function loadBalances() {
    const container = document.getElementById("balances");
    if (!container) return;

    if (!settings || Object.keys(settings).length === 0) {
        await loadSettings();
    }

    const [accounts, balances, categories] = await Promise.all([
        fetch('/api/accounts').then(r => r.json()),
        fetch('/api/balances').then(r => r.json()),
        getAccountCategories()
    ]);

    const typeSelector = document.getElementById("type-selector");
    const selectedType = typeSelector ? typeSelector.value : "net_worth";
    const typeFilteredAccounts = filterAccountsByType(accounts, categories, selectedType);
    if (!Array.isArray(typeFilteredAccounts) || typeFilteredAccounts.length === 0) {
        container.innerHTML = "<p>No accounts matching this filter.</p>";
        return;
    }
    const accountColumns = groupAccountsIntoColumns(typeFilteredAccounts, settings);

    const rowsByDate = {};
    balances.forEach(b => {
        if (!rowsByDate[b.date]) {
            rowsByDate[b.date] = {};
        }
        rowsByDate[b.date][b.account_id] = b.balance_cents;
    });

    // build normalized rows (descending by date) and hand off to buildTable()
    const sortedDates = Object.keys(rowsByDate).sort().reverse();
    const rows = sortedDates.map(dateStr => normalizeBalanceRow(dateStr, rowsByDate, accountColumns));
    const columns = buildBalanceColumnDescriptors(accountColumns);

    container.innerHTML = buildTable(rows, columns, {
        tableClass: "data-table"
    });
}

//-----------------------------------------------------
// Event listeners
//-----------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();
    await loadSettings();
    await populateTypeSelector();

    // type filtering
    const typeSelector = document.getElementById("type-selector");
    typeSelector.addEventListener("change", () => {
        loadBalances();
    });
    // [+] or [-] toggles
    const container = document.getElementById("balances");
    if (container) {
        container.addEventListener("click", (e) => {
            if (e.target.classList.contains("expand-toggle")) {
                const category = event.target.dataset.category;
                expandedStates[category] = !expandedStates[category];
                loadBalances(); // Re-render the table with the new column set
            }
        });
    }

    await loadBalances();
});
