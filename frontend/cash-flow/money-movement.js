//-----------------------------------------------------
// Globals
//-----------------------------------------------------

// Every account's month-over-month change, as the backend returns it:
// [{ account_id, date: "YYYY-MM-01", change_cents }]. Fetched once; the account filter only changes what is shown.
let movementData = [];

//-----------------------------------------------------
// Row normalization + column descriptors
//-----------------------------------------------------

// Flattens one date's changes across the selected accounts into a single row object, with a total.
function normalizeMovementRow(dateStr, rowsByDate, accounts) {
    const row = {
        dateStr,
        year: Number(dateStr.slice(0, 4)),
        monthLabel: formatMonthYearLabel(dateStr),
        sortKey: dateStr
    };

    let total = 0;
    accounts.forEach(acc => {
        const change = rowsByDate[dateStr][acc.id] || 0;
        row[acc.id] = change;
        total += change;
    });
    row.total = total;
    return row;
}

// Converts the selected accounts into the {label, getValue, ...} descriptors buildTable() expects.
// canBeNeg turns on the green/red coloring; dashIfEmpty shows "-" for months with no change.
function buildMovementColumnDescriptors(accounts) {
    const columns = [
        { label: "Month", getValue: row => row.monthLabel }
    ];

    accounts.forEach(acc => {
        columns.push({
            label: acc.name,
            getValue: row => row[acc.id],
            isCurrency: true,
            canBeNeg: true,
            dashIfEmpty: true
        });
    });

    columns.push({
        label: "Total",
        getValue: row => row.total,
        isCurrency: true,
        canBeNeg: true,
        isBold: true
    });

    return columns;
}

//-----------------------------------------------------
// Main function
//-----------------------------------------------------

// Applies the account filter to the cached data and renders the table.
function renderMovement() {
    const container = document.getElementById("money-movement");
    if (!container) return;

    const selected = AccountFilter.getSelectedAccounts();
    if (selected.length === 0) {
        container.innerHTML = "<p>No accounts matching this filter.</p>";
        return;
    }

    // group by date: rowsByDate[date][account_id] = change_cents (selected accounts only)
    const selectedIds = new Set(selected.map(acc => acc.id));
    const rowsByDate = {};
    movementData.forEach(entry => {
        if (!selectedIds.has(entry.account_id)) return;
        if (!rowsByDate[entry.date]) {
            rowsByDate[entry.date] = {};
        }
        rowsByDate[entry.date][entry.account_id] = entry.change_cents;
    });

    const sortedDates = Object.keys(rowsByDate).sort().reverse();
    if (sortedDates.length === 0) {
        container.innerHTML = "<p>Not enough balance entries to show movement yet.</p>";
        return;
    }

    const rows = sortedDates.map(dateStr => normalizeMovementRow(dateStr, rowsByDate, selected));
    const columns = buildMovementColumnDescriptors(selected);

    container.innerHTML = buildTable(rows, columns, {
        tableClass: "data-table"
    });
    initSelectableTable(container);
}

//-----------------------------------------------------
// Event listeners
//-----------------------------------------------------

document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();

    const container = document.getElementById("money-movement");
    const typeSelector = document.getElementById("type-selector");

    try {
        const [accounts, categories, views, movementResponse] = await Promise.all([
            fetch('/api/accounts').then(r => r.json()),
            getAccountCategories(),
            getAccountViews(),
            fetch('/api/analytics/money-movement')
        ]);

        if (!movementResponse.ok) {
            throw new Error("Unable to load money movement");
        }
        movementData = await movementResponse.json();

        // the filter calls onChange as soon as it is initialized, which renders the first table
        AccountFilter.init({
            container: typeSelector,
            accounts,
            categories,
            views,
            defaultView: new URLSearchParams(location.search).get("filter") || "net_worth",
            onChange: () => renderMovement()
        });
    } catch (error) {
        container.innerHTML = `<p>${error.message}</p>`;
    }
});
