import { chromium, Browser, BrowserContext, Page } from 'playwright';

(async () => {
    const meetingId: string = '4482056269'; // Replace with your actual meeting ID
    const browser: Browser = await chromium.launch({
        headless: true,
        args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            `--use-file-for-fake-video-capture=${__dirname}/test_video.y4m`,
            `--use-file-for-fake-audio-capture=${__dirname}/test_audio.wav`,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--allow-file-access-from-files',
            '--disable-features=IsolateOrigins,site-per-process',
            '--ignore-certificate-errors',
            '--ignore-ssl-errors',
            '--disable-blink-features=AutomationControlled',
            '--start-maximized',
            '--no-first-run',
        ]
    });

    try {

        const context: BrowserContext = await browser.newContext({
            viewport: null,
            permissions: ['camera', 'microphone'],
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
        });

        const page: Page = await context.newPage();

        await page.goto(`https://app.chime.aws/meetings/${meetingId}`);

        await page.waitForLoadState();

        await page.fill('input[id="name"]', 'bot', { timeout: 20000 });
        await page.press('input[id="name"]', '1');

        await page.click('button.Button--enabled:has-text("Join meeting now")', { timeout: 20000 });

        await page.waitForLoadState();

        await page.uncheck('div[data-test-id="DeviceSetupVoiceFocusCheckbox"] input', { force: true, timeout: 20000 })

        await page.click('button[data-test-id="DevicePreviewJoinWithVideo"]', { timeout: 20000 });

    } catch (error) {
        console.error(error);
        await browser.close();
    }

})();
