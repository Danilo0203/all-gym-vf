import asyncio
from playwright.async_api import async_playwright, expect
from _helpers import login, goto_panel

async def run_test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await login(page)
        await goto_panel(page, "/panel/resumen")

        # Puede verse loading o cargar directo, ambos válidos.
        loading = page.get_by_text("Cargando resumen...")
        if await loading.count() > 0:
            await expect(loading.first).to_be_visible(timeout=5000)

        await expect(page.get_by_text("Estado del Negocio").first).to_be_visible(timeout=10000)
        await browser.close()

asyncio.run(run_test())
