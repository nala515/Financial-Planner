from sqlalchemy.orm import Session
from datetime import date
from dateutil.relativedelta import relativedelta

from .schemas import AccountCreate, SettingsCreate, BalanceCreate, ContributionCreate, IncomeEventCreate, IncomeSourceCreate
from .repositories import accounts_repository, balances_repository, contributions_repository, income_repository
from .account_categories import get_category_attributes

##-----------------------------------------------------
## Utilities
##-----------------------------------------------------

def calculate_growth(
    db: Session,
    account_id: int,
    start: date,
    end: date,
):
    balances = balances_repository.db_get_account_balances(
        db,
        account_id,
        start,
        end,
    )

    # Ensure ascending order by date so month-over-month pairs are correct,
    # regardless of what order the repository returns them in.
    balances = sorted(balances, key=lambda b: b.date)

    if len(balances) < 2:
        return []

    results = []

    for i in range(1, len(balances)):
        prev_balance = balances[i - 1]
        curr_balance = balances[i]

        prev_contributions = contributions_repository.db_get_account_contributions(
            db,
            account_id,
            prev_balance.date,
            prev_balance.date,
        )
        curr_contributions = contributions_repository.db_get_account_contributions(
            db,
            account_id,
            curr_balance.date,
            curr_balance.date,
        )
        contributions = 0
        if len(curr_contributions) > 0:
            contributions = curr_contributions[0].amount_cents

        # calculate growth and returns
        growth = curr_balance.balance_cents - prev_balance.balance_cents
        if len(prev_contributions) > 0:
            investment_return = growth - prev_contributions[0].amount_cents
        else:
            investment_return = growth

        results.append({
            "month": curr_balance.date,
            "starting_balance": prev_balance.balance_cents,
            "ending_balance": curr_balance.balance_cents,
            "growth": growth,
            "contributions": contributions,
            "investment_return": investment_return,
        })

    return results

##-----------------------------------------------------
## Dashboard
##-----------------------------------------------------

def get_dashboard_summary(db: Session):
    accounts = accounts_repository.db_get_accounts(db)

    # initialize data
    def empty_stats():
        return {"current": 0, "1m": 0, "1y": 0}
    categories = {
        "retirement": empty_stats(),
        "non_retirement": empty_stats(),
        "cash": empty_stats(),
        "spendable": empty_stats(),
    }

    # aggregate the data
    for account in accounts:
        balances = balances_repository.db_get_account_balances(db, account.id)
        if not balances:
            continue

        latest_balance_record = balances[-1]
        current_cents = latest_balance_record.balance_cents
        
        # use this account's latest date as the "Anchor" date for comparisons
        anchor_date = latest_balance_record.date
        one_month_ago = anchor_date - relativedelta(months=1)
        one_year_ago = anchor_date - relativedelta(years=1)

        # map balances by date for easy historical lookup
        balance_map = {b.date: b.balance_cents for b in balances}
        m_ago_cents = balance_map.get(one_month_ago, 0)
        y_ago_cents = balance_map.get(one_year_ago, 0)

        # apply category aggregation
        category_name = account.category or "Cash"
        attrs = get_category_attributes(category_name)

        # helper to add balances to a given category bucket
        def add_to_category(key):
            categories[key]["current"] += current_cents
            categories[key]["1m"] += m_ago_cents
            categories[key]["1y"] += y_ago_cents

        # Master Buckets: Retirement vs Non-Retirement
        if attrs.get("retirement"):
            add_to_category("retirement")
        else:
            add_to_category("non_retirement")

        # Overlapping Buckets: Cash vs Spendable
        if category_name == "Cash":
            add_to_category("cash")
        if attrs.get("spendable"):
            add_to_category("spendable")

    net_worth = empty_stats()
    net_worth["current"] = categories["retirement"]["current"] + categories["non_retirement"]["current"]
    net_worth["1m"] = categories["retirement"]["1m"] + categories["non_retirement"]["1m"]
    net_worth["1y"] = categories["retirement"]["1y"] + categories["non_retirement"]["1y"]

    return {
        "net_worth": net_worth,
        "categories": categories,
    }

##-----------------------------------------------------
## Getters
##-----------------------------------------------------

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

def get_account_balances(db: Session, account_id: int, start: date | None = None, end: date | None = None):
    return balances_repository.db_get_account_balances(db, account_id, start, end)

def get_account_contributions(db: Session, account_id: int, start: date | None = None, end: date | None = None):
    return contributions_repository.db_get_account_contributions(db, account_id, start, end)

def get_income_events(db: Session, start: date | None = None, end: date | None = None):
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

def get_settings(db: Session):
    return accounts_repository.db_get_settings(db)

##-----------------------------------------------------
## Creates
##-----------------------------------------------------

def create_account(db: Session, account_data: AccountCreate):
    account = accounts_repository.db_create_account(db, account_data)

    return {
        "id": account.id,
        "status": "created"
    }

def create_settings(db: Session, settings_data: SettingsCreate):
    settings = accounts_repository.db_create_settings(db, settings_data)

    return {
        "group_cash_accounts": settings.group_cash_accounts,
        "hide_disabled_accounts": settings.hide_disabled_accounts,
        "show_retirement_accounts": settings.show_retirement_accounts
    }

def create_balance(db: Session, balance_data: BalanceCreate):

    balance = balances_repository.db_create_balance(db, balance_data)

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

def create_income_event(db: Session, income_data: IncomeEventCreate):

    income_event = income_repository.db_create_income_event(db, income_data)

    return {
        "id": income_event.id,
        "status": "created"
    }

def create_income_source(db: Session, source_data: IncomeSourceCreate):
    source = income_repository.db_create_income_source(db, source_data)

    return {
        "id": source.id,
        "status": "created"
    }

##-----------------------------------------------------
## Deletes
##-----------------------------------------------------

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


def delete_balance(db: Session, balance_id: int):
    deleted = balances_repository.db_delete_balance(db, balance_id)

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

##-----------------------------------------------------
## Updates
##-----------------------------------------------------

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

def update_settings(db: Session, settings_data):
    settings = accounts_repository.db_update_settings(db, settings_data)

    if settings is None:
        return {"status": "not_found"}

    return {
        "status": "updated",
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
