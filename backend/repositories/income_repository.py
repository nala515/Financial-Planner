from ..models import IncomeEvent
from ..schemas import IncomeEventCreate

from datetime import date
from sqlalchemy.orm import Session

def db_create_income_event(db: Session, income_data: IncomeEventCreate):
    income_event = IncomeEvent(
        source_id=income_data.source_id,
        date=income_data.snapshot_date,
        amount_cents=income_data.amount_cents,
    )

    db.add(income_event)
    db.commit()
    db.refresh(income_event)

    return income_event


def db_get_income_events(
    db: Session,
    start: date | None = None,
    end: date | None = None,
):
    query = db.query(IncomeEvent)

    if start is not None:
        query = query.filter(IncomeEvent.date >= start)

    if end is not None:
        query = query.filter(IncomeEvent.date <= end)

    return query.order_by(IncomeEvent.date).all()


def db_delete_income_event(db: Session, event_id: int):
    income_event = db.query(IncomeEvent).filter(IncomeEvent.id == event_id).first()

    if income_event is None:
        return False

    db.query(IncomeEvent).filter(IncomeEvent.id == event_id).delete()
    db.commit()

    return True
