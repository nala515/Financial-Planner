import csv
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ...database import SessionLocal, initialize_database
from ...models import IncomeEvent, IncomeSource


def _get_existing_source(db, name: str):
    return (
        db.query(IncomeSource)
        .filter(IncomeSource.name == name)
        .first()
    )

def import_csv(csv_path):
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    db = SessionLocal()

    with csv_path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.reader(handle))

        if not rows:
            raise ValueError("CSV file is empty")

        # parse header
        name = rows[0][0].strip()

        source = _get_existing_source(db, name)
        if source is None:
            source = IncomeSource(name=name)
            db.add(source)
            db.commit()
            db.refresh(source)
        else:
            print(f"Found existing source {name}, id {source.id}")

        for row in rows[1:]:
            if not row:
                continue
            if len(row) < 3:
                continue

            year = int(row[0].strip())
            month = int(row[1].strip())
            amount_cents = int(float(row[2].strip()) * 100)
            if(len(row) > 3):
                note = row[3].strip()
            else:
                note = ""

            event_date = date(year, month, 1)

            # check for existing event, add one if none exists
            existing_event = (
                db.query(IncomeEvent)
                .filter(
                    IncomeEvent.source_id == source.id,
                    IncomeEvent.date == event_date,
                )
                .first()
            )
            if existing_event is not None:
                existing_event.amount_cents = amount_cents
                continue

            event = IncomeEvent(
                source_id=source.id,
                date=event_date,
                amount_cents=amount_cents,
                notes=note
            )
            db.add(event)

    db.commit()
    filename = Path(csv_path).name
    print(f"Imported {filename} as source {name}, id {source.id}")
    return

def import_all_csvs():
    initialize_database()

    cur_dir = Path(__file__).resolve().parent
    csv_dir = cur_dir / "myIncome"
    csv_files = list(csv_dir.glob("*.csv"))
    num_imported = 0

    if len(csv_files) > 0:
        print(f"Found {len(csv_files)} CSV file(s) to import")
    else:
        raise FileNotFoundError(f"CSV files not found at {csv_dir}")

    db = SessionLocal()
    try:
        for csv_path in csv_files:
            import_csv(csv_path)
            num_imported += 1
    finally:
        db.close()

    return num_imported


if __name__ == "__main__":
    count = import_all_csvs()
    print(f"Imported {count} source(s)")
