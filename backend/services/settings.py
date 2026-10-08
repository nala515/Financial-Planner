from sqlalchemy.orm import Session
from backend.schemas import SettingsCreate
from backend.repositories import settings_repository


def get_settings(db: Session):
	return accounts_repository.db_get_settings(db)

def update_settings(db: Session, settings_data):
	settings = accounts_repository.db_update_settings(db, settings_data)
	return {"status": "updated"}
