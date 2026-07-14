import os
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

DEFAULT_DB_PATH = Path(__file__).resolve().parent / "finance.db"
DB_PATH = Path(os.getenv("FINANCIAL_PLANNER_DB_PATH", str(DEFAULT_DB_PATH))).expanduser()
if not DB_PATH.is_absolute():
    DB_PATH = (Path.cwd() / DB_PATH).resolve()
else:
    DB_PATH = DB_PATH.resolve()

DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(bind=engine)


def initialize_database():
    from models import Base

    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    if "accounts" not in inspector.get_table_names():
        return

    columns = [column["name"] for column in inspector.get_columns("accounts")]
    if "account_type" not in columns:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE accounts RENAME COLUMN account_type TO account_type_old"))
        connection.execute(text("CREATE TABLE accounts_new (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL, shared BOOLEAN NOT NULL, category VARCHAR NOT NULL DEFAULT 'Cash')"))
        connection.execute(text("INSERT INTO accounts_new (id, name, shared, category) SELECT id, name, shared, category FROM accounts"))
        connection.execute(text("DROP TABLE accounts"))
        connection.execute(text("ALTER TABLE accounts_new RENAME TO accounts"))


initialize_database()