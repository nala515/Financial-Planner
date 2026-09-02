//-----------------------------------------------------
// Row normalization + column descriptors
//-----------------------------------------------------

// Flattens one date's income events across all sources into a single row object, with a running total.
function normalizeIncomeRow(dateStr, rowsByDate, sources) {
    const row = {dateStr, year: Number(dateStr.slice(0, 4)), monthLabel: formatMonthYearLabel(dateStr), sortKey: dateStr};

    let total = 0;
    sources.forEach(source => {
        const amount = rowsByDate[dateStr][source.id] || 0;
        row[source.id] = amount;
        total += amount;
    });
    row.total = total;
    return row;
}

// Converts income sources into the {label, getValue, ...} descriptors buildTable() expects.
function buildIncomeColumnDescriptors(sources) {
    const columns = [{ label: "Month", getValue: row => row.monthLabel }];

    sources.forEach(source => {
        columns.push({label: source.name, getValue: row => row[source.id], isCurrency: true, dashIfEmpty: true});
    });
    columns.push({label: "Total", getValue: row => row.total, isCurrency: true, canBeNeg: true});

    return columns;
}

//-----------------------------------------------------
// Main function
//-----------------------------------------------------

async function loadIncome() {
    const container = document.getElementById("income");
    if (!container) return;

    const [sources, events] = await Promise.all([
        fetch('/api/income_sources').then(r => r.json()),
        fetch('/api/income_events').then(r => r.json())
    ]);

    // group events by date: rowsByDate[date][source_id] = amount_cents
    const rowsByDate = {};
    events.forEach(e => {
        if (!rowsByDate[e.date]) {
            rowsByDate[e.date] = {};
        }
        rowsByDate[e.date][e.source_id] = e.amount_cents;
    });

    const sortedDates = Object.keys(rowsByDate).sort().reverse();
    const rows = sortedDates.map(dateStr => normalizeIncomeRow(dateStr, rowsByDate, sources));
    const columns = buildIncomeColumnDescriptors(sources);

    container.innerHTML = buildTable(rows, columns, {
        tableClass: "data-table"
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();
    await loadIncome();
});
