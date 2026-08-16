from sqlalchemy.orm import Session
from backend.schemas import (
	IncomeEventCreate,
	IncomeSourceCreate,
)
from backend.repositories import income_repository


def get_income_events(db: Session, start=None, end=None):
	return income_repository.db_get_income_events(db, start, end)


def get_income_sources(db: Session):
	sources = income_repository.db_get_income_sources(db)
	return [
		{
			"id": source.id,
			"name": source.name,
		}
		for source in sources
	]


def create_income_data(db: Session, income_data: IncomeEventCreate):
	income_event = income_repository.db_create_income_event(db, income_data)

	return {
		"id": income_event.id,
		"status": "created",
	}


def create_income_source(db: Session, source_data: IncomeSourceCreate):
	source = income_repository.db_create_income_source(db, source_data)

	return {
		"id": source.id,
		"status": "created",
	}


def delete_income_event(db: Session, event_id: int):
	deleted = income_repository.db_delete_income_event(db, event_id)

	return {
		"id": event_id,
		"status": "deleted" if deleted else "not_found",
	}


def delete_income_source(db: Session, source_id: int):
	deleted = income_repository.db_delete_income_source(db, source_id)

	return {
		"id": source_id,
		"status": "deleted" if deleted else "not_found",
	}


def delete_all_income_sources(db: Session):
	deleted_count = income_repository.db_delete_all_income_sources(db)

	return {
		"status": "deleted",
		"deleted_count": deleted_count,
	}


def update_income_source(db: Session, source_id: int, source_data):
	source = income_repository.db_update_income_source(db, source_id, source_data)

	if source is None:
		return {"id": source_id, "status": "not_found"}

	return {
		"id": source.id,
		"name": source.name,
		"status": "updated",
	}

