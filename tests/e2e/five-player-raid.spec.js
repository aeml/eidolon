import { test } from '@playwright/test';
import { runGearedPartyRoute } from './geared-party-route.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test('five geared raiders clear the assault and defend all three crystal repair waves', async ({ page, browser, baseURL }, testInfo) => {
    await runGearedPartyRoute({ page, browser, baseURL }, testInfo, {
        raidType: process.env.EIDOLON_E2E_RAID || 'earth_crystal_raid'
    });
});
