from fastapi.testclient import TestClient

from backend.engines.pvlib_engine import PVLIB_AVAILABLE
from backend.main import app


client = TestClient(app)


def sample_request():
    return {
        "schema": "GH-PV-ENGINE-CONTRACT-2026.04-v1",
        "requestedEngine": "python-backend",
        "scenario": {"key": "on-grid", "label": "On-Grid", "proposalTone": "commercial-grid"},
        "site": {"lat": 39.9334, "lon": 32.8597, "cityName": "Ankara", "ghi": 1620, "timezone": "Europe/Istanbul"},
        "roof": {"areaM2": 80, "tiltDeg": 33, "azimuthDeg": 180, "azimuthName": "Güney", "shadingPct": 10, "soilingPct": 3},
        "system": {"panelType": "mono", "inverterType": "string", "batteryEnabled": False, "netMeteringEnabled": True},
        "load": {"dailyConsumptionKwh": 30, "monthlyConsumptionKwh": None, "hourlyConsumption8760": None},
        "tariff": {"tariffType": "commercial", "tariffRegime": "auto", "importRateTryKwh": 8.44, "exportRateTryKwh": 2.0, "annualPriceIncrease": 0.12, "discountRate": 0.18, "sourceCheckedAt": "2026-04-14"},
        "governance": {"quoteInputsVerified": True, "hasSignedCustomerBillData": True, "evidence": {}},
    }


def test_health_contract():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "pvlibAvailable" in data
    assert "pvlibBackedEngineAvailable" in data
    assert data["fallbackEngine"] == "python-deterministic-fallback"


def test_pv_calculation_contract():
    response = client.post("/api/pv/calculate", json=sample_request())
    assert response.status_code == 200
    data = response.json()
    assert data["schema"] == "GH-PV-ENGINE-CONTRACT-2026.04-v1"
    assert data["engineSource"]["engine"] == "python-backend"
    assert data["engineSource"]["pvlibReady"] is True
    assert data["production"]["engine_used"] in {"pvlib-backed", "python-deterministic-fallback"}
    assert data["production"]["engine_quality"] in {"engineering-mvp", "fallback-estimate"}
    assert data["production"]["annualEnergyKwh"] > 0
    assert len(data["production"]["monthlyEnergyKwh"]) == 12
    assert data["financial"]["annualSavingsTry"] > 0
    if not PVLIB_AVAILABLE:
        assert data["engineSource"]["pvlibBacked"] is False
        assert data["engineSource"]["fallbackUsed"] is True
        assert data["raw"]["fallbackUsed"] is True


def test_pvlib_missing_fallback_metadata_is_explicit():
    request = sample_request()
    request["requestedEngine"] = "pvlib-service"
    response = client.post("/api/pvlib/calculate", json=request)
    assert response.status_code == 200
    data = response.json()
    if not PVLIB_AVAILABLE:
        assert data["raw"]["engineUsed"] == "python-deterministic-fallback"
        assert data["raw"]["fallback_flags"]
        assert data["losses"]["fallbackReason"]


def test_pvlib_engine_contract_when_available():
    if not PVLIB_AVAILABLE:
        return
    response = client.post("/api/pv/calculate", json=sample_request())
    assert response.status_code == 200
    data = response.json()
    assert data["engineSource"]["source"] == "pvlib-backed"
    assert data["engineSource"]["pvlibBacked"] is True
    assert data["production"]["engine_used"] == "pvlib-backed"
    assert data["losses"]["transpositionModel"] == "pvlib.irradiance.haydavies"
    assert data["losses"]["temperatureModel"].startswith("pvlib.sapm_cell")


def test_financial_proposal_contract():
    response = client.post("/api/financial/proposal", json=sample_request())
    assert response.status_code == 200
    data = response.json()
    assert data["proposal"]["scenarioKey"] == "on-grid"
    assert data["proposal"]["quoteReadiness"] == "backend-engineering-estimate"
    assert data["financial"]["simplePaybackYears"] is not None
