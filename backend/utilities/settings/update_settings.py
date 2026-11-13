import argparse

from ...database import SessionLocal, initialize_database
from ...models import Account
from ...schemas import SettingsUpdate
from ...repositories import settings_repository


def split_names(value: str) -> list[str]:
    return [name.strip() for name in (value or "").split(",") if name.strip()]


def set_disabled(db, names: list[str], disabled: bool) -> int:
    changed = 0
    for name in names:
        accounts = db.query(Account).filter(Account.name == name).all()
        if not accounts:
            print(f"Account '{name}' not found. Skipping.")
            continue
        for account in accounts:
            account.disabled = disabled
            changed += 1
            print(f"{'Disabled' if disabled else 'Enabled'} account '{account.name}' (id {account.id})")
    return changed


def update_settings(hide_disabled: str, disable: str, enable: str):
    initialize_database()
    db = SessionLocal()

    try:
        hide_value = (hide_disabled or "").strip().lower()
        if hide_value in {"true", "false"}:
            settings_repository.db_update_settings(
                db, SettingsUpdate(hide_disabled_accounts=(hide_value == "true"))
            )
            print(f"hide_disabled_accounts set to {hide_value}")

        set_disabled(db, split_names(disable), True)
        set_disabled(db, split_names(enable), False)
        db.commit()

        # print the resulting state so it shows in the Action log
        settings = settings_repository.db_get_settings(db)
        print(f"\nhide_disabled_accounts = {settings.hide_disabled_accounts}")
        for account in db.query(Account).order_by(Account.name).all():
            print(f"  {account.name}: {'DISABLED' if account.disabled else 'enabled'}")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Update app settings and account disabled flags.")
    parser.add_argument("--hide-disabled", default="", help="true, false, or empty to leave unchanged")
    parser.add_argument("--disable", default="", help="comma-separated account names to disable")
    parser.add_argument("--enable", default="", help="comma-separated account names to enable")
    args = parser.parse_args()

    update_settings(args.hide_disabled, args.disable, args.enable)
