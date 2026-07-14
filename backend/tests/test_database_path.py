import importlib
import sys
from pathlib import Path

import database


def test_database_path_is_absolute():
    db_path = Path(database.engine.url.database)

    assert db_path.is_absolute()
    assert db_path.name == "finance.db"


def test_import_csv_is_idempotent_for_repeated_imports(tmp_path, monkeypatch):
    db_path = tmp_path / "finance.db"
    monkeypatch.setenv("FINANCIAL_PLANNER_DB_PATH", str(db_path))

    repo_root = Path(__file__).resolve().parents[2]
    importer_path = repo_root / "importer"
    backend_path = repo_root / "backend"
    sys.path.insert(0, str(repo_root))
    sys.path.insert(0, str(backend_path))
    sys.path.insert(0, str(importer_path))

    import database as database_module
    import import_accounts

    importlib.reload(database_module)
    importlib.reload(import_accounts)

    csv_path = tmp_path / "sample.csv"
    csv_path.write_text(
        "My Checking\nCash\nFalse\n2023,1,100.00\n2023,2,200.00\n",
        encoding="utf-8",
    )

    first_id = import_accounts.import_csv(str(csv_path))
    second_id = import_accounts.import_csv(str(csv_path))

    db = import_accounts.SessionLocal()
    try:
        accounts = db.query(import_accounts.Account).filter(import_accounts.Account.name == "My Checking").all()
        balances = db.query(import_accounts.MonthlyBalance).filter(
            import_accounts.MonthlyBalance.account_id == first_id
        ).all()

        assert len(accounts) == 1
        assert second_id == first_id
        assert len(balances) == 2
    finally:
        db.close()
