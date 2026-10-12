from sqlalchemy.orm import Session
from datetime import date
from backend.repositories import balances_repository, contributions_repository, income_repository, summary_repository
from backend.account_categories import (
    ACCOUNT_VIEWS,
    INVESTED_SPENDABLE_CATEGORIES,
    SPENDABLE_NON_RETIREMENT_CATEGORIES,
    categories_matching,
    normalize_category,
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

