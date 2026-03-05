import asyncio
from playwright.async_api import async_playwright, expect
from _helpers import login, goto_panel

async def run_test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await login(page)
        await goto_panel(page, "/panel/clientes")

        await page.locator("input[placeholder*='Buscar por nombre']").first.fill("zzzz-no-existe-12345")
        await expect(page.get_by_text("Sin resultados").first).to_be_visible(timeout=10000)
        await browser.close()

asyncio.run(run_test())
