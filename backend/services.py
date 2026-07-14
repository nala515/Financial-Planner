from sqlalchemy.orm import Session
from datetime import date

from schemas import AccountCreate, MonthlyBalanceCreate, ContributionCreate
from repositories import accounts_repository, balances_repository, contributions_repository

def calculate_total_contributions(
    db: Session,
    account_id: int,
    start: date,
    end: date,
):
    contributions = contributions_repository.db_get_contributions(
        db,
        account_id,
        start,
        end,
    )

    return sum(c.amount_cents for c in contributions)

def calculate_growth(
    db: Session,
    account_id: int,
    start: date,
    end: date,
):
    balances = balances_repository.db_get_monthly_balances(
        db,
        account_id,
        start,
        end,
    )

    if len(balances) < 2:
        return None

    start_balance = balances[0].balance_cents
    end_balance = balances[-1].balance_cents

    contributions = calculate_total_contributions(
        db,
        account_id,
        start,
        end,
    )

    growth = end_balance - start_balance
    investment_return = growth - contributions

    return {
        "starting_balance": start_balance,
        "ending_balance": end_balance,
        "growth": growth,
        "contributions": contributions,
        "investment_return": investment_return,
    }

def get_account(db: Session, account_id: int):
    return accounts_repository.db_get_account(db, account_id)


def get_accounts(db: Session):
    return accounts_repository.db_get_accounts(db)


def update_account_name(db: Session, account_id: int, new_name: str):
    account = accounts_repository.db_update_account_name(db, account_id, new_name)

    if account is None:
        return {"id": account_id, "status": "not_found"}

    return {
        "id": account.id,
        "name": account.name,
        "status": "updated",
    }


def get_monthly_balances(db: Session, account_id: int, start: date | None = None, end: date | None = None):
    return balances_repository.db_get_monthly_balances(db, account_id, start, end)


def create_account(db: Session, account_data: AccountCreate):
    account = accounts_repository.db_create_account(db, account_data)

    return {
        "id": account.id,
        "status": "created"
    }


def create_monthly_balance(db: Session, balance_data: MonthlyBalanceCreate):

    balance = balances_repository.db_create_monthly_balance(db, balance_data)

    return {
        "id": balance.id,
        "status": "created"
    }


def create_contribution(db: Session, contribution_data: ContributionCreate):

    contribution = contributions_repository.db_create_contribution(db, contribution_data)

    return {
        "id": contribution.id,
        "status": "created"
    }


def delete_account(db: Session, account_id: int):
    deleted = accounts_repository.db_delete_account(db, account_id)

    return {
        "id": account_id,
        "status": "deleted" if deleted else "not_found",
    }


def delete_monthly_balance(db: Session, balance_id: int):
    deleted = balances_repository.db_delete_monthly_balance(db, balance_id)

    return {
        "id": balance_id,
        "status": "deleted" if deleted else "not_found",
    }


def delete_contribution(db: Session, contribution_id: int):
    deleted = contributions_repository.db_delete_contribution(db, contribution_id)

    return {
        "id": contribution_id,
        "status": "deleted" if deleted else "not_found",
    }