from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


CONTRACT_VERSION = "GH-PV-ENGINE-CONTRACT-2026.04-v1"


class FlexibleModel(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)


class ScenarioInput(FlexibleModel):
    key: str = "on-grid"
    label: str = "On-Grid"
    proposalTone: str = "commercial-grid"


class SiteInput(FlexibleModel):
    lat: Optional[float] = None
    lon: Optional[float] = None
    cityName: Optional[str] = None
    ghi: Optional[float] = None
    timezone: str = "Europe/Istanbul"


class RoofInput(FlexibleModel):
    areaM2: float = 0
    tiltDeg: float = 33
    azimuthDeg: float = 180
    azimuthName: str = "Güney"
    shadingPct: float = 0
    soilingPct: float = 0
    geometry: Optional[Dict[str, Any]] = None
    sections: List[Dict[str, Any]] = Field(default_factory=list)


class SystemInput(FlexibleModel):
    panelType: str = "mono"
    inverterType: str = "string"
    targetPowerKwp: Optional[float] = None
    batteryEnabled: bool = False
    battery: Optional[Dict[str, Any]] = None
    netMeteringEnabled: bool = False
    evEnabled: bool = False
    ev: Optional[Dict[str, Any]] = None
    heatPumpEnabled: bool = False
    heatPump: Optional[Dict[str, Any]] = None


class LoadInput(FlexibleModel):
    dailyConsumptionKwh: float = 0
    monthlyConsumptionKwh: Optional[List[float]] = None
    hourlyConsumption8760: Optional[List[float]] = None


class TariffInput(FlexibleModel):
    tariffType: str = "residential"
    tariffRegime: str = "auto"
    importRateTryKwh: float = 0
    exportRateTryKwh: float = 0
    contractedPowerKw: float = 0
    annualPriceIncrease: float = 0.12
    discountRate: float = 0.18
    sourceDate: Optional[str] = None
    sourceCheckedAt: Optional[str] = None


class GovernanceInput(FlexibleModel):
    evidence: Dict[str, Any] = Field(default_factory=dict)
    proposalApproval: Optional[Dict[str, Any]] = None
    quoteInputsVerified: bool = False
    hasSignedCustomerBillData: bool = False


class EngineRequest(FlexibleModel):
    schema_: str = Field(default=CONTRACT_VERSION, alias="schema")
    requestedEngine: str = "python-backend"
    scenario: ScenarioInput = Field(default_factory=ScenarioInput)
    site: SiteInput = Field(default_factory=SiteInput)
    roof: RoofInput = Field(default_factory=RoofInput)
    system: SystemInput = Field(default_factory=SystemInput)
    load: LoadInput = Field(default_factory=LoadInput)
    tariff: TariffInput = Field(default_factory=TariffInput)
    governance: GovernanceInput = Field(default_factory=GovernanceInput)


class EngineSource(FlexibleModel):
    engine: str = "python-backend"
    provider: str = "python-pvlib-ready"
    source: str = "Python backend"
    confidence: str = "medium"
    engineQuality: str = "adapter-ready"
    pvlibReady: bool = True
    pvlibBacked: bool = False
    fallbackUsed: bool = False
    notes: List[str] = Field(default_factory=list)


class EngineResponse(FlexibleModel):
    schema_: str = Field(default=CONTRACT_VERSION, alias="schema")
    generatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    engineSource: EngineSource = Field(default_factory=EngineSource)
    production: Dict[str, Any] = Field(default_factory=dict)
    losses: Dict[str, Any] = Field(default_factory=dict)
    financial: Dict[str, Any] = Field(default_factory=dict)
    proposal: Dict[str, Any] = Field(default_factory=dict)
    raw: Dict[str, Any] = Field(default_factory=dict)


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "guneshesap-engineering-backend"
    version: str = "0.1.0"
    pvlibAvailable: bool = False
    pvlibBackedEngineAvailable: bool = False
    activeEngineWhenAvailable: str = "pvlib-backed"
    fallbackEngine: str = "python-deterministic-fallback"
