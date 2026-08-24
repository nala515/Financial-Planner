
//-----------------------------------------------------
// Summary (Balance + Contributions + Growth)
//-----------------------------------------------------

//-----------------------------------------------------
// Row normalization + column descriptors for buildTable()
//-----------------------------------------------------

// Attaches year/month-label/sort fields to one summary row returned by the API; all other fields pass through untouched.
function normalizeSummaryRow(row) {
    return {...row, year: Number(row.month.slice(0, 4)), monthLabel: formatMonthYearLabel(row.month), sortKey: row.month};
}

// Builds the column set for an account's summary table; growth-type accounts get two extra columns.
function buildSummaryColumnDescriptors(isGrowthType) {
    const columns = [
        { label: "Month", getValue: row => row.monthLabel },
        { label: "Starting Balance", getValue: row => row.starting_balance, isCurrency: true }
    ];
    if (isGrowthType) {
        columns.push(
            { label: "Contributions", getValue: row => row.contributions, isCurrency: true },
            { label: "Investment Return", getValue: row => row.investment_return, isCurrency: true, canBeNeg: true }
        );
    }
    columns.push({ label: "Growth", getValue: row => row.growth, isCurrency: true, canBeNeg: true });

    return columns;
}

//-----------------------------------------------------
// Main functions
//-----------------------------------------------------

async function loadSummary() {
    const selector = document.getElementById("account-selector");
    const container = document.getElementById("summary");

    if (!selector || !container) {
        return;
    }

    try {
        const accounts = await loadAccounts();
        const accountId = await populateAccountDropdown(selector, accounts);
        // call function to load account summary
        if (accountId) {
            // grab category
            const selectedOption = selector.options[selector.selectedIndex];
            const category = selectedOption?.dataset.category;
            await loadSummaryForAccount(accountId, category);
        }
    } catch (error) {
        container.innerHTML = `<p>${error.message}</p>`;
    }
}

async function loadSummaryForAccount(accountId, category) {
    const container = document.getElementById("summary");
    if (!container) return;

    if (!accountId) {
        container.innerHTML = `<p>No account selected.</p>`;
        return;
    }
    const isGrowthType = category === "Investment" || category === "Retirement";

    try {
        const start = "2000-01-01";
        const end = new Date().toISOString().split("T")[0];

        const response = await fetch(`/api/accounts/${accountId}/summary?start=${start}&end=${end}`);
        if (!response.ok) {
            throw new Error("Unable to load summary");
        }

        const rawRows = await response.json();
        if (!Array.isArray(rawRows) || rawRows.length === 0) {
            container.innerHTML = `<p>No monthly data found.</p>`;
            return;
        }

        const rows = rawRows.map(normalizeSummaryRow).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
        const columns = buildSummaryColumnDescriptors(isGrowthType);
        container.innerHTML = buildTable(rows, columns, { tableClass: "data-table" });

    } catch (error) {
        container.innerHTML = `<p>${error.message}</p>`;
    }
}

//-----------------------------------------------------
// Event listener
//-----------------------------------------------------
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
