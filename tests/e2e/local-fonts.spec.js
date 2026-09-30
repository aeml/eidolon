import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('login typography loads locally with external font DNS unavailable', async ({ page, baseURL }) => {
    const failures = collectBrowserFailures(page, baseURL);
    const externalFontRequests = [];
    const localFonts = [];
    await page.route(/https:\/\/(?:fonts\.googleapis\.com|fonts\.gstatic\.com)\//, route => {
        externalFontRequests.push(route.request().url());
        return route.abort('namenotresolved');
    });
    page.on('response', response => {
        if (response.url().includes('/assets/fonts/')) localFonts.push({ url: response.url(), status: response.status() });
    });
    await page.goto('/', { waitUntil: 'networkidle' });
    const faces = await page.evaluate(async () => {
        const result = [];
        for (const weight of [400, 700]) {
            const loaded = await document.fonts.load(`${weight} 24px Cinzel`, 'Eidolon ÀÉŒ');
            result.push({ weight, faces: loaded.map(face => ({ family: face.family, status: face.status })) });
        }
        return result;
    });
    expect(failures, failures.join('\n')).toEqual([]);
    expect(externalFontRequests).toEqual([]);
    for (const row of faces) expect(row.faces).toEqual([{ family: 'Cinzel', status: 'loaded' }]);
    expect(localFonts.length).toBeGreaterThan(0);
    for (const response of localFonts) {
        expect(new URL(response.url).origin).toBe(new URL(baseURL).origin);
        expect(response.status).toBe(200);
    }
});
