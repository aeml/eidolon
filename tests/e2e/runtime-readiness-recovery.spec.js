import { expect, test } from '@playwright/test';
import { collectBrowserFailures, openGame } from './helpers.js';

const actorModule = /\/src\/entities\/Actor\.js(?:\?|$)/;

test('runtime warm-up recovers one failed module without discarding earlier errors', async ({ page, baseURL }) => {
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    const failures = collectBrowserFailures(page, baseURL);
    const earlier = 'runtime-readiness preexisting error sentinel';
    await page.evaluate(message => console.error(message), earlier);
    await expect.poll(() => failures.slice()).toEqual([`console: ${earlier}`]);
    let aborted = false, recovered = false;
    page.on('response', response => {
        if (actorModule.test(response.url()) && response.status() === 200) recovered = true;
    });
    await page.route(actorModule, async route => {
        if (!aborted) { aborted = true; await route.abort('connectionreset'); }
        else await route.continue();
    });
    await openGame(page, { attempts: 2 });
    expect(aborted).toBe(true);
    expect(recovered).toBe(true);
    await expect(page.locator('html')).toHaveAttribute('data-eidolon-ready', 'true');
    expect(failures).toEqual([`console: ${earlier}`]);
});

test('runtime warm-up preserves an unrecovered module failure', async ({ page, baseURL }) => {
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    const failures = collectBrowserFailures(page, baseURL);
    await page.route(actorModule, route => route.abort('connectionreset'));
    await expect(openGame(page, { attempts: 1 })).rejects.toThrow();
    expect(failures.some(failure => failure.includes('/src/entities/Actor.js') &&
        failure.includes('net::ERR_CONNECTION_RESET'))).toBe(true);
    await expect(page.locator('html')).not.toHaveAttribute('data-eidolon-ready', 'true');
});

for (const redundantReload of [true, false]) {
    test(`reconnect readiness ${redundantReload ? 'exposes errors from a redundant raw reload' : 'owns a single fresh navigation and its recovery'}`, async ({ page, baseURL }) => {
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        const failures = collectBrowserFailures(page, baseURL);
        await openGame(page, { attempts: 1 });
        const priorDocument = await page.evaluate(() => performance.timeOrigin);
        let aborted = false;
        await page.route(actorModule, async route => {
            if (!aborted) { aborted = true; await route.abort('connectionreset'); }
            else await route.continue();
        });
        // Deliberately retain the old pattern in this control case to reproduce
        // its out-of-scope failure; ordinary reconnect callers must not do this.
        if (redundantReload) await page.reload();
        await openGame(page, { attempts: 2 });
        expect(aborted).toBe(true);
        expect(await page.evaluate(() => performance.timeOrigin)).toBeGreaterThan(priorDocument);
        await expect(page.locator('html')).toHaveAttribute('data-eidolon-ready', 'true');
        if (redundantReload) {
            expect(failures.some(failure => failure.includes('/src/entities/Actor.js') &&
                failure.includes('net::ERR_CONNECTION_RESET'))).toBe(true);
        } else expect(failures).toEqual([]);
    });
}
