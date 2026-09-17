import csv
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ...database import SessionLocal, initialize_database
from ...models import Account, Contribution, Balance


def _get_existing_account(db, name: str):
    return (
        db.query(Account)
        .filter(Account.name == name)
        .first()
    )

def import_csv(csv_file):
    if not csv_file.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_file}")

    db = SessionLocal()
    count = 0

    with csv_file.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.reader(handle))

        if not rows:
            raise ValueError("CSV file is empty")

        for row in rows[3:]:
            if not row:
                continue
            if len(row) < 4:
                continue

            name = row[0].strip()
            account = _get_existing_account(db, name)
            if account is None:
                print(f"Account {name} not found in db. Skipping.")
                continue

            year = int(row[1].strip())
            month = int(row[2].strip())
            balance_cents = int(float(row[3].strip()) * 100)
            if(len(row) > 3):
                contribution_cents = int(float(row[4].strip().strip("$")) * 100)
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
            count += 1
    db.commit()
    filename = Path(csv_path).name
    print(f"Imported {filename}")
    return count

if __name__ == "__main__":
    initialize_database()
    cur_dir = Path(__file__).resolve().parent
    csv_file = cur_dir + "recent_months.csv"
    count = import_csv()
    print(f"Imported {count} line(s)")
