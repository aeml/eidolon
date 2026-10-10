import { renderAnimatedActorCells } from './actor-cell-animation-fixture.js';
import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
for (const quality of ['high', 'low']) test(`${quality}: actor cell multi-draw preserves exact existing instance pixels and bucket culling`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1100, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(renderAnimatedActorCells, { quality });
    await writeFile(testInfo.outputPath('actor-cell-multidraw.json'), JSON.stringify(result.reports, null, 2));
    await writeFile(testInfo.outputPath('actor-cell-multidraw.png'), Buffer.from(result.image.split(',')[1], 'base64'));
    for (const row of result.reports) {
        expect(row.changedRGB, row.state).toBe(0); expect(row.unstableRGB, row.state).toBe(0);
        expect(row.after.triangles, row.state).toBe(row.before.triangles);
        if (row.state === 'ShearedAttack') expect(row.after.calls).toBeLessThanOrEqual(row.before.calls);
        else { expect(row.entries, row.state).toBeGreaterThan(0); expect(row.after.calls, row.state).toBeLessThan(row.before.calls); }
        for (const phase of [row.before, row.after, row.again]) expect(phase.restored).toBe(true);
        expect(row.again.geometries).toBe(row.before.geometries); expect(row.again.textures).toBe(row.before.textures);
    }
    expect(result.failureRestored).toBe(true);
    expect(failures, failures.join('\n')).toEqual([]);
});
