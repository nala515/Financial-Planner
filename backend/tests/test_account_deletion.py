from datetime import date

from repositories.accounts_repository import db_delete_account
from database import SessionLocal
from models import Account, MonthlyBalance, Contribution


def test_delete_account_removes_related_balance_and_contribution_rows():
    db = SessionLocal()
    try:
        account = Account(name="Test", shared=False, category="Cash")
        db.add(account)
        db.commit()
        db.refresh(account)

        db.add(MonthlyBalance(account_id=account.id, snapshot_date=date(2024, 1, 1), balance_cents=1000))
        db.add(Contribution(account_id=account.id, date=date(2024, 1, 1), amount_cents=500, notes="test"))
        db.commit()

        account_id = account.id
        deleted = db_delete_account(db, account_id)

        assert deleted is True
        assert db.query(Account).filter(Account.id == account_id).count() == 0
        assert db.query(MonthlyBalance).filter(MonthlyBalance.account_id == account_id).count() == 0
        assert db.query(Contribution).filter(Contribution.account_id == account_id).count() == 0
    finally:
        db.close()
