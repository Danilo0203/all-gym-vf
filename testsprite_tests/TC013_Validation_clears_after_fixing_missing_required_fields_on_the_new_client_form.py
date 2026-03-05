import asyncio
import time
from playwright.async_api import async_playwright, expect
from _helpers import login, goto_panel

async def run_test():
    suffix = int(time.time())
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await login(page)
        await goto_panel(page, "/panel/clientes")

        await page.get_by_test_id("customers-new-button").click()
        await page.get_by_test_id("customers-submit-button").click()

        await expect(page.get_by_text("obligatorio").first).to_be_visible(timeout=6000)

        await page.locator("input[type='email']").last.fill(f"fix+{suffix}@example.com")
        await page.locator("input[placeholder='Nombre Apellido']").fill(f"Fix Validacion {suffix}")
        await page.locator("input[placeholder='12345678']").fill("11112222")
        await page.get_by_test_id("customers-submit-button").click()

        await expect(page.get_by_text(f"Fix Validacion {suffix}").first).to_be_visible(timeout=15000)
        await browser.close()

asyncio.run(run_test())
