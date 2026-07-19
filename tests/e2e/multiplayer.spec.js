import { expect, test } from '@playwright/test';
import {
    backendOriginBrowserArgs,
    hardwareWebGLBrowserArgs
} from './browserLaunchPolicy.js';
import {
    collectBrowserFailures,
    credentialsFromEnvironment,
    findOverworldTarget,
    loginAndEnterWorld,
    moveByGroundClick,
    projectEntity,
    selectLowGraphicsThroughSettings,
    useCombatQAWaypoint
} from './helpers.js';

const primary = credentialsFromEnvironment();
const secondary = credentialsFromEnvironment('_SECONDARY');
const hasTwoAccounts = Boolean(
    primary.username && primary.password && secondary.username && secondary.password
);

async function pressBodyKey(page, key) {
    await page.locator('body').press(key, { timeout: 20_000 });
}

async function dismissChatIfVisible(page) {
    const chatBox = page.locator('#chat-box');
    if (!await chatBox.isVisible()) return;
    await pressBodyKey(page, 'Escape');
    await expect(chatBox).toBeHidden();
}

async function closeSocialWindow(page) {
    await dismissChatIfVisible(page);
    const socialWindow = page.locator('#social-window');
    if (await socialWindow.isVisible()) await pressBodyKey(page, 'Escape');
    await expect(socialWindow).toBeHidden();
}

async function leavePartyIfPresent(page) {
    const inParty = () => page.evaluate(() => Boolean(
        window.game?.socialController?.myPartyId ||
        window.game?.uiManager?.social?.inParty
    ));
    if (!await inParty()) return;
    await dismissChatIfVisible(page);
    await pressBodyKey(page, 'o');
    await expect(page.locator('#social-window')).toBeVisible();
    await page.locator('#btn-leave-party').click();
    await expect.poll(inParty, { timeout: 20_000 }).toBe(false);
    await closeSocialWindow(page);
}

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test.describe('two-account multiplayer', () => {
    test.skip(!hasTwoAccounts, 'Set primary and _SECONDARY credentials for multiplayer QA');

    test('both real characters observe one another through the live state stream', async ({ browser, baseURL }) => {
        test.setTimeout(1_200_000);
        const phase = (name) => console.log(`[multiplayer] ${name}`);
        expect(primary.username !== secondary.username).toBe(true);
        // Use an actual second Chrome process so two WebGL render loops cannot
        // starve one another inside a shared browser process/GPU scheduler.
        const secondBrowser = await browser.browserType().launch({
            executablePath: process.env.EIDOLON_E2E_BROWSER_PATH || undefined,
            headless: process.env.EIDOLON_E2E_HEADLESS !== '0',
            args: [
                ...hardwareWebGLBrowserArgs(),
                ...backendOriginBrowserArgs(process.env.EIDOLON_E2E_BACKEND_ORIGIN_IP)
            ]
        });
        const firstContext = await browser.newContext();
        const secondContext = await secondBrowser.newContext();
        const firstPage = await firstContext.newPage();
        const secondPage = await secondContext.newPage();
        firstPage.setDefaultTimeout(20_000);
        secondPage.setDefaultTimeout(20_000);
        const firstFailures = collectBrowserFailures(firstPage, baseURL);
        const secondFailures = collectBrowserFailures(secondPage, baseURL);

        try {
            phase('loading primary character');
            await firstPage.bringToFront();
            await loginAndEnterWorld(firstPage, primary);
            // A real user can lower rendering cost before opening another game.
            // This keeps two production WebGL clients responsive on the
            // repository runner without bypassing gameplay or mutating page state.
            await selectLowGraphicsThroughSettings(firstPage);
            phase('loading secondary character');
            await secondPage.bringToFront();
            await loginAndEnterWorld(secondPage, secondary);
            await selectLowGraphicsThroughSettings(secondPage);

            // Persistent accounts may retain a party across disconnects. Start
            // this scenario from a fresh two-member party through visible UI.
            await leavePartyIfPresent(firstPage);
            await leavePartyIfPresent(secondPage);
            phase('cleared stale party state');

            // Persistent QA characters can begin outside the server's 200-unit
            // replication radius. Put both at the same fixed allowlisted point
            // through the visible chat UI before requiring remote visibility.
            await useCombatQAWaypoint(firstPage);
            await useCombatQAWaypoint(secondPage);
            phase('colocated characters');

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
            phase('verified bidirectional state visibility');

            await firstPage.bringToFront();
            await pressBodyKey(firstPage, 'o');
            await expect(firstPage.locator('#social-window')).toBeVisible();
            await firstPage.locator('#social-status-select').selectOption('looking_party');
            await secondPage.bringToFront();
            await pressBodyKey(secondPage, 'o');
            await expect.poll(() => secondPage.evaluate((primaryName) =>
                [...document.querySelectorAll('#social-list .social-window__row')].some((row) =>
                    row.textContent.includes(primaryName) && row.textContent.includes('Looking for Party')
            ), primary.username), { timeout: 20_000 }).toBe(true);
            phase('verified social presence');
            await closeSocialWindow(secondPage);
            phase('closed secondary social window');
            await firstPage.bringToFront();
            await dismissChatIfVisible(firstPage);
            await expect(firstPage.locator('#social-window')).toBeVisible();
            phase('cleared chat overlay from party controls');
            await firstPage.locator('#party-invite-input').fill(secondary.username);
            phase('filled party invite');
            await firstPage.locator('#btn-invite-party').click();
            phase('submitted party invite');
            await expect(secondPage.locator('#party-request-modal')).toBeVisible({ timeout: 20_000 });
            expect(await secondPage.locator('#party-inviter-name').evaluate(
                (element, primaryName) => element.textContent === primaryName,
                primary.username
            )).toBe(true);
            await secondPage.locator('#btn-accept-party').click();
            phase('accepted party invite');

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
            phase('formed fresh replicated party');
            await closeSocialWindow(firstPage);
            const beforeMovement = await remoteSnapshot(secondPage, primary.username);
            await moveByGroundClick(firstPage, 20, 0);

            await expect.poll(async () => {
                const after = await remoteSnapshot(secondPage, primary.username);
                return Math.hypot(after.x - beforeMovement.x, after.z - beforeMovement.z);
            }, { timeout: 15_000 }).toBeGreaterThan(0.25);
            phase('verified remote movement');

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
            phase('verified remote jump');

            await moveByGroundClick(secondPage, 20, 0);

            // Reset both characters to the deterministic combat area after the
            // movement/jump assertions, then reuse the bounded full-gameplay
            // hostile finder instead of wandering until the test times out.
            await useCombatQAWaypoint(firstPage);
            await useCombatQAWaypoint(secondPage);
            const hostile = await findOverworldTarget(firstPage);
            phase('acquired shared hostile');
            await firstPage.mouse.click(hostile.x, hostile.y);
            await pressBodyKey(firstPage, '1');
            await expect.poll(async () => {
                const remote = await remoteSnapshot(secondPage, primary.username);
                return remote?.state === 'ATTACKING' || remote?.state === 'CASTING';
            }, { timeout: 20_000, intervals: [50, 100, 250] }).toBe(true);
            phase('verified remote combat presentation');

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
                await pressBodyKey(secondPage, '1');
            }
            expect(firstFailures, firstFailures.join('\n')).toEqual([]);
            expect(secondFailures, secondFailures.join('\n')).toEqual([]);
            phase('completed browser failure audit');
        } finally {
            for (const page of [firstPage, secondPage]) {
                if (!page.isClosed()) {
                    await leavePartyIfPresent(page).catch(() => {});
                }
            }
            await Promise.allSettled([
                firstContext.close(),
                secondContext.close(),
                secondBrowser.close()
            ]);
        }
    });
});
