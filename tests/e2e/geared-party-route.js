import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PARTY_ROLES, partyDungeonCharacter, requireIsolatedPartyFixture, partyGraphicsQuality, partyGearProfile } from '../partyDungeonFixture.js';
import { dungeonPlaythroughOptions } from '../dungeonPlaythroughCatalog.js';
import { PARTY_DUNGEON_CHAPTERS, partyDungeonStory } from '../partyDungeonStory.js';
import { gatherPartyFormation, PARTY_FOLLOW_INPUT_OPTIONS, partyFollowStep, partyWarningInputPolicy, partyFormationArrival } from '../partyDungeonControls.js';
import { attackPartyDamageTarget, selectPartyDamageBuff } from '../partyDamageRoleControls.js';
import { runPartyRoleInputs } from '../partyRoleScheduling.js';
import { startPartyCombatWorkers } from '../partyCombatWorkers.js';
import { observePartyCombatHealth } from '../partyCombatHealth.js';
import { partyTankHasEngaged } from '../partyEngagementControls.js';
import { partyAuraFollowSpacing, selectPartyHealTarget } from '../partyHealingControls.js';
import { tryDungeonGroundStep } from '../dungeonNavigationInput.js';
import { dungeonExpeditionBudget } from '../dungeonExpeditionTiming.js';
import { partyDungeonRestNeeded } from '../dungeonRestPolicy.js';
import { playDungeonThroughInputs } from './dungeon-playthrough-route.js';
import { RAID_PARTY_ROLES, raidPartyFixture } from '../raidPartyFixture.js';
import { formAndEnterElementalRaid, enterElementalRaid } from './raid-party-entry.js';
import { stepRaidVigilInput } from './raid-vigil-input.js';
import { hardwareWebGLBrowserArgs } from './browserLaunchPolicy.js';
import { claimChapterAndContinue, readChronicleChapter } from './chronicle-earth-route.js';
import { verifyFreshWaterHandoff } from './chronicle-water-handoff.js';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, openGame,
    enterDungeon, moveByGroundClick, projectEntity, projectGroundOffset, returnToTown } from './helpers.js';

// Shared input route; each spec owns Playwright recording options.

const readPartySnapshot = (page, chapterId) => page.evaluate(chapterId => {
    const g = window.game, p = g.player;
    return { id: p.id, instance: g.currentInstanceId, seed: g.currentDungeonLayout?.generationSeed,
        x: p.position.x, z: p.position.z, hp: p.stats.hp, maxHP: p.stats.maxHp,
        mana: p.stats.mana, maxMana: p.stats.maxMana, dead: p.state === 'DEAD',
        render: { quality: g.renderSystem.graphicsQuality,
            fps: g.renderSystem.perfOverlay ? g.renderSystem.perfStats.fps : null,
            frameTime: g.renderSystem.perfOverlay ? g.renderSystem.perfStats.frameTime : null },
        gold: p.gold, xp: p.xp, resonanceXP: p.resonanceXP ?? 0, resonanceLevel: p.resonanceLevel ?? 0,
        level: p.level, stats: p.baseStats, hotbar: p.hotbar,
        quest: p.quests?.find(q => q.id === chapterId),
        rooms: g.currentDungeonRoomState?.rooms, evidence: window.__partyClearEvidence };
}, chapterId);

async function verifyNextStoryOffer(page, story) {
    if (story.chapterId === PARTY_DUNGEON_CHAPTERS.verdant_bastion_catacombs) return verifyFreshWaterHandoff(page);
    await expect.poll(() => page.evaluate(({ nextChapterId, laterChapterId }) => window.game.player.quests
        .filter(q => q.id === nextChapterId || q.id === laterChapterId)
        .map(q => ({ id: q.id, accepted: q.accepted, completed: q.completed, count: q.count })), story))
        .toEqual([{ id: story.nextChapterId, accepted: false, completed: false, count: 0 }]);
}

async function observeRole(page) {
    await page.evaluate(async () => {
        const { observePartyWarning } = await import('/tests/partyDamageRoleControls.js');
        const { recordPartyOutgoingDamage } = await import('/tests/partyEngagementControls.js');
        const { recordPartyCombatReceipt } = await import('/tests/partyCombatReceipts.js');
        const game = window.game, original = game.handleServerMessage.bind(game);
        const e = window.__partyClearEvidence = { damageDone: 0, damageByTarget: {}, damageTaken: 0, allyHealing: 0, repairStages: [],
            casts: {}, rejected: {}, sawDeath: false, combatReceipts: [], warningMoves: 0, warningEscapes: 0,
            warningEarlyEscapes: 0, recentDamage: [], recentEscapes: [], recentAttackInputs: [], recentRangedSpacing: [], lastAcceptedCastAt: -Infinity,
            lastUpdate: performance.now() };
        window.__partyClearWarnings = [];
        game.handleServerMessage = message => {
            recordPartyCombatReceipt(e.combatReceipts, message, game.player.id, Date.now());
            const p = message.payload;
            if (p && message.type === 'crystal_repair' && p.instanceId === game.currentInstanceId) {
                const stage = `${p.wave}:${p.stage}`;
                if (!e.repairStages.includes(stage)) e.repairStages.push(stage);
            }
            if (p && message.type === 'telegraph' && [p.x, p.z, p.radius, p.duration].every(Number.isFinite)) {
                window.__partyClearWarnings.push(observePartyWarning({ x: p.x, z: p.z, radius: p.radius,
                    instance: game.currentInstanceId, expires: performance.now() + p.duration * 1000 },
                game.player.position, performance.now()));
            }
            if (message.type === 'state' || message.type === 'delta') e.lastUpdate = performance.now();
            if (p && message.type === 'damage') {
                recordPartyOutgoingDamage(e, p, game.player.id);
                if (p.targetId === game.player.id) {
                    e.damageTaken += Math.max(0, p.amount || 0);
                    const position = game.player.position, now = performance.now();
                    const source = game.remotePlayers.get(p.sourceId);
                    e.recentDamage.push({ amount: p.amount, kind: p.kind, x: position.x, z: position.z,
                        render: { quality: game.renderSystem.graphicsQuality,
                            fps: game.renderSystem.perfOverlay ? game.renderSystem.perfStats.fps : null,
                            frameTime: game.renderSystem.perfOverlay ? game.renderSystem.perfStats.frameTime : null },
                        source: source ? { type: source.subType || source.constructor.name,
                            x: source.position?.x, z: source.position?.z,
                            distance: source.position ? Math.hypot(source.position.x - position.x, source.position.z - position.z) : null,
                            state: source.state } : null,
                        pendingTarget: game.pendingInteraction?.id || null,
                        moveTarget: game.player.targetPosition ? { x: game.player.targetPosition.x, z: game.player.targetPosition.z } : null,
                        warnings: window.__partyClearWarnings.filter(w => w.instance === game.currentInstanceId && now < w.expires + 3000)
                            .map(w => ({ radius: w.radius, distance: Math.hypot(position.x - w.x, position.z - w.z),
                                msUntilImpact: w.expires - now, earlyEscape: w.firstSafeAt != null, lastObservedSafe: w.safe })) });
                    e.recentDamage = e.recentDamage.slice(-12);
                }
            }
            if (p && message.type === 'heal' && p.sourceId === game.player.id && p.targetId !== game.player.id) {
                e.allyHealing += Math.max(0, p.amount || 0);
            }
            if (p && message.type === 'ability_result') {
                const counts = p.accepted ? e.casts : e.rejected;
                counts[p.skillName] = (counts[p.skillName] || 0) + 1;
                if (p.accepted) e.lastAcceptedCastAt = performance.now();
            }
            const result = original(message);
            if (message.type === 'state' || message.type === 'delta') {
                const now = performance.now();
                window.__partyClearWarnings = window.__partyClearWarnings
                    .filter(w => w.instance === game.currentInstanceId && now < w.expires + 3000)
                    .map(w => {
                        const observed = observePartyWarning(w, game.player.position, now);
                        if (w.firstSafeAt == null && observed.firstSafeAt != null) e.warningEarlyEscapes++;
                        return observed;
                    });
            }
            e.sawDeath ||= game.player.state === 'DEAD';
            return result;
        };
    });
}

async function seedActor(page, credentials, character) {
    console.log(`[party-clear] prepare ${character.class}: load registration screen`);
    await openGame(page);
    await page.locator('#auth-username').fill(credentials.username);
    await page.locator('#auth-password').fill(credentials.password);
    await page.locator('#auth-email').fill(`${credentials.username}@example.invalid`);
    await page.locator('#btn-register').click();
    await expect(page.locator('#auth-status')).toContainText('Registration successful');
    console.log(`[party-clear] prepare ${character.class}: seed disposable character`);
    const script = `
        if (!db.getSiblingDB('admin').auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) throw Error('Fixture auth failed');
        const result = db.getSiblingDB('eidolon').users.updateOne(
            { username: ${JSON.stringify(credentials.username)}, 'characters.0': { $exists: false } },
            { $set: { characters: [${JSON.stringify(character)}] } });
        if (result.matchedCount !== 1 || result.modifiedCount !== 1) throw Error('Requires newly registered empty account');
    `;
    try {
        execFileSync('docker', ['exec', '-i', process.env.EIDOLON_E2E_BUILD_MONGO_CONTAINER, 'mongosh',
            '--quiet', '--port', process.env.EIDOLON_E2E_BUILD_MONGO_PORT, '--file', '/dev/stdin'],
        { input: script, stdio: ['pipe', 'pipe', 'pipe'], timeout: 20_000 });
    } catch { throw new Error('Disposable party fixture initialization failed'); }
    console.log(`[party-clear] prepare ${character.class}: login and enter world`);
    await loginAndEnterWorld(page, credentials);
    console.log(`[party-clear] prepare ${character.class}: verify replicated build`);
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(character.level);
    expect(await page.evaluate(() => window.game.player.baseStats)).toMatchObject(character.stats);
    const equipped = await page.evaluate(async () => {
        const { partyEquippedItemSnapshot } = await import('/tests/partyDungeonFixture.js');
        return Object.fromEntries(Object.entries(window.game.player.equipment)
            .map(([slot, item]) => [slot, partyEquippedItemSnapshot(item)]));
    });
    for (const [slot, item] of Object.entries(character.equipment)) {
        expect(equipped[slot], `${character.class} must actually wear its prepared ${slot}`).toEqual({
            name: item.name, level: item.level, rarity: item.rarity, stats: item.stats });
    }
    const skills = character.unlocked_skills.slice(1);
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar)).toEqual(expect.arrayContaining(skills));
    await observeRole(page);
}

export async function runGearedPartyRoute({ page, browser, baseURL }, testInfo, { raidType } = {}) {
    const isRaid = Boolean(raidType);
    test.skip(process.env[isRaid ? 'EIDOLON_E2E_PARTY_RAID' : 'EIDOLON_E2E_PARTY_DUNGEON'] !== '1', 'Explicit disposable party diagnostic only');
    test.setTimeout(dungeonExpeditionBudget('party') + 300_000);
    requireIsolatedPartyFixture({ ...process.env, ...(isRaid ? { EIDOLON_E2E_PARTY_DUNGEON: '1' } : {}) });
    const graphicsQuality = partyGraphicsQuality(process.env);
    const gearProfile = partyGearProfile(process.env);
    let playthrough = isRaid ? null : dungeonPlaythroughOptions(process.env);
    const fixtureLevel = isRaid ? 70 : playthrough.runLevel;
    const output = execFileSync('go', ['test', './internal/game', '-run', '^TestPartyBrowserFixtureCatalog$', '-count=1', '-v'], {
        cwd: 'server', env: { ...process.env, EIDOLON_PARTY_FIXTURE_CATALOG: '1',
            EIDOLON_PARTY_FIXTURE_LEVEL: String(fixtureLevel) }, encoding: 'utf8', timeout: 120_000
    });
    const catalog = JSON.parse(output.split('\n').find(line => line.startsWith('[party-fixture-catalog]')).slice(23));
    expect(catalog.level).toBe(fixtureLevel);
    const roles = isRaid ? RAID_PARTY_ROLES : PARTY_ROLES;
    const credentials = credentialsFromEnvironment(), ownedBrowsers = [], actors = [];
    const actorName = (role, index) => `${credentials.username}-${role.toLowerCase()}${isRaid ? `-${index}` : ''}`;
    const raid = isRaid ? raidPartyFixture(catalog, raidType, roles.map(actorName)) : null;
    if (isRaid) {
        expect(gearProfile).toBe('progressed');
        const definition = catalog.raids[raidType];
        playthrough = { dungeonType: raidType, difficulty: 'normal', runLevel: definition.RequiredLevel,
            name: definition.Name, bosses: [definition.Boss] };
    }
    const story = raid || partyDungeonStory(catalog.quests, playthrough.dungeonType);
    const snapshot = actorPage => readPartySnapshot(actorPage, story.chapterId);
    // Preserve the accepted Verdant fixture. Other families explicitly prepare
    // their prerequisites; they are encounter checks, not earned campaigns.
    const quests = playthrough.dungeonType === 'verdant_bastion_catacombs'
        ? JSON.parse(readFileSync('tests/fixtures/earned-wizard-31.json', 'utf8')).quests : story.quests;
    let entered = false, combatWorkers = null, routeFailure = null;
    const healerDecisions = [];
    try {
        for (const [index, className] of roles.entries()) {
            let actorPage = page;
            if (index) {
                const extra = await browser.browserType().launch({ executablePath: process.env.EIDOLON_E2E_BROWSER_PATH || '/usr/bin/google-chrome',
                    headless: true, args: hardwareWebGLBrowserArgs() });
                ownedBrowsers.push(extra);
                actorPage = await (await extra.newContext({ baseURL, viewport: { width: 1280, height: 720 } })).newPage();
            }
            const login = { ...credentials, username: actorName(className, index), characterClass: className };
            // Standalone contexts do not inherit Playwright test fixtures.
            // A hidden login/control must not consume the two-hour expedition
            // allowance. Explicit loading/recovery expectations retain theirs.
            actorPage.setDefaultTimeout(30_000);
            actorPage.setDefaultNavigationTimeout(30_000);
            const actor = { page: actorPage, className, login, failures: collectBrowserFailures(actorPage, baseURL) };
            actors.push(actor);
            const character = raid?.characters[index] || partyDungeonCharacter(catalog, quests, className, login.username, gearProfile);
            await seedActor(actorPage, login, character);
            if (graphicsQuality !== 'high') {
                await actorPage.keyboard.press('Escape');
                await actorPage.locator('#btn-settings').click();
                await actorPage.locator('#graphics-quality').selectOption(graphicsQuality);
                await actorPage.locator('#btn-close-settings').click();
                if (await actorPage.locator('#esc-menu').isVisible()) await actorPage.locator('#btn-resume').click();
            }
            await expect.poll(() => actorPage.evaluate(() => window.game.renderSystem.graphicsQuality)).toBe(graphicsQuality);
            console.log(`[party-clear] ${className} graphics: ${graphicsQuality}`);
            console.log(`[party-clear] prepared ${className}: level${character.level} ${gearProfile} gear, rank5 primary mastery, seeded ${story.chapterId} gate`);
            console.log('[party-loadout]', JSON.stringify({ class: className, profile: gearProfile,
                items: Object.entries(character.equipment).map(([slot, item]) => ({ slot, name: item.name, rarity: item.rarity })) }));
        }
        const [tank, healer] = actors;
        const damage = actors.filter(actor => actor.className === 'Wizard' || actor.className === 'Rogue');
        let formationAnchor = null;
        if (isRaid) await formAndEnterElementalRaid(actors, raidType, { enter: false });
        else {
            await tank.page.locator('body').press('o');
            await expect(tank.page.locator('#social-window')).toBeVisible();
            for (const actor of actors.slice(1)) {
                await tank.page.locator('#party-invite-input').fill(actor.login.username);
                await tank.page.locator('#btn-invite-party').click();
                await expect(actor.page.locator('#party-request-modal')).toBeVisible();
                await actor.page.locator('#btn-accept-party').click();
            }
            await tank.page.locator('body').press('Escape');
            await expect(tank.page.locator('#social-window')).toBeHidden();
        }
        for (const actor of actors) {
            await expect.poll(() => actor.page.evaluate(() => window.game.uiManager.social.partyData?.members?.length)).toBe(roles.length);
            await expect.poll(() => actor.page.evaluate(() => {
                const p = window.game.player;
                return p.stats.hp === p.stats.maxHp && p.stats.mana === p.stats.maxMana;
            })).toBe(true);
            actor.initial = await snapshot(actor.page);
        }
        console.log(`[party-clear] ${roles.length}-member party formed through invitation UI`);
        const tankSelection = healer.page.locator(`#party-list [data-party-support-target=${JSON.stringify(tank.initial.id)}]`);
        await tankSelection.click();
        await expect(tankSelection).toHaveAttribute('aria-pressed', 'true');
        await expect.poll(() => healer.page.evaluate(() => window.game.getDesktopSupportTarget()?.id)).toBe(tank.initial.id);
        await healer.page.screenshot({ path: testInfo.outputPath('desktop-party-healing.png') });
        await healer.page.locator('#party-list .party-support-mode').click();
        expect(await healer.page.evaluate(() => window.game.uiManager.social.selectedSupportTargetId)).toBeNull();
        console.log('[party-clear] visible desktop roster selection and clear verified before combat');

        async function follow(actor, anchor, distance = 4) {
            const state = await snapshot(actor.page);
            const step = partyFollowStep(state, anchor, distance);
            if (!step) return;
            // Same covered-pointer handling as the leader: reread on the next
            // bounded loop, never count a blocked ray as successful movement.
            await tryDungeonGroundStep(() => moveByGroundClick(actor.page, step.dx, step.dz, PARTY_FOLLOW_INPUT_OPTIONS));
        }

        async function avoidWarnings(actor, encounter) {
            const observation = await actor.page.evaluate(async encounter => {
                const planningStartedAt = performance.now();
                const { planPartyTelegraphEscape } = await import('/tests/partyDungeonControls.js');
                const { isEarnedRetreatPathClear, retreatStaysInEncounter } = await import('/tests/wizardHuntControls.js');
                const g = window.game, p = g.player;
                const warnings = window.__partyClearWarnings.filter(w =>
                    w.expires > performance.now() && w.instance === g.currentInstanceId);
                const origin = { x: p.position.x, z: p.position.z, radius: p.radius || 1.25 };
                const bodies = [...g.remotePlayers.values()].filter(other => other !== p && other.id !== p.id &&
                    other.isActive && other.stats && other.state !== 'DEAD' && other.position)
                    .map(other => ({ id: other.id, state: other.state, x: other.position.x, z: other.position.z, radius: other.radius || 1.25 }));
                const step = p.state === 'DEAD' ? null : planPartyTelegraphEscape(origin, warnings, delta =>
                    retreatStaysInEncounter(encounter, { x: p.position.x + delta.x, z: p.position.z + delta.z }, p.radius) &&
                    isEarnedRetreatPathClear(g.collisionManager, p.position, p.radius || 1.25, delta), bodies);
                return { active: warnings.length > 0, step, warnings, origin,
                    plannedAt: performance.now(), planningMs: performance.now() - planningStartedAt,
                    frameAtPlan: Number.isFinite(g.frameCount) ? g.frameCount : null,
                    renderSample: { actors: g.remotePlayers.size,
                        geometries: g.renderSystem.renderer?.info.memory.geometries,
                        textures: g.renderSystem.renderer?.info.memory.textures,
                        calls: g.renderSystem.renderer?.info.render.calls }, bodies,
                    safe: warnings.every(w => Math.hypot(p.position.x - w.x, p.position.z - w.z) >= w.radius + 1.5) };
            }, encounter);
            if (!observation.active) return partyWarningInputPolicy(observation);
            observation.inputTiming = [];
            if (observation.step) {
                const moved = await tryDungeonGroundStep(() => moveByGroundClick(actor.page,
                    observation.step.x, observation.step.z, { ...PARTY_FOLLOW_INPUT_OPTIONS,
                        allowAlternatePaths: false, requireClearPath: true, batchPreparation: true, timeout: 1500,
                        onTiming: phase => observation.inputTiming.push(phase) }));
                if (moved) observation.safe = await actor.page.evaluate(warnings => {
                    const p = window.game.player.position, e = window.__partyClearEvidence;
                    e.warningMoves++;
                    const safe = warnings.every(w => Math.hypot(p.x - w.x, p.z - w.z) >= w.radius + 1.5);
                    if (safe) e.warningEscapes++;
                    return safe;
                }, observation.warnings);
            }
            await actor.page.evaluate(observation => {
                const p = window.game.player, e = window.__partyClearEvidence;
                e.recentEscapes.push({ origin: observation.origin, step: observation.step,
                    inputTiming: observation.inputTiming,
                    planningMs: observation.planningMs, frameAtPlan: observation.frameAtPlan,
                    frameAfterInput: Number.isFinite(window.game.frameCount) ? window.game.frameCount : null,
                    renderSample: observation.renderSample,
                    bodies: observation.bodies, elapsed: performance.now() - observation.plannedAt,
                    after: { x: p.position.x, z: p.position.z, dead: p.state === 'DEAD',
                        blockedStops: p.movementMetrics?.blockedStops || 0 },
                    safe: observation.safe, warnings: observation.warnings.map(w => ({ x: w.x, z: w.z,
                        radius: w.radius, msUntilImpact: w.expires - performance.now() })) });
                if (e.recentEscapes.length > 12) e.recentEscapes.shift();
            }, observation);
            // Do not immediately select the boss and walk back into its warning.
            // The normal combat/death/connection deadlines remain unchanged.
            return partyWarningInputPolicy(observation);
        }

        async function healParty({ allowMovement = true } = {}, support = healer) {
            const healer = support, healerIndex = actors.indexOf(healer);
            const states = await Promise.all(actors.map(actor => snapshot(actor.page)));
            const available = await healer.page.evaluate(() => {
                const p = window.game.player;
                return { index: p.hotbar.indexOf('Healing Light'), cooldown: p.cooldowns['Healing Light'] || 0, mana: p.stats.mana,
                    healRange: window.game.abilityController.getAbilityCastRange('Healing Light'),
                    aura: p.hotbar.indexOf('Guardian Embrace'), auraCooldown: p.cooldowns['Guardian Embrace'] || 0,
                    auraRadius: p.guardianEmbraceRadius || 10,
                    auraActive: p.guardianEmbraceActive || p.guardianEmbraceTimer > 0 };
            });
            const healDistance = Math.min(14, available.healRange - .5);
            const hurt = selectPartyHealTarget(states, states[healerIndex], healDistance, { allowApproach: allowMovement });
            if (!hurt) { if (allowMovement && !states[healerIndex].dead) await follow(healer, states[0], 9); return; }
            const distance = Math.hypot(hurt.x - states[healerIndex].x, hurt.z - states[healerIndex].z);
            const record = async reason => {
                const pointer = await healer.page.evaluate(id => ({
                    observedAtMs: Date.now(),
                    selectedSupportTargetId: window.game.uiManager.social.selectedSupportTargetId,
                    resolvedSupportTargetId: window.game.getDesktopSupportTarget()?.id || null,
                    targetLoaded: window.game.remotePlayers.has(id),
                    hoveredType: window.game.hoveredEntity?.constructor?.name || null,
                    hoveringAlly: window.game.hoveredEntity?.id === id,
                    focus: document.activeElement?.tagName || null
                }), hurt.id);
                healerDecisions.push({ reason, distance, hurtRole: actors[states.indexOf(hurt)].className,
                    hp: hurt.hp, maxHP: hurt.maxHP, healerX: states[healerIndex].x, healerZ: states[healerIndex].z,
                    party: states.map((state, index) => ({ role: actors[index].className, hp: state.hp,
                        maxHP: state.maxHP, dead: state.dead, sameInstance: state.instance === states[healerIndex].instance,
                        distance: Math.hypot(state.x - states[healerIndex].x, state.z - states[healerIndex].z) })),
                    ...available, ...pointer });
                if (healerDecisions.length > 20) healerDecisions.shift();
            };
            if (distance > healDistance) {
                await record(allowMovement ? 'approach' : 'warning-hold-out-of-range');
                if (allowMovement) await follow(healer, hurt, 7);
                return;
            }
            const auraSpacing = partyAuraFollowSpacing(states[healerIndex], hurt, { ...available, allowMovement });
            if (auraSpacing !== null) {
                await record(available.auraActive ? 'maintain-active-aura' : 'approach-ready-aura');
                await follow(healer, hurt, auraSpacing);
                return;
            }
            // Use the unlocked ten-unit healing aura for sustained group
            // damage, but do not delay an available critical direct heal.
            if (distance <= 9 && (hurt.hp / hurt.maxHP >= .55 || available.cooldown > 0) && available.aura >= 0 &&
                available.auraCooldown <= 0 && !available.auraActive && available.mana >= 65) {
                const self = await projectGroundOffset(healer.page, 0, 0);
                if (self?.canvas) {
                    await healer.page.mouse.move(self.x, self.y);
                    await record('aura-key');
                    await healer.page.keyboard.press(String(available.aura + 1));
                    return;
                }
            }
            if (available.index < 0 || available.cooldown > 0 || available.mana < 25) { await record('heal-unavailable'); return; }
            // Ordinary visible roster selection, then the hotbar key. Enemy
            // silhouettes must not redirect a deliberately chosen party heal.
            const targetButton = healer.page.locator(`#party-list [data-party-support-target=${JSON.stringify(hurt.id)}]`);
            await targetButton.click();
            await expect(targetButton).toHaveAttribute('aria-pressed', 'true');
            await record('heal-key');
            await healer.page.keyboard.press(String(available.index + 1));
        }

        async function spaceRangedRole(actor, target) {
            const support = await healer.page.evaluate(() => ({ id: window.game.player.id,
                range: Math.min(14, window.game.abilityController.getAbilityCastRange('Healing Light') - .5) }));
            const plan = await actor.page.evaluate(async ({ id, encounter, support }) => {
                const { planPartyRangedSpacing } = await import('/tests/partyRangedSpacing.js');
                const { isEarnedRetreatPathClear, retreatStaysInEncounter } = await import('/tests/wizardHuntControls.js');
                const g = window.game, p = g.player, enemy = g.remotePlayers.get(id), healer = g.remotePlayers.get(support.id);
                const live = entity => entity?.isActive && entity.stats && entity.state !== 'DEAD' && entity.position;
                // A new warning may arrive since the role's earlier safety read.
                if (p.state === 'DEAD' || !live(enemy) || !live(healer) ||
                    window.__partyClearWarnings.some(w => w.expires > performance.now() && w.instance === g.currentInstanceId)) return null;
                const origin = { x: p.position.x, z: p.position.z, radius: p.radius || 1.25 };
                const target = { x: enemy.position.x, z: enemy.position.z, range: g.getBasicAttackRangeForEntity(enemy) };
                const healing = { x: healer.position.x, z: healer.position.z, range: support.range };
                const bodies = [...g.remotePlayers.values()].filter(live)
                    .map(other => ({ id: other.id, state: other.state, x: other.position.x, z: other.position.z, radius: other.radius || 1.25 }));
                const step = planPartyRangedSpacing(origin, target, healing, delta =>
                    retreatStaysInEncounter(encounter, { x: origin.x + delta.dx, z: origin.z + delta.dz }, origin.radius) &&
                    isEarnedRetreatPathClear(g.collisionManager, p.position, origin.radius, { x: delta.dx, z: delta.dz }), bodies);
                return step && { origin, target, healing, step, bodies, actorState: p.state, instanceId: g.currentInstanceId };
            }, { id: target.id, encounter: target.encounter, support });
            if (!plan) return false;
            let moved = false, failure = null;
            try {
                moved = await tryDungeonGroundStep(() => moveByGroundClick(actor.page, plan.step.dx, plan.step.dz,
                    { ...PARTY_FOLLOW_INPUT_OPTIONS, allowAlternatePaths: false, requireClearPath: true, timeout: 1500,
                        arrival: partyFormationArrival(plan.origin, plan.step, plan.instanceId) }));
            } catch (error) {
                failure = error;
                throw error; // An issued input failure remains fatal, never a successful retreat.
            } finally {
                // Earlier evidence retained only successful moves, losing the
                // actual failed plan and body geometry at the point of failure.
                const capture = actor.page.evaluate(({ plan, moved, failure }) => {
                    const g = window.game, p = g.player, records = window.__partyClearEvidence.recentRangedSpacing;
                    const bodiesAfter = [...g.remotePlayers.values()].filter(other => other.isActive && other.position &&
                        Math.hypot(other.position.x - p.position.x, other.position.z - p.position.z) < 30)
                        .map(other => ({ id: other.id, state: other.state, x: other.position.x, z: other.position.z, radius: other.radius || 1.25 }));
                    records.push({ ...plan, moved, failure, bodiesAfter, at: Date.now(),
                        after: { x: p.position.x, z: p.position.z, state: p.state, dead: p.state === 'DEAD' } });
                    if (records.length > 20) records.shift();
                }, { plan, moved, failure: failure?.message?.slice(0, 1500) || null });
                // If the page itself closed, preserve the original movement
                // exception rather than replacing it with a diagnostic error.
                if (failure) await capture.catch(() => {});
                else await capture;
            }
            return moved; // The next serial role step rereads warnings/range before attacking.
        }

        async function actCombatRole(actor, policy, target) {
            if (actor.className === 'Cleric') return healParty({ allowMovement: policy.allowApproach }, actor);
            if (isRaid && policy.allowApproach && await stepRaidVigilInput(actor.page, actors.indexOf(actor))) return;
            const tankEngaged = partyTankHasEngaged(await tank.page.evaluate(() => ({
                damageByTarget: window.__partyClearEvidence.damageByTarget
            })), target.id);
            if (!tankEngaged) return; // Wait for a real tank hit, not just movement.
            if (policy.allowApproach && await spaceRangedRole(actor, target)) return;
            const enemy = await actor.page.evaluate(id => {
                const g = window.game, p = g.player, e = g.remotePlayers.get(id);
                return e && e.state !== 'DEAD' ? { distance: p.position.distanceTo(e.position),
                    range: g.abilityController.getAbilityCastRange(), cooldown: p.abilityCooldown,
                    dead: p.state === 'DEAD', mana: p.stats.mana, healthRatio: p.stats.hp / p.stats.maxHp,
                    hotbar: p.hotbar, unlockedSkills: p.unlockedSkills, cooldowns: p.cooldowns,
                    shieldActive: p.arcaneShieldActive, poisonActive: p.poisonCoatingActive,
                    sinceCastMs: performance.now() - window.__partyClearEvidence.lastAcceptedCastAt,
                    costs: Object.fromEntries(['Arcane Shield', 'Poison Coating'].map(skill =>
                        [skill, g.abilityController.getConfiguredManaCost(skill)])) } : null;
            }, target.id);
            if (!enemy) return;
            const buff = selectPartyDamageBuff({ ...enemy, className: actor.className });
            if (buff) {
                const self = await projectGroundOffset(actor.page, 0, 0);
                if (self?.canvas) {
                    await actor.page.mouse.move(self.x, self.y);
                    await actor.page.keyboard.press(buff.key);
                    return;
                }
            }
            const point = await projectEntity(actor.page, target.id);
            if (!point?.visible) {
                if (policy.allowApproach) await follow(actor, await snapshot(tank.page), 8);
                return;
            }
            const clicks = await attackPartyDamageTarget({
                project: (id, hitboxPoint) => projectEntity(actor.page, id, hitboxPoint),
                move: (x, y) => actor.page.mouse.move(x, y),
                settle: () => actor.page.waitForTimeout(60),
                hoveredId: () => actor.page.evaluate(() => window.game.hoveredEntity?.id),
                read: id => actor.page.evaluate(id => {
                    const g = window.game, p = g.player, e = g.remotePlayers.get(id);
                    const warnings = window.__partyClearWarnings.filter(w =>
                        w.expires > performance.now() && w.instance === g.currentInstanceId);
                    return { alive: p.state !== 'DEAD' && Boolean(e?.isActive && e.state !== 'DEAD'),
                        distance: e ? Math.hypot(p.position.x - e.position.x, p.position.z - e.position.z) : null,
                        range: g.abilityController.getAbilityCastRange(), cooldown: p.abilityCooldown,
                        allowApproach: warnings.length === 0,
                        allowCasts: warnings.every(w => Math.hypot(p.position.x - w.x, p.position.z - w.z) >= w.radius + 1.5) };
                }, id),
                click: async button => {
                    await actor.page.mouse.down({ button });
                    await actor.page.mouse.up({ button });
                }
            }, target.id);
            await actor.page.evaluate(({ id, clicks }) => {
                const g = window.game, p = g.player, e = g.remotePlayers.get(id);
                const records = window.__partyClearEvidence.recentAttackInputs;
                records.push({ clicks, hovered: g.hoveredEntity?.id === id,
                    distance: e ? Math.hypot(p.position.x - e.position.x, p.position.z - e.position.z) : null,
                    basicRange: e ? g.getBasicAttackRangeForEntity(e) : null,
                    pendingTarget: g.pendingInteraction?.id === id,
                    moveTarget: p.targetPosition ? { x: p.targetPosition.x, z: p.targetPosition.z } : null });
                if (records.length > 12) records.shift();
            }, { id: target.id, clicks });
        }

        let currentTarget, bossStart;
        let townRests = 0;
        await playDungeonThroughInputs(tank.page, { playthrough, expeditionProfile: 'party',
            ...(isRaid ? { runInstance: async (actorPage, { beforeExit }) => {
                await enterElementalRaid(actorPage, raidType);
                let failure;
                try { await beforeExit(); } catch (error) { failure = error; }
                if (!failure) await returnToTown(actorPage, { allowRespawn: false });
                if (failure) throw failure;
            } } : {}),
            // Every member and this party were just created. There is no prior
            // instance to discard (and no active-run confirmation dialog).
            resetRun: false,
            // Walk the short return from a12.5-unit quake instead of spending
            //20mana on Charge every cycle; retain it for real opening gaps.
            minimumChargeDistance: 18,
            requiredFighterSkills: ['Iron Fortress', 'Whirlwind', 'Shield Slam'],
            afterEntry: async () => {
                entered = true;
                const run = await snapshot(tank.page);
                formationAnchor = { x: run.x, z: run.z };
                for (const actor of actors) {
                    await expect.poll(async () => (await snapshot(actor.page)).instance).toBe(run.instance);
                    await expect.poll(async () => (await snapshot(actor.page)).seed).toBe(run.seed);
                }
                console.log(`[party-clear] all ${roles.length} entered the same ${playthrough.difficulty} ${playthrough.name} instance`);
            },
            afterGroundStep: async () => {
                // The base movement helper proves displacement, not arrival.
                // Finish this waypoint before deciding where followers gather.
                await expect.poll(() => tank.page.evaluate(() => !window.game.player.targetPosition),
                    { timeout: 5000 }).toBe(true);
                const formationTrace = [];
                try {
                    await gatherPartyFormation({ read: () => Promise.all(actors.map(actor => snapshot(actor.page))),
                        trace: entry => {
                            formationTrace.push(entry);
                            if (formationTrace.length > 32) formationTrace.shift();
                        },
                        plan: (index, _state, anchor, spacing) => actors[index].page.evaluate(async ({ anchor, previous, spacing, slot }) => {
                            const { partyFormationStep, partyPathAvoidsActors, partyFormationArrival,
                                PartyFormationRouteUnavailable } = await import('/tests/partyDungeonControls.js');
                            const { isEarnedRetreatPathClear } = await import('/tests/wizardHuntControls.js');
                            const g = window.game, p = g.player;
                            const bodies = [...g.remotePlayers.values()].filter(other => other !== p && other.id !== p.id &&
                                other.isActive && other.stats && other.state !== 'DEAD' && other.position)
                                .map(other => ({ x: other.position.x, z: other.position.z, radius: other.radius || 1.25 }));
                            let step;
                            try {
                                step = partyFormationStep(p.position, anchor, previous, (step, from) => {
                                    const origin = p.position.clone();
                                    origin.x = from.x;
                                    origin.z = from.z;
                                    return partyPathAvoidsActors(origin, step, bodies, p.radius || 1.25) &&
                                        isEarnedRetreatPathClear(g.collisionManager, origin, p.radius || 1.25,
                                            { x: step.dx, z: step.dz });
                                }, spacing, slot, bodies);
                            } catch (error) {
                                // Another follower can be blocking this member's only
                                // exit. Move clear lanes first, then read and replan;
                                // null never counts as arrival or bypasses the deadline.
                                if (error instanceof PartyFormationRouteUnavailable) return null;
                                throw error;
                            }
                            return step && { ...step, origin: { x: p.position.x, z: p.position.z, radius: p.radius || 1.25 },
                                arrival: partyFormationArrival(p.position, step, anchor.instance) };
                        }, { anchor: { x: anchor.x, z: anchor.z, instance: anchor.instance }, previous: formationAnchor,
                            spacing, slot: [Math.PI / 3, -Math.PI / 3, 0][index - 1] }),
                        move: async (index, step) => {
                            await tryDungeonGroundStep(() => moveByGroundClick(actors[index].page,
                                step.dx, step.dz, { ...PARTY_FOLLOW_INPUT_OPTIONS, allowAlternatePaths: false,
                                    requireClearPath: true, arrival: step.arrival }));
                            await expect.poll(() => actors[index].page.evaluate(() => !window.game.player.targetPosition),
                                { timeout: 5000 }).toBe(true);
                        } });
                } catch (error) {
                    const positions = await Promise.all(actors.map(async actor => ({ role: actor.className,
                        ...await actor.page.evaluate(() => {
                            const g = window.game, p = g.player;
                            return { x: p.position.x, z: p.position.z, state: p.state,
                                target: p.targetPosition ? { x: p.targetPosition.x, z: p.targetPosition.z } : null,
                                meshOffset: Math.hypot(p.mesh.position.x - p.position.x, p.mesh.position.z - p.position.z),
                                cameraOffset: Math.hypot(g.renderSystem.cameraTarget.x - p.position.x,
                                    g.renderSystem.cameraTarget.z - p.position.z),
                                cameraPunch: Boolean(g.renderSystem.cameraPunch),
                                nearbyActors: [...g.remotePlayers.values()].filter(other => other.isActive && other.stats &&
                                    other.state !== 'DEAD' && other.position && other.position.distanceTo(p.position) < 24)
                                    .map(other => ({ role: other.constructor.name, x: other.position.x, z: other.position.z,
                                        radius: other.radius || 1.25 })),
                                blockedStops: p.movementMetrics?.blockedStops || 0 };
                        }) })));
                    console.log('[party-formation-failure]', JSON.stringify({ previousAnchor: formationAnchor, positions, formationTrace }));
                    throw error;
                }
                const arrived = await snapshot(tank.page);
                formationAnchor = { x: arrived.x, z: arrived.z };
            },
            recoverAfterRoom: async (_page, { roomIndex, nearbyHostiles }) => {
                const states = await Promise.all(actors.map(actor => snapshot(actor.page)));
                if (!partyDungeonRestNeeded(states, { nearbyHostiles, townRests, expectedMembers: roles.length,
                    cleared: states[0].rooms.find(room => room.index === roomIndex)?.cleared })) return false;
                const progress = actorPage => actorPage.evaluate(async () => {
                    const { dungeonRestSnapshot } = await import('/tests/dungeonRestSnapshot.js');
                    return dungeonRestSnapshot(window.game);
                });
                const before = await Promise.all(actors.map(actor => progress(actor.page)));
                await Promise.all(actors.map(actor => returnToTown(actor.page, { allowRespawn: false })));
                for (const actor of actors) await expect.poll(async () => {
                    const s = await snapshot(actor.page);
                    return !s.dead && s.hp === s.maxHP && s.mana === s.maxMana;
                }, { timeout: 15_000 }).toBe(true);
                console.log('[party-clear-rest-guide]', JSON.stringify({ roomIndex, role: tank.className, phase: 'resume-leader' }));
                if (isRaid) await enterElementalRaid(tank.page, raidType);
                else await enterDungeon(tank.page, { ...playthrough, useTownGuide: true, resetRun: false });
                for (const [index, actor] of actors.entries()) {
                    // A fresh start moves the group; resuming intentionally
                    // moves only the requester. Each member uses the guide.
                    if ((await snapshot(actor.page)).instance !== states[index].instance) {
                        console.log('[party-clear-rest-guide]', JSON.stringify({ roomIndex, role: actor.className, phase: 'resume-member' }));
                        if (isRaid) await enterElementalRaid(actor.page, raidType);
                        else await enterDungeon(actor.page, { ...playthrough, useTownGuide: true, resetRun: false });
                    }
                    await expect.poll(async () => (await snapshot(actor.page)).instance).toBe(states[index].instance);
                    await expect.poll(() => progress(actor.page)).toEqual(before[index]);
                }
                townRests++;
                const resumed = await snapshot(tank.page);
                formationAnchor = { x: resumed.x, z: resumed.z };
                console.log('[party-clear-rest]', JSON.stringify({ roomIndex, townRests,
                    spent: states.map(s => ({ hp: s.hp, mana: s.mana })), allMembersRecovered: roles.length,
                    sameSeedRoomsGoldInventoryAndQuests: true }));
                return true; // Existing driver rewalks the real cleared route.
            },
            beforeCombat: async (_page, target) => {
                // Start the Fighter's ordinary driver first; movement alone
                // is not an opener, so DPS also waits for a damage receipt.
                if (currentTarget !== target.id) {
                    if (combatWorkers) await combatWorkers.stop();
                    currentTarget = target.id;
                    bossStart = playthrough.bosses.includes(target.type) ? await Promise.all(actors.map(actor => snapshot(actor.page))) : null;
                    if (bossStart) await tank.page.screenshot({ path: testInfo.outputPath(`party-boss-${target.type}.png`) });
                    combatWorkers = startPartyCombatWorkers(actors.slice(1),
                        actor => runPartyRoleInputs([actor],
                            role => avoidWarnings(role, target.encounter),
                            (role, policy) => actCombatRole(role, policy, target)),
                        actor => actor.page.waitForTimeout(60));
                    return false;
                }
                combatWorkers.check();
                // The Fighter remains owned by the leader driver; other roles
                // observe and act independently, with one input loop per browser.
                const health = await observePartyCombatHealth(actors, actor => actor.page.evaluate(async () => {
                    const { partyCombatHealthSnapshot } = await import('/tests/partyCombatHealth.js');
                    return partyCombatHealthSnapshot(window.game, window.__partyClearEvidence, performance.now());
                }));
                for (const [index, actor] of actors.entries()) {
                    const status = health[index];
                    if (status.dead || status.sawDeath) {
                        const state = await snapshot(actor.page);
                        const cleric = await snapshot(healer.page);
                        console.log('[party-clear-death]', JSON.stringify({ role: actor.className, boss: target.type,
                            healerDistance: Math.hypot(state.x - cleric.x, state.z - cleric.z),
                            healerMana: cleric.mana, healerCasts: cleric.evidence.casts,
                            bossAllyHealing: bossStart ? cleric.evidence.allyHealing - bossStart[1].evidence.allyHealing : null }));
                    }
                    expect(status.dead || status.sawDeath, `${actor.className} must survive; inspect party evidence if not`).toBe(false);
                    expect(status.updateAge).toBeGreaterThanOrEqual(0);
                    expect(status.updateAge).toBeLessThan(10_000);
                }
                // Check current warnings after observation, immediately before
                // returning control to the sole Fighter input owner.
                const tankPolicy = await avoidWarnings(tank, target.encounter);
                if (tankPolicy.holdMelee) await tank.page.waitForTimeout(60);
                return tankPolicy.holdMelee;
            },
            afterEncounter: async (_page, target) => {
                await combatWorkers?.stop();
                combatWorkers = null;
                if (playthrough.bosses.includes(target.type)) {
                    const end = await Promise.all(actors.map(actor => snapshot(actor.page)));
                    console.log('[party-clear-boss]', JSON.stringify({ boss: target.type,
                        roles: end.map((state, index) => ({ role: actors[index].className,
                            damage: state.evidence.damageDone - bossStart[index].evidence.damageDone,
                            taken: state.evidence.damageTaken - bossStart[index].evidence.damageTaken,
                            allyHealing: state.evidence.allyHealing - bossStart[index].evidence.allyHealing })) }));
                }
            },
            afterClearedRoute: async (_page, controls) => {
                if (isRaid) {
                    const chamber = await tank.page.evaluate(() => window.game.currentDungeonLayout.rooms.at(-1));
                    const encounter = { x: chamber.x, z: chamber.z, width: chamber.width, height: chamber.height };
                    const deadline = Date.now() + 15 * 60_000;
                    let restored = false;
                    while (Date.now() < deadline) {
                        controls.assertActive();
                        const status = await tank.page.evaluate(() => {
                            const g = window.game;
                            return { crystal: g.currentDungeonRoomState?.crystal,
                                enemies: [...g.remotePlayers.values()].filter(e => g.isHostileActorTarget(e) &&
                                    e.isActive && e.state !== 'DEAD' && (e.health ?? e.stats?.hp) > 0)
                                    .map(e => ({ id: e.id, type: e.subType || e.constructor.name,
                                        health: e.health ?? e.stats?.hp, x: e.position.x, z: e.position.z,
                                        distance: e.position.distanceTo(g.player.position) }))
                                    .sort((a, b) => a.distance - b.distance) };
                        });
                        if (status.crystal?.stage === 'restored') { restored = true; break; }
                        if (status.enemies.length) {
                            await controls.fight({ ...status.enemies[0], encounter });
                        } else {
                            await combatWorkers?.stop();
                            combatWorkers = null;
                            currentTarget = null;
                            // Keep the living group inside the ritual chamber while
                            // runners follow actual markers. Do not fake channel time.
                            const tankPolicy = await avoidWarnings(tank, encounter);
                            if (tankPolicy.allowApproach) await follow(tank, { x: chamber.x + 24, z: chamber.z }, 2);
                            await Promise.all(actors.slice(1).map(actor => runPartyRoleInputs([actor],
                                role => avoidWarnings(role, encounter), async (role, policy) => {
                                    if (role.className === 'Cleric') return healParty({ allowMovement: policy.allowApproach }, role);
                                    if (policy.allowApproach && !await stepRaidVigilInput(role.page, actors.indexOf(role))) {
                                        await follow(role, await snapshot(tank.page), 8);
                                    }
                                })));
                            await tank.page.waitForTimeout(350);
                        }
                        for (const actor of actors) {
                            const state = await snapshot(actor.page);
                            expect(state.dead || state.evidence.sawDeath, 'raid defense must not hide a death').toBe(false);
                            expect(await actor.page.evaluate(() => performance.now() - window.__partyClearEvidence.lastUpdate),
                                'raid defense requires current authoritative updates').toBeLessThan(10_000);
                        }
                    }
                    expect(restored, 'complete all three defended ritual waves within the same expedition').toBe(true);
                    for (const actor of actors) {
                        await expect.poll(() => actor.page.evaluate(() => window.game.currentDungeonRoomState?.crystal?.stage)).toBe('restored');
                        await expect.poll(async () => (await snapshot(actor.page)).evidence.repairStages)
                            .toEqual(expect.arrayContaining(['1:wave_clear', '2:wave_clear', '3:wave_clear', '3:complete']));
                    }
                    await tank.page.screenshot({ path: testInfo.outputPath('raid-crystal-restored.png') });
                    console.log(`[raid-clear] ${raidType}: all three defended waves and all five restoration receipts observed`);
                }
                for (const actor of actors) {
                    await expect.poll(async () => (await snapshot(actor.page)).quest?.count).toBeGreaterThan(0);
                    const state = await snapshot(actor.page);
                    expect(state.quest.completed, 'manual wizard turn-in must remain unclaimed').toBe(false);
                    expect(state.gold).toBeGreaterThan(actor.initial.gold);
                    expect(state.level > actor.initial.level || state.xp > actor.initial.xp ||
                        state.resonanceLevel > actor.initial.resonanceLevel ||
                        state.resonanceXP > actor.initial.resonanceXP).toBe(true);
                    expect(state.rooms.every(room => room.cleared || room.type === 'start')).toBe(true);
                }
                expect((await snapshot(tank.page)).evidence.damageTaken).toBeGreaterThan(0);
                // A second Cleric can land the first effective heal. Prove real
                // healing by the support role without requiring overhealing by
                // whichever healer happened to be first in the fixture.
                const supportStates = await Promise.all(actors.filter(actor => actor.className === 'Cleric')
                    .map(actor => snapshot(actor.page)));
                expect(supportStates.reduce((sum, state) => sum + state.evidence.allyHealing, 0)).toBeGreaterThan(0);
                for (const actor of damage) expect((await snapshot(actor.page)).evidence.damageDone).toBeGreaterThan(0);
            }
        });
        for (const actor of actors.slice(1)) await returnToTown(actor.page, { allowRespawn: false });
        for (const [index, actor] of actors.entries()) {
            actor.combatEvidence = (await snapshot(actor.page)).evidence;
            await claimChapterAndContinue(actor.page, story.chapterId);
            await verifyNextStoryOffer(actor.page, story);
            await actor.page.locator('#btn-close-quest').click();
            actor.claimedChapter = await readChronicleChapter(actor.page, story.chapterId);
            actor.claimedGold = (await snapshot(actor.page)).gold;
            for (const waiting of actors.slice(index + 1)) {
                expect((await readChronicleChapter(waiting.page, story.chapterId)).completed,
                    'Another member turning in must not claim this player’s reward').toBe(false);
            }
            console.log(`[party-clear-turn-in] ${actor.className}: manual reward and ${story.nextChapterId} offer verified`);
        }
        for (const actor of actors) {
            await loginAndEnterWorld(actor.page, actor.login);
            expect(await readChronicleChapter(actor.page, story.chapterId)).toEqual(actor.claimedChapter);
            expect((await snapshot(actor.page)).gold, 'Relogging must neither lose nor duplicate the reward').toBe(actor.claimedGold);
            await verifyNextStoryOffer(actor.page, story);
            console.log(`[party-clear-relogin] ${actor.className}: personal chapter, reward and next offer persisted`);
        }
        for (const actor of actors) expect(actor.failures, `${actor.className} browser failures`).toEqual([]);
    } catch (error) {
        routeFailure = error;
    } finally {
        try { await combatWorkers?.stop(); } catch (error) { routeFailure ||= error; }
        console.log('[party-healer-decisions]', JSON.stringify(healerDecisions));
        for (const actor of actors) {
            try {
                const s = await snapshot(actor.page);
                console.log('[party-clear-result]', JSON.stringify({ class: actor.className, entered, level: s.level,
                    hp: s.hp, mana: s.mana, dead: s.dead, gold: s.gold, render: s.render,
                    quest: s.quest, evidence: s.evidence || actor.combatEvidence }));
            } catch { /* Browser may already have closed on interruption. */ }
        }
        await Promise.all(ownedBrowsers.map(extra => extra.close()));
    }
    if (routeFailure) throw routeFailure;
}
