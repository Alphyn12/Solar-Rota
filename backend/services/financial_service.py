from __future__ import annotations

from backend.engines.production_router import calculate_backend_production
from backend.engines.simple_engine import annual_load_kwh
from backend.models.engine_contracts import EngineRequest, EngineResponse


def _npv(cashflows: list[float], discount_rate: float) -> float:
    return sum(cf / ((1 + discount_rate) ** idx) for idx, cf in enumerate(cashflows))


def build_financial_payload(request: EngineRequest, production: dict) -> dict:
    annual_energy = float(production.get("annualEnergyKwh") or 0)
    annual_load = annual_load_kwh(request)
    import_rate = max(0, request.tariff.importRateTryKwh or 0)
    export_rate = max(0, request.tariff.exportRateTryKwh or 0)
    net_metering = bool(request.system.netMeteringEnabled)

    scenario_key = request.scenario.key
    self_consumption_target = {
        "off-grid": 0.90,
        "flexible-mobile": 0.88,
        "agricultural-irrigation": 0.72,
        "ev-charging": 0.68,
        "heat-pump": 0.62,
    }.get(scenario_key, 0.58)
    # Saatlik simülasyon olmadan en sağlam üst sınır: min(üretim, tüketim).
    # Scenario bazlı self_consumption_target burada senaryo notuna dönüştürülür,
    # hesap için kullanılmaz — JS tarafı saatlik simülasyonla zaten doğru değeri üretir.
    self_consumed = min(annual_energy, annual_load)
    export_kwh = max(0, annual_energy - self_consumed)
    paid_export = export_kwh if net_metering else 0
    annual_savings = self_consumed * import_rate + paid_export * export_rate

    rough_capex = max(1, float(production.get("systemPowerKwp") or 0) * 26000)
    if request.system.batteryEnabled and request.system.battery:
        rough_capex += max(0, float(request.system.battery.get("capacity", 0) or 0)) * 8000

    simple_payback = rough_capex / annual_savings if annual_savings > 0 else None
    discount_rate = max(0, request.tariff.discountRate or 0.18)
    escalation = max(-0.5, request.tariff.annualPriceIncrease or 0.12)
    # O&M + sigorta ~%1.7/yıl (JS engine ile tutarlı: omRate=1.2 + insuranceRate=0.5)
    annual_om_cost = round(rough_capex * 0.017)
    cashflows = [-rough_capex]
    for year in range(1, 26):
        gross = annual_savings * ((1 + escalation) ** (year - 1))
        cashflows.append(gross - annual_om_cost)
    project_npv = _npv(cashflows, discount_rate)
    roi = ((sum(cashflows[1:]) - rough_capex) / rough_capex) * 100

    blockers = []
    if not request.governance.quoteInputsVerified:
        blockers.append("Teklif varsayımları doğrulanmadı.")
    if not request.governance.hasSignedCustomerBillData and not request.load.monthlyConsumptionKwh and not request.load.hourlyConsumption8760:
        blockers.append("Tüketim/fatura kanıtı eksik.")
    if not request.tariff.sourceCheckedAt:
        blockers.append("Tarife kaynak kontrol tarihi eksik.")

    financial = {
        "annualLoadKwh": round(annual_load),
        "selfConsumedEnergyKwh": round(self_consumed),
        "gridExportKwh": round(export_kwh),
        "paidGridExportKwh": round(paid_export),
        "annualSavingsTry": round(annual_savings),
        "roughCapexTry": round(rough_capex),
        "simplePaybackYears": round(simple_payback, 2) if simple_payback else None,
        "npv25Try": round(project_npv),
        "roiPct": round(roi, 1),
    }
    proposal = {
        "scenarioKey": scenario_key,
        "scenarioLabel": request.scenario.label,
        "quoteReadiness": "not-quote-ready" if blockers else "backend-engineering-estimate",
        "blockers": blockers,
        "nextAction": "Attach evidence and run full proposal governance before approval." if blockers else "Review proposal governance and customer-facing output.",
    }
    return {"financial": financial, "proposal": proposal}


def calculate_financial_proposal(request: EngineRequest) -> EngineResponse:
    production_payload = calculate_backend_production(request)
    financial_payload = build_financial_payload(request, production_payload["production"])
    return EngineResponse(
        engineSource=production_payload["engineSource"],
        production=production_payload["production"],
        losses=production_payload["losses"],
        financial=financial_payload["financial"],
        proposal=financial_payload["proposal"],
        raw={**production_payload.get("raw", {}), "mode": "financial-proposal"},
    )
