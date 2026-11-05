from sqlalchemy.orm import Session

from backend.account_categories import INVESTED_CATEGORIES
from backend.repositories import income_repository, summary_repository
from .dashboard import get_dashboard_data
from .savings import calculate_monthly_savings_metrics


def get_monthly_change(db: Session):
    """
    Snapshot of what changed between the previous month's entry and the latest entry.
    Contributions and investment gains cover all invested accounts (retirement included);
    spending uses the same calculation as the Savings page. Spending is None when there
    is no income entry for that month.
    """
    latest = summary_repository.db_get_latest_balance_date(db)
    if latest is None:
        return None

    if latest.month > 1:
        prev_year, prev_month = latest.year, latest.month - 1
    else:
        prev_year, prev_month = latest.year - 1, 12
    key = (prev_year, prev_month)

    net_worth = get_dashboard_data(db)["net_worth"]

    gains = summary_repository.db_get_monthly_growth(
        db, INVESTED_CATEGORIES, net_of_contributions=True
    ).get(key, 0)
    gross_growth = summary_repository.db_get_monthly_growth(db, INVESTED_CATEGORIES).get(key, 0)
    contributions = gross_growth - gains

    spending = None
    income_sources = income_repository.db_get_income_sources(db)
    for row in calculate_monthly_savings_metrics(db, income_sources):
        if (row["year"], row["month"]) == key:
            spending = row["spending"]
            break

    return {
        "previous_month": f"{prev_year:04d}-{prev_month:02d}",
        "current_month": f"{latest.year:04d}-{latest.month:02d}",
        "previous_net_worth": net_worth["1m"],
        "contributions": contributions,
        "investment_gains": gains,
        "spending": spending,
        "current_net_worth": net_worth["current"],
    }
