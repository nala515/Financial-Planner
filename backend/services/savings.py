from sqlalchemy.orm import Session
from backend.repositories import income_repository, summary_repository
from backend.account_categories import INVESTED_SPENDABLE_CATEGORIES, SPENDABLE_NON_RETIREMENT_CATEGORIES

SUMMED_FIELDS = ("cash_income", "investment_gains", "total_income",
                 "spending", "cash_savings", "total_savings")

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

    invested_spendable_growth = summary_repository.db_get_monthly_growth(db, INVESTED_SPENDABLE_CATEGORIES, net_of_contributions=True)
    spendable_growth = summary_repository.db_get_monthly_growth(db, SPENDABLE_NON_RETIREMENT_CATEGORIES)

    # gather together
    monthly_rows = []
    for year, month in sorted(months, reverse=True):
        key = (year, month)
        cash = cash_income[key]
        investment = invested_spendable_growth.get(key, 0)
        growth = spendable_growth.get(key, 0) # also called total savings
        total_income = cash + investment
        spending = total_income - growth
        cash_savings = cash - spending

        monthly_rows.append({
            "year": year,
            "month": month,
            "income_by_source": {
                str(source_id): income_by_source[key][source_id]
                for source_id in source_ids
            },
            "cash_income": cash,
            "investment_gains": investment,
            "total_income": total_income,
            "spending": spending,
            "cash_savings": cash_savings,
            "total_savings": growth,
        })

    # trailing 12-month averages for the charts (need a full 12 months of history)
    oldest_first = list(reversed(monthly_rows))
    for i, row in enumerate(oldest_first):
        if i >= 11:
            window = oldest_first[i - 11:i + 1]
            row["spending_avg_12m"] = round(sum(r["spending"] for r in window) / 12)
            row["cash_savings_avg_12m"] = round(sum(r["cash_savings"] for r in window) / 12)
            row["total_savings_avg_12m"] = round(sum(r["total_savings"] for r in window) / 12)
        else:
            row["spending_avg_12m"] = None
            row["cash_savings_avg_12m"] = None
            row["total_savings_avg_12m"] = None

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

    yearly_totals: dict[int, dict] = {}
    for row in monthly_rows:
        year = row["year"]
        if year not in yearly_totals:
            yearly_totals[year] = {
                "month_count": 0,
                **{f: 0 for f in SUMMED_FIELDS},
                "income_by_source": {source_id: 0 for source_id in source_ids},
            }
    
        totals = yearly_totals[year]
        totals["month_count"] += 1
        for f in SUMMED_FIELDS:
            totals[f] += row[f]
    
        for source_id, amount in row["income_by_source"].items():
            totals["income_by_source"][int(source_id)] += amount

    yearly_rows = []
    for year, data in sorted(yearly_totals.items(), reverse=True):
        months = data["month_count"]
    
        income_by_source = {}
        avg_monthly_income_by_source = {}
        for source_id in source_ids:
            total = data["income_by_source"][source_id]
            income_by_source[str(source_id)] = total
            avg_monthly_income_by_source[str(source_id)] = round(total / months)
    
        row = {"year": year, "income_by_source": income_by_source, "avg_monthly_income_by_source": avg_monthly_income_by_source}
        for f in SUMMED_FIELDS:
            row[f] = data[f]
            row[f"avg_monthly_{f}"] = round(data[f] / months)
        yearly_rows.append(row)

    return {
        "income_sources": [
            {"id": source.id, "name": source.name}
            for source in income_sources
        ],
        "rows": yearly_rows,
    }
