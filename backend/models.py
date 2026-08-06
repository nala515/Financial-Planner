from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import (
    Boolean, Column, Date, Float, ForeignKey,
    Integer, String, UniqueConstraint
)

class Base(DeclarativeBase):
    pass

class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    shared = Column(Boolean, nullable=False)
    category = Column(String, nullable=False, default="Cash")

class Balance(Base):
    __tablename__ = "balances"
    __table_args__ = (
        UniqueConstraint("account_id", "date"),
    )

    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    date = Column(Date, nullable=False)
    balance_cents = Column(Integer, nullable=False)

class Contribution(Base):
    __tablename__ = "contributions"

    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    date = Column(Date, nullable=False)
    amount_cents = Column(Integer, nullable=False)
    notes = Column(String, nullable=True)

class IncomeEvent(Base):
    __tablename__ = "income_event"

    id = Column(Integer, primary_key=True)
    source_id = Column(Integer, nullable=False)
    date = Column(Date, nullable=False)
    amount_cents = Column(Integer, nullable=False)
    notes = Column(String, nullable=True)

class IncomeSource(Base):
    __tablename__ = "income_source"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)

class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True)
    group_cash_accounts = Column(Boolean, default=False)
    hide_disabled_accounts = Column(Boolean, default=False)
    show_retirement_accounts = Column(Boolean, default=True)
