//-----------------------------------------------------
// Utility functions
//-----------------------------------------------------

let accountCategories = null; // cache so we don't refetch on every dropdown change

async function getAccountCategories() {
    if (accountCategories) {
        return accountCategories;
    }
    const response = await fetch(`/api/account-categories`);
    accountCategories = await response.json();
    return accountCategories;
}

function buildDisplayColumns(accounts, settings) {
    const columns = [];

    if (settings.group_cash_accounts) {
        // 1. Find all accounts belonging to the "Cash" category
        const cashAccounts = accounts.filter(acc => acc.category === "Cash");
        const otherAccounts = accounts.filter(acc => acc.category !== "Cash");

        // 2. Add a single virtual "Cash" column that tracks all cash account IDs
        columns.push({
            id: "cash_group",
            name: "Cash",
            isGroup: true,
            memberAccountIds: cashAccounts.map(acc => acc.id)
        });

        // 3. Add all other categories (Investment, Retirement, etc.) individually
        otherAccounts.forEach(acc => {
            columns.push({ id: acc.id, name: acc.name, isGroup: false });
        });
    } else {
        // If false, simply map every account to its own individual column
        accounts.forEach(acc => {
            columns.push({ id: acc.id, name: acc.name, isGroup: false });
        });
    }

    return columns;
}

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
    const typeFilteredAccounts = filterAccountsByType(allAccounts, categories, selectedType);
    if (!Array.isArray(typeFilteredAccounts) || typeFilteredAccounts.length === 0) {
        container.innerHTML = "<p>No accounts matching this filter.</p>";
        return;
    }
    // generate the columns based on the user's settings
    const displayColumns = buildDisplayColumns(typeFilteredAccounts, settings);

    // group the raw balance data by date for the matrix view: rowsByDate[date][account_id]
    const rowsByDate = {};
    balances.forEach(b => {
        if (!rowsByDate[b.date]) rowsByDate[b.date] = {};
        rowsByDate[b.date][b.account_id] = b.balance_cents;
    });
        
    // map balances by date: { "YYYY-MM": { account_id: balance_cents } }
    const rowsByDate = {};
    balances.forEach(b => {
        const dateKey = b.date;
        if (!rowsByDate[dateKey]) {
            rowsByDate[dateKey] = {};
        }
        rowsByDate[dateKey][b.account_id] = b.balance_cents;
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
    table.className = "data-table wide";

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
                const amount = rowsByDate[dateStr][col.id] || 0;
                if (col.isGroup) {
                    col.memberAccountIds.forEach(id => balanceCents += (rowsByDate[dateStr][col.id] || 0));
                } else {
                    balanceCents = rowsByDate[date][col.id] || 0;
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

document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();
    await loadSettings();
    await populateTypeSelector();

    const typeSelector = document.getElementById("type-selector");
    typeSelector.addEventListener("change", () => {
        loadBalances();    
    });

    await loadBalances();
});
