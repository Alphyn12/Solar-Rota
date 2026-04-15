from __future__ import annotations

from typing import Dict, List

from backend.models.engine_contracts import EngineRequest


MONTH_WEIGHTS = [0.055, 0.062, 0.085, 0.095, 0.105, 0.115, 0.112, 0.108, 0.090, 0.075, 0.055, 0.043]

PANEL_WATT = {
    "mono": 430,
    "poly": 370,
    "bifacial": 470,
}

PANEL_AREA_M2 = {
    "mono": 1.134 * 1.762,
    "poly": 1.134 * 1.762,
    "bifacial": 1.134 * 1.762,
}

INVERTER_EFF = {
    "string": 0.97,
    "micro": 0.965,
    "optimizer": 0.985,
}


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _annual_ghi_to_psh(ghi: float | None, city_name: str | None = None) -> float:
    # BUG-15 fix: coerce to float first so string inputs don't silently fall through.
    # Heuristic: PSH (peak sun hours/day) is physically bounded to ~10 h/day.
    # Any value > 20 must be annual GHI kWh/m²/year → divide by 365.
    # Values 0 < v ≤ 20 are treated as daily PSH (reasonable range: 3–7 for Turkey).
    # Annual GHI < 20 kWh/m²/year is physically impossible, so the threshold is unambiguous.
    try:
        ghi = float(ghi) if ghi is not None else None
    except (TypeError, ValueError):
        ghi = None
    if ghi and ghi > 20:
        return ghi / 365
    if ghi and 0 < ghi <= 20:
        # Clamp to physical maximum of 10 h/day; values 10–20 indicate bad upstream data.
        return min(ghi, 10.0)
    fallback = {
        "Ankara": 4.44,
        "İstanbul": 4.24,
        "Izmir": 4.71,
        "İzmir": 4.71,
        "Antalya": 4.93,
    }
    return fallback.get(city_name or "", 4.50)


def _tilt_factor(tilt: float) -> float:
    delta = abs(tilt - 33)
    return _clamp(1 - delta * 0.0045, 0.62, 1.0)


def _azimuth_factor(azimuth: float) -> float:
    delta = abs(((azimuth - 180 + 180) % 360) - 180)
    return _clamp(1 - delta * 0.0017, 0.55, 1.0)


def panel_watt_peak(request: EngineRequest) -> float:
    explicit = getattr(request.system, "panelWattPeak", None)
    if explicit and float(explicit) > 0:
        return float(explicit)
    return float(PANEL_WATT.get(request.system.panelType, PANEL_WATT["mono"]))


def panel_area_m2(request: EngineRequest) -> float:
    explicit = getattr(request.system, "panelAreaM2", None)
    if explicit and float(explicit) > 0:
        return float(explicit)
    return float(PANEL_AREA_M2.get(request.system.panelType, PANEL_AREA_M2["mono"]))


def inverter_efficiency(request: EngineRequest) -> float:
    explicit = getattr(request.system, "inverterEfficiency", None)
    if explicit and 0 < float(explicit) <= 1:
        return float(explicit)
    return float(INVERTER_EFF.get(request.system.inverterType, INVERTER_EFF["string"]))


def bifacial_gain(request: EngineRequest) -> float:
    explicit = getattr(request.system, "bifacialGain", None)
    if explicit is not None:
        return max(0.0, float(explicit))
    return 0.10 if request.system.panelType == "bifacial" else 0.0


def cable_loss_factor(request: EngineRequest) -> float:
    loss_pct = getattr(request.system, "cableLossPct", 0) or getattr(request.system, "wiringMismatchPct", 0) or 0
    return 1 - _clamp(float(loss_pct), 0, 50) / 100


def calculate_production(request: EngineRequest) -> Dict[str, object]:
    panel_type = request.system.panelType
    panel_watt = panel_watt_peak(request)
    panel_area = panel_area_m2(request)
    usable_area = max(0, request.roof.areaM2) * 0.75
    panel_count = int(usable_area // panel_area)
    system_power_kwp = panel_count * panel_watt / 1000

    psh = _annual_ghi_to_psh(request.site.ghi, request.site.cityName)
    base_energy = system_power_kwp * psh * 365
    shading_factor = 1 - _clamp(request.roof.shadingPct, 0, 80) / 100
    soiling_factor = 1 - _clamp(request.roof.soilingPct, 0, 50) / 100
    inverter_factor = inverter_efficiency(request)
    orientation_factor = _tilt_factor(request.roof.tiltDeg) * _azimuth_factor(request.roof.azimuthDeg)
    bifacial_factor = 1 + bifacial_gain(request)
    wiring_factor = cable_loss_factor(request)

    annual_energy = base_energy * shading_factor * soiling_factor * inverter_factor * orientation_factor * bifacial_factor * wiring_factor
    monthly = [round(annual_energy * weight) for weight in MONTH_WEIGHTS]

    losses = {
        "baseEnergyKwh": round(base_energy),
        "orientationFactor": round(orientation_factor, 4),
        "shadingPct": request.roof.shadingPct,
        "soilingPct": request.roof.soilingPct,
        "inverterEfficiency": inverter_factor,
        "bifacialFactor": bifacial_factor,
        "wiringLossPct": round((1 - wiring_factor) * 100, 3),
        "modelCompleteness": "deterministic backend fallback aligned to frontend panel/inverter contract; pvlib hourly model chain preferred when available",
        "parityNotes": [
            "Panel wattage, panel area, inverter efficiency, bifacial gain, and cable loss are read from the shared request contract when present.",
            "This fallback still uses a deterministic GHI/PSH orientation model, so it is not expected to numerically match pvlib-backed or browser PVGIS output exactly.",
        ],
    }
    return {
        "production": {
            "annualEnergyKwh": round(annual_energy),
            "monthlyEnergyKwh": monthly,
            "systemPowerKwp": round(system_power_kwp, 3),
            "panelCount": panel_count,
            "psh": round(psh, 3),
            "capacityFactorPct": round((annual_energy / max(system_power_kwp * 8760, 1)) * 100, 2),
        },
        "losses": losses,
    }


def annual_load_kwh(request: EngineRequest) -> float:
    monthly = request.load.monthlyConsumptionKwh
    if monthly and len(monthly) == 12:
        return sum(max(0, float(value or 0)) for value in monthly)
    hourly = request.load.hourlyConsumption8760
    if hourly and len(hourly) == 8760:
        return sum(max(0, float(value or 0)) for value in hourly)
    return max(0, request.load.dailyConsumptionKwh) * 365


def monthly_from_annual(total: float) -> List[float]:
    return [round(total * weight, 2) for weight in MONTH_WEIGHTS]
