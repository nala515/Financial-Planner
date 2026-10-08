from ..models import Settings
from ..schemas import SettingsUpdate

from sqlalchemy.orm import Session


def db_get_settings(db: Session):
    """Returns the single settings row, creating it with defaults if it doesn't exist yet."""
    settings = db.query(Settings).first()

    if settings is None:
        settings = Settings()
        db.add(settings)
        db.commit()
        db.refresh(settings)

    return settings


def db_update_settings(db: Session, settings_data: SettingsUpdate):
    settings = db_get_settings(db)

    if settings_data.hide_disabled_accounts is not None:
        settings.hide_disabled_accounts = settings_data.hide_disabled_accounts

    db.commit()
    db.refresh(settings)

    return settings
