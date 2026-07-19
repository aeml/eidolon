import { expect, test } from '@playwright/test';
import {
    collectBrowserFailures,
    credentialsFromEnvironment,
    loginAndEnterWorld,
    projectEntity,
    projectNearestHostile
} from './helpers.js';

const primary = credentialsFromEnvironment();
const secondary = credentialsFromEnvironment('_SECONDARY');
const hasTwoAccounts = Boolean(
    primary.username && primary.password && secondary.username && secondary.password
);

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test.describe('two-account multiplayer', () => {
    test.skip(!hasTwoAccounts, 'Set primary and _SECONDARY credentials for multiplayer QA');

    test('both real characters observe one another through the live state stream', async ({ browser, baseURL }) => {
        test.setTimeout(240_000);
        expect(primary.username !== secondary.username).toBe(true);
        const firstContext = await browser.newContext();
        const secondContext = await browser.newContext();
        const firstPage = await firstContext.newPage();
        const secondPage = await secondContext.newPage();
        const firstFailures = collectBrowserFailures(firstPage, baseURL);
        const secondFailures = collectBrowserFailures(secondPage, baseURL);

        try {
            await loginAndEnterWorld(firstPage, primary);
            await loginAndEnterWorld(secondPage, secondary);

            const remoteSnapshot = (page, username) => page.evaluate((remoteUsername) => {
                const entity = [...(window.game?.remotePlayers?.values?.() || [])]
                    .find((candidate) => candidate?.name === remoteUsername);
                return entity ? {
                    id: entity.id,
                    partyId: entity.partyId,
                    state: entity.state,
                    jumpProgress: entity.jumpProgress,
                    x: entity.position?.x,
                    z: entity.position?.z
                } : null;
            }, username);

            await expect.poll(() => remoteSnapshot(firstPage, secondary.username), { timeout: 30_000 }).not.toBeNull();
            await expect.poll(() => remoteSnapshot(secondPage, primary.username), { timeout: 30_000 }).not.toBeNull();

            await firstPage.keyboard.press('o');
            await expect(firstPage.locator('#social-window')).toBeVisible();
            await firstPage.locator('#social-status-select').selectOption('looking_party');
            await secondPage.keyboard.press('o');
            await expect.poll(() => secondPage.evaluate((primaryName) =>
                [...document.querySelectorAll('#social-list .social-window__row')].some((row) =>
                    row.textContent.includes(primaryName) && row.textContent.includes('Looking for Party')
                ), primary.username), { timeout: 20_000 }).toBe(true);
            await secondPage.keyboard.press('Escape');
            await firstPage.locator('#party-invite-input').fill(secondary.username);
            await firstPage.locator('#btn-invite-party').click();
            await expect(secondPage.locator('#party-request-modal')).toBeVisible({ timeout: 20_000 });
            expect(await secondPage.locator('#party-inviter-name').evaluate(
                (element, primaryName) => element.textContent === primaryName,
                primary.username
            )).toBe(true);
            await secondPage.locator('#btn-accept-party').click();

            await expect.poll(() => firstPage.locator('#party-list').evaluate(
                (element, secondaryName) => element.textContent.includes(secondaryName),
                secondary.username
            ), { timeout: 20_000 }).toBe(true);
            await expect.poll(() => secondPage.locator('#party-list').evaluate(
                (element, primaryName) => element.textContent.includes(primaryName),
                primary.username
            ), { timeout: 20_000 }).toBe(true);
            await expect.poll(async () => {
                const firstSees = await remoteSnapshot(firstPage, secondary.username);
                const secondSees = await remoteSnapshot(secondPage, primary.username);
                return Boolean(firstSees?.partyId && firstSees.partyId === secondSees?.partyId);
            }, { timeout: 20_000 }).toBe(true);
            await firstPage.keyboard.press('Escape');
            const beforeMovement = await remoteSnapshot(secondPage, primary.username);
            await firstPage.keyboard.down('w');
            await firstPage.waitForTimeout(1_500);
            await firstPage.keyboard.up('w');

            await expect.poll(async () => {
                const after = await remoteSnapshot(secondPage, primary.username);
                return Math.hypot(after.x - beforeMovement.x, after.z - beforeMovement.z);
            }, { timeout: 15_000 }).toBeGreaterThan(0.25);

            const gameCanvas = firstPage.locator('body > canvas').last();
            const canvasBox = await gameCanvas.boundingBox();
            expect(canvasBox).not.toBeNull();
            await firstPage.keyboard.down('Control');
            await firstPage.mouse.click(
                canvasBox.x + canvasBox.width * 0.62,
                canvasBox.y + canvasBox.height * 0.65
            );
            await firstPage.keyboard.up('Control');
            await expect.poll(async () => {
                const remote = await remoteSnapshot(secondPage, primary.username);
                return remote?.state === 'JUMPING' || Number(remote?.jumpProgress) > 0;
            }, { timeout: 5_000, intervals: [50, 100, 200] }).toBe(true);

            await secondPage.keyboard.down('w');
            await secondPage.waitForTimeout(1_500);
            await secondPage.keyboard.up('w');

            let hostile = await projectNearestHostile(firstPage);
            for (let attempt = 0; !hostile && attempt < 30; attempt += 1) {
                await Promise.all([
                    firstPage.keyboard.down('w'),
                    secondPage.keyboard.down('w')
                ]);
                await firstPage.waitForTimeout(1_000);
                await Promise.all([
                    firstPage.keyboard.up('w'),
                    secondPage.keyboard.up('w')
                ]);
                hostile = await projectNearestHostile(firstPage);
            }
            expect(hostile, 'A shared overworld hostile is required for multiplayer presentation QA').not.toBeNull();
            await firstPage.mouse.click(hostile.x, hostile.y);
            await firstPage.keyboard.press('1');
            await expect.poll(async () => {
                const remote = await remoteSnapshot(secondPage, primary.username);
                return remote?.state === 'ATTACKING' || remote?.state === 'CASTING';
            }, { timeout: 20_000, intervals: [50, 100, 250] }).toBe(true);

            const primaryPosition = await firstPage.evaluate(() => ({
                x: window.game.player.position.x,
                z: window.game.player.position.z
            }));
            await expect.poll(async () => {
                const converged = await remoteSnapshot(secondPage, primary.username);
                return Math.hypot(converged.x - primaryPosition.x, converged.z - primaryPosition.z);
            }, { timeout: 15_000 }).toBeLessThan(2);

            const secondaryTarget = await projectEntity(secondPage, hostile.id);
            if (secondaryTarget?.visible) {
                await secondPage.mouse.click(secondaryTarget.x, secondaryTarget.y);
                await secondPage.keyboard.press('1');
            }
            expect(firstFailures, firstFailures.join('\n')).toEqual([]);
            expect(secondFailures, secondFailures.join('\n')).toEqual([]);
        } finally {
            for (const page of [firstPage, secondPage]) {
                if (!page.isClosed()) {
                    await page.locator('#btn-leave-party').click({ timeout: 2_000 }).catch(() => {});
                }
            }
            await Promise.all([firstContext.close(), secondContext.close()]);
        }
    });
});
