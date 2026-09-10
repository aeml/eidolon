import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PARTY_ROLES, partyDungeonCharacter, requireIsolatedPartyFixture } from '../partyDungeonFixture.js';
import { dungeonPlaythroughOptions } from '../dungeonPlaythroughCatalog.js';
import { gatherPartyFormation, PARTY_FOLLOW_INPUT_OPTIONS, partyFollowStep, partyWarningInputPolicy } from '../partyDungeonControls.js';
import { tryDungeonGroundStep } from '../dungeonNavigationInput.js';
import { playDungeonThroughInputs } from './dungeon-playthrough-route.js';
import { hardwareWebGLBrowserArgs } from './browserLaunchPolicy.js';
import { claimChapterAndContinue, EARTH_DUNGEON_CHAPTER, readChronicleChapter } from './chronicle-earth-route.js';
import { verifyFreshWaterHandoff } from './chronicle-water-handoff.js';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, openGame,
    enterDungeon, moveByGroundClick, projectEntity, projectGroundOffset, returnToTown } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const snapshot = page => page.evaluate(() => {
    const g = window.game, p = g.player;
    return { id: p.id, instance: g.currentInstanceId, seed: g.currentDungeonLayout?.generationSeed,
        x: p.position.x, z: p.position.z, hp: p.stats.hp, maxHP: p.stats.maxHp,
        mana: p.stats.mana, maxMana: p.stats.maxMana, dead: p.state === 'DEAD',
        gold: p.gold, xp: p.xp, level: p.level, stats: p.baseStats, hotbar: p.hotbar,
        quest: p.quests?.find(q => q.id === 'chronicle_03_roots_remember'),
        rooms: g.currentDungeonRoomState?.rooms, evidence: window.__partyClearEvidence };
});

async function observeRole(page) {
    await page.evaluate(() => {
        const game = window.game, original = game.handleServerMessage.bind(game);
        const e = window.__partyClearEvidence = { damageDone: 0, damageTaken: 0, allyHealing: 0,
            casts: {}, rejected: {}, sawDeath: false, warningMoves: 0, warningEscapes: 0,
            lastUpdate: performance.now() };
        window.__partyClearWarnings = [];
        game.handleServerMessage = message => {
            const p = message.payload;
            if (p && message.type === 'telegraph' && [p.x, p.z, p.radius, p.duration].every(Number.isFinite)) {
                window.__partyClearWarnings = window.__partyClearWarnings.filter(w => w.expires > performance.now());
                window.__partyClearWarnings.push({ x: p.x, z: p.z, radius: p.radius,
                    instance: game.currentInstanceId, expires: performance.now() + p.duration * 1000 });
            }
            if (message.type === 'state' || message.type === 'delta') e.lastUpdate = performance.now();
            if (p && message.type === 'damage') {
                if (p.sourceId === game.player.id) e.damageDone += Math.max(0, p.amount || 0);
                if (p.targetId === game.player.id) e.damageTaken += Math.max(0, p.amount || 0);
            }
            if (p && message.type === 'heal' && p.sourceId === game.player.id && p.targetId !== game.player.id) {
                e.allyHealing += Math.max(0, p.amount || 0);
            }
            if (p && message.type === 'ability_result') {
                const counts = p.accepted ? e.casts : e.rejected;
                counts[p.skillName] = (counts[p.skillName] || 0) + 1;
            }
            const result = original(message);
            e.sawDeath ||= game.player.state === 'DEAD';
            return result;
        };
    });
}

async function seedActor(page, credentials, character) {
    await openGame(page);
    await page.locator('#auth-username').fill(credentials.username);
    await page.locator('#auth-password').fill(credentials.password);
    await page.locator('#auth-email').fill(`${credentials.username}@example.invalid`);
    await page.locator('#btn-register').click();
    await expect(page.locator('#auth-status')).toContainText('Registration successful');
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
    await loginAndEnterWorld(page, credentials);
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(30);
    expect(await page.evaluate(() => window.game.player.baseStats)).toMatchObject(character.stats);
    const skills = character.unlocked_skills.slice(1);
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar)).toEqual(expect.arrayContaining(skills));
    await observeRole(page);
}

test('four level30 roles clear Normal Verdant through real party inputs and receive individual credit', async ({ page, browser, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_PARTY_DUNGEON !== '1', 'Explicit disposable four-player diagnostic only');
    test.setTimeout(2_700_000);
    requireIsolatedPartyFixture(process.env);
    const output = execFileSync('go', ['test', './internal/game', '-run', '^TestPartyBrowserFixtureCatalog$', '-count=1', '-v'], {
        cwd: 'server', env: { ...process.env, EIDOLON_PARTY_FIXTURE_CATALOG: '1' }, encoding: 'utf8', timeout: 120_000
    });
    const catalog = JSON.parse(output.split('\n').find(line => line.startsWith('[party-fixture-catalog]')).slice(23));
    const quests = JSON.parse(readFileSync('tests/fixtures/earned-wizard-31.json', 'utf8')).quests;
    const credentials = credentialsFromEnvironment(), ownedBrowsers = [], actors = [];
    const playthrough = dungeonPlaythroughOptions({});
    let entered = false;
    const healerDecisions = [];
    try {
        for (const [index, className] of PARTY_ROLES.entries()) {
            let actorPage = page;
            if (index) {
                const extra = await browser.browserType().launch({ executablePath: process.env.EIDOLON_E2E_BROWSER_PATH || '/usr/bin/google-chrome',
                    headless: true, args: hardwareWebGLBrowserArgs() });
                ownedBrowsers.push(extra);
                actorPage = await (await extra.newContext({ baseURL, viewport: { width: 1280, height: 720 } })).newPage();
            }
            const login = { ...credentials, username: `${credentials.username}-${className.toLowerCase()}`, characterClass: className };
            const actor = { page: actorPage, className, login, failures: collectBrowserFailures(actorPage, baseURL) };
            actors.push(actor);
            await seedActor(actorPage, login, partyDungeonCharacter(catalog, quests, className, login.username));
            console.log(`[party-clear] prepared ${className}: level30 common gear, rank5 primary mastery, seeded Earth story gate`);
        }
        const [tank, healer, ...damage] = actors;
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
        for (const actor of actors) {
            await expect.poll(() => actor.page.evaluate(() => window.game.uiManager.social.partyData?.members?.length)).toBe(4);
            await expect.poll(() => actor.page.evaluate(() => {
                const p = window.game.player;
                return p.stats.hp === p.stats.maxHp && p.stats.mana === p.stats.maxMana;
            })).toBe(true);
            actor.initial = await snapshot(actor.page);
        }
        console.log('[party-clear] four-member party formed through invitation UI');
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
                const { planPartyTelegraphEscape } = await import('/tests/partyDungeonControls.js');
                const { isEarnedRetreatPathClear, retreatStaysInEncounter } = await import('/tests/wizardHuntControls.js');
                const g = window.game, p = g.player;
                const warnings = window.__partyClearWarnings.filter(w =>
                    w.expires > performance.now() && w.instance === g.currentInstanceId);
                const step = p.state === 'DEAD' ? null : planPartyTelegraphEscape(p.position, warnings, delta =>
                    retreatStaysInEncounter(encounter, { x: p.position.x + delta.x, z: p.position.z + delta.z }, p.radius) &&
                    isEarnedRetreatPathClear(g.collisionManager, p.position, p.radius || 1.25, delta));
                return { active: warnings.length > 0, step, warnings,
                    safe: warnings.every(w => Math.hypot(p.position.x - w.x, p.position.z - w.z) >= w.radius + 1.5) };
            }, encounter);
            if (!observation.active) return partyWarningInputPolicy(observation);
            if (observation.step) {
                const moved = await tryDungeonGroundStep(() => moveByGroundClick(actor.page,
                    observation.step.x, observation.step.z, { ...PARTY_FOLLOW_INPUT_OPTIONS,
                        allowAlternatePaths: false, requireClearPath: true, timeout: 1500 }));
                if (moved) observation.safe = await actor.page.evaluate(warnings => {
                    const p = window.game.player.position, e = window.__partyClearEvidence;
                    e.warningMoves++;
                    const safe = warnings.every(w => Math.hypot(p.x - w.x, p.z - w.z) >= w.radius + 1.5);
                    if (safe) e.warningEscapes++;
                    return safe;
                }, observation.warnings);
            }
            // Do not immediately select the boss and walk back into its warning.
            // The normal combat/death/connection deadlines remain unchanged.
            return partyWarningInputPolicy(observation);
        }

        async function healParty({ allowMovement = true } = {}) {
            const states = await Promise.all(actors.map(actor => snapshot(actor.page)));
            const hurt = states.filter(s => !s.dead && s.hp / s.maxHP < .85).sort((a, b) => a.hp / a.maxHP - b.hp / b.maxHP)[0];
            if (!hurt) { if (allowMovement) await follow(healer, states[0], 9); return; }
            const available = await healer.page.evaluate(() => {
                const p = window.game.player;
                return { index: p.hotbar.indexOf('Healing Light'), cooldown: p.cooldowns['Healing Light'] || 0, mana: p.stats.mana,
                    healRange: window.game.abilityController.getAbilityCastRange('Healing Light'),
                    aura: p.hotbar.indexOf('Guardian Embrace'), auraCooldown: p.cooldowns['Guardian Embrace'] || 0,
                    auraActive: p.guardianEmbraceActive || p.guardianEmbraceTimer > 0 };
            });
            const distance = Math.hypot(hurt.x - states[1].x, hurt.z - states[1].z);
            const record = async reason => {
                const pointer = await healer.page.evaluate(id => ({
                    targetLoaded: window.game.remotePlayers.has(id),
                    hoveredType: window.game.hoveredEntity?.constructor?.name || null,
                    hoveringAlly: window.game.hoveredEntity?.id === id,
                    focus: document.activeElement?.tagName || null
                }), hurt.id);
                healerDecisions.push({ reason, distance, hurtRole: actors[states.indexOf(hurt)].className,
                    hp: hurt.hp, maxHP: hurt.maxHP, healerX: states[1].x, healerZ: states[1].z,
                    ...available, ...pointer });
                if (healerDecisions.length > 20) healerDecisions.shift();
            };
            if (distance > Math.min(14, available.healRange - .5)) {
                await record(allowMovement ? 'approach' : 'warning-hold-out-of-range');
                if (allowMovement) await follow(healer, hurt, 7);
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

        let currentTarget, bossStart;
        let townRests = 0;
        await playDungeonThroughInputs(tank.page, { playthrough,
            // Walk the short return from a12.5-unit quake instead of spending
            //20mana on Charge every cycle; retain it for real opening gaps.
            minimumChargeDistance: 18,
            requiredFighterSkills: ['Iron Fortress', 'Whirlwind', 'Shield Slam'],
            afterEntry: async () => {
                entered = true;
                const run = await snapshot(tank.page);
                for (const actor of actors) {
                    await expect.poll(async () => (await snapshot(actor.page)).instance).toBe(run.instance);
                    await expect.poll(async () => (await snapshot(actor.page)).seed).toBe(run.seed);
                }
                console.log('[party-clear] all four entered the same Normal Verdant instance');
            },
            afterGroundStep: async () => {
                // The base movement helper proves displacement, not arrival.
                // Finish this waypoint before deciding where followers gather.
                await expect.poll(() => tank.page.evaluate(() => !window.game.player.targetPosition),
                    { timeout: 5000 }).toBe(true);
                await gatherPartyFormation({ read: () => Promise.all(actors.map(actor => snapshot(actor.page))),
                    move: (index, step) => tryDungeonGroundStep(() => moveByGroundClick(actors[index].page,
                        step.dx, step.dz, PARTY_FOLLOW_INPUT_OPTIONS)) });
            },
            recoverAfterRoom: async (_page, { roomIndex, nearbyHostiles }) => {
                const states = await Promise.all(actors.map(actor => snapshot(actor.page)));
                if (nearbyHostiles || !states[0].rooms.find(room => room.index === roomIndex)?.cleared ||
                    !states.some(s => s.hp < s.maxHP * .8 || s.mana < s.maxMana * .8)) return false;
                for (const s of states) expect(s.dead, 'a party rest cannot hide a death').toBe(false);
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
                await enterDungeon(tank.page, { ...playthrough, useTownGuide: true, resetRun: false });
                for (const [index, actor] of actors.entries()) {
                    // A fresh start moves the group; resuming intentionally
                    // moves only the requester. Each member uses the guide.
                    if ((await snapshot(actor.page)).instance !== states[index].instance) {
                        await enterDungeon(actor.page, { ...playthrough, useTownGuide: true, resetRun: false });
                    }
                    await expect.poll(async () => (await snapshot(actor.page)).instance).toBe(states[index].instance);
                    await expect.poll(() => progress(actor.page)).toEqual(before[index]);
                }
                townRests++;
                console.log('[party-clear-rest]', JSON.stringify({ roomIndex, townRests,
                    spent: states.map(s => ({ hp: s.hp, mana: s.mana })), allFourRecovered: true,
                    sameSeedRoomsGoldInventoryAndQuests: true }));
                return true; // Existing driver rewalks the real cleared route.
            },
            beforeCombat: async (_page, target) => {
                // Let the Fighter engage first, then maintain real ally inputs.
                if (currentTarget !== target.id) {
                    currentTarget = target.id;
                    bossStart = playthrough.bosses.includes(target.type) ? await Promise.all(actors.map(actor => snapshot(actor.page))) : null;
                    return false;
                }
                const [tankPolicy, healerPolicy, ...damagePolicies] = await Promise.all(actors.map(actor => avoidWarnings(actor, target.encounter)));
                // Safe ranged players can keep doing their jobs during a
                // telegraph, but never use an approach input into its circle.
                await Promise.all([healerPolicy.allowCasts ? healParty({ allowMovement: healerPolicy.allowApproach }) : null,
                    ...damage.map(async (actor, index) => {
                    const policy = damagePolicies[index];
                    if (!policy.allowCasts) return;
                    const enemy = await actor.page.evaluate(id => {
                        const g = window.game, p = g.player, e = g.remotePlayers.get(id);
                        return e && e.state !== 'DEAD' ? { distance: p.position.distanceTo(e.position),
                            range: g.abilityController.getAbilityCastRange(), cooldown: p.abilityCooldown } : null;
                    }, target.id);
                    if (!enemy) return;
                    const point = await projectEntity(actor.page, target.id);
                    if (!point?.visible) {
                        if (policy.allowApproach) await follow(actor, await snapshot(tank.page), 8);
                        return;
                    }
                    await actor.page.mouse.move(point.x, point.y);
                    await actor.page.waitForTimeout(60);
                    if (policy.allowApproach) await actor.page.mouse.click(point.x, point.y);
                    if (enemy.distance <= enemy.range && enemy.cooldown <= 0) await actor.page.mouse.click(point.x, point.y, { button: 'right' });
                })]);
                for (const actor of actors) {
                    const state = await snapshot(actor.page);
                    if (state.dead) {
                        const cleric = await snapshot(healer.page);
                        console.log('[party-clear-death]', JSON.stringify({ role: actor.className, boss: target.type,
                            healerDistance: Math.hypot(state.x - cleric.x, state.z - cleric.z),
                            healerMana: cleric.mana, healerCasts: cleric.evidence.casts,
                            bossAllyHealing: bossStart ? cleric.evidence.allyHealing - bossStart[1].evidence.allyHealing : null }));
                    }
                    expect(state.dead, `${actor.className} must survive; inspect party evidence if not`).toBe(false);
                    expect(await actor.page.evaluate(() => performance.now() - window.__partyClearEvidence.lastUpdate)).toBeLessThan(10_000);
                }
                if (tankPolicy.holdMelee) await tank.page.waitForTimeout(60);
                return tankPolicy.holdMelee;
            },
            afterEncounter: async (_page, target) => {
                if (playthrough.bosses.includes(target.type)) {
                    const end = await Promise.all(actors.map(actor => snapshot(actor.page)));
                    console.log('[party-clear-boss]', JSON.stringify({ boss: target.type,
                        roles: end.map((state, index) => ({ role: actors[index].className,
                            damage: state.evidence.damageDone - bossStart[index].evidence.damageDone,
                            taken: state.evidence.damageTaken - bossStart[index].evidence.damageTaken,
                            allyHealing: state.evidence.allyHealing - bossStart[index].evidence.allyHealing })) }));
                }
            },
            afterClearedRoute: async () => {
                for (const actor of actors) {
                    await expect.poll(async () => (await snapshot(actor.page)).quest?.count).toBeGreaterThan(0);
                    const state = await snapshot(actor.page);
                    expect(state.quest.completed, 'manual wizard turn-in must remain unclaimed').toBe(false);
                    expect(state.gold).toBeGreaterThan(actor.initial.gold);
                    expect(state.level > actor.initial.level || state.xp > actor.initial.xp).toBe(true);
                    expect(state.rooms.every(room => room.cleared || room.type === 'start')).toBe(true);
                }
                expect((await snapshot(tank.page)).evidence.damageTaken).toBeGreaterThan(0);
                expect((await snapshot(healer.page)).evidence.allyHealing).toBeGreaterThan(0);
                for (const actor of damage) expect((await snapshot(actor.page)).evidence.damageDone).toBeGreaterThan(0);
            }
        });
        for (const actor of actors.slice(1)) await returnToTown(actor.page, { allowRespawn: false });
        for (const [index, actor] of actors.entries()) {
            actor.combatEvidence = (await snapshot(actor.page)).evidence;
            await claimChapterAndContinue(actor.page, EARTH_DUNGEON_CHAPTER);
            await verifyFreshWaterHandoff(actor.page);
            await actor.page.locator('#btn-close-quest').click();
            actor.claimedChapter = await readChronicleChapter(actor.page, EARTH_DUNGEON_CHAPTER);
            actor.claimedGold = (await snapshot(actor.page)).gold;
            for (const waiting of actors.slice(index + 1)) {
                expect((await readChronicleChapter(waiting.page, EARTH_DUNGEON_CHAPTER)).completed,
                    'Another member turning in must not claim this player’s reward').toBe(false);
            }
            console.log(`[party-clear-turn-in] ${actor.className}: manual reward and Water offer verified`);
        }
        for (const actor of actors) {
            await loginAndEnterWorld(actor.page, actor.login);
            expect(await readChronicleChapter(actor.page, EARTH_DUNGEON_CHAPTER)).toEqual(actor.claimedChapter);
            expect((await snapshot(actor.page)).gold, 'Relogging must neither lose nor duplicate the reward').toBe(actor.claimedGold);
            await verifyFreshWaterHandoff(actor.page);
            console.log(`[party-clear-relogin] ${actor.className}: personal chapter, reward and Water offer persisted`);
        }
        for (const actor of actors) expect(actor.failures, `${actor.className} browser failures`).toEqual([]);
    } finally {
        console.log('[party-healer-decisions]', JSON.stringify(healerDecisions));
        for (const actor of actors) {
            try {
                const s = await snapshot(actor.page);
                console.log('[party-clear-result]', JSON.stringify({ class: actor.className, entered, level: s.level,
                    hp: s.hp, mana: s.mana, dead: s.dead, gold: s.gold, quest: s.quest, evidence: s.evidence || actor.combatEvidence }));
            } catch { /* Browser may already have closed on interruption. */ }
        }
        await Promise.all(ownedBrowsers.map(extra => extra.close()));
    }
});
