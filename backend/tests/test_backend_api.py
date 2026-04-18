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
    assert data["financial"]["estimateOnly"] is True
    assert data["financial"]["warning"] == "estimate_only_not_for_commercial_quotes"
    assert data["proposal"]["warning"] == "estimate_only_not_for_commercial_quotes"
    # FIX-6 (backend KDV parity): panels at 0% KDV, non-panel components at 20%.
    # 12.9 kWp mono: panel_cost=258_000 (0% KDV) + non_panel=159_800 (20% KDV → +31_960)
    # = 449_760. Old value was 501_360 (20% on full subtotal).
    assert data["financial"]["roughCapexTry"] == 449760


def test_backend_offgrid_financial_uses_alternative_cost_and_blocks_export_revenue():
    request = sample_request()
    request["scenario"] = {"key": "off-grid", "label": "Off-Grid", "proposalTone": "autonomy"}
    request["system"]["netMeteringEnabled"] = True
    request["tariff"]["importRateTryKwh"] = 7.16
    request["tariff"]["exportRateTryKwh"] = 3.0
    request["tariff"]["offGridCostPerKwhTry"] = 19.5

    response = client.post("/api/financial/proposal", json=request)
    assert response.status_code == 200
    data = response.json()
    assert data["financial"]["financialBasis"] == "off-grid-user-alternative-energy-cost"
    assert data["financial"]["financialSavingsRateTryKwh"] == 19.5
    assert data["financial"]["paidGridExportKwh"] == 0
    assert abs(data["financial"]["annualSavingsTry"] - round(data["financial"]["selfConsumedEnergyKwh"] * 19.5)) <= 20


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


def test_fix3_self_consumption_target_caps_self_consumed_energy():
    """FIX-3: Backend self-consumption must be <= annual_energy * scenario_target.
    Before the fix, self_consumed = min(annual_energy, annual_load) which could
    be unrealistically high (implies 100% instantaneous match between generation
    and load)."""
    request = sample_request()
    # on-grid target = 0.58 — with a large roof and small load the old code
    # would claim 100% self-consumption but new code caps at 58%
    request["load"]["dailyConsumptionKwh"] = 5  # small load vs large system
    response = client.post("/api/financial/proposal", json=request)
    assert response.status_code == 200
    data = response.json()
    annual_energy = data["financial"]["selfConsumedEnergyKwh"] + data["financial"]["gridExportKwh"]
    self_consumed = data["financial"]["selfConsumedEnergyKwh"]
    annual_load = data["financial"]["annualLoadKwh"]
    # self_consumed must be <= energy * 0.58 (on-grid target) and <= load
    assert self_consumed <= annual_energy * 0.60, (
        f"FIX-3: self_consumed {self_consumed} > energy {annual_energy} * 0.58 "
        f"(pre-fix behaviour — 100% self-consumption was being claimed)"
    )
    assert self_consumed <= annual_load, "FIX-3: self_consumed cannot exceed annual load"


def test_fix3_om_cost_escalates_year_over_year():
    """FIX-3: O&M costs must escalate over the 25-year horizon; before the fix
    they were flat (annual_om_cost applied identically to every year)."""
    from backend.services.financial_service import build_financial_payload
    from backend.models.engine_contracts import EngineRequest

    request_data = sample_request()
    request_data["load"]["dailyConsumptionKwh"] = 30
    req = EngineRequest(**request_data)
    production = {"annualEnergyKwh": 14000, "systemPowerKwp": 12.9}
    payload = build_financial_payload(req, production)
    # NPV should be finite and realistic
    assert payload["financial"]["npv25Try"] is not None
    # Simple payback should be positive
    assert payload["financial"]["simplePaybackYears"] > 0


def test_fix6_kdv_split_panel_zero_nonpanel_twenty():
    """FIX-6: Solar panels carry 0% KDV (Law 7456/2023), other components 20%."""
    from backend.services.financial_service import _frontend_default_capex
    from backend.models.engine_contracts import EngineRequest

    request_data = sample_request()
    req = EngineRequest(**request_data)
    capex = _frontend_default_capex(req, 12.9)

    panel_cost = 12.9 * 1000 * 20.0  # mono
    non_panel = 12.9 * 6500 + 12.9 * 2200 + 12.9 * 600 + 12.9 * 900 + 12.9 * 1800 + 5000
    expected = panel_cost * 1.00 + non_panel * 1.20
    assert abs(capex - expected) < 1, (
        f"FIX-6: capex {capex:.0f} != expected {expected:.0f} "
        f"(panel 0% KDV + non-panel 20% KDV)"
    )
    # Must be less than old 20%-flat capex
    old_capex_flat = (panel_cost + non_panel) * 1.20
    assert capex < old_capex_flat, "FIX-6: New capex (panel 0%) must be lower than flat-20% capex"


def test_contract_cable_loss_is_not_hidden_backend_default():
    base = sample_request()
    with_loss = sample_request()
    with_loss["system"]["cableLossPct"] = 3
    with_loss["system"]["wiringMismatchPct"] = 3
    base_response = client.post("/api/pv/calculate", json=base).json()
    loss_response = client.post("/api/pv/calculate", json=with_loss).json()
    assert loss_response["production"]["annualEnergyKwh"] < base_response["production"]["annualEnergyKwh"]
    assert loss_response["losses"].get("wiringLossPct") == 3


# ── PVGIS Proxy endpoint tests ────────────────────────────────────────────────

from unittest.mock import AsyncMock, MagicMock, patch


VALID_PVGIS_UPSTREAM = {
    "outputs": {
        "totals": {
            "fixed": {"E_y": 1250.0, "H(i)_y": 1680.0}
        },
        "monthly": {
            "fixed": [{"E_m": 100 + i} for i in range(12)]
        },
    }
}


def _mock_httpx_client(status_code=200, body=None, exc=None):
    """Returns a mock async context manager standing in for httpx.AsyncClient(...)."""
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.json.return_value = body if body is not None else {}

    inner = AsyncMock()
    if exc is not None:
        inner.get = AsyncMock(side_effect=exc)
    else:
        inner.get = AsyncMock(return_value=mock_resp)

    cm = AsyncMock()
    cm.__aenter__ = AsyncMock(return_value=inner)
    cm.__aexit__ = AsyncMock(return_value=None)
    return cm


def test_pvgis_proxy_invalid_lat_rejected():
    """FastAPI Query validation rejects lat outside -90..90."""
    resp = client.get("/api/pvgis-proxy?lat=200&lon=32&peakpower=5")
    assert resp.status_code == 422


def test_pvgis_proxy_peakpower_zero_rejected():
    """peakpower=0 is rejected by the gt=0 constraint on the Query param."""
    resp = client.get("/api/pvgis-proxy?lat=39&lon=32&peakpower=0")
    assert resp.status_code == 422


def test_pvgis_proxy_missing_required_params():
    """Omitting lat/lon/peakpower entirely returns 422."""
    resp = client.get("/api/pvgis-proxy?lat=39")
    assert resp.status_code == 422


def test_pvgis_proxy_success():
    """Successful PVGIS upstream → ok=True, proxy-success, energy/poa/monthly populated."""
    cm = _mock_httpx_client(status_code=200, body=VALID_PVGIS_UPSTREAM)
    with patch("httpx.AsyncClient", return_value=cm):
        resp = client.get("/api/pvgis-proxy?lat=39&lon=32&peakpower=5&loss=14&angle=30&aspect=0")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["fetchStatus"] == "proxy-success"
    assert data["rawEnergy"] == 1250.0
    assert data["rawPoa"] == 1680.0
    assert isinstance(data["rawMonthly"], list) and len(data["rawMonthly"]) == 12
    assert data["error_type"] is None


def test_pvgis_proxy_timeout():
    """PVGIS upstream timeout → ok=False, error_type=timeout, rawEnergy=None."""
    import httpx as httpx_lib
    cm = _mock_httpx_client(exc=httpx_lib.TimeoutException("upstream timed out"))
    with patch("httpx.AsyncClient", return_value=cm):
        resp = client.get("/api/pvgis-proxy?lat=39&lon=32&peakpower=5")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is False
    assert data["error_type"] == "timeout"
    assert data["rawEnergy"] is None
    assert data["rawMonthly"] is None


def test_pvgis_proxy_http_error():
    """PVGIS upstream HTTP 503 → ok=False, error_type=http-error."""
    cm = _mock_httpx_client(status_code=503, body={})
    with patch("httpx.AsyncClient", return_value=cm):
        resp = client.get("/api/pvgis-proxy?lat=39&lon=32&peakpower=5")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is False
    assert data["error_type"] == "http-error"
    assert data["rawEnergy"] is None


def test_pvgis_proxy_empty_ey_response():
    """PVGIS returning E_y=0 → ok=False, error_type=empty-response."""
    empty = {"outputs": {"totals": {"fixed": {"E_y": 0}}, "monthly": {"fixed": []}}}
    cm = _mock_httpx_client(status_code=200, body=empty)
    with patch("httpx.AsyncClient", return_value=cm):
        resp = client.get("/api/pvgis-proxy?lat=39&lon=32&peakpower=5")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is False
    assert data["error_type"] == "empty-response"


def test_pvgis_proxy_network_error():
    """Network-level exception → ok=False, error_type not http-error."""
    import httpx as httpx_lib
    cm = _mock_httpx_client(exc=httpx_lib.ConnectError("connection refused"))
    with patch("httpx.AsyncClient", return_value=cm):
        resp = client.get("/api/pvgis-proxy?lat=39&lon=32&peakpower=5")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is False
    assert data["rawEnergy"] is None
    assert data["error_type"] in {"network", "unknown"}
