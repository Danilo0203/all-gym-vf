import asyncio
from playwright import async_api

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
                "--single-process"                # Run the browser in a single process mode
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Navigate to your target URL and wait until the network request is committed
        await page.goto("http://localhost:3000", wait_until="commit", timeout=10000)

        # Wait for the main page to reach DOMContentLoaded state (optional for stability)
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=3000)
        except async_api.Error:
            pass

        # Iterate through all iframes and wait for them to load as well
        for frame in page.frames:
            try:
                await frame.wait_for_load_state("domcontentloaded", timeout=3000)
            except async_api.Error:
                pass

        # Interact with the page elements to simulate user flow
        # -> Navigate to http://localhost:3000
        await page.goto("http://localhost:3000", wait_until="commit", timeout=10000)
        
        # -> Rellenar email y contraseña en el formulario y hacer clic en 'Iniciar Sesión' para acceder al panel, luego navegar a la sección 'Resumen' y realizar scroll para verificar totales y gráficos.
        frame = context.pages[-1]
        # Input text
        elem = frame.locator('xpath=html/body/div[2]/div/div/div/div[2]/form/div/div[3]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('danilocalderon0203@gmail.com')
        
        frame = context.pages[-1]
        # Input text
        elem = frame.locator('xpath=html/body/div[2]/div/div/div/div[2]/form/div/div[4]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('123456')
        
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=html/body/div[2]/div/div/div/div[2]/form/div/div[5]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # -> Navigate directly to http://localhost:3000/panel/resumen so the page can be inspected and scrolled to verify totals and charts remain visible (no blank areas).
        await page.goto("http://localhost:3000/panel/resumen", wait_until="commit", timeout=10000)
        
        # --> Assertions to verify final state
        frame = context.pages[-1]
        # -> Assert that the financial summary section is visible (e.g., 'Ingresos del Mes' or the business status header)
        await page.wait_for_selector("text=Ingresos del Mes", timeout=5000)
        assert await page.locator("text=Ingresos del Mes").is_visible(), "Financial summary ('Ingresos del Mes') is not visible on /panel/resumen"
        
        # If the page uses a different heading, also ensure the main business header is present
        await page.wait_for_selector("text=Estado del Negocio", timeout=3000)
        assert await page.locator("text=Estado del Negocio").is_visible(), "Main business header ('Estado del Negocio') is not visible on /panel/resumen"
        
        # -> Scroll to the bottom of the page to reveal charts and ensure they remain visible (no blank areas)
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight);")
        await page.wait_for_timeout(1000)
        
        # Verify a chart section is visible (e.g., 'Ingresos por Mes' chart)
        await page.wait_for_selector("text=Ingresos por Mes", timeout=5000)
        assert await page.locator("text=Ingresos por Mes").is_visible(), "Chart section ('Ingresos por Mes') is not visible after scrolling"
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    