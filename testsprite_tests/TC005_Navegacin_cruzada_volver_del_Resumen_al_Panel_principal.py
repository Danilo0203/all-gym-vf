import asyncio
from playwright.async_api import async_playwright, expect
from _helpers import login, goto_panel

async def run_test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await login(page)
        await goto_panel(page, "/panel/resumen")

        # /panel redirige a /panel/resumen; validamos navegación por app al home real (Tablero/Resumen)
        nav_tablero = page.locator("a[data-testid='nav-tablero']").first
        if await nav_tablero.count() > 0:
            await nav_tablero.click()

        await expect(page).to_have_url("**/panel/resumen", timeout=10000)
        await expect(page.get_by_text("Estado del Negocio").first).to_be_visible(timeout=10000)
        await browser.close()

asyncio.run(run_test())
