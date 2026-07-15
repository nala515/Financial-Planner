import os
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import database


def test_ensure_account_schema_removes_account_type_constraint(tmp_path):
    db_path = tmp_path / "finance.db"
    engine = create_engine(f"sqlite:///{db_path}")

    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE accounts (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, account_type VARCHAR NOT NULL, shared BOOLEAN NOT NULL, category VARCHAR NOT NULL DEFAULT 'Cash')"
            )
        )
        connection.execute(
            text("INSERT INTO accounts (name, account_type, shared, category) VALUES ('Checking', 'Bank', 1, 'Cash')")
        )

    database.engine = engine
    database.SessionLocal = sessionmaker(bind=engine)

    database.ensure_account_schema()

    inspector = inspect(engine)
    columns = [column["name"] for column in inspector.get_columns("accounts")]

    assert "account_type" not in columns
    assert "category" in columns

    with engine.begin() as connection:
        row = connection.execute(text("SELECT name, shared, category FROM accounts WHERE id = 1")).fetchone()

    assert row == ("Checking", 1, "Cash")
