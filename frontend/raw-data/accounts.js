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
        const [accountsResponse, balancesResponse, categories] = await Promise.all([
            fetch(`/api/accounts`),
            fetch(`/api/balances`),
            getAccountCategories(),
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
            if (!existing || b.date > existing.date) {
                latestBalanceByAccount[b.account_id] = b;
            }
        });

        // Known categories come from ACCOUNT_CATEGORIES (in the order the backend
        // defines them); anything not in there goes to "Other", which is shown last
        const OTHER_KEY = "Other";
        const knownKeys = new Set(Object.keys(categories));
        const sectionKeys = [...knownKeys, OTHER_KEY];

        // Group accounts by category
        const accountsByCategory = new Map();
        accounts.forEach(account => {
            let category = account.category || "Cash";
            if (!knownKeys.has(category)) {
                category = OTHER_KEY;
            }
            if (!accountsByCategory.has(category)) {
                accountsByCategory.set(category, []);
            }
            accountsByCategory.get(category).push(account);
        });

        // Render each section in order, skipping empty ones
        sectionKeys.forEach(key => {
            const categoryAccounts = accountsByCategory.get(key);
            if (!categoryAccounts || categoryAccounts.length === 0) return;

            const heading = document.createElement("h3");
            heading.className = "account-section-header";
            heading.textContent = key;
            div.appendChild(heading);

            const list = document.createElement("ul");
            list.className = "account-list";

            categoryAccounts.forEach(account => {
                const latest = latestBalanceByAccount[account.id];
                const balanceDisplay = latest
                    ? formatCurrency(latest.balance_cents)
                    : "No balance yet";

                const item = document.createElement("li");
                item.className = "account-card account-card-row";
                item.innerHTML = `
                    <div class="account-card-info">
                        <strong>${account.name}</strong>
                        <small>${account.shared ? "Shared" : "Personal"}</small>
                        <small><a href="/summary" onclick="setSelectedAccountId(${account.id})">Summary</a></small>
                    </div>
                    <div class="account-card-balance">${balanceDisplay}</div>
                `;
                list.appendChild(item);
            });

            div.appendChild(list);
        });
    } catch (error) {
        div.innerHTML = `<p>${error.message}</p>`;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadNav();
    loadAccounts();
});
