//-----------------------------------------------------
// Utilities
//-----------------------------------------------------

function getSelectedAccountId() {
    return localStorage.getItem("selectedAccount");
}

function setSelectedAccountId(accountId) {
    localStorage.setItem("selectedAccount", accountId);
}

function populateAccountCategoryOptions(select) {
    if (!select) {
        return;
    }

    const categories = ["Cash", "Investment", "Retirement", "HSA", "529"];
    select.innerHTML = "";

    categories.forEach(category => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
    });
}

function formatCurrency(cents) {
    return (cents / 100).toLocaleString("en-US", {
        style: "currency",
        currency: "USD"
    });
}

function formatMonthLabel(snapshotDate) {
    const date = new Date(snapshotDate);
    return date.toLocaleDateString("en-US", { month: "long" });
}

function formatYearLabel(snapshotDate) {
    const date = new Date(snapshotDate);
    return date.getFullYear().toString();
}

async function loadNav() {
    const placeholder = document.getElementById("nav-placeholder");
    if (!placeholder) {
        return;
    }
    const response = await fetch("/static/html/nav.html");
    if (!response.ok) {
        placeholder.innerHTML = `<p style="color:red">Nav failed to load: ${response.status}</p>`;
        return;
    }
    placeholder.innerHTML = await response.text();
}
