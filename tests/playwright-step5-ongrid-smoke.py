from playwright.sync_api import sync_playwright


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1200})
        page.goto("http://127.0.0.1:3000", wait_until="networkidle")

        page.evaluate(
            """() => {
                window.state.scenarioKey = 'on-grid';
                window.state.lat = 41.6771;
                window.state.lon = 26.5557;
                window.state.cityName = 'Edirne';
                window.state.ghi = 1490;
                window.state.roofArea = 120;
                window.state.multiRoof = false;
                window.state.roofSections = [];
                window.state.results = null;
                window.goToStep(5);
            }"""
        )

        page.wait_for_function("window.state.step === 5")
        assert page.locator("#on-grid-flow-panel").is_visible()
        assert page.locator(".on-grid-choice-card").count() == 2
        assert page.locator("#on-grid-monthly-bill-estimate").is_visible()
        assert page.locator("#step5-advanced-card").evaluate("el => !el.open")

        page.select_option("#on-grid-subscriber-type", "commercial")
        page.fill("#on-grid-monthly-bill-estimate", "12500")
        page.click('[data-design-target-card="fill-roof"]')
        page.wait_for_function(
            "() => window.state.subscriberType === 'commercial' && window.state.designTarget === 'fill-roof' && Number(window.state.annualConsumptionKwh) > 0"
        )

        summary_text = page.locator("#on-grid-flow-summary").inner_text()
        assert "Maksimum teknik performans" in summary_text
        assert "₺/ay" in summary_text

        page.click('[data-on-grid-mode-btn="advanced"]')
        page.wait_for_function("window.state.onGridInputMode === 'advanced'")
        assert page.locator("#on-grid-advanced-fields").is_visible()
        assert page.locator("#step5-advanced-card").evaluate("el => el.open")
        page.select_option("#on-grid-usage-profile", "business-hours")
        page.fill("#distribution-fee-input", "0.50")

        page.click('[data-testid="calculate-results"]')
        page.wait_for_function("window.state.step === 6")

        browser.close()

    print("step5 on-grid smoke passed")


if __name__ == "__main__":
    main()
