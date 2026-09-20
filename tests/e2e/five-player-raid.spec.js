import { test } from '@playwright/test';
import { runGearedPartyRoute } from './geared-party-route.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test('five geared raiders complete the selected crystal Vigil or four-phase Dark King finale', async ({ page, browser, baseURL }, testInfo) => {
    await runGearedPartyRoute({ page, browser, baseURL }, testInfo, {
        raidType: process.env.EIDOLON_E2E_RAID || 'earth_crystal_raid'
    });
});
