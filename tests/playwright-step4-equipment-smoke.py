from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:3000/index.html"


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1400})
        page.goto(BASE_URL, wait_until="networkidle")
        page.evaluate(
            """() => {
                const data = window._appData;
                window.state.roofArea = 120;
                window.state.annualConsumptionKwh = 9600;
                window.state.usableRoofRatio = 0.72;
                window.state.panelType = 'poly';
                window.state.inverterType = 'optimizer';
                window.state.batteryEnabled = true;
                window.state.battery = { ...data.BATTERY_MODELS.tesla_pw3, model: 'tesla_pw3' };
                window.goToStep(4);
                window.buildPanelCards();
                window.buildInverterCards();
                window.updatePanelPreview();
                window.onBatteryToggle(true);
            }"""
        )
        page.wait_for_function("window.state.step === 4")
        page.wait_for_selector(".panel-card")
        page.wait_for_selector(".inverter-card")
        page.wait_for_selector(".bat-model-btn")

        assert page.locator(".panel-card").count() == 3
        assert page.locator(".inverter-card").count() == 3
        assert page.locator(".bat-model-btn").count() == 6

        assert "1762" in page.locator(".panel-card").nth(1).inner_text()
        assert "SolarEdge Home Hub + S440" in page.locator(".inverter-card.selected").inner_text()
        assert page.locator("#battery-summary").is_visible()
        assert "Tesla Powerwall 3" in page.locator("#battery-summary").inner_text()
        assert "SolarEdge Home Battery 400V" in page.locator("#bat-models-wrap").inner_text()
        assert "panel + inverter + batarya" in page.locator("#equip-summary-cost-note").inner_text().lower()
        assert page.locator("#equip-summary-inverter-cost").inner_text() != "—"
        assert page.locator("#equip-summary-battery-cost").inner_text() != "Kapalı"

        page.click('[data-battery-model="custom"]')
        page.wait_for_selector("#bat-custom-inputs", state="visible")
        page.fill("#bat-capacity", "8.5")
        page.fill("#bat-dod", "90")
        page.fill("#bat-eff-input", "92")
        page.wait_for_timeout(150)
        assert "Özel 8.5 kWh" in page.locator("#equip-summary-battery").inner_text()

        page.click('#panel-card-bifacial')
        page.wait_for_timeout(100)
        assert "Bifacial" in page.locator("#equip-summary-panel-type").inner_text()

        page.click('#inv-card-micro')
        page.wait_for_timeout(100)
        assert "Mikro İnverter" in page.locator("#equip-summary-inverter").inner_text()
        assert page.locator("#equip-summary-power").inner_text().endswith("kWp")
        assert page.locator("#equip-summary-area").inner_text().endswith("m²")
        assert "Kullanılabilir enerji" in page.locator("#battery-summary").inner_text()

        page.screenshot(path="tests/artifacts-step4-equipment.png", full_page=True)
        browser.close()

    print("step4 equipment smoke passed")


if __name__ == "__main__":
    main()
