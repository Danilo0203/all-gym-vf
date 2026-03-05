import asyncio
from playwright.async_api import async_playwright, expect
from _helpers import login, goto_panel

async def run_test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await login(page)
        await goto_panel(page, "/panel/clientes")

        await page.locator("tbody tr").first.click()
        await page.get_by_test_id("customer-actions-menu").click()
        await page.get_by_test_id("add-physical-evaluation-button").click()

        await page.get_by_label("Peso (kg)").fill("abc")
        await page.get_by_label("Estatura (cm)").fill("xyz")
        await page.get_by_role("button", name="Guardar").click()

        await expect(page.get_by_text("número").first).to_be_visible(timeout=8000)
        await browser.close()

asyncio.run(run_test())
