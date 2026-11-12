from sqlalchemy.orm import Session
from backend.repositories import balances_repository


def _month_idx(year: int, month: int) -> int:
    # months since year 0, so consecutive months differ by exactly 1
    return year * 12 + month - 1


def _month_date(idx: int) -> str:
    # "YYYY-MM-01", the same date format the balances API returns
    return f"{idx // 12:04d}-{idx % 12 + 1:02d}-01"


def build_money_movement(balance_rows: list[tuple[int, int, int, int]]) -> list[dict]:
    """
    balance_rows: (account_id, year, month, balance_cents) tuples.

    Returns one row per account per month: {"account_id", "date", "change_cents"},
    where change_cents = balance(month) - balance(previous month). Oldest first.

    An account's first entry has nothing to compare against, so it produces no row.
    A month with no entry carries the previous balance forward (stale accounts show
    $0 change rather than a jump later), the same rule the other pages use.
    """
    entries_by_account: dict[int, dict[int, int]] = {}
    for account_id, year, month, cents in balance_rows:
        entries_by_account.setdefault(account_id, {})[_month_idx(year, month)] = cents

    if not entries_by_account:
        return []

    last_idx = max(idx for entries in entries_by_account.values() for idx in entries)

    rows = []
    for account_id, entries in entries_by_account.items():
        first_idx = min(entries)
        previous = entries[first_idx]

        for idx in range(first_idx + 1, last_idx + 1):
            current = entries.get(idx, previous)
            rows.append({
                "account_id": account_id,
                "date": _month_date(idx),
                "change_cents": current - previous,
            })
            previous = current

    rows.sort(key=lambda r: (r["date"], r["account_id"]))
    return rows


def get_money_movement(db: Session) -> list[dict]:
    balances = balances_repository.db_get_all_balances(db)
    balance_rows = [
        (b.account_id, b.date.year, b.date.month, b.balance_cents)
        for b in balances
    ]
    return build_money_movement(balance_rows)
