from fastapi import APIRouter, HTTPException
from backend.database import SessionLocal
from backend import services, schemas

router = APIRouter()


@router.post("/api/growth/projection", response_model=schemas.GrowthProjectionResponse)
def api_get_growth_projection(request: schemas.GrowthProjectionRequest):
    db = SessionLocal()
    try:
        return services.get_growth_projection(db, request)
    except services.GrowthError as error:
        raise HTTPException(status_code=422, detail=str(error))
    finally:
        db.close()
