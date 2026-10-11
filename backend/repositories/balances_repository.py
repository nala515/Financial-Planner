from ..models import Balance
from ..schemas import BalanceCreate

from datetime import date
from sqlalchemy import func
from sqlalchemy.orm import Session

##-----------------------------------------------------
## CREATE
##-----------------------------------------------------

def db_create_balance(db: Session, balance_data: BalanceCreate):
    existing_balance = (
        db.query(Balance)
        .filter(
            Balance.account_id == balance_data.account_id,
            Balance.date >= date(balance_data.date.year, balance_data.date.month, 1),
            Balance.date < date(balance_data.date.year, balance_data.date.month + 1, 1) if balance_data.date.month < 12 else date(balance_data.date.year + 1, 1, 1),
        )
        .first()
    )

    if existing_balance is not None:
        existing_balance.balance_cents = balance_data.balance_cents
        db.commit()
        db.refresh(existing_balance)
        return existing_balance

    balance = Balance(
        account_id=balance_data.account_id,
        date=balance_data.date,
        balance_cents=balance_data.balance_cents,
    )

    db.add(balance)
    db.commit()
    db.refresh(balance)

    return balance

##-----------------------------------------------------
## GET
##-----------------------------------------------------

def db_get_all_balances(
    db: Session,
    start: date | None = None,
    end: date | None = None,
):
    query = db.query(Balance)

    if start is not None:
        query = query.filter(Balance.date >= start)

    if end is not None:
        query = query.filter(Balance.date <= end)

    return query.order_by(Balance.date).all()


def db_get_account_balances(
    db: Session,
    account_id: int,
    start: date | None = None,
    end: date | None = None,
):
    query = (
        db.query(Balance)
        .filter(Balance.account_id == account_id)
    )

    if start is not None:
        query = query.filter(Balance.date >= start)

    if end is not None:
        query = query.filter(Balance.date <= end)

    return query.order_by(Balance.date).all()


# for growth page
def db_get_monthly_balances_for_accounts(db: Session, account_ids: list[int]):
    """
    Returns (account_id, "YYYY-MM", balance_cents) rows for the given accounts, oldest first.
    Months are returned as strings so callers can slice them rather than parse dates.
    """
    if not account_ids:
        return []

    month = func.strftime("%Y-%m", Balance.date)

    return (
        db.query(Balance.account_id, month, Balance.balance_cents)
        .filter(Balance.account_id.in_(account_ids))
        .order_by(Balance.account_id, Balance.date)
        .all()
    )

##-----------------------------------------------------
## DELETE
##-----------------------------------------------------

def db_delete_balance(db: Session, balance_id: int):
    balance = db.query(Balance).filter(Balance.id == balance_id).first()

    if balance is None:
        return False

    db.query(Balance).filter(Balance.id == balance_id).delete()
    db.commit()

    return True
