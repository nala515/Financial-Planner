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

function filterAccountsByType(accounts, categories, type) {
    return accounts.filter(acc => {
        const categoryInfo = categories[acc.category];
        // If an account's category isn't in the mapping for some reason,
        // exclude it rather than crash or silently include it.
        return categoryInfo ? categoryInfo[type] === true : false;
    });
}

//-----------------------------------------------------
// Main function
//-----------------------------------------------------

async function loadBalances() {
    const container = document.getElementById("balances");
    if (!container) return;

    try {
        // 1. Fetch active accounts (for headers) AND all balances in parallel
        const [accountsRes, balancesRes] = await Promise.all([
            fetch('/api/accounts'),
            fetch('/api/balances') // Assumes an endpoint returning all MonthlyBalance records
        ]);

        if (!accountsRes.ok || !balancesRes.ok) {
            throw new Error("Unable to load balance data");
        }

        const allAccounts = await accountsRes.json();
        const balances = await balancesRes.json();
        
        if (!Array.isArray(allAccounts) || allAccounts.length === 0) {
            container.innerHTML = "<p>No accounts found.</p>";
            return;
        }

        // set up type filtering dropdown
        const categories = await getAccountCategories();
        const typeSelector = document.getElementById("type-selector");
        const selectedType = typeSelector ? typeSelector.value : "net_worth";
        const typeFilteredAccounts = filterAccountsByType(allAccounts, categories, selectedType);

        if (!Array.isArray(typeFilteredAccounts) || typeFilteredAccounts.length === 0) {
            container.innerHTML = "<p>No accounts matching this filter.</p>";
            return;
        }
        
        // 2. Map balances by snapshot_date: { "YYYY-MM": { account_id: balance_cents } }
        const rowsByDate = {};
        balances.forEach(b => {
            const dateKey = b.date;
            if (!rowsByDate[dateKey]) {
                rowsByDate[dateKey] = {};
            }
            rowsByDate[dateKey][b.account_id] = b.balance_cents;
        });

        // 3. Group dates by Year for section headers
        const sortedDates = Object.keys(rowsByDate).sort((a, b) => new Date(b) - new Date(a));
        const groupedByYear = sortedDates.reduce((groups, dateStr) => {
            const year = formatYearLabel(dateStr);
            if (!groups[year]) groups[year] = [];
            groups[year].push(dateStr);
            return groups;
        }, {});

        // 4. Build Table DOM
        const table = document.createElement("table");
        table.className = "data-table wide";

        // Build Header
        let thHtml = `<thead><tr><th>Month</th>`;
        typeFilteredAccounts.forEach(acc => {
            thHtml += `<th>${acc.name}</th>`;
        });
        thHtml += `<th>Total</th></tr></thead>`;
        table.innerHTML = thHtml;

        const tbody = document.createElement("tbody");

        // Populate Rows with Year Dividers
        const years = Object.keys(groupedByYear).sort((a, b) => Number(b) - Number(a));
        const colCount = typeFilteredAccounts.length + 2; // Month + Accounts + Total

        years.forEach(year => {
            // Year Section Row
            const yearRow = document.createElement("tr");
            yearRow.className = "table-year-row";
            yearRow.innerHTML = `<td colspan="${colCount}">${year}</td>`;
            tbody.appendChild(yearRow);

            // Monthly Rows
            groupedByYear[year].forEach(dateStr => {
                const tr = document.createElement("tr");
                tr.className = "table-data-row";

                let rowHtml = `<td>${formatMonthLabel(dateStr)}</td>`;
                let monthTotal = 0;

                typeFilteredAccounts.forEach(acc => {
                    const amount = rowsByDate[dateStr][acc.id] || 0;
                    monthTotal += amount;
                    rowHtml += `<td>${amount ? formatCurrency(amount) : '-'}</td>`;
                });

                rowHtml += `<td><strong>${formatCurrency(monthTotal)}</strong></td>`;
                tr.innerHTML = rowHtml;
                tbody.appendChild(tr);
            });
        });

        table.appendChild(tbody);
        container.innerHTML = "";
        container.appendChild(table);

    } catch (error) {
        container.innerHTML = `<p>${error.message}</p>`;
    }
}
