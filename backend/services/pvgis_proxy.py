"""
PVGIS Proxy Service — Solar Rota Backend
Forwards PVGIS API requests from the backend, avoiding browser CORS restrictions.
Returns structured response with error classification metadata.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_PVGIS_ENDPOINTS = [
    "https://re.jrc.ec.europa.eu/api/v5_2/PVcalc",
    "https://re.jrc.ec.europa.eu/api/v5_3/PVcalc",
]
_PROXY_TIMEOUT_S = 22.0


def _classify_httpx_error(exc: Exception) -> str:
    name = type(exc).__name__.lower()
    msg = str(exc).lower()
    if "timeout" in name or "timeout" in msg:
        return "timeout"
    if "connect" in name or "network" in name or "connect" in msg:
        return "network"
    return "unknown"


async def fetch_pvgis_via_proxy(
    lat: float,
    lon: float,
    peakpower: float,
    loss: float = 0.0,
    angle: float = 30.0,
    aspect: float = 0.0,
) -> Dict[str, Any]:
    """
    Proxy-fetch PVGIS PVcalc for given parameters.

    Returns a dict with:
      ok (bool), fetchStatus, rawEnergy, rawPoa, rawMonthly,
      endpointUsed, error_type, error_message

    Never raises — errors are returned as structured metadata.
    Caller should use local PSH fallback when ok=False.
    """
    try:
        import httpx
    except ImportError:
        logger.error("[pvgis-proxy] httpx not installed — proxy unavailable")
        return _fail("dependency-missing", "httpx not installed")

    params: Dict[str, Any] = {
        "lat": lat,
        "lon": lon,
        "peakpower": peakpower,
        "loss": loss,
        "angle": angle,
        "aspect": aspect,
        "outputformat": "json",
        "pvtechchoice": "crystSi",
        "mountingplace": "free",
    }

    last_error_type = "unknown"
    last_error_msg = "All PVGIS endpoints failed"

    async with httpx.AsyncClient(timeout=_PROXY_TIMEOUT_S) as client:
        for endpoint in _PVGIS_ENDPOINTS:
            try:
                resp = await client.get(endpoint, params=params)
                if resp.status_code != 200:
                    logger.warning("[pvgis-proxy] HTTP %s from %s", resp.status_code, endpoint)
                    last_error_type = "http-error"
                    last_error_msg = f"HTTP {resp.status_code}"
                    continue

                data = resp.json()
                fixed = (data.get("outputs") or {}).get("totals", {}).get("fixed", {})
                ey: Optional[float] = fixed.get("E_y")
                if not ey or ey <= 0:
                    logger.warning("[pvgis-proxy] E_y missing or zero from %s", endpoint)
                    last_error_type = "empty-response"
                    last_error_msg = "E_y missing or zero"
                    continue

                poa: Optional[float] = fixed.get("H(i)_y") or fixed.get("H_i_y")

                monthly_fixed = (data.get("outputs") or {}).get("monthly", {}).get("fixed")
                raw_monthly: Optional[List[Optional[float]]] = None
                if monthly_fixed and len(monthly_fixed) == 12:
                    raw_monthly = [m.get("E_m") for m in monthly_fixed]

                logger.info("[pvgis-proxy] OK E_y=%.1f from %s", ey, endpoint)
                return {
                    "ok": True,
                    "fetchStatus": "proxy-success",
                    "rawEnergy": ey,
                    "rawPoa": poa,
                    "rawMonthly": raw_monthly,
                    "endpointUsed": endpoint,
                    "error_type": None,
                    "error_message": None,
                }

            except Exception as exc:
                etype = _classify_httpx_error(exc)
                logger.warning("[pvgis-proxy] %s on %s: %s", etype, endpoint, exc)
                last_error_type = etype
                last_error_msg = "PVGIS upstream unavailable"

    return _fail(last_error_type, last_error_msg)


def _fail(error_type: str, message: str) -> Dict[str, Any]:
    return {
        "ok": False,
        "fetchStatus": "proxy-failed",
        "rawEnergy": None,
        "rawPoa": None,
        "rawMonthly": None,
        "endpointUsed": None,
        "error_type": error_type,
        "error_message": message,
    }


def validate_pvgis_params(
    lat: float, lon: float, peakpower: float,
    loss: float, angle: float, aspect: float,
) -> List[str]:
    errors: List[str] = []
    if not -90 <= lat <= 90:
        errors.append("lat must be -90..90")
    if not -180 <= lon <= 180:
        errors.append("lon must be -180..180")
    if not 0 < peakpower <= 10000:
        errors.append("peakpower must be 0..10000 kWp")
    if not 0 <= loss <= 100:
        errors.append("loss must be 0..100 %")
    if not 0 <= angle <= 90:
        errors.append("angle must be 0..90 degrees")
    if not -180 <= aspect <= 180:
        errors.append("aspect must be -180..180 degrees")
    return errors
