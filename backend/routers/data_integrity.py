from backend import services, schemas

def _parse_ym(s: str) -> tuple[int, int]:
    y, m = s.split("-")
    return int(y), int(m)

@app.get("/api/missing-entries", response_model=list[schemas.MissingEntryRow])
def get_missing_entries(
    start: str = "2000-01",
    end: str | None = None,
    db: Session = Depends(get_db),
):
    start_ym = _parse_ym(start)
    end_ym = _parse_ym(end) if end else (date.today().year, date.today().month)
    return missing_entries.find_missing_rows(db, start_ym, end_ym)
