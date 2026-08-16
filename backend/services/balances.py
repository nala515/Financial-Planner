from sqlalchemy.orm import Session
from datetime import date
from backend.schemas import BalanceCreate, MonthlyEntryBatchCreate
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


def create_monthly_entry_batch(db: Session, batch_data: MonthlyEntryBatchCreate):
	if not batch_data.entries:
		raise ValueError("No entries provided.")

	seen_account_ids = set()
	for entry in batch_data.entries:
		if entry.account_id in seen_account_ids:
			raise ValueError(f"Duplicate account in batch: {entry.account_id}")
		seen_account_ids.add(entry.account_id)

		account = accounts_repository.db_get_account(db, entry.account_id)
		if account is None:
			raise ValueError(f"Unknown account_id: {entry.account_id}")

	with db.begin():
		for entry in batch_data.entries:
			balance_date = batch_data.snapshot_date
			existing_balance = (
				db.query(balances_repository.Balance)
				.filter(
					balances_repository.Balance.account_id == entry.account_id,
					balances_repository.Balance.date == balance_date,
				)
				.first()
			)

			if existing_balance is not None:
				existing_balance.balance_cents = entry.balance_cents
			else:
				db.add(
					balances_repository.Balance(
						account_id=entry.account_id,
						date=balance_date,
						balance_cents=entry.balance_cents,
					)
				)

			existing_contribution = (
				db.query(contributions_repository.Contribution)
				.filter(
					contributions_repository.Contribution.account_id == entry.account_id,
					contributions_repository.Contribution.date == balance_date,
				)
				.first()
			)

			if entry.contribution_cents == 0:
				if existing_contribution is not None:
					db.delete(existing_contribution)
			elif existing_contribution is not None:
				existing_contribution.amount_cents = entry.contribution_cents
			else:
				db.add(
					contributions_repository.Contribution(
						account_id=entry.account_id,
						date=balance_date,
						amount_cents=entry.contribution_cents,
					)
				)

	return {
		"status": "created",
		"snapshot_date": batch_data.snapshot_date.isoformat(),
		"updated_count": len(batch_data.entries),
	}


def delete_balance(db: Session, balance_id: int):
	deleted = balances_repository.db_delete_balance(db, balance_id)

	return {
		"id": balance_id,
		"status": "deleted" if deleted else "not_found",
	}

