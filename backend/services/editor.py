from sqlalchemy.orm import Session
from backend.repositories import balances_repository, contributions_repository, accounts_repository

def find_missing_rows(db, start_ym, end_ym):
    accounts = accounts_repository.list_all(db)
    balances_by_account = balances_repository.all_by_account(db)
    contributions_by_account = contributions_repository.all_by_account(db)

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
                break  # account is dead — stop scanning entirely, no row for this month either

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

