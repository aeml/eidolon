import { expect, test } from '@playwright/test';
import { restoreEarnedWizard } from './earned-earth-continuation.js';
import { createEarnedClassCombat } from './earned-class-combat.js';
import { createInvestigationTravelDefense } from './fresh-investigation-combat.js';
import { walkInvestigationWaypoints } from './chronicle-investigation-route.js';
import { chroniclePhoneRoutes } from './chronicle-phone-routes.js';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld,
    moveByGroundClick, projectEntity, readPlayerState, returnToTown, selectGraphicsThroughSettings } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

// A separate branch of the retained earned save, not a replacement campaign
// checkpoint. No event clock, enemy health, resources or rewards are injected.
test('earned Wizard completes a scheduled public disturbance through normal combat and ward movement', async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_EARNED_PUBLIC_EVENT !== '1', 'Explicit isolated public-event route only');
    test.setTimeout(25 * 60_000);
    expect(testInfo.retry).toBe(0);
    const credentials = credentialsFromEnvironment();
    const failures = collectBrowserFailures(page, baseURL);
    await restoreEarnedWizard(page, credentials);
    await selectGraphicsThroughSettings(page, 'low');
    await returnToTown(page, { allowRespawn: false });
    await expect.poll(() => page.evaluate(() => {
        const p = window.game.player;
        return p.stats.hp === p.stats.maxHp && p.stats.mana === p.stats.maxMana;
    }), { timeout: 15_000 }).toBe(true);
    const readEvent = () => page.evaluate(() => window.game.publicEvents.data);
    // At most one ordinary schedule interval. Do not start a late-slot run and
    // silently retry a different event when it expires.
    await expect.poll(async () => {
        const event = await readEvent();
        return event?.phase === 'announced' && Date.parse(event.endsAt) - Date.now() >= 390_000;
    }, { timeout: 610_000, intervals: [2000] }).toBe(true);
    const event = await readEvent();
    const prefix = `${event.id.replace('disturbance-', 'world-event-')}-`;
    console.log('[earned-public-event-start]', JSON.stringify({ id: event.id, site: event.site.id,
        endsAt: event.endsAt, level: await page.evaluate(() => window.game.player.level) }));
    await page.evaluate(({ id, prefix }) => {
        const game = window.game, original = game.handleServerMessage.bind(game);
        const evidence = window.__earnedPublicEvent = { waves: [], damageByWave: {}, complete: false };
        game.handleServerMessage = message => {
            const p = message.payload;
            if (message.type === 'public_event' && p?.id === id) {
                if (p.wave > 0 && !evidence.waves.includes(p.wave)) evidence.waves.push(p.wave);
                if (p.phase === 'complete') evidence.complete = true;
            }
            if (message.type === 'damage' && p?.sourceId === game.player.id &&
                p.targetId?.startsWith(prefix) && p.amount > 0) {
                const wave = p.targetId.slice(prefix.length).split('-')[0];
                evidence.damageByWave[wave] = (evidence.damageByWave[wave] || 0) + p.amount;
            }
            return original(message);
        };
    }, { id: event.id, prefix });
    const beforeTravel = await createInvestigationTravelDefense(page);
    const waypoints = event.site.realm === 'earth' ? chroniclePhoneRoutes.fire.slice(0, 5)
        : chroniclePhoneRoutes[event.site.realm];
    await walkInvestigationWaypoints(page, [...waypoints, [event.site.x, event.site.z]], { beforeTravel });
    const panel = page.locator('.public-event');
    await expect(panel).toBeVisible();
    if (await panel.getAttribute('open') === null) await panel.locator('summary').click();
    await expect(panel).toContainText(event.site.title);
    // Read the rules, then use the ordinary disclosure control so the expanded
    // instructions do not cover combat targets and ground-click destinations.
    await panel.locator('summary').click();
    const defend = await createEarnedClassCombat(page, 'Wizard', { useCrowdControl: true });
    const moveToward = async (x, z) => {
        const p = await readPlayerState(page);
        const distance = Math.hypot(x - p.x, z - p.z);
        const step = Math.min(1, 10 / Math.max(distance, 1));
        await moveByGroundClick(page, (x - p.x) * step, (z - p.z) * step, { moveOnly: true });
    };
    let airDirection = 1, previousPhase;
    while (Date.now() < Date.parse(event.endsAt)) {
        const current = await readEvent();
        expect(current.id, 'The original scheduled event must finish, never a replacement').toBe(event.id);
        expect(current.phase).not.toBe('expired');
        expect((await readPlayerState(page)).state, 'Public event must remain survivable').not.toBe('DEAD');
        if (current.phase === 'complete') break;
        const phase = `${current.phase}:${current.wave}`;
        if (phase !== previousPhase) {
            previousPhase = phase;
            console.log('[earned-public-event-wave]', JSON.stringify({ phase, remaining: current.remaining }));
            await page.screenshot({ path: testInfo.outputPath(`event-${phase.replace(':', '-')}.png`) });
        }
        const target = await page.evaluate(prefix => {
            const game = window.game;
            const enemies = [...game.remotePlayers.values()].filter(e => game.isHostileActorTarget(e) &&
                (e.id.startsWith(prefix) || game.player.position.distanceTo(e.position) < 9));
            enemies.sort((a, b) => game.player.position.distanceTo(a.position) - game.player.position.distanceTo(b.position));
            const enemy = enemies[0];
            return enemy ? { id: enemy.id, x: enemy.position.x, z: enemy.position.z } : null;
        }, prefix);
        if (target) {
            if (await defend(page, { ...target,
                encounter: { x: event.site.x, z: event.site.z, radius: 55 } })) continue;
            const point = await projectEntity(page, target.id);
            if (point?.visible) {
                await page.mouse.move(point.x, point.y);
                await page.waitForTimeout(75);
                if (await page.evaluate(() => window.game.isHostileActorTarget(window.game.hoveredEntity))) {
                    await page.mouse.click(point.x, point.y);
                    if (await page.evaluate(() => window.game.player.abilityCooldown <= 0)) {
                        await page.mouse.click(point.x, point.y, { button: 'right' });
                    }
                }
            } else await moveToward(target.x, target.z);
        } else if (current.phase === 'defending') {
            const p = await readPlayerState(page);
            const offset = current.innerRadius > 0 ? (current.innerRadius + current.radius) / 2
                : event.site.realm === 'air' ? 4 * airDirection : 0;
            const x = current.runeX + offset, z = current.runeZ;
            if (Math.hypot(x - p.x, z - p.z) > 1) {
                await moveToward(x, z);
            } else if (event.site.realm === 'air') airDirection *= -1;
        }
        await page.waitForTimeout(250);
    }
    await expect.poll(async () => (await readEvent())?.phase).toBe('complete');
    const final = await readEvent();
    expect(final.id).toBe(event.id);
    expect(final.remaining).toBe(0);
    expect(Date.parse(final.calmedUntil)).toBeGreaterThan(Date.now());
    const evidence = await page.evaluate(() => window.__earnedPublicEvent);
    expect(evidence.waves).toEqual([1, 2, 3, 4]);
    expect(evidence.complete).toBe(true);
    for (const wave of evidence.waves) expect(evidence.damageByWave[wave] || 0).toBeGreaterThan(0);
    await expect(panel).toContainText('Road restored');
    await expect(panel).toContainText('no reward to claim');
    if (await panel.getAttribute('open') === null) await panel.locator('summary').click();
    await page.screenshot({ path: testInfo.outputPath('event-complete.png') });
    const rewards = () => page.evaluate(() => ({ gold: window.game.player.gold, xp: window.game.player.xp,
        resonanceXP: window.game.player.resonanceXP, resonanceLevel: window.game.player.resonanceLevel }));
    await returnToTown(page, { allowRespawn: false });
    const earned = await rewards();
    await loginAndEnterWorld(page, credentials);
    expect(await rewards()).toEqual(earned);
    expect(failures, failures.join('\n')).toEqual([]);
    console.log('[earned-public-event-complete]', JSON.stringify({ id: final.id, realm: final.site.realm,
        evidence, savedRewards: earned, scope: 'one full scheduled event with an earned max-level Wizard; not all-realm or group balance' }));
});
