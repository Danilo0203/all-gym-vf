import asyncio
from playwright.async_api import async_playwright, expect
from _helpers import login, goto_panel

async def run_test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await login(page)
        await goto_panel(page, "/panel/pagos")

        await page.get_by_test_id("payments-register-button").click()

        await page.get_by_role("combobox").nth(0).click()
        await page.get_by_role("option").first.click()

        await page.locator("input[placeholder='0.00']").fill("150")

        await page.get_by_role("combobox").nth(1).click()
        await page.get_by_role("option", name="Efectivo").click()

        await page.get_by_test_id("payments-submit-button").click()
        await expect(page.get_by_text("150").first).to_be_visible(timeout=12000)
        await browser.close()

asyncio.run(run_test())
