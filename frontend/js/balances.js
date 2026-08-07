//-----------------------------------------------------
// Utility functions
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


// build account columns with groupings as desired
function buildDisplayColumns(accounts, settings) {
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
                    displayName += `<span class="expand-toggle" data-category="${groupName}" style="cursor:pointer; color: #ef4444;">[-]</span>`;
                }
                columns.push({ id: acc.id, name: displayName, isGroup: false });
            });
        }
        // if multiple accounts and they're collapsed, show all with a plus toggle
        else {
            columns.push({
                id: `${groupName}_group`,
                name: `${groupName} <span class="expand-toggle" data-category="${groupName}" style="cursor:pointer; color: #3b82f6;">[+]</span>`,
                isGroup: true,
                memberAccountIds: groupMembers.map(m => m.id)
            });
        }
    });

    return columns;
}

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
// Main function
//-----------------------------------------------------

async function loadBalances() {
    const container = document.getElementById("balances");
    if (!container) return;

    // Fetch accounts, all balances, and user settings
    if (!settings || Object.keys(settings).length === 0) {
        await loadSettings(); 
    }

    const [accounts, balances, categories] = await Promise.all([
        fetch('/api/accounts').then(r => r.json()),
        fetch('/api/balances').then(r => r.json()),
        getAccountCategories()
    ]);

    // get current type selection from dropdown
    const typeSelector = document.getElementById("type-selector");
    const selectedType = typeSelector ? typeSelector.value : "net_worth";
    const typeFilteredAccounts = filterAccountsByType(accounts, categories, selectedType);
    if (!Array.isArray(typeFilteredAccounts) || typeFilteredAccounts.length === 0) {
        container.innerHTML = "<p>No accounts matching this filter.</p>";
        return;
    }
    // generate the columns based on the user's settings
    const displayColumns = buildDisplayColumns(typeFilteredAccounts, settings);

    // group the raw balance data by date for the matrix view: rowsByDate[date][account_id]
    const rowsByDate = {};
    balances.forEach(b => {
        if (!rowsByDate[b.date]) {
            rowsByDate[b.date] = {};
        }
        rowsByDate[b.date][b.account_id] = b.balance_cents;
    });

    // group dates by Year for section headers
    const sortedDates = Object.keys(rowsByDate).sort((a, b) => new Date(b) - new Date(a));
    const groupedByYear = sortedDates.reduce((groups, dateStr) => {
        const year = formatYearLabel(dateStr);
        if (!groups[year]) groups[year] = [];
        groups[year].push(dateStr);
        return groups;
    }, {});

    // build table DOM
    const table = document.createElement("table");
    table.className = "data-table";

    // build Header
    let thHtml = `<thead><tr><th>Month</th>`;
    displayColumns.forEach(col => {
        thHtml += `<th>${col.name}</th>`;
    });
    thHtml += `<th>Total</th></tr></thead>`;
    table.innerHTML = thHtml;

    const tbody = document.createElement("tbody");

    // populate rows with Year dividers
    const years = Object.keys(groupedByYear).sort((a, b) => Number(b) - Number(a));
    const colCount = displayColumns.length + 2; // Month + Accounts + Total

    years.forEach(year => {
        // year section row
        const yearRow = document.createElement("tr");
        yearRow.className = "table-year-row";
        yearRow.innerHTML = `<td colspan="${colCount}">${year}</td>`;
        tbody.appendChild(yearRow);

        // monthly rows
        groupedByYear[year].forEach(dateStr => {
            const tr = document.createElement("tr");
            tr.className = "table-data-row";

            let rowHtml = `<td>${formatMonthLabel(dateStr)}</td>`;
            let monthTotal = 0;

            displayColumns.forEach(col => {
                let balanceCents = rowsByDate[dateStr][col.id] || 0;
                if (col.isGroup) {
                    col.memberAccountIds.forEach(accountId => {
                        balanceCents += (rowsByDate[dateStr][accountId] || 0);
                    });
                } else {
                    balanceCents = rowsByDate[dateStr][col.id] || 0;
                }
                monthTotal += balanceCents;
                rowHtml += `<td>${balanceCents ? formatCurrency(balanceCents) : '-'}</td>`;
            });

            rowHtml += `<td><strong>${formatCurrency(monthTotal)}</strong></td>`;
            tr.innerHTML = rowHtml;
            tbody.appendChild(tr);
        });
    });

    table.appendChild(tbody);
    container.innerHTML = "";
    container.appendChild(table);
}

// event listeners
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
