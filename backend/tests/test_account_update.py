import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import services
from models import Account, Base
from schemas import AccountUpdate


def test_update_account_updates_name_shared_and_category():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        account = Account(
            name="Checking",
            shared=False,
            category="Cash",
        )
        db.add(account)
        db.commit()
        db.refresh(account)

        result = services.update_account(
            db,
            account.id,
            AccountUpdate(
                name="Savings",
                shared=True,
                category="Investment",
            ),
        )

        updated_account = db.query(Account).filter(Account.id == account.id).first()

        assert result["status"] == "updated"
        assert updated_account.name == "Savings"
        assert updated_account.shared is True
        assert updated_account.category == "Investment"
    finally:
        db.close()
