import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from account_categories import ACCOUNT_CATEGORIES, get_category_attributes, normalize_category


def test_account_categories_are_defined_with_expected_flags():
    assert ACCOUNT_CATEGORIES["Cash"]["spendable"] is True
    assert ACCOUNT_CATEGORIES["Retirement"]["retirement"] is True
    assert ACCOUNT_CATEGORIES["529"]["invested"] is True


def test_category_normalization_uses_known_categories():
    assert normalize_category("cash") == "Cash"
    assert normalize_category("retirement") == "Retirement"
    assert normalize_category("unknown") == "Cash"


def test_category_attributes_are_exposed_as_booleans():
    assert get_category_attributes("HSA") == {
        "retirement": True,
        "spendable": False,
        "invested": True,
        "net_worth": True,
    }
