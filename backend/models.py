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
    account_type = Column(String, nullable=False)
    shared = Column(Boolean, nullable=False)

class MonthlyBalance(Base):
    __tablename__ = "balances"
    __table_args__ = (
        UniqueConstraint("account_id", "snapshot_date"),
    )

    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    snapshot_date = Column(Date, nullable=False)
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
    #income_source = Column(Integer, nullable=False)
    date = Column(Date, nullable=False)
    amount_cents = Column(Integer, nullable=False)
    notes = Column(String, nullable=True)
