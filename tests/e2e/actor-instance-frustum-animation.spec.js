import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';
import { renderAnimatedActorCells } from './actor-cell-animation-fixture.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
for (const quality of ['high', 'low']) test(`${quality}: clipped animated instances preserve exact surfaces shadows and frame recovery`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1100, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(renderAnimatedActorCells, { quality, perInstanceFrustum: true });
    await writeFile(testInfo.outputPath('actor-instance-frustum-animation.json'), JSON.stringify(result.reports, null, 2));
    for (const row of result.reports) {
        expect(row.changedRGB, row.state).toBe(0); expect(row.unstableRGB, row.state).toBe(0);
        expect(row.after.triangles, row.state).toBeLessThanOrEqual(row.before.triangles);
        expect(row.after.calls, row.state).toBeLessThanOrEqual(row.before.calls);
        for (const phase of [row.before, row.after, row.again]) expect(phase.restored).toBe(true);
        expect(row.again.geometries).toBe(row.before.geometries); expect(row.again.textures).toBe(row.before.textures);
    }
    expect(result.reports.some(row => row.after.triangles < row.before.triangles)).toBe(true);
    expect(result.failureRestored).toBe(true);
    expect(failures, failures.join('\n')).toEqual([]);
});
