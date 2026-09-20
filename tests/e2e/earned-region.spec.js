import { expect, test } from '@playwright/test';
import { restoreEarnedWizard } from './earned-earth-continuation.js';
import { earnRegionToReadiness } from './earned-water-region.js';
import { collectBrowserFailures, credentialsFromEnvironment } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('earned later-region story retains discoveries, collection and saved dungeon handoff', async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_EARNED_REGION !== '1', 'Explicit earned regional continuation only');
    const realm = process.env.EIDOLON_E2E_STORY_REALM;
    expect(['fire', 'air']).toContain(realm);
    test.setTimeout(7_200_000);
    expect(testInfo.retry).toBe(0);
    const credentials = credentialsFromEnvironment();
    const failures = collectBrowserFailures(page, baseURL);
    await restoreEarnedWizard(page, credentials);
    await earnRegionToReadiness(page, credentials, realm, {
        step: (name, body) => test.step(name, body),
        capture: (site, stage) => page.screenshot({ path: testInfo.outputPath(`${site.id}-${stage}.png`) })
    });
    expect(failures, failures.join('\n')).toEqual([]);
});
