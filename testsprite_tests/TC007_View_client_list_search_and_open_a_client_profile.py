import asyncio
from playwright.async_api import async_playwright, expect
from _helpers import login, goto_panel

async def run_test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await login(page)
        await goto_panel(page, "/panel/clientes")

        search = page.locator("input[placeholder*='Buscar por nombre']").first
        if await search.count() > 0:
            await search.fill("a")

        await page.locator("tbody tr").first.click()
        await expect(page.get_by_text("Datos personales").first).to_be_visible(timeout=10000)
        await expect(page.get_by_text("Datos físicos").first).to_be_visible(timeout=10000)
        await browser.close()

asyncio.run(run_test())
