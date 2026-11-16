import { expect, test } from '@playwright/test';
import { resumeEarnedEarthToReadiness } from '../support/progression/earned-earth-continuation.js';
import { collectBrowserFailures, credentialsFromEnvironment } from '../support/browser/helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('continue the earned Earth save through its remaining four kills and saved handoff', async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_EARNED_RESUME !== '1', 'Explicit private checkpoint continuation only');
    test.setTimeout(600_000);
    expect(testInfo.retry).toBe(0);
    const failures = collectBrowserFailures(page, baseURL);
    await resumeEarnedEarthToReadiness(page, credentialsFromEnvironment());
    expect(failures, failures.join('\n')).toEqual([]);
});
