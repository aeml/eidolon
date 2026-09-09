import { expect } from '@playwright/test';
import { projectEntity, waitForTouchScrollSettled } from './helpers.js';
import { openPhoneNavigation } from './mobile-helpers.js';

// Real joystick contacts only. No coordinate assignment, waypoint command,
// keyboard fallback, collision override or granted interaction credit.
export async function walkChronicleByTouch(page, context, x, z, timeout = 90_000, { onThreat } = {}) {
    const cdp = await context.newCDPSession(page);
    const box = await page.locator('#joystick-zone').boundingBox();
    expect(box, 'The phone movement control must be visible').not.toBeNull();
    let started = false;
    try {
        await expect.poll(async () => {
            const state = await page.evaluate(({ x, z, watchThreats }) => {
                const game = window.game, player = game.player;
                return { x: x - player.position.x, z: z - player.position.z, dead: player.state === 'DEAD',
                    position: { x: player.position.x, z: player.position.z },
                    threatened: watchThreats && (game.activeEntitiesCache || []).some(enemy =>
                        game.isHostileActorTarget(enemy) && player.position.distanceTo(enemy.position) < 12) };
            }, { x, z, watchThreats: Boolean(onThreat) });
            expect(state.dead, 'Phone investigation travel must remain survivable').toBe(false);
            const response = state.threatened ? await onThreat(state.position) : null;
            if (response) {
                // Release the movement finger before ordinary taps/retreats.
                // Combat has no travel callback, so this cannot recurse.
                if (started) {
                    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                    started = false;
                }
                await response();
                return false;
            }
            const distance = Math.hypot(state.x, state.z);
            if (distance < 2) return true;
            const jx = state.x - state.z, jy = state.x + state.z, length = Math.hypot(jx, jy);
            const radius = 32 * Math.min(1, distance / 4);
            await cdp.send('Input.dispatchTouchEvent', { type: started ? 'touchMove' : 'touchStart', touchPoints: [
                { id: 87, x: box.x + box.width / 2 + radius * jx / length,
                    y: box.y + box.height / 2 + radius * jy / length }
            ] });
            started = true;
            return false;
        }, { timeout, intervals: [100], message: `Reach investigation waypoint ${x},${z} by joystick` }).toBe(true);
    } catch (error) {
        console.log('[phone-lore-travel-failure]', JSON.stringify({ destination: { x, z },
            ...await page.evaluate(() => {
                const game = window.game, p = game.player;
                return { position: p.position.toArray(), state: p.state, hp: p.stats.hp,
                    maxHp: p.stats.maxHp, shieldHP: p.shieldHP, mana: p.stats.mana,
                    casts: window.__phoneLoreCombat?.counts,
                    nearby: (game.activeEntitiesCache || []).filter(enemy => game.isHostileActorTarget(enemy) &&
                        p.position.distanceTo(enemy.position) < 30).map(enemy => ({ type: enemy.constructor.name,
                        level: enemy.level, hp: enemy.stats?.hp, position: enemy.position.toArray() })) };
            }) }));
        throw error;
    } finally {
        try {
            if (started) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } finally {
            await cdp.detach();
        }
    }
    await expect.poll(() => page.evaluate(() => window.game.inputManager.joystickVector.lengthSq())).toBe(0);
}

export async function recallChronicleByTouch(page) {
    await openPhoneNavigation(page, 'btn-recall');
    await expect.poll(() => page.evaluate(() => Math.hypot(window.game.player.position.x + 1.25,
        window.game.player.position.z - 200)), { timeout: 20_000 }).toBeLessThan(3);
}

export async function openIlyraByTouch(page, context, chapter) {
    await walkChronicleByTouch(page, context, 17, 215, 20_000);
    const point = await projectEntity(page, 'story-wizard-1');
    expect(point?.visible, 'Ilyra must be visible without desktop zoom').toBe(true);
    await page.touchscreen.tap(point.x, point.y);
    await expect(page.locator('#quest-window')).toBeVisible();
    const other = page.locator('#quest-list details').filter({ has: page.locator('summary').filter({ hasText: 'Other discoveries' }) });
    if (await other.getAttribute('open') === null) await other.locator('summary').tap();
    const offer = other.getByRole('button', { name: chapter.title, exact: true });
    await offer.scrollIntoViewIfNeeded();
    await offer.tap();
}

export async function swipeChronicleJournal(page, context, { direction = 'up', distance = Infinity } = {}) {
    const box = await page.locator('#journal-list').boundingBox();
    expect(box.height).toBeGreaterThan(60);
    const cdp = await context.newCDPSession(page);
    let started = false;
    try {
        const x = box.x + box.width / 2;
        const start = direction === 'down' ? box.y + 16 : box.y + box.height - 16;
        const travel = Math.min(box.height - 32, Math.max(24, distance)) * (direction === 'down' ? 1 : -1);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 88, x, y: start }] });
        started = true;
        for (let step = 1; step <= 8; step++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
                { id: 88, x, y: start + travel * step / 8 }
            ] });
            await page.waitForTimeout(30);
        }
        // Stop moving before release so a long fling does not skip the ending.
        await page.waitForTimeout(120);
    } finally {
        try {
            if (started) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } finally {
            await cdp.detach();
        }
    }
    await waitForTouchScrollSettled(page.locator('#journal-list'));
}

export async function chronicleReadingMetrics(record) {
    return record.evaluate(el => {
        const paragraph = el.lastElementChild, text = paragraph?.lastChild;
        if (text?.nodeType !== Node.TEXT_NODE) return { readable: false, reason: 'missing final text' };
        const range = document.createRange();
        range.setStart(text, Math.max(0, text.length - 12)); range.setEnd(text, text.length);
        const scrollable = el.closest('#journal-list');
        const line = range.getBoundingClientRect(), body = scrollable.getBoundingClientRect();
        const hit = document.elementFromPoint(line.x + line.width / 2, line.y + line.height / 2);
        return {
            readable: line.height > 0 && line.top >= body.top && line.bottom <= body.bottom && paragraph.contains(hit),
            delta: (line.top + line.bottom - body.top - body.bottom) / 2,
            line: { top: line.top, bottom: line.bottom }, body: { top: body.top, bottom: body.bottom },
            scrollTop: scrollable.scrollTop, hit: hit ? { tag: hit.tagName, id: hit.id, className: String(hit.className) } : null
        };
    });
}

export async function chronicleEndingReadable(record) {
    return (await chronicleReadingMetrics(record)).readable;
}

export async function revealChronicleEndingByTouch(page, context, record) {
    for (let swipe = 0; swipe < 20; swipe++) {
        const metrics = await chronicleReadingMetrics(record);
        if (metrics.readable) return;
        expect(Number.isFinite(metrics.delta), JSON.stringify(metrics)).toBe(true);
        await swipeChronicleJournal(page, context, {
            direction: metrics.delta < 0 ? 'down' : 'up', distance: Math.abs(metrics.delta)
        });
    }
    await expect.poll(() => chronicleEndingReadable(record), { message: 'Read the record ending through native touch' }).toBe(true);
}
