
//-----------------------------------------------------
// Contributions
//-----------------------------------------------------

async function loadContributions() {
    const container = document.getElementById("contributions");
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
            await loadContributionsForAccount(accountId, container);
        }
    } catch (error) {
        container.innerHTML = `<p>${error.message}</p>`;
    }
}

async function loadContributionsForAccount(accountId, container) {
    if (!accountId) {
        container.innerHTML = "<p>No account selected.</p>";
        return;
    }

    try {
        const response = await fetch(`/api/accounts/${accountId}/contributions`);

        if (!response.ok) {
            throw new Error("Unable to load contributions");
        }

        const contributions = await response.json();
        container.innerHTML = "";

        if (!Array.isArray(contributions) || contributions.length === 0) {
            container.innerHTML = "<p>No monthly contributions found.</p>";
            return;
        }

        const sortedContributions = [...contributions].sort((a, b) => new Date(b.date) - new Date(a.date));
        const groupedContributions = sortedContributions.reduce((groups, contribution) => {
            const year = formatYearLabel(contribution.date);
            if (!groups[year]) {
                groups[year] = [];
            }
            groups[year].push(contribution);
            return groups;
        }, {});

        const years = Object.keys(groupedContributions).sort((a, b) => Number(b) - Number(a));
        const list = document.createElement("ul");
        list.className = "account-list";

        years.forEach(year => {
            const yearSection = document.createElement("li");
            yearSection.className = "account-card year-section";
            yearSection.innerHTML = `<strong>${year}</strong>`;
            list.appendChild(yearSection);

            groupedContributions[year].forEach(contribution => {
                const item = document.createElement("li");
                item.className = "account-card balance-row";
                item.innerHTML = `
                    <span>${formatMonthLabel(contribution.date)}</span>
                    <span>${formatCurrency(contribution.amount_cents)}</span>
                `;
                list.appendChild(item);
            });
        });

        container.appendChild(list);
    } catch (error) {
        container.innerHTML = `<p>${error.message}</p>`;
    }
}
