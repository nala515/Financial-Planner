from sqlalchemy.orm import Session
from datetime import date
from dateutil.relativedelta import relativedelta
from backend.repositories import balances_repository, contributions_repository, accounts_repository, income_repository
from backend.account_categories import get_category_attributes


def calculate_growth(
    db: Session,
    account_id: int,
    start: date,
    end: date,
):
    # Fetch balances and contributions and create maps
    raw_balances = balances_repository.db_get_account_balances(db, account_id, start, end)
    raw_contributions = contributions_repository.db_get_account_contributions(db, account_id, start, end)
    balance_map = build_balance_map(raw_balances)
    contrib_map = build_contributions_map(raw_contributions)

    # Sort balances to ensure correct month-over-month pairing
    balances = sorted(raw_balances, key=lambda b: b.date)
    if not balances:
        return []

    results = []

    # Iterate through pairs to calculate growth metrics
    for i in range(1, len(balances)):
        prev_balance = balances[i - 1]
        curr_balance = balances[i]

        # Use the contribution map for the month being measured
        # We look up the contribution that occurred during the "prev" month
        key = (account_id, prev_balance.date.year, prev_balance.date.month)
        contributions = contrib_map.get(key, 0)

        # Calculate gains by doing (balance change - contributions)
        growth = curr_balance.balance_cents - prev_balance.balance_cents
        investment_return = growth - contributions

        results.append({
            "month": prev_balance.date,
            "starting_balance": prev_balance.balance_cents,
            "ending_balance": curr_balance.balance_cents,
            "growth": growth,
            "contributions": contributions,
            "investment_return": investment_return,
        })

    # Handle the most recent month, which won't have gains yet, just balance/contributions
    last_balance = balances[-1]
    last_key = (account_id, last_balance.date.year, last_balance.date.month)
    last_contributions = contrib_map.get(last_key, 0)

    results.append({
        "month": last_balance.date,
        "starting_balance": last_balance.balance_cents,
        "ending_balance": "TBD",
        "growth": "TBD",
        "contributions": last_contributions,
        "investment_return": "TBD",
    })

    return results


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



# returns a list containing category attributes for each account that exists, by ID
def get_account_attrs(db: Session):
    accounts = accounts_repository.db_get_accounts(db)
    account_attrs = {
        account.id: get_category_attributes(account.category)
        for account in accounts
    }
    return account_attrs

# returns a map of balances for easy access by date
def build_balance_map(balances: list):
    balance_map: dict[tuple[int, int, int], int] = {}
    for balance in balances:
        balance_map[(balance.account_id, balance.date.year, balance.date.month)] = balance.balance_cents
    return balance_map

# returns a map of contributions for easy access by date
def build_contributions_map(contributions: list):
    contrib_map: dict[tuple[int, int, int], int] = {}
    for c in contributions:
        contrib_map[(c.account_id, c.date.year, c.date.month)] = c.amount_cents
    return contrib_map

# returns total cash income for each month in a list
def get_cash_income(income_events: list) -> dict[tuple[int, int], int]:
    cash_income = {}
    for event in income_events:
        key = (event.date.year, event.date.month)
        cash_income[key] = cash_income.get(key, 0) + event.amount_cents
    return cash_income

# returns total gains for each month for accounts that are invested + spendable
def get_invested_spendable_growth(balances: list,
                                  account_attrs: dict,
                                  balance_map: dict,
                                  contrib_map: dict,
                                  months: set) -> dict[tuple[int, int], int]:
    growth = {key: 0 for key in months}

    for balance in balances:
        attrs = account_attrs.get(balance.account_id, get_category_attributes(None))

        # Determine the previous month for the balance delta
        prev_date = balance.date - relativedelta(months=1)
        prev_key = (balance.account_id, prev_date.year, prev_date.month)
        prev_balance = balance_map.get(prev_key)
        if prev_balance is None:
            continue

        month_key = (balance.date.year, balance.date.month)
        if month_key not in growth:
            continue

        # Filter by "invested spendable" criteria
        if attrs.get("invested") and attrs.get("spendable"):
            # Grab the contributions made in the previous month to subtract it out from overall growth
            monthly_contrib = contrib_map.get(prev_key, 0)

            # Calculate gain: balance change - contribution
            net_gain = (balance.balance_cents - prev_balance) - monthly_contrib
            growth[month_key] += net_gain
    return growth

# returns total balance growth for each month for accounts that are spendable
def get_spendable_growth(balances: list,
                         account_attrs: dict,
                         balance_map: dict,
                         months: set) -> dict[tuple[int, int], int]:
    growth = {key: 0 for key in months}

    for balance in balances:
        attrs = account_attrs.get(balance.account_id, get_category_attributes(None))
        prev_date = balance.date - relativedelta(months=1)
        prev_key = (balance.account_id, prev_date.year, prev_date.month)
        prev_balance = balance_map.get(prev_key)
        if prev_balance is None:
            continue

        month_key = (balance.date.year, balance.date.month)
        if month_key not in growth:
            continue

        if not attrs.get("retirement") and attrs.get("spendable"):
            growth[month_key] += balance.balance_cents - prev_balance

    return growth


def get_income_by_source(income_sources: list, income_events: list, months: set):
    source_ids = [source.id for source in income_sources]
    source_ids_set = set(source_ids)

    by_source = {key: {source_id: 0 for source_id in source_ids} for key in months}
    for event in income_events:
        key = (event.date.year, event.date.month)
        if key in by_source and event.source_id in source_ids_set:
            by_source[key][event.source_id] += event.amount_cents
    return by_source


def calculate_monthly_savings_metrics(db: Session, income_sources: list):
    # get starting data
    income_events = income_repository.db_get_income_events(db)
    balances = balances_repository.db_get_all_balances(db)
    balance_map = build_balance_map(balances)
    contributions = contributions_repository.db_get_all_contributions(db)
    contrib_map = build_contributions_map(contributions)
    account_attrs = get_account_attrs(db)

    # parse the data with these function calls
    cash_income = get_cash_income(income_events)
    months = set(cash_income.keys())
    invested_spendable_growth = get_invested_spendable_growth(balances, account_attrs, balance_map, contrib_map, months)
    spendable_growth = get_spendable_growth(balances, account_attrs, balance_map, months)
    income_by_source = get_income_by_source(income_sources, income_events, months)
    source_ids = [source.id for source in income_sources]

    # gather together
    monthly_rows = []
    for year, month in sorted(months, reverse=True):
        key = (year, month)
        cash = cash_income[key]
        investment = invested_spendable_growth.get(key, 0)
        total_income = cash + investment
        expenses = total_income - spendable_growth.get(key, 0)
        cash_savings = cash - expenses
        total_savings = total_income - expenses

        monthly_rows.append({
            "year": year,
            "month": month,
            "income_by_source": {
                str(source_id): income_by_source.get(key, {}).get(source_id, 0)
                for source_id in source_ids
            },
            "cash_income": cash,
            "investment_gains": investment,
            "total_income": total_income,
            "expenses": expenses,
            "cash_savings": cash_savings,
            "total_savings": total_savings,
        })

    return monthly_rows


def get_savings_summary(db: Session, granularity: str = "month"):
    income_sources = income_repository.db_get_income_sources(db)
    source_ids = [source.id for source in income_sources]
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
                "investment_gains": 0,
                "expenses": 0,
                "cash_savings": 0,
                "total_savings": 0,
                "income_by_source": {source_id: 0 for source_id in source_ids},
            }

        yearly_totals[year]["month_count"] += 1
        yearly_totals[year]["cash_income"] += row["cash_income"]
        yearly_totals[year]["investment_gains"] += row["investment_gains"]
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
            "avg_monthly_investment_gains": round(data["investment_gains"] / data["month_count"]),
            "avg_monthly_total_income": round((data["cash_income"] + data["investment_gains"]) / data["month_count"]),
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

