from sqlalchemy.orm import Session
from datetime import date
from dateutil.relativedelta import relativedelta
from backend.repositories import balances_repository, contributions_repository, accounts_repository, income_repository
from backend.account_categories import get_category_attributes, INVESTED_SPENDABLE_CATEGORIES, SPENDABLE_NON_RETIREMENT_CATEGORIES

# returns a map of contributions for easy access by date
def build_contributions_map(contributions: list):
    contrib_map: dict[tuple[int, int, int], int] = {}
    for c in contributions:
        contrib_map[(c.account_id, c.date.year, c.date.month)] = c.amount_cents
    return contrib_map


def calculate_growth(
    db: Session,
    account_id: int,
    start: date,
    end: date,
):
    # Fetch balances and contributions and create maps
    balances = balances_repository.db_get_account_balances(db, account_id, start, end)
    contributions = contributions_repository.db_get_account_contributions(db, account_id, start, end)

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


#-------------------------
# Get dashboard data
#-------------------------
BUCKETS = ("retirement", "non_retirement", "cash", "spendable")

def empty_stats():
    return {"current": 0, "1m": 0, "1y": 0}

def get_dashboard_data(db: Session):
    categories = {key: empty_stats() for key in BUCKETS}

    for category, current, m_ago, y_ago in balances_repository.db_get_category_totals(db):
        name = category or "Cash"
        attrs = get_category_attributes(name)

        keys = ["retirement" if attrs.get("retirement") else "non_retirement"]
        if name in ("Cash", "Credit"):
            keys.append("cash")
        if attrs.get("spendable"):
            keys.append("spendable")

        for key in keys:
            categories[key]["current"] += current
            categories[key]["1m"] += m_ago
            categories[key]["1y"] += y_ago

    net_worth = {
        period: categories["retirement"][period] + categories["non_retirement"][period]
        for period in ("current", "1m", "1y")
    }
    return {"net_worth": net_worth, "categories": categories}


# returns total cash income for each month in a list
def get_cash_income(income_events: list) -> dict[tuple[int, int], int]:
    cash_income = {}
    for event in income_events:
        key = (event.date.year, event.date.month)
        cash_income[key] = cash_income.get(key, 0) + event.amount_cents
    return cash_income


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
    # collect starting data
    income_events = income_repository.db_get_income_events(db)
    cash_income = get_cash_income(income_events)
    months = set(cash_income.keys())
    income_by_source = get_income_by_source(income_sources, income_events, months)
    source_ids = [source.id for source in income_sources]

    invested_spendable_growth = balances_repository.db_get_monthly_growth(
        db, INVESTED_SPENDABLE_CATEGORIES, net_of_contributions=True
    )
    spendable_growth = balances_repository.db_get_monthly_growth(
        db, SPENDABLE_NON_RETIREMENT_CATEGORIES
    )

    # gather together
    monthly_rows = []
    for year, month in sorted(months, reverse=True):
        key = (year, month)
        cash = cash_income[key]
        investment = invested_spendable_growth.get(key, 0)
        total_income = cash + investment
        spending = total_income - spendable_growth.get(key, 0)
        cash_savings = cash - spending
        total_savings = total_income - spending

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
            "spending": spending,
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
                "spending": 0,
                "cash_savings": 0,
                "total_savings": 0,
                "income_by_source": {source_id: 0 for source_id in source_ids},
            }

        yearly_totals[year]["month_count"] += 1
        yearly_totals[year]["cash_income"] += row["cash_income"]
        yearly_totals[year]["investment_gains"] += row["investment_gains"]
        yearly_totals[year]["spending"] += row["spending"]
        yearly_totals[year]["cash_savings"] += row["cash_savings"]
        yearly_totals[year]["total_savings"] += row["total_savings"]

        for source_id, amount in row["income_by_source"].items():
            yearly_totals[year]["income_by_source"][int(source_id)] += amount

    yearly_rows = []
    for year, data in sorted(yearly_totals.items(), reverse=True):
        income_by_source = {}
        avg_monthly_income_by_source = {}
        for source_id in source_ids:
            total = data["income_by_source"][source_id]
            income_by_source[str(source_id)] = total
            avg_monthly_income_by_source[str(source_id)] = round(total / data["month_count"])

        yearly_rows.append({
            "year": year,
            "income_by_source": income_by_source,
            "cash_income": data["cash_income"],
            "investment_gains": data["investment_gains"],
            "total_income": data["cash_income"] + data["investment_gains"],
            "spending": data["spending"],
            "cash_savings": data["cash_savings"],
            "total_savings": data["total_savings"],
            "avg_monthly_income_by_source": avg_monthly_income_by_source,
            "avg_monthly_cash_income": round(data["cash_income"] / data["month_count"]),
            "avg_monthly_investment_gains": round(data["investment_gains"] / data["month_count"]),
            "avg_monthly_total_income": round((data["cash_income"] + data["investment_gains"]) / data["month_count"]),
            "avg_monthly_spending": round(data["spending"] / data["month_count"]),
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

