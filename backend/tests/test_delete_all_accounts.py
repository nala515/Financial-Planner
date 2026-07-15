import importlib
from datetime import date


def test_delete_all_accounts_removes_related_rows(tmp_path, monkeypatch):
    db_path = tmp_path / "finance.db"
    monkeypatch.setenv("FINANCIAL_PLANNER_DB_PATH", str(db_path))

    import database as database_module
    import models as models_module
    import repositories.accounts_repository as accounts_repository_module

    importlib.reload(database_module)
    importlib.reload(models_module)
    importlib.reload(accounts_repository_module)

    from database import SessionLocal
    from models import Account, MonthlyBalance, Contribution
    from repositories.accounts_repository import db_delete_all_accounts

    db = SessionLocal()
    try:
        account_one = Account(name="Test One", shared=False, category="Cash")
        account_two = Account(name="Test Two", shared=True, category="Retirement")
        db.add_all([account_one, account_two])
        db.commit()
        db.refresh(account_one)
        db.refresh(account_two)

        db.add_all([
            MonthlyBalance(account_id=account_one.id, snapshot_date=date(2024, 1, 1), balance_cents=1000),
            MonthlyBalance(account_id=account_two.id, snapshot_date=date(2024, 2, 1), balance_cents=2000),
            Contribution(account_id=account_one.id, date=date(2024, 1, 1), amount_cents=500, notes="test"),
        ])
        db.commit()

        deleted_count = db_delete_all_accounts(db)

        assert deleted_count == 2
        assert db.query(Account).count() == 0
        assert db.query(MonthlyBalance).count() == 0
        assert db.query(Contribution).count() == 0
    finally:
        db.close()
