from __future__ import annotations

from datetime import datetime, timezone
from importlib.util import find_spec
from typing import Any

from backend.engines.simple_engine import (
    _annual_ghi_to_psh,
    bifacial_gain,
    cable_loss_factor,
    inverter_efficiency,
    panel_area_m2,
    panel_watt_peak,
)
from backend.models.engine_contracts import EngineRequest, EngineSource


PVLIB_AVAILABLE = find_spec("pvlib") is not None


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _system_power_kwp(request: EngineRequest) -> tuple[float, int]:
    explicit_kwp = getattr(request.system, "targetPowerKwp", None)
    if explicit_kwp:
        kwp = max(0, float(explicit_kwp))
        panel_watt = panel_watt_peak(request)
        return kwp, max(1, round((kwp * 1000) / panel_watt))

    panel_watt = panel_watt_peak(request)
    panel_area = panel_area_m2(request)
    usable_area = max(0, request.roof.areaM2) * 0.75
    panel_count = int(usable_area // panel_area)
    return panel_count * panel_watt / 1000, panel_count


def _has_valid_site_coordinates(request: EngineRequest) -> bool:
    lat = request.site.lat
    lon = request.site.lon
    return (
        lat is not None
        and lon is not None
        and -90 <= float(lat) <= 90
        and -180 <= float(lon) <= 180
    )


def _representative_year() -> int:
    year = datetime.now(timezone.utc).year
    is_leap = year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
    return year - 1 if is_leap else year


def engine_source(mode: str = "auto", fallback_reason: str | None = None) -> EngineSource:
    if mode == "pvlib" and PVLIB_AVAILABLE and not fallback_reason:
        return EngineSource(
            engine="python-backend",
            provider="python-pvlib",
            source="pvlib-backed",
            confidence="high",
            engineQuality="engineering-mvp",
            pvlibReady=True,
            pvlibBacked=True,
            fallbackUsed=False,
            notes=[
                "pvlib solar position, clear-sky irradiance, POA transposition, cell temperature, and PVWatts DC model are active.",
                "Panel wattage, panel area, inverter efficiency, bifacial gain, and cable loss are read from the shared frontend/backend request contract when present.",
                "Weather is still normalized from the request GHI when no measured or PVGIS time series is provided.",
                "Inverter clipping, AOI losses, and dispatch remain simplified in this MVP pass.",
            ],
        )

    if fallback_reason:
        return EngineSource(
            engine="python-backend",
            provider="python-deterministic-fallback",
            source="Python backend deterministic fallback",
            confidence="medium-low",
            engineQuality="fallback-estimate",
            pvlibReady=True,
            pvlibBacked=False,
            fallbackUsed=True,
            notes=[
                fallback_reason,
                "Deterministic backend model preserved the normalized response contract.",
                "Install pvlib and provide richer irradiance/weather inputs for the pvlib-backed path.",
            ],
        )

    return EngineSource(
        engine="python-backend",
        provider="python-pvlib-ready",
        source="Python backend pvlib-ready",
        confidence="medium",
        engineQuality="adapter-ready",
        pvlibReady=True,
        pvlibBacked=False,
        fallbackUsed=False,
        notes=[
            "pvlib is not installed in this environment; deterministic backend engine is active.",
            "TODO(pvlib): add measured/PVGIS hourly weather, AOI losses, clipping, inverter curves, and dispatch.",
        ],
    )


def pvlib_status() -> dict[str, Any]:
    return {
        "pvlibAvailable": PVLIB_AVAILABLE,
        "pvlibBackedEngineAvailable": PVLIB_AVAILABLE,
        "activeWhenAvailable": "pvlib-backed",
        "fallbackEngine": "python-deterministic-fallback",
        "readyFor": [
            "solar position",
            "clear-sky irradiance",
            "POA transposition",
            "cell temperature",
            "PVWatts DC production",
            "basic AC/inverter approximation",
        ],
        "futureWork": [
            "measured/PVGIS hourly weather source injection",
            "AOI losses",
            "inverter clipping curves",
            "battery dispatch",
            "off-grid autonomy",
            "irrigation pump curves",
        ],
    }


def can_use_pvlib(request: EngineRequest) -> bool:
    return (
        PVLIB_AVAILABLE
        and _has_valid_site_coordinates(request)
        and _system_power_kwp(request)[0] > 0
    )


def calculate_pvlib_production(request: EngineRequest) -> dict[str, Any]:
    if not PVLIB_AVAILABLE:
        raise RuntimeError("pvlib is not installed")
    if request.site.lat is None or request.site.lon is None:
        raise ValueError("pvlib engine requires latitude and longitude")

    import numpy as np
    import pandas as pd
    import pvlib

    system_power_kwp, panel_count = _system_power_kwp(request)
    if system_power_kwp <= 0:
        raise ValueError("pvlib engine requires positive installed capacity")

    tz = request.site.timezone or "Europe/Istanbul"
    year = _representative_year()
    times = pd.date_range(f"{year}-01-01 00:00", periods=8760, freq="h", tz=tz)

    location = pvlib.location.Location(
        latitude=float(request.site.lat),
        longitude=float(request.site.lon),
        tz=tz,
        name=request.site.cityName or "Solar Rota site",
    )
    solar_position = location.get_solarposition(times)
    clearsky = location.get_clearsky(times, model="ineichen")
    dni_extra = pvlib.irradiance.get_extra_radiation(times)

    target_annual_ghi = _annual_ghi_to_psh(request.site.ghi, request.site.cityName) * 365
    clear_annual_ghi = max(float(clearsky["ghi"].sum()) / 1000, 1)
    ghi_scale = _clamp(target_annual_ghi / clear_annual_ghi, 0.45, 1.30)

    scaled_ghi = clearsky["ghi"] * ghi_scale
    scaled_dni = clearsky["dni"] * ghi_scale
    scaled_dhi = clearsky["dhi"] * ghi_scale

    poa = pvlib.irradiance.get_total_irradiance(
        surface_tilt=_clamp(float(request.roof.tiltDeg), 0, 90),
        surface_azimuth=float(request.roof.azimuthDeg),
        dni=scaled_dni,
        ghi=scaled_ghi,
        dhi=scaled_dhi,
        solar_zenith=solar_position["apparent_zenith"],
        solar_azimuth=solar_position["azimuth"],
        dni_extra=dni_extra,
        model="haydavies",
    )
    poa_global = poa["poa_global"].clip(lower=0).fillna(0)

    shading_factor = 1 - _clamp(float(request.roof.shadingPct or 0), 0, 80) / 100
    soiling_factor = 1 - _clamp(float(request.roof.soilingPct or 0), 0, 50) / 100
    wiring_mismatch_factor = cable_loss_factor(request)
    bifacial_factor = 1 + bifacial_gain(request)
    poa_effective = poa_global * shading_factor * soiling_factor * wiring_mismatch_factor * bifacial_factor

    day_of_year = pd.Series(times.dayofyear, index=times)
    ambient_temp = pd.Series(17 + 11 * np.sin(2 * np.pi * (day_of_year - 172) / 365), index=times)
    wind_speed = pd.Series(1.5, index=times)
    temp_params = pvlib.temperature.TEMPERATURE_MODEL_PARAMETERS["sapm"]["open_rack_glass_glass"]
    cell_temp = pvlib.temperature.sapm_cell(poa_effective, ambient_temp, wind_speed, **temp_params)

    pdc0_w = system_power_kwp * 1000
    pdc_w = pvlib.pvsystem.pvwatts_dc(
        effective_irradiance=poa_effective,
        temp_cell=cell_temp,
        pdc0=pdc0_w,
        gamma_pdc=-0.0037,
        temp_ref=25,
    ).clip(lower=0)

    inverter_eff = inverter_efficiency(request)
    inverter_ac_limit_w = pdc0_w * 0.96
    ac_w = (pdc_w * inverter_eff).clip(upper=inverter_ac_limit_w).fillna(0)
    clipped_w = (pdc_w * inverter_eff - ac_w).clip(lower=0).fillna(0)

    # "ME" pandas 2.2+; eski sürümler "M" kullanır — her iki alias denenebilir
    try:
        monthly_kwh = (ac_w.resample("ME").sum() / 1000).round(2).tolist()
    except Exception:
        monthly_kwh = (ac_w.resample("M").sum() / 1000).round(2).tolist()
    annual_kwh = float(sum(monthly_kwh))
    poa_annual = float(poa_global.sum()) / 1000
    effective_poa_annual = float(poa_effective.sum()) / 1000
    dc_annual_kwh = float(pdc_w.sum()) / 1000
    clipping_kwh = float(clipped_w.sum()) / 1000
    capacity_factor = (annual_kwh / max(system_power_kwp * 8760, 1)) * 100

    loss_flags = {
        "shadingPct": float(request.roof.shadingPct or 0),
        "soilingPct": float(request.roof.soilingPct or 0),
        "wiringMismatchPct": round((1 - wiring_mismatch_factor) * 100, 2),
        "wiringLossPct": round((1 - wiring_mismatch_factor) * 100, 2),
        "contractPanelWattPeak": round(panel_watt_peak(request), 3),
        "contractPanelAreaM2": round(panel_area_m2(request), 4),
        "contractInverterEfficiency": round(inverter_eff, 4),
        "temperatureModel": "pvlib.sapm_cell.open_rack_glass_glass",
        "dcModel": "pvlib.pvsystem.pvwatts_dc",
        "transpositionModel": "pvlib.irradiance.haydavies",
        "inverterApproximation": "constant efficiency with AC cap",
        "clippingKwh": round(clipping_kwh, 2),
    }

    return {
        "engineSource": engine_source("pvlib"),
        "production": {
            "annualEnergyKwh": round(annual_kwh),
            "monthlyEnergyKwh": monthly_kwh,
            "systemPowerKwp": round(system_power_kwp, 3),
            "panelCount": panel_count,
            "psh": round(annual_kwh / max(system_power_kwp * 365, 1), 3),
            "capacityFactorPct": round(capacity_factor, 2),
            "annual_kwh": round(annual_kwh, 2),
            "monthly_kwh": monthly_kwh,
            "engine_used": "pvlib-backed",
            "engine_quality": "engineering-mvp",
            "confidence_level": "high",
            "assumption_flags": {
                "usesClearSkyIrradianceScaledToInputGhi": True,
                "usesMeasuredWeather": False,
                "usesHourlySolarPosition": True,
                "usesPvlibTemperatureModel": True,
                "usesSimplifiedInverterModel": True,
            },
        },
        "losses": {
            "poaAnnualKwhM2": round(poa_annual, 2),
            "effectivePoaAnnualKwhM2": round(effective_poa_annual, 2),
            "dcAnnualKwh": round(dc_annual_kwh, 2),
            "acAnnualKwh": round(annual_kwh, 2),
            "ghiScaleFactor": round(ghi_scale, 4),
            **loss_flags,
            "modelCompleteness": "pvlib MVP: real solar position/transposition/temperature/DC path with approximate weather and AC clipping.",
        },
        "raw": {
            "engineUsed": "pvlib-backed",
            "engine_used": "pvlib-backed",
            "engineQuality": "engineering-mvp",
            "engine_quality": "engineering-mvp",
            "confidenceLevel": "high",
            "confidence_level": "high",
            "sourceNotes": engine_source("pvlib").notes,
            "source_notes": engine_source("pvlib").notes,
            "parityNotes": [
                "System sizing is aligned to the frontend panel catalog through the request contract.",
                "Production may intentionally differ from browser PVGIS/JS because pvlib uses hourly solar position, transposition and temperature modeling.",
            ],
            "fallbackUsed": False,
            "fallback_flags": [],
            "simulationYear": year,
            "hourlySamples": len(times),
        },
    }
