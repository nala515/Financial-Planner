from sqlalchemy.orm import Session
from backend.schemas import AccountCreate
from backend.repositories import accounts_repository
from backend.account_categories import get_category_attributes


def get_account(db: Session, account_id: int):
	account = accounts_repository.db_get_account(db, account_id)
	if account is None:
		return None

	return {
		"id": account.id,
		"name": account.name,
		"shared": account.shared,
		"category": account.category,
		"category_attributes": get_category_attributes(account.category),
	}


def get_accounts(db: Session):
	accounts = accounts_repository.db_get_accounts(db)
	return [
		{
			"id": account.id,
			"name": account.name,
			"shared": account.shared,
			"category": account.category,
			"category_attributes": get_category_attributes(account.category),
		}
		for account in accounts
	]


def create_account(db: Session, account_data: AccountCreate):
	account = accounts_repository.db_create_account(db, account_data)

	return {
		"id": account.id,
		"status": "created",
	}


def update_account(db: Session, account_id: int, account_data):
	account = accounts_repository.db_update_account(db, account_id, account_data)

	if account is None:
		return {"id": account_id, "status": "not_found"}

	return {
		"id": account.id,
		"name": account.name,
		"shared": account.shared,
		"category": account.category,
		"status": "updated",
	}


def delete_account(db: Session, account_id: int):
	deleted = accounts_repository.db_delete_account(db, account_id)

	return {
		"id": account_id,
		"status": "deleted" if deleted else "not_found",
	}


def delete_all_accounts(db: Session):
	deleted_count = accounts_repository.db_delete_all_accounts(db)

	return {
		"status": "deleted",
		"deleted_count": deleted_count,
	}

