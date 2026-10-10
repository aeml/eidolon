import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';
import { renderRecordedActorCellPopulation } from './actor-cell-population-fixture.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
for (const quality of ['high', 'low']) test(`${quality}: individual actor instance clipping preserves exact color and shadows`, async ({ page, baseURL }, testInfo) => {
    const population = JSON.parse(await readFile(new URL('../fixtures/actor-cell-population.json', import.meta.url), 'utf8'));
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1100, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(renderRecordedActorCellPopulation, { quality, population, perInstanceFrustum: true });
    await writeFile(testInfo.outputPath('actor-instance-frustum.json'), JSON.stringify(result, null, 2));
    for (const row of result) {
        expect(row.changedRGB).toBe(0); expect(row.unstableRGB).toBe(0);
        expect(row.candidate.triangles).toBeLessThanOrEqual(row.reference.triangles);
        expect(row.candidate.calls).toBeLessThanOrEqual(row.reference.calls);
    }
    expect(result.some(row => row.candidate.triangles < row.reference.triangles)).toBe(true);
    expect(failures, failures.join('\n')).toEqual([]);
});
