from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Query

from backend.engines.engine_router import calculate_pv
from backend.engines.pvlib_engine import PVLIB_AVAILABLE
from backend.models.engine_contracts import EngineRequest, EngineResponse, HealthResponse
from backend.services.financial_service import calculate_financial_proposal
from backend.services.pvgis_proxy import fetch_pvgis_via_proxy, validate_pvgis_params


router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(pvlibAvailable=PVLIB_AVAILABLE, pvlibBackedEngineAvailable=PVLIB_AVAILABLE)


@router.post("/api/pv/calculate", response_model=EngineResponse)
def pv_calculate(request: EngineRequest) -> EngineResponse:
    return calculate_pv(request)


@router.post("/api/pvlib/calculate", response_model=EngineResponse)
def pvlib_calculate(request: EngineRequest) -> EngineResponse:
    return calculate_pv(request)


@router.post("/api/financial/proposal", response_model=EngineResponse)
def financial_proposal(request: EngineRequest) -> EngineResponse:
    return calculate_financial_proposal(request)


@router.get("/api/pvgis-proxy")
async def pvgis_proxy(
    lat: float = Query(..., ge=-90, le=90, description="Latitude (decimal degrees)"),
    lon: float = Query(..., ge=-180, le=180, description="Longitude (decimal degrees)"),
    peakpower: float = Query(..., gt=0, le=10000, description="System peak power in kWp"),
    loss: float = Query(default=0.0, ge=0, le=100, description="System loss in %"),
    angle: float = Query(default=30.0, ge=0, le=90, description="Panel tilt angle in degrees"),
    aspect: float = Query(default=0.0, ge=-180, le=180, description="Azimuth offset from south in degrees"),
) -> Dict[str, Any]:
    """
    Backend proxy for PVGIS PVcalc API.
    Forwards the request to PVGIS from the server side (no CORS restrictions).
    Returns structured response with fetchStatus, rawEnergy, rawPoa, rawMonthly metadata.
    On proxy failure returns ok=false with error metadata — caller must use local PSH fallback.
    """
    errors = validate_pvgis_params(lat, lon, peakpower, loss, angle, aspect)
    if errors:
        raise HTTPException(status_code=422, detail={"errors": errors})

    result = await fetch_pvgis_via_proxy(lat, lon, peakpower, loss, angle, aspect)
    return result
