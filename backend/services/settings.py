from sqlalchemy.orm import Session
from backend.schemas import SettingsCreate
from backend.repositories import accounts_repository


def get_settings(db: Session):
	return accounts_repository.db_get_settings(db)


def create_settings(db: Session, settings_data: SettingsCreate):
	settings = accounts_repository.db_create_settings(db, settings_data)

	return {
		"group_cash_accounts": settings.group_cash_accounts,
		"hide_disabled_accounts": settings.hide_disabled_accounts,
		"show_retirement_accounts": settings.show_retirement_accounts,
	}


def update_settings(db: Session, settings_data):
	settings = accounts_repository.db_update_settings(db, settings_data)

	if settings is None:
		return {"status": "not_found"}

	return {"status": "updated"}
