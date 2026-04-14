from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def main():
    root = Path(__file__).resolve().parents[1]
    server = ThreadingHTTPServer(("127.0.0.1", 8124), lambda *args, **kwargs: QuietHandler(*args, directory=str(root), **kwargs))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(service_workers="block")
            page = ctx.new_page()
            page.goto("http://127.0.0.1:8124/index.html")
            page.wait_for_load_state("networkidle")
            page.click('[data-lang="en"]')
            page.wait_for_function("document.querySelector('#step-1 .step-heading-title')?.textContent === 'Select Your Location'")
            page.wait_for_function("document.querySelector('#scenario-title')?.textContent === 'Choose the solution scenario first'")
            assert page.evaluate("localStorage.getItem('guneshesap_lang')") == "en"
            assert page.locator(".chart-title").first.inner_text() == "Monthly Energy Production (kWh)"
            page.reload()
            page.wait_for_load_state("networkidle")
            page.wait_for_function("document.querySelector('#step-1 .step-heading-title')?.textContent === 'Select Your Location'")
            page.click('[data-lang="de"]')
            page.wait_for_function("document.querySelector('#step-1 .step-heading-title')?.textContent === 'Standort auswählen'")
            assert page.evaluate("localStorage.getItem('guneshesap_lang')") == "de"
            print("i18n browser smoke passed")
            browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
