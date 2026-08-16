async function loadIncome() {
    const container = document.getElementById("income");
    if (!container) return;

    // Fetch income sources and events
    const [sources, events] = await Promise.all([
        fetch('/api/income_sources').then(r => r.json()),
        fetch('/api/income_events').then(r => r.json())
    ]);

    // group the raw balance data by date for the matrix view: rowsByDate[date][account_id]
    const rowsByDate = {};
    events.forEach(b => {
        if (!rowsByDate[b.date]) {
            rowsByDate[b.date] = {};
        }
        rowsByDate[b.date][b.account_id] = b.balance_cents;
    });

    // group dates by Year for section headers
    const sortedDates = Object.keys(rowsByDate).sort().reverse();
    const groupedByYear = sortedDates.reduce((groups, dateStr) => {
        const year = formatYearLabel(dateStr);
        if (!groups[year]) groups[year] = [];
        groups[year].push(dateStr);
        return groups;
    }, {});

    // build table DOM
    const table = document.createElement("table");
    table.className = "data-table";

    let thHtml = `<thead><tr><th>Month</th>`;
    sources.forEach(source => {
        thHtml += `<th data-income-source-id="${source.id}">${source.name}</th>`;
    });
    thHtml += `<th>Total</th></tr></thead>`;
    table.innerHTML = thHtml;

    const tbody = document.createElement("tbody");

    // populate rows with Year dividers
    const years = Object.keys(groupedByYear).sort((a, b) => Number(b) - Number(a));
    const colCount = sources.length + 2; // Month + Sources + Total

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

            for (let i = 1; i < colCount - 1; i++) {
                const source = sources[i - 1];
                const event = events.find(event =>
                    event.date === dateStr &&
                    event.source_id === source.id
                );

                const amountCents = event ? event.amount_cents : 0;
                monthTotal += amountCents;
                rowHtml += `<td>${amountCents ? formatCurrency(amountCents) : '-'}</td>`;
            }

            // Total column
            rowHtml += `<td class="growth-positive">${formatCurrency(monthTotal)}</td>`;
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
    await loadIncome();
});
