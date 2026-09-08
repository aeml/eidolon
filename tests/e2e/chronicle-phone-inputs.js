import { expect } from '@playwright/test';
import { projectEntity } from './helpers.js';
import { openPhoneNavigation } from './mobile-helpers.js';

// Real joystick contacts only. No coordinate assignment, waypoint command,
// keyboard fallback, collision override or granted interaction credit.
export async function walkChronicleByTouch(page, context, x, z, timeout = 90_000) {
    const cdp = await context.newCDPSession(page);
    const box = await page.locator('#joystick-zone').boundingBox();
    expect(box, 'The phone movement control must be visible').not.toBeNull();
    let started = false;
    try {
        await expect.poll(async () => {
            const state = await page.evaluate(({ x, z }) => {
                const player = window.game.player;
                return { x: x - player.position.x, z: z - player.position.z, dead: player.state === 'DEAD' };
            }, { x, z });
            expect(state.dead, 'Phone investigation travel must remain survivable').toBe(false);
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
    } finally {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
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

export async function swipeChronicleJournal(page, context) {
    const box = await page.locator('#journal-list').boundingBox();
    expect(box.height).toBeGreaterThan(60);
    const cdp = await context.newCDPSession(page);
    try {
        const x = box.x + box.width / 2, start = box.y + box.height - 16;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 88, x, y: start }] });
        for (let step = 1; step <= 8; step++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
                { id: 88, x, y: start - (box.height - 32) * step / 8 }
            ] });
            await page.waitForTimeout(30);
        }
    } finally {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
    }
    await page.waitForTimeout(150);
}

export async function chronicleEndingReadable(record) {
    return record.evaluate(el => {
        const paragraph = el.lastElementChild, text = paragraph?.lastChild;
        if (text?.nodeType !== Node.TEXT_NODE) return false;
        const range = document.createRange();
        range.setStart(text, Math.max(0, text.length - 12)); range.setEnd(text, text.length);
        const line = range.getBoundingClientRect(), body = el.closest('#journal-list').getBoundingClientRect();
        return line.height > 0 && line.top >= body.top && line.bottom <= body.bottom &&
            paragraph.contains(document.elementFromPoint(line.x + line.width / 2, line.y + line.height / 2));
    });
}
