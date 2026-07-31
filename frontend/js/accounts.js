//-----------------------------------------------------
// Accounts
//-----------------------------------------------------

let accountCache = [];

async function loadAccounts() {
    const div = document.getElementById("accounts");
    if (!div) {
        return;
    }

    try {
        const [accountsResponse, balancesResponse] = await Promise.all([
            fetch(`/api/accounts`),
            fetch(`/api/balances`),
        ]);

        if (!accountsResponse.ok) {
            throw new Error("Unable to load accounts");
        }
        if (!balancesResponse.ok) {
            throw new Error("Unable to load balances");
        }

        const accounts = await accountsResponse.json();
        const balances = await balancesResponse.json();

        accountCache = Array.isArray(accounts) ? accounts : [];
        div.innerHTML = "";

        if (!Array.isArray(accounts) || accounts.length === 0) {
            div.innerHTML = "<p>No accounts found yet.</p>";
            return;
        }

        // Find the most recent balance per account
        const latestBalanceByAccount = {};
        balances.forEach(b => {
            const existing = latestBalanceByAccount[b.account_id];
            if (!existing || new Date(b.date) > new Date(existing.date)) {
                latestBalanceByAccount[b.account_id] = b;
            }
        });

        const list = document.createElement("ul");
        list.className = "account-list";

        accounts.forEach(account => {
            const latest = latestBalanceByAccount[account.id];
            const balanceDisplay = latest
                ? formatCurrency(latest.balance_cents)
                : "No balance yet";

            const item = document.createElement("li");
            item.className = "account-card account-card-row";
            item.innerHTML = `
                <div class="account-card-info">
                    <strong>${account.name}</strong>
                    <small>${account.category || "Cash"}</small>
                    <small>${account.shared ? "Shared" : "Personal"}</small>
                    <small>${account.category_attributes?.retirement ? "Retirement" : "Non-retirement"}</small>
                    <a href="/balances">View balances</a>
                </div>
                <div class="account-card-balance">${balanceDisplay}</div>
            `;
            list.appendChild(item);
        });

        div.appendChild(list);
    } catch (error) {
        div.innerHTML = `<p>${error.message}</p>`;
    }
}
