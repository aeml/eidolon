import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { bundleGameStyles, rewriteCss } from '../../scripts/version-pages-runtime.mjs';

let published;
test.beforeAll(async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'eidolon-published-styles-'));
    try {
        await fs.mkdir(path.join(root, 'src'), { recursive: true });
        await fs.cp(path.resolve('src/styles'), path.join(root, 'src/styles'), { recursive: true });
        expect(await bundleGameStyles(root)).toBe(true);
        published = rewriteCss(await fs.readFile(path.join(root, 'src/styles/index.css'), 'utf8'), 'style-test-20261008');
    } finally { await fs.rm(root, { recursive: true, force: true }); }
});

async function appearance(page) {
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.eidolonReady)).toBe('true');
    await page.locator('#login-patch-notes-link').click();
    await expect(page.locator('#patch-notes-screen')).toBeVisible();
    const result = await page.evaluate(() => ['#btn-register', '#login-patch-notes-link', '#patch-notes-screen', '#btn-close-patch-notes-header'].map(selector => {
        const element = document.querySelector(selector), style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return { selector, rect: [rect.x, rect.y, rect.width, rect.height],
            styles: Object.fromEntries(['color', 'background-color', 'font-family', 'font-size', 'display', 'position', 'pointer-events', 'padding', 'border-radius', 'z-index'].map(key => [key, style.getPropertyValue(key)])) };
    }));
    await page.locator('#btn-close-patch-notes-header').click();
    return result;
}

for (const width of [1280, 390]) test(`published single stylesheet retains login and patch-note appearance at ${width}px`, async ({ page }) => {
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const modular = await appearance(page);
    const requests = [], failures = [];
    page.on('request', request => { if (new URL(request.url()).pathname.endsWith('.css')) requests.push(request.url()); });
    page.on('pageerror', error => failures.push(error.message));
    await page.route('**/src/styles/index.css*', route => route.fulfill({ status: 200, contentType: 'text/css', body: published }));
    await page.goto('/', { waitUntil: 'networkidle' });
    expect(await appearance(page)).toEqual(modular);
    expect(requests).toHaveLength(1);
    expect(await page.evaluate(() => [...document.querySelector('[data-eidolon-game-styles]').sheet.cssRules].filter(rule => rule.type === CSSRule.IMPORT_RULE).length)).toBe(0);
    expect(failures).toEqual([]);
});

test('a lost published bundle recovers through the existing bounded stylesheet retry', async ({ page }) => {
    let requests = 0;
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.route('**/src/styles/index.css*', route => ++requests === 1
        ? route.abort('internetdisconnected')
        : route.fulfill({ status: 200, contentType: 'text/css', body: published }));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await appearance(page);
    expect(requests).toBe(2);
    await expect(page.locator('#style-boot-recovery')).toHaveCount(0);
});
