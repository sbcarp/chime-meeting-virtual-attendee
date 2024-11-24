// src/lib/browserManager.ts

import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import type { MeetingStatus } from '$lib/types';
import { uniqueId } from 'lodash-es';
import os from 'os';
import { generateRandomSentence } from './string';

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

    private lastChatMessageTime = 0;

    private canSendChatMessage(): boolean {
        const currentTime = Date.now();
        const timeSinceLastMessage = currentTime - this.lastChatMessageTime;
        this.lastChatMessageTime = currentTime;
        if (timeSinceLastMessage >= 1000) {
            this.lastChatMessageTime = currentTime;
            return true;
        }
        return false;
    }


    private async launchBot(meetingId: string, enableCamera: boolean, enableMic: boolean): Promise<void> {
        console.log('import.meta.dirname', import.meta.dirname)
        console.log('os.platform', os.platform())
        console.log('process.env.', process.env.CUSTOM_ASSETS_FOLDER)
        console.log('enableMic', enableMic)
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
                '--disable-extensions',
                '--disable-default-apps',
                '--disable-sync',
                '--disable-translate',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
                '--disable-logging',
                '--webrtc-max-cpu-consumption-percentage=100',
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


            await this.navigateToMeeting(page, meetingId, `${enableMic ? 'A' : ''}${enableCamera ? 'V' : ''}Bot`);

            await page.waitForLoadState();

            if (!enableMic) {
                const locator = page.locator('div[data-test-id="DeviceSetupJoinMutedCheckbox"] input');
                await locator.evaluate((input: HTMLInputElement) => input.click())
            }



            const locator = page.locator('div[data-test-id="DeviceSetupVoiceFocusCheckbox"] input');
            await locator.evaluate((input: HTMLInputElement) => input.click())

            // await page.click('div[data-test-id="DeviceSetupVoiceFocusCheckbox"] input', {
            //     force: true,
            //     timeout: 20000,
            // });





            const joinButtonSelector = enableCamera
                ? 'button[data-test-id="DevicePreviewJoinWithVideo"]'
                : 'button[data-test-id="DevicePreviewJoinBtn"]';

            await page.click(joinButtonSelector, { timeout: 20000 });

            page.click('button[data-id="awsccc-cb-btn-accept"]', {
                force: true,
                timeout: 5000
            }).catch(() => {
                console.log('No cookie banner found');
            });

            await page.waitForSelector('nav[data-testid="control-bar"]');
            if (enableMic) {
                try {
                    await page.click('button#audio[aria-label*="Unmute my microphone"]', { timeout: 10000 })
                } catch (error) {
                }
            }



            this.meetings[meetingId].bots.push({ id: botId, browser, page, cameraEnabled: enableCamera, micEnabled: enableMic });

            const sendChatMessage = () => {
                const chatInterval = setTimeout(async () => {
                    try {
                        if (!browser.isConnected()) {
                            clearTimeout(chatInterval);
                            return;
                        }
                        if (!this.canSendChatMessage()) {
                            return;
                        }
                        const sentence = generateRandomSentence(50);
                        await page.fill('textarea[data-testid="textarea"]', sentence);
                        await page.press('textarea[data-testid="textarea"]', 'Enter');
                    } catch (error) {
                        console.error(error)
                    }
                    sendChatMessage();
                }, 5000)
            }
            try {
                await page.click('button[aria-label*="Open chat panel"]', { timeout: 30000 })
                sendChatMessage();
            } catch (error) {
                console.log(error)
            }


        } catch (error) {
            console.error(error);
            browser.close();
        }
    }

    private async navigateToMeeting(page: Page, meetingId: string, botName: string) {
        const maxRetries = 1;
        let attempt = 0;

        while (attempt <= maxRetries) {
            try {
                await page.goto(`https://app.chime.aws/meetings/${meetingId}`);
                await page.waitForURL(url => {
                    const parsedUrl = new URL(url);
                    return parsedUrl.pathname === '/anonymousJoin';
                });
                await page.waitForLoadState('domcontentloaded');
                await page.fill('input[id="name"]', botName, { timeout: 20000 });
                await page.press('input[id="name"]', ' ');

                await page.click('button.Button--enabled:has-text("Join meeting now")', {
                    timeout: 20000,
                });
                // Break out of the loop on success
                break;
            } catch (error) {
                attempt++;
                if (attempt > maxRetries) {
                    console.error('Failed to navigate after retrying:', error);
                    throw error; // Re-throw the error if retries exhausted
                }
                console.warn(`Retry attempt ${attempt} due to error:`, error);
            }
        }
    }

    private queue: (() => Promise<void>)[] = [];
    private running = 0;
    private async launchBotsConcurrently(
        meetingId: string,
        enableCamera: boolean,
        enableMicForFirstBot: boolean,
        desiredCount: number,
        currentBots: Bot[],
        maxConcurrency: number = 10
    ) {

        let hasMicEnabled = currentBots.some(b => b.micEnabled);

        const botsToAdd = desiredCount - currentBots.length;

        const launchNext = async () => {
            if (this.queue.length === 0) return; // No more bots to launch
            if (this.running >= maxConcurrency) return; // Wait for a slot to free up

            this.running++; // Increment running bots counter
            const botLauncher = this.queue.shift(); // Get the next bot from the queue
            if (botLauncher) {
                await botLauncher(); // Launch the bot
            }
            this.running--; // Decrement running bots counter
            launchNext(); // Launch the next bot in the queue
        };

        for (let i = 0; i < botsToAdd; i++) {
            this.queue.push(async () => {
                await this.launchBot(meetingId, enableCamera, i === 0 && enableMicForFirstBot && !this.meetings[meetingId]?.bots.some(b => b.micEnabled));
            });
        }

        // Kick off up to `maxConcurrency` bots
        for (let i = 0; i < Math.min(maxConcurrency, this.queue.length); i++) {
            launchNext();
        }

        return hasMicEnabled;
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

        const adjustBotsHelper = async (
            currentBots: Bot[],
            desiredCount: number,
            meetingId: string,
            enableCamera: boolean,
            enableMicForFirstBot: boolean
        ) => {
            if (currentBots.length > desiredCount) {
                const botsToRemove = currentBots.length - desiredCount;
                for (let i = 0; i < botsToRemove; i++) {
                    const bot = currentBots.pop();
                    if (bot) this.removeBot(meetingId, bot.id);
                }
                return false;
            } else if (currentBots.length < desiredCount) {
                return await this.launchBotsConcurrently(meetingId, enableCamera, enableMicForFirstBot, desiredCount, currentBots, 10);
            }
        }


        const activeVideoBots = meeting.bots.filter((bot) => bot.cameraEnabled);
        const activeNoneVideoBots = meeting.bots.filter((bot) => !bot.cameraEnabled);

        const hasMicEnabled = await adjustBotsHelper(activeVideoBots, meeting.desiredVideoBots, meetingId, true, meeting.enableAudioForFirstBot);
        await adjustBotsHelper(activeNoneVideoBots, meeting.desiredNoneVideoBots, meetingId, false, !hasMicEnabled && meeting.enableAudioForFirstBot);
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
