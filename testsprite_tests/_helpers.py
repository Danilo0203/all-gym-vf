import asyncio
from playwright.async_api import expect

BASE_URL = "http://localhost:3000"
EMAIL = "danilocalderon0203@gmail.com"
PASSWORD = "123456"

async def login(page):
    await page.goto(BASE_URL, wait_until="domcontentloaded")
    await page.locator("input[type='email']").first.fill(EMAIL)
    await page.locator("input[type='password']").first.fill(PASSWORD)
    await page.get_by_role("button", name="Iniciar Sesión").first.click()
    await page.wait_for_url("**/panel/**", timeout=15000)

async def goto_panel(page, path: str):
    await page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded")

async def short_wait(page, ms: int = 400):
    await page.wait_for_timeout(ms)

async def assert_visible_text(page, text: str, timeout: int = 8000):
    await expect(page.get_by_text(text).first).to_be_visible(timeout=timeout)
