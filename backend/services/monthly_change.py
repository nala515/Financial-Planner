from sqlalchemy.orm import Session

from backend.account_categories import get_invested_group, normalize_category
from backend.repositories import income_repository, summary_repository
from .savings import calculate_monthly_savings_metrics

GROUP_LABELS = {"retirement": "Retirement", "non_retirement": "Non-retirement"}


def _split_by_group(account_changes: list, pick) -> dict:
    """
    {value, parts} for invested accounts: one part per group (retirement / non-retirement),
    each holding its accounts. pick(balance_change, contribution) chooses what to count.
    """
    groups = {key: [] for key in GROUP_LABELS}

    for _account_id, name, category, balance_change, contribution in account_changes:
        group = get_invested_group(category)
        if group is None:
            continue
        value = pick(balance_change, contribution)
        if value != 0:
            groups[group].append({"label": name, "value": value})

    parts = []
    for key, label in GROUP_LABELS.items():
        children = groups[key]
        if children:
            parts.append({"label": label, "value": sum(c["value"] for c in children), "parts": children})

    return {"value": sum(p["value"] for p in parts), "parts": parts}


def _net_worth_nodes(db: Session) -> tuple[dict, dict]:
    """(previous, current) net worth as {value, parts}, with one part per account category."""
    previous, current = [], []
    for category, current_cents, month_ago_cents, _year_ago_cents in summary_repository.db_get_category_totals(db):
        label = normalize_category(category)
        if month_ago_cents != 0:
            previous.append({"label": label, "value": month_ago_cents})
        if current_cents != 0:
            current.append({"label": label, "value": current_cents})

    def node(parts):
        return {"value": sum(p["value"] for p in parts), "parts": parts}

    return node(previous), node(current)


def _spending_node(db: Session, key: tuple[int, int]) -> dict:
    """
    Spending as {value, parts} using the Savings page calculation:
    spending = cash income + spendable investment gains - growth in spendable balances.
    value is None when there is no income entry for the month.
    """
    income_sources = income_repository.db_get_income_sources(db)
    source_names = {str(source.id): source.name for source in income_sources}

    for row in calculate_monthly_savings_metrics(db, income_sources):
        if (row["year"], row["month"]) != key:
            continue

        by_source = [
            {"label": source_names.get(source_id, "Unknown source"), "value": amount}
            for source_id, amount in row["income_by_source"].items()
            if amount != 0
        ]
        return {
            "value": row["spending"],
            "parts": [
                {"label": "Cash income", "value": row["cash_income"], "parts": by_source},
                {"label": "Investment gains (spendable accounts)", "value": row["investment_gains"]},
                {"label": "Less: growth in spendable balances", "value": -row["total_savings"]},
            ],
        }

    return {"value": None, "parts": []}


def get_monthly_change(db: Session):
    """
    Snapshot of what changed between the previous month's entry and the latest entry.
    Every number is {value, parts} so the dashboard can show what went into it.
    """
    latest = summary_repository.db_get_latest_balance_date(db)
    if latest is None:
        return None

    if latest.month > 1:
        prev_year, prev_month = latest.year, latest.month - 1
    else:
        prev_year, prev_month = latest.year - 1, 12

    month_str = f"{prev_year:04d}-{prev_month:02d}"
    account_changes = summary_repository.db_get_account_changes(db, month_str)
    previous_net_worth, current_net_worth = _net_worth_nodes(db)

    return {
        "previous_month": month_str,
        "current_month": f"{latest.year:04d}-{latest.month:02d}",
        "previous_net_worth": previous_net_worth,
        "contributions": _split_by_group(account_changes, lambda change, contribution: contribution),
        "investment_gains": _split_by_group(account_changes, lambda change, contribution: change - contribution),
        "spending": _spending_node(db, (prev_year, prev_month)),
        "current_net_worth": current_net_worth,
    }
