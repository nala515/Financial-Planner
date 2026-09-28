# services/missing_entries.py

from datetime import date
from typing import Iterator

from sqlalchemy.orm import Session

from backend.repositories import accounts_repository, balances_repository, contributions_repository


def month_iter(start_ym: tuple[int, int], end_ym: tuple[int, int]) -> Iterator[tuple[int, int]]:
    y, m = start_ym
    while (y, m) <= end_ym:
        yield y, m
        m += 1
        if m > 12:
            y, m = y + 1, 1


def _group_by_account_month(rows, amount_attr: str) -> dict[int, dict[tuple[int, int], int]]:
    grouped: dict[int, dict[tuple[int, int], int]] = {}
    for r in rows:
        key = (r.date.year, r.date.month)
        grouped.setdefault(r.account_id, {})[key] = getattr(r, amount_attr)
    return grouped


def find_missing_rows(db: Session, start_ym: tuple[int, int], end_ym: tuple[int, int]) -> list[dict]:
    accounts = accounts_repository.db_get_accounts(db)
    balances_by_account = _group_by_account_month(
        balances_repository.db_get_all_balances(db), "balance_cents"
    )
    contributions_by_account = _group_by_account_month(
        contributions_repository.db_get_all_contributions(db), "amount_cents"
    )

    rows = []
    for a in accounts:
        bals = balances_by_account.get(a.id, {})
        contribs = contributions_by_account.get(a.id, {})
        has_any_contribution = len(contribs) > 0

        known_months = sorted(bals.keys())
        first = known_months[0] if known_months else start_ym
        scan_start = max(first, start_ym)

        for (y, m) in month_iter(scan_start, end_ym):
            bal = bals.get((y, m))
            has_balance = bal is not None

            if has_balance and bal == 0:
                break  # dead account — stop scanning entirely, no row for this month either

            missing_balance = not has_balance
            missing_contribution = has_any_contribution and (y, m) not in contribs

            if missing_balance or missing_contribution:
                rows.append({
                    "account_name": a.name,
                    "year": y,
                    "month": f"{m:02d}",
                    "balance": "" if missing_balance else f"{bal / 100:.2f}",
                    "contribution": "",
                })

    rows.sort(key=lambda r: (r["year"], r["month"], r["account_name"]))
    return rows
