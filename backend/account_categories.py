ACCOUNT_CATEGORIES = {
    "Cash": {
        "retirement": False,
        "spendable": True,
        "invested": False,
        "net_worth": True,
    },
    "Credit": {
        "retirement": False,
        "spendable": False,
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


def categories_where(predicate) -> list[str]:
    """Names of all categories whose attributes satisfy predicate(attrs)."""
    return [
        name for name in ACCOUNT_CATEGORIES          # <- whatever your category dict is called
        if predicate(get_category_attributes(name))
    ]

INVESTED_SPENDABLE_CATEGORIES = categories_where(
    lambda a: a.get("invested") and a.get("spendable")
)
SPENDABLE_NON_RETIREMENT_CATEGORIES = categories_where(
    lambda a: a.get("spendable") and not a.get("retirement")
)
