import asyncio
import time
from playwright.async_api import async_playwright, expect
from _helpers import login, goto_panel

async def run_test():
    suffix = int(time.time())
    client_name = f"Cliente E2E {suffix}"
    client_email = f"e2e+{suffix}@example.com"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await login(page)
        await goto_panel(page, "/panel/clientes")

        await page.get_by_test_id("customers-new-button").click()
        await page.locator("input[type='email']").last.fill(client_email)
        await page.locator("input[placeholder='Nombre Apellido']").fill(client_name)
        await page.locator("input[placeholder='12345678']").fill("55556666")
        await page.get_by_test_id("customers-submit-button").click()

        await expect(page.get_by_text(client_name).first).to_be_visible(timeout=15000)
        await browser.close()

asyncio.run(run_test())
