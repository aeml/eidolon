import { renderRecordedActorCellPopulation } from './actor-cell-population-fixture.js';
import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
for (const quality of ['high', 'low']) test(`${quality}: recorded three-cell actor population keeps exact original GPU delivery`, async ({ page, baseURL }, testInfo) => {
    const population = JSON.parse(await readFile(new URL('../fixtures/actor-cell-population.json', import.meta.url), 'utf8'));
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1100, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(renderRecordedActorCellPopulation, { quality, population });
    await writeFile(testInfo.outputPath('actor-cell-population.json'), JSON.stringify(result, null, 2));
    for (const row of result) {
        expect(row.changedRGB).toBe(0); expect(row.unstableRGB).toBe(0);
        expect(row.candidate.triangles).toBe(row.reference.triangles);
        if (quality === 'low' && row.cellZ === -128) {
            // This recorded cell has no actor in the Low camera and no shadow
            // pass. Keep that negative culling control exact; there is only
            // the two-triangle floor and no actor submission to consolidate.
            expect(row.reference.calls).toBe(1); expect(row.reference.triangles).toBe(2);
            expect(row.candidate.calls).toBe(1);
        } else expect(row.candidate.calls).toBeLessThan(row.reference.calls);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
