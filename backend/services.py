from sqlalchemy.orm import Session
from datetime import date
from dateutil.relativedelta import relativedelta

from .schemas import (
    AccountCreate,
    SettingsCreate,
    BalanceCreate,
    ContributionCreate,
    IncomeEventCreate,
    IncomeSourceCreate,
    DebugRequest,
    MonthlyEntryBatchCreate,
)
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

def get_dashboard_data(db: Session):
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


def calculate_monthly_savings_metrics(db: Session, income_sources: list):
    income_events = income_repository.db_get_income_events(db)
    accounts = accounts_repository.db_get_accounts(db)
    balances = balances_repository.db_get_all_balances(db)

    account_attrs = {
        account.id: get_category_attributes(account.category)
        for account in accounts
    }

    source_ids = [source.id for source in income_sources]
    source_ids_set = set(source_ids)

    balance_map: dict[tuple[int, int, int], int] = {}
    for balance in balances:
        balance_map[(balance.account_id, balance.date.year, balance.date.month)] = balance.balance_cents

    monthly_metrics: dict[tuple[int, int], dict] = {}
    for event in income_events:
        key = (event.date.year, event.date.month)
        if key not in monthly_metrics:
            monthly_metrics[key] = {
                "cash_income": 0,
                "investment_income": 0,
                "non_retirement_spendable_growth": 0,
                "income_by_source": {source_id: 0 for source_id in source_ids},
            }

        monthly_metrics[key]["cash_income"] += event.amount_cents
        if event.source_id in source_ids_set:
            monthly_metrics[key]["income_by_source"][event.source_id] += event.amount_cents

    for balance in balances:
        attrs = account_attrs.get(balance.account_id, get_category_attributes(None))
        prev_date = balance.date - relativedelta(months=1)
        prev_key = (balance.account_id, prev_date.year, prev_date.month)
        prev_balance = balance_map.get(prev_key)
        if prev_balance is None:
            continue

        growth = balance.balance_cents - prev_balance
        month_key = (balance.date.year, balance.date.month)
        if month_key not in monthly_metrics:
            continue

        if attrs.get("invested") and attrs.get("spendable"):
            monthly_metrics[month_key]["investment_income"] += growth

        if not attrs.get("retirement") and attrs.get("spendable"):
            monthly_metrics[month_key]["non_retirement_spendable_growth"] += growth

    monthly_rows = []
    for (year, month), metrics in sorted(monthly_metrics.items(), reverse=True):
        cash_income = metrics["cash_income"]
        investment_income = metrics["investment_income"]
        total_income = cash_income + investment_income
        expenses = total_income - metrics["non_retirement_spendable_growth"]
        cash_savings = cash_income - expenses
        total_savings = total_income - expenses

        income_by_source = {
            str(source_id): metrics["income_by_source"].get(source_id, 0)
            for source_id in source_ids
        }

        monthly_rows.append({
            "year": year,
            "month": month,
            "income_by_source": income_by_source,
            "cash_income": cash_income,
            "investment_income": investment_income,
            "total_income": total_income,
            "expenses": expenses,
            "cash_savings": cash_savings,
            "total_savings": total_savings,
        })

    return monthly_rows


def get_savings_summary(db: Session, granularity: str = "month"):
    income_sources = income_repository.db_get_income_sources(db)
    monthly_rows = calculate_monthly_savings_metrics(db, income_sources)

    if granularity == "month":
        return {
            "income_sources": [
                {"id": source.id, "name": source.name}
                for source in income_sources
            ],
            "rows": monthly_rows,
        }

    if granularity != "year":
        raise ValueError("granularity must be 'month' or 'year'")

    yearly_totals: dict[int, dict] = {}
    for row in monthly_rows:
        year = row["year"]
        if year not in yearly_totals:
            yearly_totals[year] = {
                "month_count": 0,
                "cash_income": 0,
                "investment_income": 0,
                "expenses": 0,
                "cash_savings": 0,
                "total_savings": 0,
                "income_by_source": {source_id: 0 for source_id in source_ids},
            }

        yearly_totals[year]["month_count"] += 1
        yearly_totals[year]["cash_income"] += row["cash_income"]
        yearly_totals[year]["investment_income"] += row["investment_income"]
        yearly_totals[year]["expenses"] += row["expenses"]
        yearly_totals[year]["cash_savings"] += row["cash_savings"]
        yearly_totals[year]["total_savings"] += row["total_savings"]

        for source_id, amount in row["income_by_source"].items():
            yearly_totals[year]["income_by_source"][int(source_id)] += amount

    yearly_rows = []
    for year, data in sorted(yearly_totals.items(), reverse=True):
        income_by_source = {
            str(source_id): round(data["income_by_source"][source_id] / data["month_count"])
            for source_id in source_ids
        }

        yearly_rows.append({
            "year": year,
            "income_by_source": income_by_source,
            "avg_monthly_cash_income": round(data["cash_income"] / data["month_count"]),
            "avg_monthly_investment_income": round(data["investment_income"] / data["month_count"]),
            "avg_monthly_total_income": round((data["cash_income"] + data["investment_income"]) / data["month_count"]),
            "avg_monthly_expenses": round(data["expenses"] / data["month_count"]),
            "avg_monthly_cash_savings": round(data["cash_savings"] / data["month_count"]),
            "avg_monthly_total_savings": round(data["total_savings"] / data["month_count"]),
        })

    return {
        "income_sources": [
            {"id": source.id, "name": source.name}
            for source in income_sources
        ],
        "rows": yearly_rows,
    }


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
