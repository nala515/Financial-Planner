//-----------------------------------------------------
// Row normalization + column descriptors
//-----------------------------------------------------

// Flattens one date's contributions across all accounts-with-data into a single row object, with a running total.
function normalizeContributionRow(dateStr, rowsByDate, accountsWithData) {
    const row = {dateStr, year: Number(dateStr.slice(0, 4)), monthLabel: formatMonthYearLabel(dateStr), sortKey: dateStr};

    let total = 0;
    accountsWithData.forEach(acc => {
        const amount = rowsByDate[dateStr][acc.id] || 0;
        row[acc.id] = amount;
        total += amount;
    });
    row.total = total;
    return row;
}

// Converts accounts-with-data into the {label, getValue, ...} descriptors buildTable() expects.
function buildContributionColumnDescriptors(accountsWithData) {
    const columns = [{ label: "Month", getValue: row => row.monthLabel }];

    accountsWithData.forEach(acc => {
        columns.push({label: acc.name, getValue: row => row[acc.id], isCurrency: true, dashIfEmpty: true});
    });
    columns.push({label: "Total", getValue: row => row.total, isCurrency: true, isBold: true});

    return columns;
}

//-----------------------------------------------------
// Main function
//-----------------------------------------------------

async function loadContributions() {
    const container = document.getElementById("contributions");
    if (!container) return;

    try {
        const [accountsRes, contributionsRes] = await Promise.all([
            fetch('/api/accounts'),
            fetch('/api/contributions')
        ]);

        if (!accountsRes.ok || !contributionsRes.ok) {
            throw new Error("Unable to load contribution data");
        }

        const accounts = await accountsRes.json();
        const contributions = await contributionsRes.json();

        if (!Array.isArray(accounts) || accounts.length === 0) {
            container.innerHTML = "<p>No accounts found.</p>";
            return;
        }

        const rowsByDate = {};
        contributions.forEach(c => {
            const dateKey = c.date;
            if (!rowsByDate[dateKey]) {
                rowsByDate[dateKey] = {};
            }
            rowsByDate[dateKey][c.account_id] = c.amount_cents;
        });

        const accountsWithData = accounts.filter(acc => {
            return Object.values(rowsByDate).some(dateRow => {
                const amount = dateRow[acc.id];
                return amount !== undefined && amount !== null && amount !== 0;
            });
        });

        const sortedDates = Object.keys(rowsByDate).sort().reverse();
        const rows = sortedDates.map(dateStr => normalizeContributionRow(dateStr, rowsByDate, accountsWithData));
        const columns = buildContributionColumnDescriptors(accountsWithData);

        container.innerHTML = buildTable(rows, columns, {tableClass: "data-table"});

    } catch (error) {
        container.innerHTML = `<p>${error.message}</p>`;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();
    loadContributions();
});
