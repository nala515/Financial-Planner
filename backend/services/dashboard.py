from sqlalchemy.orm import Session
from backend.repositories import summary_repository
from backend.account_categories import (
    ACCOUNT_VIEWS,
    categories_matching,
    normalize_category,
)

def empty_stats():
    return {"current": 0, "1m": 0, "1y": 0}

def get_dashboard_data(db: Session):
    view_members = {key: set(categories_matching(c)) for key, c in ACCOUNT_VIEWS.items()}
    totals = {key: empty_stats() for key in ACCOUNT_VIEWS}

    for category, current, m_ago, y_ago in summary_repository.db_get_category_totals(db):
        name = normalize_category(category)
        for key, members in view_members.items():
            if name in members:
                totals[key]["current"] += current
                totals[key]["1m"] += m_ago
                totals[key]["1y"] += y_ago

    net_worth = totals.pop("net_worth")
    return {"net_worth": net_worth, "categories": totals}

