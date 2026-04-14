from fastapi import APIRouter

from backend.engines.engine_router import calculate_pv
from backend.engines.pvlib_engine import PVLIB_AVAILABLE
from backend.models.engine_contracts import EngineRequest, EngineResponse, HealthResponse
from backend.services.financial_service import calculate_financial_proposal


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
