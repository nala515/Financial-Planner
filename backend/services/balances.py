from sqlalchemy.orm import Session
from datetime import date
from backend.schemas import BalanceCreate
from backend.repositories import balances_repository, contributions_repository, accounts_repository

def get_all_balances(db: Session, start: date | None = None, end: date | None = None):
	balances = balances_repository.db_get_all_balances(db, start, end)
	return [
		{
			"id": balance.id,
			"account_id": balance.account_id,
			"date": balance.date,
			"balance_cents": balance.balance_cents,
		}
		for balance in balances
	]

def get_account_balances(db: Session, account_id: int, start: date | None = None, end: date | None = None):
	return balances_repository.db_get_account_balances(db, account_id, start, end)

def create_balance(db: Session, balance_data: BalanceCreate):
	balance = balances_repository.db_create_balance(db, balance_data)

	return {
		"id": balance.id,
		"status": "created",
	}

def delete_balance(db: Session, balance_id: int):
	deleted = balances_repository.db_delete_balance(db, balance_id)

	return {
		"id": balance_id,
		"status": "deleted" if deleted else "not_found",
	}
