from ..models import Account, Balance, Contribution
from ..schemas import BalanceCreate

from datetime import date
from sqlalchemy import and_, func
from sqlalchemy.orm import Session, aliased


# for dashboard page
def db_get_category_totals(db: Session):
    """
    Returns one row per account category: (category, current_cents, one_month_ago_cents, one_year_ago_cents).
    Used for calculating the growth from a month or a year ago to today.
    """
    anchor_date = db.query(func.max(Balance.date)).scalar_subquery()

    def latest_entry_on_or_before(target):
        # per account: the date of its latest entry on or before `target`
        return (
            db.query(
                Balance.account_id.label("account_id"),
                func.max(Balance.date).label("anchor"),
            )
            .filter(Balance.date <= target)
            .group_by(Balance.account_id)
            .subquery()
        )

    cur_dates = latest_entry_on_or_before(anchor_date)
    m1_dates = latest_entry_on_or_before(func.date(anchor_date, "-1 month"))
    y1_dates = latest_entry_on_or_before(func.date(anchor_date, "-1 year"))

    cur = aliased(Balance)
    m1 = aliased(Balance)
    y1 = aliased(Balance)

    return (
        db.query(
            Account.category,
            func.coalesce(func.sum(cur.balance_cents), 0),
            func.coalesce(func.sum(m1.balance_cents), 0),
            func.coalesce(func.sum(y1.balance_cents), 0),
        )
        .join(cur_dates, cur_dates.c.account_id == Account.id)
        .join(cur, and_(cur.account_id == Account.id, cur.date == cur_dates.c.anchor))
        .outerjoin(m1_dates, m1_dates.c.account_id == Account.id)
        .outerjoin(m1, and_(m1.account_id == Account.id, m1.date == m1_dates.c.anchor))
        .outerjoin(y1_dates, y1_dates.c.account_id == Account.id)
        .outerjoin(y1, and_(y1.account_id == Account.id, y1.date == y1_dates.c.anchor))
        .group_by(Account.category)
        .all()
    )

def db_get_monthly_growth(db: Session, categories: list[str], net_of_contributions: bool = False):
    """
    param net_of_contributions: if True, subtracts out contributions, leaving investment gains only.
    Returns {(year, month): cents}, the total growth for accounts in the given categories.
    """
    cur = aliased(Balance)
    prev = aliased(Balance)
    prev_month = func.strftime("%Y-%m", prev.date)

    contrib = (
        db.query(
            Contribution.account_id.label("account_id"),
            func.strftime("%Y-%m", Contribution.date).label("month"),
            func.sum(Contribution.amount_cents).label("total"),
        )
        .group_by(Contribution.account_id, "month")
        .subquery()
    )

    gain = cur.balance_cents - prev.balance_cents
    if net_of_contributions:
        gain = gain - func.coalesce(contrib.c.total, 0)

    rows = (
        db.query(prev_month, func.sum(gain))
        .select_from(prev)
        .join(Account, Account.id == prev.account_id)
        .join(cur, and_(cur.account_id == prev.account_id,
                        cur.date == func.date(prev.date, "+1 month")))
        .outerjoin(contrib, and_(contrib.c.account_id == prev.account_id,
                                 contrib.c.month == prev_month))
        .filter(Account.category.in_(categories))
        .group_by(prev_month)
        .all()
    )
    return {(int(m[:4]), int(m[5:7])): total for m, total in rows}
