import asyncio
from playwright.async_api import async_playwright, expect
from _helpers import login, goto_panel

async def run_test():
    new_phone = "12344321"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await login(page)
        await goto_panel(page, "/panel/clientes")

        await page.locator("tbody tr").first.click()
        await page.get_by_test_id("customer-actions-menu").click()
        await page.get_by_text("Editar Perfil").click()

        phone_input = page.locator("input[placeholder='12345678']").first
        await phone_input.fill(new_phone)
        await page.get_by_test_id("customers-submit-button").click()

        await expect(page.get_by_text(new_phone).first).to_be_visible(timeout=12000)
        await browser.close()

asyncio.run(run_test())
