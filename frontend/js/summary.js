
//-----------------------------------------------------
// Summary (Balance + Contributions + Growth)
//-----------------------------------------------------

async function loadSummary() {
    const selector = document.getElementById("account-selector");
    const tbody = document.getElementById("table-body");

    if (!selector || !tbody) {
        return;
    }

    try {
        const response = await fetch(`/api/accounts`);

        if (!response.ok) {
            throw new Error("Unable to load accounts");
        }

        const accounts = await response.json();
        selector.innerHTML = "";

        if (!Array.isArray(accounts) || accounts.length === 0) {
            selector.innerHTML = '<option value="">No accounts available</option>';
            tbody.innerHTML = '<tr><td colspan="4">No accounts found yet.</td></tr>';
            return;
        }

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "Select an account";
        selector.appendChild(defaultOption);

        accounts.forEach(account => {
            const option = document.createElement("option");
            option.value = account.id;
            option.textContent = account.name;
            selector.appendChild(option);
        });

        const params = new URLSearchParams(window.location.search);
        const accountId = getSelectedAccountId();

        if (accountId) {
            selector.value = accountId;
            await loadSummaryForAccount(accountId);
        }
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4">${error.message}</td></tr>`;
    }
}

async function loadSummaryForAccount(accountId) {
    const tbody = document.getElementById("table-body");

    if (!tbody) {
        return;
    }

    if (!accountId) {
        tbody.innerHTML = '<tr><td colspan="4">No account selected.</td></tr>';
        return;
    }

    try {
        // Assumption: pull full history. Adjust the start date if you'd
        // rather default to something like "this year" or the account's
        // creation date.
        const start = "2000-01-01";
        const end = new Date().toISOString().split("T")[0];

        const response = await fetch(
            `/api/accounts/${accountId}/summary?start=${start}&end=${end}`
        );

        if (!response.ok) {
            throw new Error("Unable to load summary");
        }

        const rows = await response.json();
        tbody.innerHTML = "";

        if (!Array.isArray(rows) || rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No monthly data found.</td></tr>';
            return;
        }

        const sortedRows = [...rows].sort(
            (a, b) => new Date(b.month) - new Date(a.month)
        );

        const groupedRows = sortedRows.reduce((groups, row) => {
            const year = formatYearLabel(row.month);
            if (!groups[year]) {
                groups[year] = [];
            }
            groups[year].push(row);
            return groups;
        }, {});

        const years = Object.keys(groupedRows).sort((a, b) => Number(b) - Number(a));

        years.forEach(year => {
            const yearRow = document.createElement("tr");
            yearRow.className = "table-year-row";
            yearRow.innerHTML = `<td colspan="4">${year}</td>`;
            tbody.appendChild(yearRow);

            groupedRows[year].forEach(row => {
                const tr = document.createElement("tr");
                tr.className = "table-data-row";

                const growthClass =
                    row.investment_return > 0 ? "growth-positive" :
                    row.investment_return < 0 ? "growth-negative" :
                    "growth-neutral";

                tr.innerHTML = `
                    <td>${formatMonthLabel(row.month)}</td>
                    <td>${formatCurrency(row.ending_balance)}</td>
                    <td>${formatCurrency(row.contributions)}</td>
                    <td class="${growthClass}">${formatCurrency(row.growth)}</td>
                    <td class="${growthClass}">${formatCurrency(row.investment_return)}</td>
                `;
                tbody.appendChild(tr);
            });
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4">${error.message}</td></tr>`;
    }
}
