from ..models import MonthlyBalance
from ..schemas import MonthlyBalanceCreate

from datetime import date
from sqlalchemy.orm import Session

def db_create_monthly_balance(db: Session, balance_data: MonthlyBalanceCreate):
    existing_balance = (
        db.query(MonthlyBalance)
        .filter(
            MonthlyBalance.account_id == balance_data.account_id,
            MonthlyBalance.snapshot_date >= date(balance_data.snapshot_date.year, balance_data.snapshot_date.month, 1),
            MonthlyBalance.snapshot_date < date(balance_data.snapshot_date.year, balance_data.snapshot_date.month + 1, 1) if balance_data.snapshot_date.month < 12 else date(balance_data.snapshot_date.year + 1, 1, 1),
        )
        .first()
    )

    if existing_balance is not None:
        existing_balance.balance_cents = balance_data.balance_cents
        db.commit()
        db.refresh(existing_balance)
        return existing_balance

    balance = MonthlyBalance(
        account_id=balance_data.account_id,
        snapshot_date=balance_data.snapshot_date,
        balance_cents=balance_data.balance_cents,
    )

    db.add(balance)
    db.commit()
    db.refresh(balance)

    return balance

def db_get_monthly_balances(
    db: Session,
    account_id: int,
    start: date | None = None,
    end: date | None = None,
):
    query = (
        db.query(MonthlyBalance)
        .filter(MonthlyBalance.account_id == account_id)
    )

    if start is not None:
        query = query.filter(MonthlyBalance.snapshot_date >= start)

    if end is not None:
        query = query.filter(MonthlyBalance.snapshot_date <= end)

    return query.order_by(MonthlyBalance.snapshot_date).all()


def db_delete_monthly_balance(db: Session, balance_id: int):
    balance = db.query(MonthlyBalance).filter(MonthlyBalance.id == balance_id).first()

    if balance is None:
        return False

    db.query(MonthlyBalance).filter(MonthlyBalance.id == balance_id).delete()
    db.commit()

    return True
