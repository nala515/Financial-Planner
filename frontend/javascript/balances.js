//-----------------------------------------------------
// Balances
//-----------------------------------------------------

async function loadBalances() {
    const container = document.getElementById("balances");
    const selector = document.getElementById("account-selector");

    if (!container || !selector) {
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
            container.innerHTML = "<p>No accounts found yet.</p>";
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
            await loadBalancesForAccount(accountId, container);
        }
    } catch (error) {
        container.innerHTML = `<p>${error.message}</p>`;
    }
}

async function loadBalancesForAccount(accountId, container) {
    if (!accountId) {
        container.innerHTML = "<p>No account selected.</p>";
        return;
    }

    try {
        const response = await fetch(`/api/accounts/${accountId}/balances`);

        if (!response.ok) {
            throw new Error("Unable to load balances");
        }

        const balances = await response.json();
        container.innerHTML = "";

        if (!Array.isArray(balances) || balances.length === 0) {
            container.innerHTML = "<p>No monthly balances found.</p>";
            return;
        }

        const sortedBalances = [...balances].sort((a, b) => new Date(b.snapshot_date) - new Date(a.snapshot_date));
        const groupedBalances = sortedBalances.reduce((groups, balance) => {
            const year = formatYearLabel(balance.snapshot_date);
            if (!groups[year]) {
                groups[year] = [];
            }
            groups[year].push(balance);
            return groups;
        }, {});

        const years = Object.keys(groupedBalances).sort((a, b) => Number(b) - Number(a));
        const list = document.createElement("ul");
        list.className = "account-list";

        years.forEach(year => {
            const yearSection = document.createElement("li");
            yearSection.className = "account-card year-section";
            yearSection.innerHTML = `<strong>${year}</strong>`;
            list.appendChild(yearSection);

            groupedBalances[year].forEach(balance => {
                const item = document.createElement("li");
                item.className = "account-card balance-row";
                item.innerHTML = `
                    <span>${formatMonthLabel(balance.snapshot_date)}</span>
                    <span>${formatCurrency(balance.balance_cents)}</span>
                `;
                list.appendChild(item);
            });
        });

        container.appendChild(list);
    } catch (error) {
        container.innerHTML = `<p>${error.message}</p>`;
    }
}
