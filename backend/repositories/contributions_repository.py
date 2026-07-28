from ..models import Contribution
from ..schemas import ContributionCreate

from datetime import date
from sqlalchemy.orm import Session

def db_create_contribution(db: Session, contribution_data: ContributionCreate):
    contribution = Contribution(
        account_id=contribution_data.account_id,
        date=contribution_data.date,
        amount_cents=contribution_data.amount_cents,
    )

    db.add(contribution)
    db.commit()
    db.refresh(contribution)

    return contribution


def db_get_all_contributions(
    db: Session,
    start: date | None = None,
    end: date | None = None,
):
    query = db.query(Contribution)

    if start is not None:
        query = query.filter(Contribution.date >= start)

    if end is not None:
        query = query.filter(Contribution.date <= end)

    return query.order_by(Contribution.date).all()


def db_get_account_contributions(
    db: Session,
    account_id: int,
    start: date | None = None,
    end: date | None = None,
):
    query = (
        db.query(Contribution)
        .filter(Contribution.account_id == account_id)
    )

    if start is not None:
        query = query.filter(Contribution.date >= start)

    if end is not None:
        query = query.filter(Contribution.date <= end)

    return query.order_by(Contribution.date).all()


def db_delete_contribution(db: Session, contribution_id: int):
    contribution = db.query(Contribution).filter(Contribution.id == contribution_id).first()

    if contribution is None:
        return False

    db.query(Contribution).filter(Contribution.id == contribution_id).delete()
    db.commit()

    return True
