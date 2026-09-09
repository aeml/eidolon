import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, openGame, projectEntity } from './helpers.js';
import { openPhoneNavigation } from './mobile-helpers.js';
import { seedReturningCharacter } from './chronicle-returning-fixture.js';
import { chroniclePhoneRoutes as routes } from './chronicle-phone-routes.js';
import { chronicleInvestigations } from '../../src/data/chronicleInvestigations.generated.js';
import { planWizardCrowdControl, planWizardHuntStep, planWizardTravelDefense } from '../wizardHuntControls.js';
import { chronicleReadingMetrics, openIlyraByTouch, recallChronicleByTouch,
    revealChronicleEndingByTouch, walkChronicleByTouch } from './chronicle-phone-inputs.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000,
    trace: 'off', screenshot: 'off', video: 'off' });

const realm = process.env.EIDOLON_E2E_INVESTIGATION_REALM || 'earth';
if (!Object.hasOwn(routes, realm)) throw new Error('Unknown phone investigation realm');

async function fightAtSite(page, context, site, chapter) {
    const anchor = site.kind === 'combat';
    const mask = () => page.evaluate(id => window.game.player.quests.find(q => q.id === id)?.investigationMask || 0, chapter.id);
    if (anchor) {
        expect(await mask()).toBe(1);
        await expect.poll(() => page.evaluate(id => {
            const enemy = window.game.remotePlayers.get(id);
            return Boolean(enemy && enemy.state !== 'DEAD' && enemy.stats?.hp > 0);
        }, site.entityId), { timeout: 20_000 }).toBe(true);
    }
    let sawDeath = false;
    const engaged = new Set();
    try {
        await expect.poll(async () => {
            const state = await page.evaluate(id => {
                const game = window.game, p = game.player, target = game.remotePlayers.get(id);
                const enemies = (game.activeEntitiesCache || []).filter(e => game.isHostileActorTarget(e) &&
                    p.position.distanceTo(e.position) < 18).sort((a, b) => p.position.distanceTo(a.position) - p.position.distanceTo(b.position));
                return { className: p.constructor.name, dead: p.state === 'DEAD', x: p.position.x, z: p.position.z,
                    radius: p.radius, healthRatio: p.stats.hp / p.stats.maxHp, shieldHP: p.shieldHP || 0,
                    mana: p.stats.mana, shieldCost: 40, wellCost: 60, hotbar: p.hotbar, cooldowns: p.cooldowns,
                    unlockedSkills: p.unlockedSkills, sinceCastMs: Date.now() - window.__phoneLoreCombat.lastAccepted,
                    abilityCooldown: p.abilityCooldown,
                    anchorDead: target?.state === 'DEAD' || target?.stats?.hp <= 0,
                    threats: enemies.map(e => ({ x: e.position.x, z: e.position.z })),
                    ids: enemies.filter(e => p.position.distanceTo(e.position) < 14).map(e => e.id) };
            }, site.entityId);
            expect(state.dead, 'Phone field combat must be survivable').toBe(false);
            sawDeath ||= state.anchorDead;
            if (anchor ? sawDeath && ((await mask()) & 2) : !state.ids.length) return true;
            const plan = planWizardHuntStep({ ...state, encounter: { x: site.x, z: site.z, radius: 32 } });
            if (plan?.action === 'shield') {
                await page.locator(`.hotbar-slot[data-slot="${Number(plan.key) - 1}"]`).tap();
                await page.waitForTimeout(550);
                return false;
            }
            if (plan?.action === 'retreat') await walkChronicleByTouch(page, context, state.x + plan.x, state.z + plan.z, 5000);
            let selected = null;
            for (const id of [...new Set(anchor ? [site.entityId, ...state.ids] : state.ids)]) {
                const point = await projectEntity(page, id);
                if (!point?.visible || !await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.tagName === 'CANVAS', point)) continue;
                await page.touchscreen.tap(point.x, point.y);
                selected = await page.evaluate(() => {
                    const game = window.game, target = game.getMobileCombatTarget();
                    return game.isHostileActorTarget(target) ? target.id : null;
                });
                if (selected) break;
            }
            if (!selected) return false;
            engaged.add(selected);
            const control = planWizardCrowdControl(state);
            if (control) {
                // Mobile ground skills aim at the deliberately selected enemy.
                await page.locator(`.hotbar-slot[data-slot="${Number(control.key) - 1}"]`).tap();
                await page.waitForTimeout(550);
            } else {
                await page.locator('#btn-mobile-attack').tap();
                if ((state.abilityCooldown || 0) <= 0) await page.locator('#btn-mobile-ability').tap();
            }
            return false;
        }, { timeout: 240_000, intervals: [250], message: `Earn phone combat at ${site.id}` }).toBe(true);
    } catch (error) {
        console.log('[phone-lore-combat-failure]', JSON.stringify({ site: site.id, engaged: [...engaged], sawDeath,
            ...await page.evaluate(() => ({ state: window.game.player.state, hp: window.game.player.stats.hp,
                position: window.game.player.position.toArray(), casts: window.__phoneLoreCombat.counts })) }));
        throw error;
    }
    if (anchor) expect(await mask(), 'Ember is not recorded by the anchor kill').toBe(3);
    if (await page.locator('#btn-mobile-target-clear').isVisible()) await page.locator('#btn-mobile-target-clear').tap();
    console.log(`[phone-lore-combat] ${site.id}: ${engaged.size} actual engaged targets; anchorDeath=${anchor && sawDeath}`);
}

async function readRecordByTouch(page, context, site, capture) {
    const record = page.locator(`#journal-list details[data-discovery-id="${site.id}"]`);
    await expect(record).toHaveAttribute('open', '');
    await expect(record).toContainText(site.text.replace(/\n\s*\n/g, ''));
    for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
        await page.setViewportSize(viewport);
        await expect(page.locator('#btn-close-journal')).toBeInViewport();
        expect(await record.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        try {
            await revealChronicleEndingByTouch(page, context, record);
        } catch (error) {
            await capture(`${site.id}-reading-failure-${viewport.width}`);
            console.log('[phone-lore-reading-failure]', JSON.stringify({ site: site.id, viewport,
                metrics: await chronicleReadingMetrics(record),
                player: await page.evaluate(() => ({ state: window.game.player.state, hp: window.game.player.stats.hp,
                    position: window.game.player.position.toArray() })) }));
            throw error;
        }
        await capture(`${site.id}-phone-${viewport.width}`);
    }
    await page.locator('#btn-close-journal').tap();
    await page.setViewportSize({ width: 390, height: 844 });
}

test(`phone returning character earns both ${realm} investigations with touch travel and manual rewards`, async ({ page, context, baseURL }, testInfo) => {
    test.skip(!process.env.EIDOLON_E2E_INVESTIGATION_MONGO_CONTAINER, 'Requires isolated returning-character fixture');
    test.setTimeout(1_200_000);
    const credentials = credentialsFromEnvironment();
    if (testInfo.retry) credentials.username += `-retry${testInfo.retry}`;
    const failures = collectBrowserFailures(page, baseURL);
    const capture = name => page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
    await openGame(page);
    await page.locator('#auth-username').fill(credentials.username);
    await page.locator('#auth-password').fill(credentials.password);
    await page.locator('#auth-email').fill(`${credentials.username}@example.invalid`);
    await page.locator('#btn-register').tap();
    await expect(page.locator('#auth-status')).toContainText('Registration successful');
    seedReturningCharacter(credentials.username);
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.isMobile)).toBe(true);
    await openPhoneNavigation(page, 'btn-phone-skills');
    await page.locator('.phone-build-tabs').getByRole('button', { name: 'Skills', exact: true }).tap();
    await page.locator('[data-build-action="branch:C"]').tap();
    await expect.poll(() => page.evaluate(() => window.game.player.selectedBranch)).toBe('C');
    await page.locator('#btn-close-skills').tap();
    await page.evaluate(() => {
        const game = window.game, receive = game.handleServerMessage.bind(game);
        window.__phoneLoreCombat = { lastAccepted: 0, counts: {} };
        game.handleServerMessage = message => {
            if (message.type === 'ability_result') {
                const state = window.__phoneLoreCombat;
                if (message.payload?.accepted) state.lastAccepted = Date.now();
                const key = `${message.payload?.skillName}:${message.payload?.accepted ? 'accepted' : 'rejected'}`;
                state.counts[key] = (state.counts[key] || 0) + 1;
            }
            return receive(message);
        };
    });
    const chapters = chronicleInvestigations.filter(chapter => chapter.realm === realm);
    for (const chapter of chapters) {
        const quest = () => page.evaluate(id => window.game.player.quests.find(q => q.id === id), chapter.id);
        expect((await quest()).legacyOptional).toBe(true);
        expect((await quest()).accepted).toBe(false);
        expect((await quest()).investigationMask || 0).toBe(0);
        await openIlyraByTouch(page, context, chapter);
        await page.getByRole('button', { name: 'Accept Quest', exact: true }).tap();
        await expect.poll(async () => (await quest()).accepted).toBe(true);
        await page.locator('#btn-close-quest').tap();
        await recallChronicleByTouch(page);
        const travel = async (x, z) => {
            try {
                await walkChronicleByTouch(page, context, x, z, 180_000, {
                    onThreat: async position => {
                        const state = await page.evaluate(() => {
                            const game = window.game, p = game.player;
                            return { className: p.constructor.name, dead: p.state === 'DEAD',
                                x: p.position.x, z: p.position.z, healthRatio: p.stats.hp / p.stats.maxHp,
                                shieldHP: p.shieldHP || 0, mana: p.stats.mana, shieldCost: 40,
                                hotbar: p.hotbar, cooldowns: p.cooldowns, unlockedSkills: p.unlockedSkills,
                                sinceCastMs: Date.now() - window.__phoneLoreCombat.lastAccepted,
                                threats: (game.activeEntitiesCache || []).filter(enemy => game.isHostileActorTarget(enemy) &&
                                    p.position.distanceTo(enemy.position) < 12).map(enemy => ({ x: enemy.position.x, z: enemy.position.z })) };
                        });
                        const plan = planWizardTravelDefense(state);
                        if (plan?.action === 'shield') return async () => {
                            await page.locator(`.hotbar-slot[data-slot="${Number(plan.key) - 1}"]`).tap();
                            await page.waitForTimeout(550);
                        };
                        if (plan?.action === 'fight') return () => fightAtSite(page, context, {
                            id: `${realm}-travel`, entityId: 'travel-not-a-discovery', kind: 'travel', ...position
                        }, chapter);
                        return null;
                    }
                });
            } catch (error) {
                await capture(`${chapter.id}-travel-failure`);
                throw error;
            }
        };
        for (const [x, z] of routes[realm]) await travel(x, z);
        if (realm === 'earth' && chapter.sites[0].z < 100) await travel(145, 80);
        for (const site of chapter.sites) {
            await travel(site.x + (site.kind === 'combat' ? 18 : 0), site.z + (site.kind === 'combat' ? 18 : 3));
            try { await fightAtSite(page, context, site, chapter); }
            catch (error) { await capture(`${site.id}-combat-failure`); throw error; }
            if (site.kind !== 'combat') {
                await walkChronicleByTouch(page, context, site.x, site.z + 3);
                // USE may first pick up genuinely nearby loot. Keep bounded
                // normal presses; require this exact site's earned record.
                for (let press = 0; press < 8 && !await page.locator('#quest-journal').isVisible(); press++) {
                    await page.locator('#btn-mobile-interact').tap();
                    await page.waitForTimeout(350);
                }
            } else {
                await openPhoneNavigation(page, 'btn-mobile-quest');
                const record = page.locator(`#journal-list details[data-discovery-id="${site.id}"]`);
                await record.locator('summary').scrollIntoViewIfNeeded();
                if (await record.getAttribute('open') === null) await record.locator('summary').tap();
            }
            await readRecordByTouch(page, context, site, capture);
        }
        const before = await quest();
        expect(before.count).toBe(chapter.sites.length);
        expect(before.completed).toBe(false);
        expect(before.grantedXP || 0).toBe(0);
        await recallChronicleByTouch(page);
        await openIlyraByTouch(page, context, chapter);
        await page.getByRole('button', { name: 'Complete Quest', exact: true }).tap();
        await expect.poll(async () => (await quest()).completed).toBe(true);
        await expect(page.locator('#quest-window .quest-dialogue__speech')).toHaveText(chapter.catchupCompletion.split(/\n\s*\n/));
        await page.getByRole('button', { name: 'Continue conversation', exact: true }).tap();
        await page.locator('#btn-close-quest').tap();
    }
    await loginAndEnterWorld(page, credentials);
    await openPhoneNavigation(page, 'btn-mobile-quest');
    for (const chapter of chapters) {
        const saved = await page.evaluate(id => window.game.player.quests.find(q => q.id === id), chapter.id);
        expect(saved.completed).toBe(true);
        expect(saved.investigationMask).toBe(chapter.sites.length === 1 ? 1 : 7);
        expect(saved.grantedXP || 0).toBe(0);
        expect(saved.grantedGold).toBeGreaterThan(0);
        expect(saved.grantedResonanceXP).toBeGreaterThan(0);
        for (const site of chapter.sites) {
            const record = page.locator(`#journal-list details[data-discovery-id="${site.id}"]`);
            await record.locator('summary').scrollIntoViewIfNeeded();
            if (await record.getAttribute('open') === null) await record.locator('summary').tap();
            await expect(record).toContainText(site.text.replace(/\n\s*\n/g, ''));
        }
    }
    expect(await page.evaluate(() => window.game.player.quests.find(q => q.id === 'chronicle_10_rootheart_raid').completed)).toBe(false);
    console.log(`[phone-${realm}-investigations] both chapters earned by touch; manual replies/rewards and saved records passed`);
    expect(failures, failures.join('\n')).toEqual([]);
});
