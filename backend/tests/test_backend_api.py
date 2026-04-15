from fastapi.testclient import TestClient
import pytest

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
        "system": {
            "panelType": "mono",
            "panelWattPeak": 430,
            "panelAreaM2": 1.134 * 1.762,
            "panelTempCoeffPerC": -0.0034,
            "panelDegradationRate": 0.0045,
            "panelFirstYearDegradationRate": 0.02,
            "bifacialGain": 0,
            "inverterType": "string",
            "inverterEfficiency": 0.97,
            "cableLossPct": 0,
            "wiringMismatchPct": 0,
            "batteryEnabled": False,
            "netMeteringEnabled": True,
        },
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
    assert data["production"]["panelCount"] == 30
    assert data["production"]["systemPowerKwp"] == 12.9
    assert data["financial"]["annualSavingsTry"] > 0
    if not PVLIB_AVAILABLE:
        assert data["engineSource"]["pvlibBacked"] is False
        assert data["engineSource"]["fallbackUsed"] is True
        assert data["raw"]["fallbackUsed"] is True


def test_invalid_coordinates_are_rejected():
    request = sample_request()
    request["site"]["lat"] = 120
    response = client.post("/api/pv/calculate", json=request)
    assert response.status_code == 422


def test_missing_coordinates_are_explicit_fallback_not_pvlib():
    request = sample_request()
    request["site"]["lat"] = None
    request["site"]["lon"] = None
    response = client.post("/api/pv/calculate", json=request)
    assert response.status_code == 200
    data = response.json()
    assert data["engineSource"]["pvlibBacked"] is False
    assert data["engineSource"]["fallbackUsed"] is True
    assert "site coordinates missing" in data["losses"]["fallbackReason"]


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
    assert data["financial"]["capexModel"] == "frontend-default-cost-basis"
    assert data["financial"]["roughCapexTry"] == 501360


@pytest.mark.parametrize(
    "scenario_key,proposal_tone,tariff_type",
    [
        ("on-grid", "commercial-grid", "commercial"),
        ("off-grid", "autonomy", "residential"),
        ("agricultural-irrigation", "seasonal-pump", "agriculture"),
        ("heat-pump", "electrification", "residential"),
        ("ev-charging", "charging", "commercial"),
    ],
)
def test_representative_scenarios_preserve_frontend_system_sizing_contract(scenario_key, proposal_tone, tariff_type):
    request = sample_request()
    request["scenario"] = {"key": scenario_key, "label": scenario_key, "proposalTone": proposal_tone}
    request["tariff"]["tariffType"] = tariff_type
    request["system"]["netMeteringEnabled"] = scenario_key == "on-grid"
    response = client.post("/api/pv/calculate", json=request)
    assert response.status_code == 200
    data = response.json()
    assert data["production"]["panelCount"] == 30
    assert data["production"]["systemPowerKwp"] == 12.9
    assert data["engineSource"]["notes"]
    if data["engineSource"]["pvlibBacked"]:
        assert data["losses"]["contractPanelWattPeak"] == 430
        assert round(data["losses"]["contractPanelAreaM2"], 4) == round(1.134 * 1.762, 4)


def test_contract_cable_loss_is_not_hidden_backend_default():
    base = sample_request()
    with_loss = sample_request()
    with_loss["system"]["cableLossPct"] = 3
    with_loss["system"]["wiringMismatchPct"] = 3
    base_response = client.post("/api/pv/calculate", json=base).json()
    loss_response = client.post("/api/pv/calculate", json=with_loss).json()
    assert loss_response["production"]["annualEnergyKwh"] < base_response["production"]["annualEnergyKwh"]
    assert loss_response["losses"].get("wiringLossPct") == 3
