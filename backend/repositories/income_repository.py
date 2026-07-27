from ..models import IncomeEvent, IncomeSource
from ..schemas import IncomeEventCreate, IncomeSourceCreate, IncomeSourceUpdate

from datetime import date
from sqlalchemy.orm import Session

##-----------------------------------------------------
## Income events
##-----------------------------------------------------

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

##-----------------------------------------------------
## Income sources
##-----------------------------------------------------

def db_create_income_source(db: Session, source_data: IncomeSourceCreate):
    source = IncomeSource(
        name=source_data.name,
    )

    db.add(source)
    db.commit()
    db.refresh(source)

    return source

def db_get_income_source(db: Session, source_id: int):
    return (
        db.query(IncomeSource)
        .filter(IncomeSource.id == source_id)
        .first()
    )

def db_get_income_sources(db: Session):
    return db.query(IncomeSource).all()

def db_update_income_source(db: Session, source_id: int, source_data: IncomeSourceUpdate):
    source = db.query(IncomeSource).filter(IncomeSource.id == source_id).first()

    if source is None:
        return None

    if source_data.name is not None:
        source.name = source_data.name

    db.commit()
    db.refresh(source)

    return source

def db_delete_income_source(db: Session, source_id: int):
    source = db.query(IncomeSource).filter(IncomeSource.id == source_id).first()

    if source is None:
        return False

    db.query(IncomeEvent).filter(IncomeEvent.source_id == source_id).delete(synchronize_session=False)
    db.commit()

    return True

def db_delete_all_income_sources(db: Session):
    source_ids = [source.id for source in db.query(IncomeSource).all()]
    if not source_ids:
        return 0

    for source_id in source_ids:
        db.query(IncomeEvent).filter(IncomeEvent.source_id == source_id).delete(synchronize_session=False)

    db.query(IncomeSource).delete(synchronize_session=False)
    db.commit()

    return len(source_ids)
    return True
