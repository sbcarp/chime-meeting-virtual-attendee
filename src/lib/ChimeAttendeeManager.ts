// src/lib/browserManager.ts

import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import type { MeetingStatus } from '$lib/types';
import { uniqueId } from 'lodash-es';
import os from 'os';

interface Bot {
    id: string,
    browser: Browser;
    page: Page;
    cameraEnabled: boolean;
    micEnabled: boolean;
}

interface Meeting {
    bots: Bot[];
    desiredVideoBots: number;
    desiredNoneVideoBots: number;
    enableAudioForFirstBot: boolean;
}

class ChimeAttendeeManager {
    private meetings: { [meetingId: string]: Meeting } = {};

    private static instance: ChimeAttendeeManager;

    private constructor() { }

    public static getInstance(): ChimeAttendeeManager {
        if (!ChimeAttendeeManager.instance) {
            ChimeAttendeeManager.instance = new ChimeAttendeeManager();
        }
        return ChimeAttendeeManager.instance;
    }


    private async launchBot(meetingId: string, enableCamera: boolean, enableMic: boolean): Promise<void> {
        console.log('import.meta.dirname', import.meta.dirname)
        console.log('os.platform', os.platform())
        console.log('process.env.', process.env.CUSTOM_ASSETS_FOLDER)
        const platform = os.platform();
        const assetsFolder = process.env.CUSTOM_ASSETS_FOLDER || `${import.meta.dirname}/assets`;
        const browser: Browser = await chromium.launch({
            headless: platform !== 'darwin' && platform !== 'win32',
            args: [
                '--use-fake-ui-for-media-stream',
                '--use-fake-device-for-media-stream',
                `--use-file-for-fake-video-capture=${assetsFolder}/test_video.y4m`,
                `--use-file-for-fake-audio-capture=${assetsFolder}/test_audio.wav`,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--allow-file-access-from-files',
                '--disable-features=IsolateOrigins,site-per-process',
                '--ignore-certificate-errors',
                '--ignore-ssl-errors',
                '--disable-blink-features=AutomationControlled',
                '--no-first-run',
                // '--disk-cache-size=0',
                // '--disable-dev-shm-usage',
                // '--disable-extensions',
                // '--disable-default-apps',
                // '--disable-sync',
                // '--disable-translate',
                // '--disable-background-timer-throttling',
                // '--disable-renderer-backgrounding',
                // '--incognito',
                // '--disable-logging',
                // '--webrtc-max-cpu-consumption-percentage=100',
            ],
        });



        const botId = uniqueId();

        browser.once('disconnected', () => {
            this.removeBot(meetingId, botId);
        });

        try {
            const context = await browser.newContext({
                storageState: undefined,
                viewport: null,
                permissions: ['camera', 'microphone'],
                userAgent:
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            });

            const page: Page = await context.newPage();

            await page.goto(`https://app.chime.aws/meetings/${meetingId}`);

            await page.waitForLoadState();

            await page.fill('input[id="name"]', 'bot', { timeout: 20000 });
            await page.press('input[id="name"]', String(this.meetings[meetingId].bots.length + 1));

            await page.click('button.Button--enabled:has-text("Join meeting now")', {
                timeout: 20000,
            });

            await page.waitForLoadState();

            // try {
            //     await page.click('button[data-id="awsccc-cb-btn-accept"]', {
            //         force: true,
            //         timeout: 2000
            //     });
            // } catch (error) {
            //     console.error(error);
            // }

            if (!enableMic) {
                const locator = page.locator('div[data-test-id="DeviceSetupJoinMutedCheckbox"] input');
                await locator.evaluate((input: HTMLInputElement) => input.click())
            }

            await page.click('div[data-test-id="DeviceSetupVoiceFocusCheckbox"] input', {
                force: true,
                timeout: 20000,
            });



            const joinButtonSelector = enableCamera
                ? 'button[data-test-id="DevicePreviewJoinWithVideo"]'
                : 'button[data-test-id="DevicePreviewJoinBtn"]';

            await page.click(joinButtonSelector, { timeout: 20000 });

            this.meetings[meetingId].bots.push({ id: botId, browser, page, cameraEnabled: enableCamera, micEnabled: enableMic });
        } catch (error) {
            console.error(error);
            this.removeBot(meetingId, botId);
        }
    }
    public async removeBot(meetingId: string, botId: string): Promise<void> {
        const meeting = this.meetings[meetingId];
        if (!meeting) return;

        const bot = meeting.bots.find((bot) => bot.id === botId);
        if (bot) {
            const index = meeting.bots.indexOf(bot);
            meeting.bots.splice(index, 1);
            await bot.browser.close();
        }

        if (meeting.bots.length === 0) {
            delete this.meetings[meetingId];
        }
    }

    public async addBots(
        meetingId: string,
        desiredVideoBots: number,
        desiredNoneVideoBots: number,
        enableMicForFirstBot: boolean
    ): Promise<void> {
        if (!this.meetings[meetingId]) {
            this.meetings[meetingId] = {
                bots: [],
                desiredVideoBots,
                desiredNoneVideoBots,
                enableAudioForFirstBot: enableMicForFirstBot,
            };
        } else {
            this.meetings[meetingId].desiredVideoBots = desiredVideoBots;
            this.meetings[meetingId].desiredNoneVideoBots = desiredNoneVideoBots;
        }

        await this.adjustBots(meetingId);
    }

    public async adjustBots(
        meetingId: string,
        desiredVideoBots?: number,
        desiredNoneVideoBots?: number
    ): Promise<void> {
        const meeting = this.meetings[meetingId];
        if (!meeting) return;

        if (desiredVideoBots !== undefined) {
            meeting.desiredVideoBots = desiredVideoBots;
        }
        if (desiredNoneVideoBots !== undefined) {
            meeting.desiredNoneVideoBots = desiredNoneVideoBots;
        }

        const adjustBotsHelper = (
            currentBots: Bot[],
            desiredCount: number,
            meetingId: string,
            enableCamera: boolean,
            enableMicForFirstBot: boolean
        ) => {
            let hasMicEnabled = false;
            if (currentBots.length > desiredCount) {
                const botsToRemove = currentBots.length - desiredCount;
                for (let i = 0; i < botsToRemove; i++) {
                    const bot = currentBots.pop();
                    if (bot) this.removeBot(meetingId, bot.id);
                }
            } else if (currentBots.length < desiredCount) {
                const botsToAdd = desiredCount - currentBots.length;
                for (let i = 0; i < botsToAdd; i++) {
                    if (!hasMicEnabled && enableMicForFirstBot && !this.meetings[meetingId]?.bots.some(b => b.micEnabled)) {
                        this.launchBot(meetingId, enableCamera, true);
                        hasMicEnabled = true;
                    }
                    else {
                        this.launchBot(meetingId, enableCamera, false);
                    }
                }
            }
            return hasMicEnabled;
        }


        const activeVideoBots = meeting.bots.filter((bot) => bot.cameraEnabled);
        const activeNoneVideoBots = meeting.bots.filter((bot) => !bot.cameraEnabled);

        const hasCameraEnabled = adjustBotsHelper(activeVideoBots, meeting.desiredVideoBots, meetingId, true, meeting.enableAudioForFirstBot);
        adjustBotsHelper(activeNoneVideoBots, meeting.desiredNoneVideoBots, meetingId, false, !hasCameraEnabled && meeting.enableAudioForFirstBot);
    }

    public getMeetingStatus(): { [meetingId: string]: MeetingStatus } {
        const status: { [meetingId: string]: MeetingStatus } = {};
        for (const [meetingId, meeting] of Object.entries(this.meetings)) {
            status[meetingId] = {
                activeBots: meeting.bots.length,
                activeVideoBots: meeting.bots.filter((bot) => bot.cameraEnabled).length,
                activeNoneVideoBots: meeting.bots.filter((bot) => !bot.cameraEnabled).length,
                desiredVideoBots: meeting.desiredVideoBots,
                desiredNoneVideoBots: meeting.desiredNoneVideoBots,
            };
        }
        return status;
    }
}

export default ChimeAttendeeManager.getInstance();
