ACCOUNT_CATEGORIES = {
    "Cash": {
        "retirement": False,
        "spendable": True,
        "invested": False,
        "net_worth": True,
    },
    "Credit": {
        "retirement": False,
        "spendable": True,
        "invested": False,
        "net_worth": True,
    },
    "Investment": {
        "retirement": False,
        "spendable": True,
        "invested": True,
        "net_worth": True,
    },
    "Retirement": {
        "retirement": True,
        "spendable": False,
        "invested": True,
        "net_worth": True,
    },
    "HSA": {
        "retirement": True,
        "spendable": False,
        "invested": True,
        "net_worth": True,
    },
    "529": {
        "retirement": False,
        "spendable": False,
        "invested": True,
        "net_worth": True,
    },
}


def normalize_category(category: str | None) -> str:
    if not category:
        return "Cash"

    normalized = category.strip().lower()

    for name in ACCOUNT_CATEGORIES:
        if name.lower() == normalized:
            return name

    return "Cash"


def get_category_attributes(category: str | None) -> dict[str, bool]:
    return ACCOUNT_CATEGORIES[normalize_category(category)]

ACCOUNT_VIEWS = {
    "net_worth":      {"net_worth": True},
    "retirement":     {"retirement": True},
    "non_retirement": {"retirement": False},
    "cash":           {"invested": False},
    "spendable":      {"spendable": True},
}

def categories_matching(criteria: dict[str, bool]) -> list[str]:
    """Names of all categories whose flags equal every key/value in criteria."""
    return [
        name for name, attrs in ACCOUNT_CATEGORIES.items()
        if all(attrs.get(k) == v for k, v in criteria.items())
    ]

VIEW_CATEGORIES = {key: set(categories_matching(c)) for key, c in ACCOUNT_VIEWS.items()}

INVESTED_SPENDABLE_CATEGORIES = categories_matching({"invested": True, "spendable": True})
SPENDABLE_NON_RETIREMENT_CATEGORIES = categories_matching({"spendable": True, "retirement": False})
