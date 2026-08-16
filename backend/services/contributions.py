from sqlalchemy.orm import Session
from datetime import date
from backend.schemas import ContributionCreate
from backend.repositories import contributions_repository


def get_all_contributions(db: Session, start: date | None = None, end: date | None = None):
	contributions = contributions_repository.db_get_all_contributions(db, start, end)
	return [
		{
			"id": contribution.id,
			"account_id": contribution.account_id,
			"date": contribution.date,
			"amount_cents": contribution.amount_cents,
		}
		for contribution in contributions
	]


def get_account_contributions(db: Session, account_id: int, start: date | None = None, end: date | None = None):
	return contributions_repository.db_get_account_contributions(db, account_id, start, end)


def create_contribution(db: Session, contribution_data: ContributionCreate):
	contribution = contributions_repository.db_create_contribution(db, contribution_data)

	return {
		"id": contribution.id,
		"status": "created",
	}


def delete_contribution(db: Session, contribution_id: int):
	deleted = contributions_repository.db_delete_contribution(db, contribution_id)

	return {
		"id": contribution_id,
		"status": "deleted" if deleted else "not_found",
	}

