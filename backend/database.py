from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///finance.db"

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(bind=engine)


def ensure_account_category_column():
    inspector = inspect(engine)
    if "accounts" not in inspector.get_table_names():
        return

    columns = [column["name"] for column in inspector.get_columns("accounts")]
    if "category" in columns:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE accounts ADD COLUMN category VARCHAR DEFAULT 'Cash'"))


ensure_account_category_column()