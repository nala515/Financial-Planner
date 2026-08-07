import csv
from pathlib import Path

from ...database import SessionLocal, initialize_database
from ...models import IncomeEvent, IncomeSource

def export_income():
    numSources = 0
    initialize_database()

    output_dir = Path(__file__).parent / "myIncome"
    output_dir.mkdir(exist_ok=True)

    db = SessionLocal()

    try:
        incomeSources = db.query(IncomeSource).all()
        numSources = len(incomeSources)
        print(f"Found {numSources} income source(s).")

        # loop through every source
        for source in incomeSources:
            # create file
            csv_path = output_dir / f"{source.name}.csv"

            # read events
            events = (
                db.query(IncomeEvent)
                .filter(IncomeEvent.source_id == source.id)
                .order_by(IncomeEvent.date)
                .all()
            )

            with csv_path.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.writer(handle)

                # write header to file
                writer.writerow([source.name])

                # build the row
                for event in events:
                    row = [
                        event.date.year,
                        event.date.month,
                        f"{event.amount_cents / 100:.2f}",
                        event.notes if event.notes else "",
                    ]
                    writer.writerow(row)

            # finished exporting this income source
            print(f"Exported {csv_path}")

        # finished exporting all income sources
        print(f"Exported {len(incomeSources)} income source(s).")
    finally:
        db.close()
    return numSources


if __name__ == "__main__":
    numSources = export_income()
    print(f"Finished exporting {numSources} income source(s)")
