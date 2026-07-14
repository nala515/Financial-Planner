from models import Account
from schemas import AccountCreate, AccountUpdate
from account_categories import normalize_category

from datetime import date
from sqlalchemy.orm import Session

def db_create_account(db: Session, account_data: AccountCreate):

    category_name = normalize_category(account_data.category)

    account = Account(
        name=account_data.name,
        shared=account_data.shared,
        category=category_name,
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


def db_update_account(db: Session, account_id: int, account_data: AccountUpdate):
    account = db.query(Account).filter(Account.id == account_id).first()

    if account is None:
        return None

    if account_data.name is not None:
        account.name = account_data.name

    if account_data.shared is not None:
        account.shared = account_data.shared

    if account_data.category is not None:
        account.category = normalize_category(account_data.category)

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