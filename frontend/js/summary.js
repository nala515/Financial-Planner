
//-----------------------------------------------------
// Summary (Balance + Contributions + Growth)
//-----------------------------------------------------

function renderSummaryHeader(showInvestmentReturn) {
    const thead = document.getElementById("summary-thead");

    let headerHtml = `<tr><th>Month</th><th>Balance</th><th>Contributions</th><th>Growth</th>`;
    if (showInvestmentReturn) {
        headerHtml += `<th>Investment Return</th>`;
    }
    headerHtml += `</tr>`;

    thead.innerHTML = headerHtml;
}

async function loadSummary() {
    const selector = document.getElementById("account-selector");
    const tbody = document.getElementById("summary-body");

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
            option.dataset.category = account.category
            selector.appendChild(option);
        });

        const params = new URLSearchParams(window.location.search);
        const accountId = getSelectedAccountId();

        // call function to load account summary
        if (accountId) {
            selector.value = accountId;

            // grab category
            const selectedOption = selector.options[selector.selectedIndex];
            const category = selectedOption?.dataset.category;
            
            await loadSummaryForAccount(accountId, category);
        }
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4">${error.message}</td></tr>`;
    }
}

async function loadSummaryForAccount(accountId, category) {
    const tbody = document.getElementById("summary-body");

    if (!tbody) {
        return;
    }

    if (!accountId) {
        tbody.innerHTML = '<tr><td colspan="4">No account selected.</td></tr>';
        return;
    }

    try {
        // determine which header to use and render it
        const showInvestmentReturn = category === "Investment" || category === "Retirement";
        const colCount = showInvestmentReturn ? 5 : 4;
        renderSummaryHeader(showInvestmentReturn);

        // Pull full history for the account
        // Adjust the start date if you'd rather default to something
        // like "this year" or the account's creation date.
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
            tbody.innerHTML = `<tr><td colspan="${colCount}">No monthly data found.</td></tr>`;
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
            yearRow.innerHTML = `<td colspan="${colCount}">${year}</td>`;
            tbody.appendChild(yearRow);

            groupedRows[year].forEach(row => {
                const tr = document.createElement("tr");
                tr.className = "table-data-row";

                // set up investment return column, if applicable
                let investmentReturnCell = ""
                if (showInvestmentReturn) {
                    const returnColorClass =
                        row.investment_return > 0 ? "growth-positive" :
                        row.investment_return < 0 ? "growth-negative" :
                        "growth-neutral";
                    investmentReturnCell = `<td class="${returnColorClass}">${formatCurrency(row.investment_return)}</td>`
                }

                // set up color for growth column
                const growthColorClass =
                    row.growth > 0 ? "growth-positive" :
                    row.growth < 0 ? "growth-negative" :
                    "growth-neutral";

                // put it all together
                tr.innerHTML = `
                    <td>${formatMonthLabel(row.month)}</td>
                    <td>${formatCurrency(row.ending_balance)}</td>
                    <td>${formatCurrency(row.contributions)}</td>
                    <td class="${growthColorClass}">${formatCurrency(row.growth)}</td>
                    ${investmentReturnCell}
                `;
                tbody.appendChild(tr);
            });
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4">${error.message}</td></tr>`;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();
    loadSummary();

    const selector = document.getElementById("account-selector");

    selector.addEventListener("change", async (event) => {
        const accountId = event.target.value;
        setSelectedAccountId(accountId);

        // Get the selected <option> element to read the data-category attribute
        const selectedOption = event.target.selectedOptions[0];
        const category = selectedOption ? selectedOption.dataset.category : null;

        await loadSummaryForAccount(accountId, category);
    });
});
