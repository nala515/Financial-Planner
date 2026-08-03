import csv
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ...database import SessionLocal, initialize_database
from ...models import Account, Contribution, Balance
from ...account_categories import normalize_category


def _get_existing_account(db, name: str, category: str, shared: bool):
    return (
        db.query(Account)
        .filter(Account.name == name, Account.category == category, Account.shared == shared)
        .first()
    )

def parse_bool(value: str) -> bool:
    return str(value).strip().lower() in {"true", "1", "yes", "y"}

def import_csv(csv_path):
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    db = SessionLocal()

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
            if(len(row) > 3):
                contribution_cents = int(float(row[3].strip().strip("$")) * 100)
            else:
                contribution_cents = 0

            balance_date = date(year, month, 1)

            # check for existing balance, add one if none exists
            existing_balance = (
                db.query(Balance)
                .filter(
                    Balance.account_id == account.id,
                    Balance.date == balance_date,
                )
                .first()
            )
            if existing_balance is not None:
                existing_balance.balance_cents = balance_cents
                continue

            balance = Balance(
                account_id=account.id,
                date=balance_date,
                balance_cents=balance_cents,
            )
            db.add(balance)

            if contribution_cents == 0:
                continue

            # check for existing contribution, add one if none exists
            existing_contribution = (
                db.query(Contribution)
                .filter(
                    Contribution.account_id == account.id,
                    Contribution.date == balance_date,
                )
                .first()
            )
            if existing_contribution is not None:
                existing_contribution.amount_cents = contribution_cents
            else:
                contribution = Contribution(
                    account_id=account.id,
                    date=balance_date,
                    amount_cents=contribution_cents,
                )
                db.add(contribution)

    db.commit()
    filename = Path(csv_path).name
    print(f"Imported {filename} as account {name}, id {account.id}")
    return

def import_all_csvs():
    initialize_database()

    cur_dir = Path(__file__).resolve().parent
    csv_dir = cur_dir / "myAccounts"
    csv_files = list(csv_dir.glob("*.csv"))
    num_imported = 0

    if len(csv_files) > 0:
        print(f"Found {len(csv_files)} CSV file(s) to import")
    else:
        raise FileNotFoundError(f"CSV files not found at {csv_dir}")

    db = SessionLocal()
    try:
        for csv_path in csv_files:
            import_csv(csv_path)
            num_imported += 1
    finally:
        db.close()

    return num_imported


if __name__ == "__main__":
    count = import_all_csvs()
    print(f"Imported {count} account(s)")
