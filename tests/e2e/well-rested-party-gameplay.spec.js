import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';
import { hardwareWebGLBrowserArgs } from './browserLaunchPolicy.js';
import { profileGameplayScene } from './scene-performance.js';
import { restedAuraMeetsBudget } from '../restedAuraEvidence.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000,
    trace: 'off', screenshot: 'off', video: 'off' });

const auras = (page, allyId) => page.evaluate(id => {
    const game = window.game;
    return [game.player, game.remotePlayers.get(id)].map(actor => {
        const aura = actor?.attachedStatusEffects?.get('well_rested');
        let meshes = 0, invalid = 0, batches = 0, sparks = 0, ownerGroups = 0;
        aura?.group.traverse(part => {
            if (!part.isMesh) return;
            // Compare draw-visible parts and actual spark instances, not just
            // the reusable geometry allocation count.
            if (part.visible) meshes++;
            if (part.visible && part.isInstancedMesh) {
                batches++;
                sparks += part.count;
            }
            if (part.geometry.type === 'BoxGeometry' || !part.material.transparent || part.material.depthWrite) invalid++;
        });
        game.renderSystem.scene.traverse(part => {
            if (part.name === `AttachedStatusEffect:well_rested:${actor?.id}`) ownerGroups++;
        });
        return { bank: actor?.wellRestedSeconds, attached: Boolean(aura?.group.parent),
            quality: aura?.quality, meshes, invalid, batches, sparks, ownerGroups,
            ownerMatches: Boolean(aura && aura.group.userData.ownerId === actor.id),
            distance: aura && actor.mesh ? aura.group.position.distanceTo(actor.mesh.position) : null };
    });
}, allyId);

test('two real rested party members retain readable phone auras at High and Low quality', async ({ page, context, browser, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires disposable ordinary registrations');
    test.setTimeout(240_000);
    const credentials = credentialsFromEnvironment();
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    const second = await browser.browserType().launch({
        executablePath: process.env.EIDOLON_E2E_BROWSER_PATH || '/usr/bin/google-chrome',
        headless: true, args: hardwareWebGLBrowserArgs() });
    try {
        const allyContext = await second.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, baseURL });
        const ally = await allyContext.newPage();
        const allyFailures = collectBrowserFailures(ally, baseURL);
        await loginAndEnterWorld(ally, { ...credentials, username: `${credentials.username}-ally`, characterClass: 'Fighter' });
        const allyId = await ally.evaluate(() => window.game.player.id);
        await page.locator('#btn-phone-party').tap();
        await page.getByRole('textbox', { name: 'Player to invite' }).fill(`${credentials.username}-ally`);
        await page.locator('#phone-party-panel').getByRole('button', { name: 'Invite', exact: true }).tap();
        await expect(ally.locator('#party-request-modal')).toBeVisible();
        await ally.locator('#btn-accept-party').tap();
        await expect.poll(() => page.evaluate(() => window.game.uiManager.social.partyData?.members?.length)).toBe(2);
        await expect(page.locator('#phone-party-panel')).toBeHidden();
        // Move through the actual joystick so the two auras do not merely pass
        // while stacked at the shared spawn position.
        const cdp = await context.newCDPSession(page);
        const before = await page.evaluate(() => window.game.player.position.toArray());
        const stick = await page.locator('#joystick-zone').boundingBox();
        try {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
                { id: 1, x: stick.x + stick.width / 2 + 24, y: stick.y + stick.height / 2 }] });
            await expect.poll(() => page.evaluate(position => window.game.player.position.distanceTo(
                { x: position[0], y: position[1], z: position[2] }), before)).toBeGreaterThan(3);
        } finally {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await cdp.detach();
        }
        const meshCounts = {}, profiles = [];
        // Rebuild High after Low as well, checking both actors for duplicate
        // scene attachments and lost sparks instead of only fewer meshes.
        for (const phase of ['high', 'low', 'high-repeat']) {
            const quality = phase === 'low' ? 'low' : 'high';
            await page.setViewportSize({ width: 390, height: 844 });
            await page.locator('#btn-mobile-menu').tap();
            await page.locator('#btn-settings').tap();
            await page.locator('#graphics-quality').selectOption(quality);
            await page.locator('#btn-close-settings').tap();
            if (await page.locator('#btn-resume').isVisible()) await page.locator('#btn-resume').tap();
            await expect(page.locator('#esc-menu')).toBeHidden();
            await expect.poll(async () => (await auras(page, allyId)).every(aura =>
                restedAuraMeetsBudget(aura, quality))).toBe(true);
            meshCounts[phase] = (await auras(page, allyId)).map(aura => aura.meshes);
            const profile = await profileGameplayScene(page, `rested-two-player-${phase}`);
            expect(profile.frames).toBe(180);
            expect(profile.visibility).toBe('visible');
            expect(profile.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
            expect(profile.drawCallsMedian).toBeGreaterThan(0);
            expect(profile.frameMedianMs).toBeGreaterThan(0);
            profiles.push({ phase, ...profile, auras: await auras(page, allyId) });
            for (const [width, height] of [[390, 844], [844, 390], [568, 320]]) {
                await page.setViewportSize({ width, height });
                // The phone camera centers the hero in the layout-owned clear
                // encounter region between controls, not the viewport center.
                await expect.poll(() => page.evaluate(() => {
                    const game = window.game;
                    const point = game.player.position.clone().project(game.renderSystem.camera);
                    const region = document.getElementById('phone-encounter-region').getBoundingClientRect();
                    const x = (point.x + 1) * window.innerWidth / 2;
                    const y = (1 - point.y) * window.innerHeight / 2;
                    return Math.abs(x - region.left - region.width / 2) < 12 &&
                        Math.abs(y - region.top - region.height / 2) < 12;
                })).toBe(true);
                await page.locator('#btn-phone-status').tap();
                const panel = page.locator('#phone-status-panel');
                await expect(panel).toContainText('Well Rested');
                await expect(panel).toContainText('+25% enemy-kill XP only');
                await expect(panel).toContainText('Resting');
                await expect(panel.getByRole('heading', { name: 'Well Rested', exact: true })).toBeInViewport();
                expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
                await page.screenshot({ path: testInfo.outputPath(`rested-party-${phase}-${width}.png`) });
                await page.locator('#btn-close-phone-status').tap();
                await page.screenshot({ path: testInfo.outputPath(`rested-party-world-${phase}-${width}.png`) });
            }
        }
        expect(meshCounts.low.every((count, index) => count < meshCounts.high[index])).toBe(true);
        expect(meshCounts['high-repeat']).toEqual(meshCounts.high);
        const beforeLogin = (await auras(page, allyId))[0].bank;
        await page.setViewportSize({ width: 390, height: 844 });
        await loginAndEnterWorld(page, credentials);
        await expect.poll(async () => (await auras(page, allyId)).every(aura =>
            restedAuraMeetsBudget(aura, 'high'))).toBe(true);
        expect((await auras(page, allyId))[0].bank).toBeGreaterThanOrEqual(beforeLogin);
        await page.screenshot({ path: testInfo.outputPath('rested-party-rejoined.png') });
        expect(failures, failures.join('\n')).toEqual([]);
        expect(allyFailures, allyFailures.join('\n')).toEqual([]);
        console.log('[rested-party]', JSON.stringify({ meshCounts, actualPartyMembers: 2, joystickMovement: true,
            rejoinedAuras: await auras(page, allyId), profiles }));
        await testInfo.attach('rested-party-rendering-profile', { body: JSON.stringify(profiles, null, 2), contentType: 'application/json' });
    } finally {
        await second.close();
    }
});
