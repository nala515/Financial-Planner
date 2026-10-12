from sqlalchemy.orm import Session
from datetime import date
from backend.repositories import accounts_repository, balances_repository, contributions_repository, income_repository, summary_repository
from backend.account_categories import (
    ACCOUNT_VIEWS,
    INVESTED_SPENDABLE_CATEGORIES,
    SPENDABLE_NON_RETIREMENT_CATEGORIES,
    categories_matching,
    normalize_category,
    get_category_attributes,
)

# returns a map of contributions for easy access by date
def build_contributions_map(contributions: list):
    contrib_map: dict[tuple[int, int, int], int] = {}
    for c in contributions:
        contrib_map[(c.account_id, c.date.year, c.date.month)] = c.amount_cents
    return contrib_map


def calculate_growth(
    db: Session,
    account_id: int,
    start: date,
    end: date,
):
    # Fetch balances and contributions and create maps
    balances = balances_repository.db_get_account_balances(db, account_id, start, end)
    contributions = contributions_repository.db_get_account_contributions(db, account_id, start, end)
    contrib_map = build_contributions_map(contributions);
    
    # Sort balances to ensure correct month-over-month pairing
    balances = sorted(balances, key=lambda b: b.date)
    if not balances:
        return []

    results = []

    # Iterate through pairs to calculate growth metrics
    for i in range(1, len(balances)):
        prev_balance = balances[i - 1]
        curr_balance = balances[i]

        # Use the contribution map for the month being measured
        # We look up the contribution that occurred during the "prev" month
        key = (account_id, prev_balance.date.year, prev_balance.date.month)
        contrib = contrib_map.get(key, 0)

        # Calculate gains by doing (balance change - contributions)
        growth = curr_balance.balance_cents - prev_balance.balance_cents
        investment_return = growth - contrib

        results.append({
            "month": prev_balance.date,
            "starting_balance": prev_balance.balance_cents,
            "ending_balance": curr_balance.balance_cents,
            "growth": growth,
            "contributions": contrib,
            "investment_return": investment_return,
        })

    # Handle the most recent month, which won't have gains yet, just balance/contributions
    last_balance = balances[-1]
    last_key = (account_id, last_balance.date.year, last_balance.date.month)
    last_contrib = contrib_map.get(last_key, 0)

    results.append({
        "month": last_balance.date,
        "starting_balance": last_balance.balance_cents,
        "ending_balance": "TBD",
        "growth": "TBD",
        "contributions": last_contrib,
        "investment_return": "TBD",
    })

    return results

#-------------------------
# Account summary
#-------------------------
def _month_idx(d: date) -> int:
    # months since year 0, so consecutive months differ by exactly 1
    return d.year * 12 + d.month - 1


def _build_account_series(balances: list, contributions: list, last_idx: int):
    """
    One account's monthly balances from its first entry through last_idx.
    A month with no entry carries the previous balance forward, so a stale
    account shows $0 gain rather than a shifted window.
    Returns (first_idx, {idx: balance_cents}, {idx: contribution_cents}).
    """
    entries = {_month_idx(b.date): b.balance_cents for b in balances}
    contribs: dict[int, int] = {}
    for c in contributions:
        idx = _month_idx(c.date)
        contribs[idx] = contribs.get(idx, 0) + c.amount_cents

    first_idx = min(entries)
    series = {}
    balance = entries[first_idx]
    for idx in range(first_idx, last_idx + 1):
        balance = entries.get(idx, balance)
        series[idx] = balance
    return first_idx, series, contribs


def _build_monthly_account_rows(accounts: list, balances: list, contributions: list):
    """
    One row per month. Balances are the start-of-month entry; contributions and
    gain are what happened DURING that month (gain(M) = balance(M+1) - balance(M) - contribution(M)).
    Only invested accounts get contributions/gain; cash and credit only add to balances.
    Cumulative fields cover all months BEFORE this row, so for invested accounts:
        invested_balance == opening_balance + cumulative_contributions + cumulative_gain
    The final row has no gain yet (complete=False).
    """
    invested_ids = {a.id for a in accounts if get_category_attributes(a.category)["invested"]}

    balances_by_account: dict[int, list] = {}
    for b in balances:
        balances_by_account.setdefault(b.account_id, []).append(b)
    contribs_by_account: dict[int, list] = {}
    for c in contributions:
        contribs_by_account.setdefault(c.account_id, []).append(c)

    if not balances_by_account:
        return []

    last_idx = max(_month_idx(b.date) for b in balances)
    first_idx = min(_month_idx(b.date) for b in balances)

    months = {
        idx: {"invested": 0, "cash": 0, "contributions": 0, "gain": 0, "opening_added": 0}
        for idx in range(first_idx, last_idx + 1)
    }

    for account_id, account_balances in balances_by_account.items():
        acct_first, series, contribs = _build_account_series(
            account_balances, contribs_by_account.get(account_id, []), last_idx
        )
        is_invested = account_id in invested_ids

        for idx, balance in series.items():
            m = months[idx]
            if not is_invested:
                m["cash"] += balance
                continue

            contrib = contribs.get(idx, 0)
            m["invested"] += balance
            m["contributions"] += contrib
            if idx == acct_first:
                m["opening_added"] += balance
            if idx < last_idx:
                m["gain"] += series[idx + 1] - balance - contrib

    rows = []
    cum_opening = cum_contributions = cum_gain = 0
    for idx in range(first_idx, last_idx + 1):
        m = months[idx]
        cum_opening += m["opening_added"]
        complete = idx < last_idx

        return_pct = None
        base = m["invested"] + m["contributions"]  # contributions count as invested from the start of the month
        if complete and base > 0:
            return_pct = round(m["gain"] / base * 100, 2)

        rows.append({
            "year": idx // 12,
            "month": idx % 12 + 1,
            "total_balance": m["invested"] + m["cash"],
            "invested_balance": m["invested"],
            "cash_balance": m["cash"],
            "opening_balance": cum_opening,
            "cumulative_contributions": cum_contributions,
            "cumulative_gain": cum_gain,
            "contributions": m["contributions"],
            "gain": m["gain"] if complete else None,
            "return_pct": return_pct,
            "complete": complete,
            "opening_added": m["opening_added"],
        })

        if complete:
            cum_contributions += m["contributions"]
            cum_gain += m["gain"]

    return rows


def _roll_up_account_years(monthly_rows: list):
    """
    One row per year. Balances are start-of-year (first row's state) plus end_* fields
    (the next year's start, or the latest entry for the last year). Contributions and gain
    are summed over complete months only. return_pct is a simple dollar-weighted return:
    gain divided by (starting balance + each contribution/new-account opening balance,
    weighted by the fraction of the period it was invested).
    """
    by_year: dict[int, list] = {}
    for row in monthly_rows:
        by_year.setdefault(row["year"], []).append(row)

    yearly = []
    for year, rows in by_year.items():
        first = rows[0]
        complete_rows = [r for r in rows if r["complete"]]
        n = len(complete_rows)

        contributions = sum(r["contributions"] for r in complete_rows)
        gain = sum(r["gain"] for r in complete_rows) if n else None

        return_pct = None
        if n:
            base = first["invested_balance"]
            for i, r in enumerate(complete_rows):
                inflow = r["contributions"] + (r["opening_added"] if i > 0 else 0)
                base += inflow * (n - i) / n
            if base > 0:
                return_pct = round(gain / base * 100, 2)

        yearly.append({
            "year": year,
            "months": n,
            "total_balance": first["total_balance"],
            "invested_balance": first["invested_balance"],
            "cash_balance": first["cash_balance"],
            "opening_balance": first["opening_balance"],
            "cumulative_contributions": first["cumulative_contributions"],
            "cumulative_gain": first["cumulative_gain"],
            "contributions": contributions,
            "gain": gain,
            "return_pct": return_pct,
            "complete": n == len(rows),
        })

    latest = monthly_rows[-1]
    for i, row in enumerate(yearly):
        end = yearly[i + 1] if i + 1 < len(yearly) else latest
        row["end_total_balance"] = end["total_balance"]
        row["end_invested_balance"] = end["invested_balance"]
        row["end_cash_balance"] = end["cash_balance"]

    return yearly


def get_account_summary(db: Session, account_ids: list[int], granularity: str = "month"):
    accounts = accounts_repository.db_get_accounts_by_ids(db, account_ids)
    ids = [a.id for a in accounts]

    balances = balances_repository.db_get_balances_for_accounts(db, ids)
    contributions = contributions_repository.db_get_contributions_for_accounts(db, ids)

    monthly_rows = _build_monthly_account_rows(accounts, balances, contributions)
    if not monthly_rows:
        return {"has_invested": False, "has_cash": False, "latest": None, "rows": []}

    invested_flags = [get_category_attributes(a.category)["invested"] for a in accounts]
    latest = monthly_rows[-1]
    rows = monthly_rows if granularity == "month" else _roll_up_account_years(monthly_rows)

    # opening_added is only needed internally for the yearly return calculation
    public_rows = [{k: v for k, v in r.items() if k != "opening_added"} for r in rows]

    return {
        "has_invested": any(invested_flags),
        "has_cash": not all(invested_flags),
        "latest": {k: v for k, v in latest.items() if k != "opening_added"},
        "rows": public_rows,
    }
