import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PARTY_ROLES, partyDungeonCharacter, requireIsolatedPartyFixture } from '../partyDungeonFixture.js';
import { dungeonPlaythroughOptions } from '../dungeonPlaythroughCatalog.js';
import { playDungeonThroughInputs } from './dungeon-playthrough-route.js';
import { hardwareWebGLBrowserArgs } from './browserLaunchPolicy.js';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, openGame,
    moveByGroundClick, projectEntity, projectGroundOffset, returnToTown } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const snapshot = page => page.evaluate(() => {
    const g = window.game, p = g.player;
    return { id: p.id, instance: g.currentInstanceId, seed: g.currentDungeonLayout?.generationSeed,
        x: p.position.x, z: p.position.z, hp: p.stats.hp, maxHP: p.stats.maxHp,
        mana: p.stats.mana, maxMana: p.stats.maxMana, dead: p.state === 'DEAD',
        gold: p.gold, level: p.level, stats: p.baseStats, hotbar: p.hotbar,
        quest: p.quests?.find(q => q.id === 'chronicle_03_roots_remember'),
        rooms: g.currentDungeonRoomState?.rooms, evidence: window.__partyClearEvidence };
});

async function observeRole(page) {
    await page.evaluate(() => {
        const game = window.game, original = game.handleServerMessage.bind(game);
        const e = window.__partyClearEvidence = { damageDone: 0, damageTaken: 0, allyHealing: 0,
            casts: {}, rejected: {}, lastUpdate: performance.now() };
        game.handleServerMessage = message => {
            const p = message.payload;
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
            return original(message);
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
    await observeRole(page);
}

test('four level30 roles clear Normal Verdant through real party inputs and receive individual credit', async ({ page, browser, baseURL }) => {
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

        async function follow(actor, anchor, distance = 4) {
            const state = await snapshot(actor.page);
            const dx = anchor.x - state.x, dz = anchor.z - state.z, d = Math.hypot(dx, dz);
            if (d <= distance) return;
            const scale = Math.min(1, 12 / d);
            await moveByGroundClick(actor.page, dx * scale, dz * scale, { allowJumpFallback: false });
        }

        async function healParty() {
            const states = await Promise.all(actors.map(actor => snapshot(actor.page)));
            const hurt = states.filter(s => !s.dead && s.hp / s.maxHP < .85).sort((a, b) => a.hp / a.maxHP - b.hp / b.maxHP)[0];
            if (!hurt) { await follow(healer, states[0], 9); return; }
            const available = await healer.page.evaluate(() => {
                const p = window.game.player;
                return { index: p.hotbar.indexOf('Healing Light'), cooldown: p.cooldowns['Healing Light'] || 0, mana: p.stats.mana };
            });
            if (Math.hypot(hurt.x - states[1].x, hurt.z - states[1].z) > 12) { await follow(healer, hurt, 10); return; }
            if (available.index < 0 || available.cooldown > 0 || available.mana < 25) return;
            const point = hurt.id === states[1].id ? await projectGroundOffset(healer.page, 0, 0) : await projectEntity(healer.page, hurt.id);
            if (!point || !(point.visible || point.canvas)) return;
            await healer.page.mouse.move(point.x, point.y);
            await healer.page.waitForTimeout(60);
            await healer.page.keyboard.press(String(available.index + 1));
        }

        let currentTarget;
        await playDungeonThroughInputs(tank.page, { playthrough,
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
                const anchor = await snapshot(tank.page);
                await Promise.all(actors.slice(1).map(actor => follow(actor, anchor)));
            },
            beforeCombat: async (_page, target) => {
                // Let the Fighter engage first, then maintain real ally inputs.
                if (currentTarget !== target.id) { currentTarget = target.id; return false; }
                await Promise.all([healParty(), ...damage.map(async actor => {
                    const enemy = await actor.page.evaluate(id => {
                        const g = window.game, p = g.player, e = g.remotePlayers.get(id);
                        return e && e.state !== 'DEAD' ? { distance: p.position.distanceTo(e.position),
                            range: g.abilityController.getAbilityCastRange(), cooldown: p.abilityCooldown } : null;
                    }, target.id);
                    if (!enemy) return;
                    const point = await projectEntity(actor.page, target.id);
                    if (!point?.visible) { await follow(actor, await snapshot(tank.page), 8); return; }
                    await actor.page.mouse.move(point.x, point.y);
                    await actor.page.waitForTimeout(60);
                    await actor.page.mouse.click(point.x, point.y);
                    if (enemy.distance <= enemy.range && enemy.cooldown <= 0) await actor.page.mouse.click(point.x, point.y, { button: 'right' });
                })]);
                for (const actor of actors) {
                    const state = await snapshot(actor.page);
                    expect(state.dead, `${actor.className} must survive; inspect party evidence if not`).toBe(false);
                    expect(await actor.page.evaluate(() => performance.now() - window.__partyClearEvidence.lastUpdate)).toBeLessThan(10_000);
                }
                return false;
            },
            afterEncounter: async (_page, target) => {
                if (playthrough.bosses.includes(target.type)) console.log(`[party-clear] boss defeated ${target.type}`);
            },
            afterClearedRoute: async () => {
                for (const actor of actors) {
                    await expect.poll(async () => (await snapshot(actor.page)).quest?.count).toBeGreaterThan(0);
                    const state = await snapshot(actor.page);
                    expect(state.quest.completed, 'manual wizard turn-in must remain unclaimed').toBe(false);
                    expect(state.gold).toBeGreaterThan(actor.initial.gold);
                    expect(state.rooms.every(room => room.cleared || room.type === 'start')).toBe(true);
                }
                expect((await snapshot(tank.page)).evidence.damageTaken).toBeGreaterThan(0);
                expect((await snapshot(healer.page)).evidence.allyHealing).toBeGreaterThan(0);
                for (const actor of damage) expect((await snapshot(actor.page)).evidence.damageDone).toBeGreaterThan(0);
            }
        });
        for (const actor of actors.slice(1)) await returnToTown(actor.page, { allowRespawn: false });
        for (const actor of actors) expect(actor.failures, `${actor.className} browser failures`).toEqual([]);
    } finally {
        for (const actor of actors) {
            try {
                const s = await snapshot(actor.page);
                console.log('[party-clear-result]', JSON.stringify({ class: actor.className, entered, level: s.level,
                    hp: s.hp, mana: s.mana, dead: s.dead, gold: s.gold, quest: s.quest, evidence: s.evidence }));
            } catch { /* Browser may already have closed on interruption. */ }
        }
        await Promise.all(ownedBrowsers.map(extra => extra.close()));
    }
});
