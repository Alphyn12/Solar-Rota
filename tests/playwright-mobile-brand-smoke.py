from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from time import sleep
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def assert_no_page_overflow(page, label):
    overflow = page.evaluate(
        """() => ({
            width: window.innerWidth,
            doc: document.documentElement.scrollWidth,
            body: document.body.scrollWidth
        })"""
    )
    assert overflow["doc"] <= overflow["width"] + 2, (label, overflow)
    assert overflow["body"] <= overflow["width"] + 2, (label, overflow)


def main():
    root = Path(__file__).resolve().parents[1]
    server = ThreadingHTTPServer(("127.0.0.1", 0), lambda *args, **kwargs: QuietHandler(*args, directory=str(root), **kwargs))
    base_url = f"http://127.0.0.1:{server.server_port}"
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    for _ in range(20):
        try:
            with urlopen(f"{base_url}/index.html", timeout=1) as response:
                if response.status == 200:
                    break
        except Exception:
            sleep(0.1)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(
                viewport={"width": 390, "height": 844},
                is_mobile=True,
                has_touch=True,
                service_workers="block",
            )
            ctx.add_init_script(
                """Object.defineProperty(navigator, 'geolocation', {
                    value: { getCurrentPosition: (ok, err) => err({ code: 1, message: 'denied' }) },
                    configurable: true
                });"""
            )
            page = ctx.new_page()
            page.goto(f"{base_url}/index.html", wait_until="networkidle")

            assert "Solar Rota" in page.title()
            assert page.locator(".logo-text").inner_text() == "Solar Rota"
            body_text = page.locator("body").inner_text()
            assert "GüneşHesap" not in body_text
            assert "GunesHesap" not in body_text
            assert_no_page_overflow(page, "initial mobile landing")

            first_card = page.locator(".scenario-choice-card").first
            card_box = first_card.bounding_box()
            assert card_box and card_box["width"] <= 390, card_box
            assert card_box["height"] >= 64, card_box

            page.click('[data-lang="en"]')
            page.wait_for_function("document.querySelector('.hero-title')?.textContent.includes('Design your solar energy system')")
            page.click('.scenario-choice-card[data-scenario-key="on-grid"]')
            page.click("#step1-continue-btn")
            page.wait_for_function("document.getElementById('step-2')?.classList.contains('active')")
            assert_no_page_overflow(page, "mobile map step")
            map_box = page.locator("#step2-map-slot").bounding_box()
            assert map_box and map_box["height"] >= 320, map_box
            assert page.locator(".step2-search-wrap").bounding_box()["width"] <= 390
            page.click("#geolocation-btn")
            page.wait_for_timeout(500)
            assert page.locator("#geolocation-btn svg").count() == 1
            assert page.locator("#geolocation-btn .step2-geo-label").inner_text() == "Use My Location"
            assert page.locator(".logo-text").inner_text() == "Solar Rota"
            assert_no_page_overflow(page, "mobile after language switch")

            print("mobile brand smoke passed")
            browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
