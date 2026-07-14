from models import Account
from schemas import AccountCreate

from datetime import date
from sqlalchemy.orm import Session

def db_create_account(db: Session, account_data: AccountCreate):

    account = Account(
        name=account_data.name,
        account_type=account_data.account_type,
        shared=account_data.shared,
    )

    db.add(account)
    db.commit()
    db.refresh(account)

    return account

def db_get_account(db: Session, account_id: int):
    return (
        db.query(Account)
        .filter(Account.id == account_id)
        .first()
    )


def db_get_accounts(db: Session):
    return db.query(Account).all()


def db_update_account_name(db: Session, account_id: int, new_name: str):
    account = db.query(Account).filter(Account.id == account_id).first()

    if account is None:
        return None

    account.name = new_name
    db.commit()
    db.refresh(account)

    return account


def db_delete_account(db: Session, account_id: int):
    account = db.query(Account).filter(Account.id == account_id).first()

    if account is None:
        return False

    db.query(Account).filter(Account.id == account_id).delete()
    db.commit()

    return True