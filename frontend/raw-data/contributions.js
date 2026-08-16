
//-----------------------------------------------------
// Contributions
//-----------------------------------------------------

async function loadContributions() {
    const container = document.getElementById("contributions");
    if (!container) return;

    try {
        // 1. Fetch active accounts and all contributions in parallel
        const [accountsRes, contributionsRes] = await Promise.all([
            fetch('/api/accounts'),
            fetch('/api/contributions') // Endpoint returning all MonthlyContribution records
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

        // 2. Map contributions by date: { "YYYY-MM-DD": { account_id: amount_cents } }
        const rowsByDate = {};
        contributions.forEach(c => {
            const dateKey = c.date;
            if (!rowsByDate[dateKey]) {
                rowsByDate[dateKey] = {};
            }
            rowsByDate[dateKey][c.account_id] = c.amount_cents;
        });

        // Filter out accounts with no contribution entries at all
        const accountsWithData = accounts.filter(acc => {
            return Object.values(rowsByDate).some(dateRow => {
                const amount = dateRow[acc.id];
                return amount !== undefined && amount !== null && amount !== 0;
            });
        });

        // 3. Group dates by Year for section headers
        const sortedDates = Object.keys(rowsByDate).sort().reverse();
        const groupedByYear = sortedDates.reduce((groups, dateStr) => {
            const year = formatYearLabel(dateStr);
            if (!groups[year]) groups[year] = [];
            groups[year].push(dateStr);
            return groups;
        }, {});

        // 4. Build Table DOM
        const table = document.createElement("table");
        table.className = "data-table";

        // Build Header
        let thHtml = `<thead><tr><th>Month</th>`;
        accountsWithData.forEach(acc => {
            thHtml += `<th>${acc.name}</th>`;
        });
        thHtml += `<th>Total</th></tr></thead>`;
        table.innerHTML = thHtml;

        const tbody = document.createElement("tbody");

        // Populate Rows with Year Dividers
        const years = Object.keys(groupedByYear).sort((a, b) => Number(b) - Number(a));
        const colCount = accountsWithData.length + 2; // Month + Accounts + Total

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

                accountsWithData.forEach(acc => {
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

document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();
    loadContributions();
});
