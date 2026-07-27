import csv
from pathlib import Path

from ..database import SessionLocal, initialize_database
from ..models import Account, MonthlyBalance, Contribution

def export_accounts():
    initialize_database()

    output_dir = Path(__file__).parent / "myAccounts"
    output_dir.mkdir(exist_ok=True)

    db = SessionLocal()

    try:
        accounts = db.query(Account).order_by(Account.name).all()
        
        # loop through every account
        for account in accounts:
            # create file
            csv_path = output_dir / f"{account.name}.csv"
        
            # read balances
            balances = (
                db.query(MonthlyBalance)
                .filter(MonthlyBalance.account_id == account.id)
                .order_by(MonthlyBalance.snapshot_date)
                .all()
            )
        
            # read contributions
            contributions = {
                contribution.date: contribution.amount_cents
                for contribution in (
                    db.query(Contribution)
                    .filter(Contribution.account_id == account.id)
                    .all()
                )
            }
        
            # write header to file
            writer.writerow([account.name])
            writer.writerow([account.category])
            writer.writerow([str(account.shared).lower()])
        
            # build the row
            for balance in balances:
                row = [
                    balance.snapshot_date.year,
                    balance.snapshot_date.month,
                    f"{balance.balance_cents / 100:.2f}",
                ]
        
                contribution = contributions.get(balance.snapshot_date)
                if contribution is not None:
                    row.append(contribution / 100)
          
                writer.writerow(row)

            # finished exporting this account
            print(f"Exported {csv_path}")

        # finished exporting all accounts
        print(f"Exported {len(accounts)} account(s).")
    finally:
        db.close()
