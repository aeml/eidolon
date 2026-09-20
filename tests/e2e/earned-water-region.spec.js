import { expect, test } from '@playwright/test';
import { restoreEarnedWizard } from './earned-earth-continuation.js';
import { earnWaterRegionToReadiness } from './earned-water-region.js';
import { collectBrowserFailures, credentialsFromEnvironment } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('earned Water story preserves its discoveries, collection and level60 dungeon handoff', async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_EARNED_WATER_REGION !== '1', 'Explicit earned post-Missing-Ferry checkpoint only');
    test.setTimeout(7_200_000);
    expect(testInfo.retry).toBe(0);
    const credentials = credentialsFromEnvironment();
    const failures = collectBrowserFailures(page, baseURL);
    await restoreEarnedWizard(page, credentials);
    await earnWaterRegionToReadiness(page, credentials, {
        step: (name, body) => test.step(name, body),
        capture: (site, stage) => page.screenshot({ path: testInfo.outputPath(`${site.id}-${stage}.png`) })
    });
    expect(failures, failures.join('\n')).toEqual([]);
});
