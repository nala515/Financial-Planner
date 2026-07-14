import csv
import os
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from database import SessionLocal, initialize_database
from models import Base, Account, MonthlyBalance
from account_categories import normalize_category


def _get_existing_account(db, name: str, category: str, shared: bool):
    return (
        db.query(Account)
        .filter(Account.name == name, Account.category == category, Account.shared == shared)
        .first()
    )


def parse_bool(value: str) -> bool:
    return str(value).strip().lower() in {"true", "1", "yes", "y"}


def import_csv(csv_path: str):
    initialize_database()

    csv_path = Path(csv_path)
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    db = SessionLocal()
    try:
        with csv_path.open(newline="", encoding="utf-8") as handle:
            rows = list(csv.reader(handle))

        if not rows:
            raise ValueError("CSV file is empty")

        name = rows[0][0].strip()
        category = normalize_category(rows[1][0].strip() if len(rows[1]) > 0 else "Cash")
        shared = parse_bool(rows[2][0].strip() if len(rows) > 2 and len(rows[2]) > 0 else "False")

        account = _get_existing_account(db, name, category, shared)
        if account is None:
            account = Account(name=name, shared=shared, category=category)
            db.add(account)
            db.commit()
            db.refresh(account)

        for row in rows[3:]:
            if not row:
                continue
            if len(row) < 3:
                continue

            year = int(row[0].strip())
            month = int(row[1].strip())
            balance_cents = int(float(row[2].strip()) * 100)

            snapshot_date = date(year, month, 1)
            existing_balance = (
                db.query(MonthlyBalance)
                .filter(
                    MonthlyBalance.account_id == account.id,
                    MonthlyBalance.snapshot_date == snapshot_date,
                )
                .first()
            )
            if existing_balance is not None:
                existing_balance.balance_cents = balance_cents
                continue

            balance = MonthlyBalance(
                account_id=account.id,
                snapshot_date=snapshot_date,
                balance_cents=balance_cents,
            )
            db.add(balance)

        db.commit()
        return account.id
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python importer/import_accounts.py <path-to-csv>")
        sys.exit(1)

    account_id = import_csv(sys.argv[1])
    print(f"Imported account with id {account_id}")
