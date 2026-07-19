import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const localBaseURL = 'http://127.0.0.1:4173';
const baseURL = process.env.EIDOLON_E2E_BASE_URL || localBaseURL;
const useLocalServer = baseURL === localBaseURL;
const configuredSystemChrome = process.env.EIDOLON_E2E_BROWSER_PATH;
const systemChrome = configuredSystemChrome || '/usr/bin/google-chrome';
const useSystemChrome = existsSync(systemChrome) && (!process.env.CI || Boolean(configuredSystemChrome));
const hasCredentialedRoute = Boolean(
    process.env.EIDOLON_E2E_USERNAME || process.env.EIDOLON_E2E_USERNAME_SECONDARY
);

// Playwright's automatic failure-context ARIA snapshot includes current input
// values. Suppress that snapshot whenever credentials are present; anonymous
// runs keep the richer context and all recording types.
if (hasCredentialedRoute) process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    timeout: 120_000,
    expect: {
        timeout: 15_000
    },
    reporter: process.env.CI
        ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
        : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
    use: {
        ...devices['Desktop Chrome'],
        baseURL,
        headless: process.env.EIDOLON_E2E_HEADLESS !== '0',
        ignoreHTTPSErrors: false,
        launchOptions: {
            executablePath: useSystemChrome ? systemChrome : undefined,
            args: ['--enable-webgl', '--ignore-gpu-blocklist']
        },
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        video: 'retain-on-failure'
    },
    webServer: useLocalServer ? {
        command: 'npm run serve',
        env: {
            ...process.env,
            ...(process.env.EIDOLON_E2E_WS_URL
                ? { EIDOLON_STATIC_WS_URL: process.env.EIDOLON_E2E_WS_URL }
                : {})
        },
        url: localBaseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000
    } : undefined
});
