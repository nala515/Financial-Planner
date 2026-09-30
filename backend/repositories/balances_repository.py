from ..models import Balance
from ..schemas import BalanceCreate

from datetime import date
from sqlalchemy import and_, func
from sqlalchemy.orm import Session, aliased

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

# for dashboard page
def db_get_category_totals(db: Session):
    """Per category: (category, current_cents, one_month_ago_cents, one_year_ago_cents).
    Each account is compared against its own latest snapshot date."""
    latest = (
        db.query(
            MonthlyBalance.account_id.label("account_id"),
            func.max(MonthlyBalance.snapshot_date).label("anchor"),
        )
        .group_by(MonthlyBalance.account_id)
        .subquery()
    )
    cur = aliased(MonthlyBalance)
    m1 = aliased(MonthlyBalance)
    y1 = aliased(MonthlyBalance)

    return (
        db.query(
            Account.category,
            func.coalesce(func.sum(cur.balance_cents), 0),
            func.coalesce(func.sum(m1.balance_cents), 0),
            func.coalesce(func.sum(y1.balance_cents), 0),
        )
        .join(latest, latest.c.account_id == Account.id)
        .join(cur, and_(cur.account_id == Account.id,
                        cur.snapshot_date == latest.c.anchor))
        .outerjoin(m1, and_(m1.account_id == Account.id,
                            m1.snapshot_date == func.date(latest.c.anchor, "-1 month")))
        .outerjoin(y1, and_(y1.account_id == Account.id,
                            y1.snapshot_date == func.date(latest.c.anchor, "-1 year")))
        .group_by(Account.category)
        .all()
    )


def db_delete_balance(db: Session, balance_id: int):
    balance = db.query(Balance).filter(Balance.id == balance_id).first()

    if balance is None:
        return False

    db.query(Balance).filter(Balance.id == balance_id).delete()
    db.commit()

    return True
