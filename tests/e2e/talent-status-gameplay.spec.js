import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel,
    loginAndEnterWorld, moveByGroundClick, projectEntity, projectNearestHostile,
    returnToTown } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('status Mastery purchases change real ticks and persist through fresh login', async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires disposable status QA');
    const config = {
        lunge: { skill: 'Shadow Lunge', talent: 'ROG_07', branch: 'Assassin Burst Path', kind: 'bleed' },
        serrated: { skill: 'Serrated Edges', talent: 'ROG_13', branch: 'Throwing Specialist Path', kind: 'bleed' },
        poison: { skill: 'Poison Coating', talent: 'ROG_21', branch: 'Utility / Debuff Path', kind: 'poison' }
    }[process.env.EIDOLON_STATUS_QA_SKILL];
    expect(config).toBeDefined();
    const credentials = credentialsFromEnvironment(), failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    // Level-prepared functional route, not earned progression. All subsequent
    // specialization, rank purchases and casts use ordinary player controls.
    await ensureDungeonReadyLevel(page);
    await page.keyboard.press('k');
    const skills = page.locator('#skill-tree-window');
    const branch = skills.locator('.skill-branch').filter({ has: page.locator('.skill-branch-title', { hasText: config.branch }) });
    await branch.getByRole('button', { name: 'Select Spec', exact: true }).click();
    await expect.poll(() => page.evaluate(skill => window.game.player.hotbar.includes(skill), config.skill)).toBe(true);
    await page.locator('#btn-close-skills').click();

    async function observe() {
        await page.evaluate(talent => {
            const game = window.game;
            window.__statusQA = { target: null, results: [], damage: [], casts: [], requests: [], rank: game.player.talentRanks?.[talent] || 0 };
            const handle = game.handleServerMessage.bind(game);
            game.handleServerMessage = message => {
                const qa = window.__statusQA;
                const states = message.type === 'state' ? message.payload : message.type === 'delta' ? message.payload?.u : null;
                for (const state of Object.values(states || {})) if (state.id === game.player.id && state.talentRanks?.[talent] !== undefined) qa.rank = state.talentRanks[talent];
                if (message.type === 'ability_result') qa.results.push(message.payload);
                if (message.type === 'ability' && message.payload?.sourceId === game.player.id) qa.casts.push(message.payload);
                if (message.type === 'damage' && message.payload?.sourceId === game.player.id && message.payload?.targetId === qa.target) {
                    qa.damage.push({ amount: message.payload.amount, kind: message.payload.kind });
                }
                return handle(message);
            };
            const send = game.network.send.bind(game.network);
            game.network.send = (kind, payload) => {
                if (kind === 'ability') {
                    const target = game.hoveredEntity;
                    const targeted = payload.skillName === 'Shadow Lunge' || payload.skillName === 'Piercing Throw';
                    // Input can arrive on a later frame than the aim probe.
                    // Snapshot the real hovered actor at dispatch, not a stale
                    // pre-input projection of a moving, overlapping crowd.
                    const selectedTarget = payload.targetId === target?.id && game.isHostileActorTarget(target);
                    if (targeted && selectedTarget) window.__statusQA.target = target.id;
                    window.__statusQA.requests.push({ skill: payload.skillName, targetId: payload.targetId, selectedTarget,
                        durable: Boolean(target?.constructor?.name === 'InfernoTitan'
                            && target.stats.hp > 2*(15+1.5*game.player.stats.dexterity)),
                        inRange: Boolean(target && target.position.distanceTo(game.player.position) < 9) });
                }
                return send(kind, payload);
            };
        }, config.talent);
    }

    async function verifyTick(rank, label) {
        await returnToTown(page);
        // The starter Skeleton can die to the primary hit before a coating
        // ticks. Use the existing Verdant waypoint's ordinary level-40–50
        // overworld population; never raise enemy health or bypass combat.
        await page.keyboard.press('Enter');
        await page.locator('#chat-input').fill('/qa-waypoint verdant');
        await page.locator('#chat-input').press('Enter');
        await expect.poll(() => page.evaluate(() => Math.hypot(window.game.player.position.x-800, window.game.player.position.z-200))).toBeLessThan(3);
        await page.waitForTimeout(1100); // Existing authoritative waypoint movement lock.
        // Enemies must remain selectable even where the entrance overlaps
        // their silhouette; exercise the real interaction-priority path.
        const minimumHealth = await page.evaluate(() => 2*(15+1.5*window.game.player.stats.dexterity));
        let target = await projectNearestHostile(page, 'InfernoTitan', minimumHealth);
        for (let step = 0; !target && step < 12; step++) {
            await moveByGroundClick(page, 0, 20);
            target = await projectNearestHostile(page, 'InfernoTitan', minimumHealth);
        }
        expect(target, 'a real durable overworld enemy must be visible').not.toBeNull();
        expect(target.health, 'enemy must survive the ordinary initiating hit').toBeGreaterThan(minimumHealth);
        for (let step = 0; step < 15; step++) {
            const offset = await page.evaluate(id => {
                const enemy = window.game.remotePlayers.get(id), player = window.game.player;
                if (!enemy?.isActive || enemy.state === 'DEAD') return null;
                return { x: enemy.position.x-player.position.x, z: enemy.position.z-player.position.z };
            }, target.id);
            expect(offset).not.toBeNull();
            const distance = Math.hypot(offset.x, offset.z);
            if (distance < 7) break;
            const scale = Math.min(8, distance-5)/distance;
            await moveByGroundClick(page, offset.x*scale, offset.z*scale);
        }
        await expect.poll(() => page.evaluate(skill => window.game.player.cooldowns?.[skill] || 0, config.skill)).toBe(0);
        await expect.poll(() => page.evaluate(() => window.game.player.state)).not.toBe('JUMPING');
        const dexterity = await page.evaluate(() => window.game.player.stats.dexterity);
        let aim;
        async function acquireAim() {
            let sample = 0;
            const points = [null,
                { x: .15, y: .5, z: .15 }, { x: .85, y: .5, z: .85 },
                { x: .15, y: .75, z: .85 }, { x: .85, y: .75, z: .15 }];
            await expect.poll(async () => {
                // A wounded foreground enemy can cover the center of a fresh
                // target. Aim at other real points on its interaction hitbox,
                // as a player would, without changing any entity or raycast.
                aim = await projectEntity(page, target.id, points[sample++ % points.length]);
                if (aim?.visible) await page.mouse.move(aim.x, aim.y);
                const acquired = await page.evaluate(async ({ visible }) => {
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                    const game = window.game, enemy = game.hoveredEntity;
                    // Several natural enemies can overlap at melee range.
                    // Select the actual top hostile under the pointer, then
                    // keep its identity through the request and damage event.
                    return { id: enemy?.id, visible,
                        hovered: game.isHostileActorTarget(enemy) && enemy?.constructor?.name === 'InfernoTitan',
                        inRange: Boolean(enemy && enemy.position.distanceTo(game.player.position) < 9),
                        living: Boolean(enemy?.isActive && enemy.state !== 'DEAD'
                            && enemy.stats.hp > 2*(15+1.5*game.player.stats.dexterity)) };
                }, { visible: Boolean(aim?.visible) });
                const { id, ...state } = acquired;
                if (state.visible && state.hovered && state.inRange && state.living) {
                    target.id = id;
                    await page.evaluate(id => Object.assign(window.__statusQA, { target: id, damage: [] }), id);
                }
                return state;
            }).toEqual({ visible: true, hovered: true, inRange: true, living: true }).catch(async error => {
                console.log('[status-aim]', await page.evaluate(id => {
                    const game = window.game, enemy = game.remotePlayers.get(id);
                    return { player: game.player.position, enemy: enemy?.position, distance: enemy?.position.distanceTo(game.player.position),
                        state: game.player.state, targetState: enemy?.state, hovered: game.hoveredEntity?.constructor?.name,
                        hoveredName: game.hoveredEntity?.name, hoveredId: game.hoveredEntity?.id,
                        targetType: enemy?.constructor?.name, health: enemy?.stats?.hp };
                }, target.id));
                throw error;
            });
        }
        await acquireAim();
        await page.evaluate(id => Object.assign(window.__statusQA, { target: id, results: [], damage: [], casts: [], requests: [] }), target.id);
        const slot = await page.evaluate(skill => window.game.player.hotbar.indexOf(skill), config.skill);
        expect(slot).toBeGreaterThanOrEqual(0);
        await page.keyboard.press(String(slot+1));
        await expect.poll(() => page.evaluate(() => window.__statusQA.results.length)).toBe(1);
        const result = await page.evaluate(() => window.__statusQA.results[0]);
        expect(result).toEqual(expect.objectContaining({ skillName: config.skill, accepted: true }));
        expect(result.cooldownRemaining).toBeGreaterThan(0);
        if (config.skill !== 'Shadow Lunge') {
            await page.waitForTimeout(600); // Observe the ordinary 500ms global cooldown.
            await acquireAim();
            await page.mouse.click(aim.x, aim.y, { button: 'right' });
            await expect.poll(() => page.evaluate(() => window.__statusQA.results.length)).toBe(2);
            expect(await page.evaluate(() => window.__statusQA.results[1])).toEqual(expect.objectContaining({ skillName: 'Piercing Throw', accepted: true }));
        }
        const delivery = config.skill === 'Shadow Lunge' ? config.skill : 'Piercing Throw';
        const requests = await page.evaluate(skill => window.__statusQA.requests.filter(request => request.skill === skill), delivery);
        expect(requests).toEqual([expect.objectContaining({ skill: delivery, selectedTarget: true, durable: true, inRange: true })]);
        await expect.poll(() => page.evaluate(skill => window.__statusQA.casts.filter(cast => cast.skillName === skill).map(cast => cast.targetId), delivery))
            .toEqual([requests[0].targetId]);
        await expect.poll(() => page.evaluate(kind => window.__statusQA.damage.some(hit => hit.kind === kind), config.kind)).toBe(true).catch(async error => {
            console.log('[status-training-missing-tick]', await page.evaluate(id => {
                const game = window.game, enemy = game.remotePlayers.get(id);
                return { state: enemy?.state, hp: enemy?.stats?.hp, active: enemy?.isActive,
                    serrated: game.player.serratedEdgesActive, coating: game.player.poisonCoatingActive,
                    results: window.__statusQA.results, damage: window.__statusQA.damage };
            }, target.id));
            throw error;
        });
        const events = await page.evaluate(() => window.__statusQA.damage);
        const base = config.skill === 'Serrated Edges' ? Math.floor(events.find(hit => hit.kind === 'physical').amount/5)
            : (config.kind === 'poison' ? 8 : 10)+Math.floor(dexterity/2);
        const expected = Math.floor(base*(1+.04*rank)+1e-9);
        expect(events.filter(hit => hit.kind === config.kind).map(hit => hit.amount)).toEqual(expect.arrayContaining([expected]));
        expect(events.filter(hit => hit.kind === config.kind).every(hit => hit.amount === expected)).toBe(true);
        console.log(`[status-training] ${config.skill} ${label}: rank ${rank}, tick ${expected}, accepted targeted combat`);
    }

    await observe(); await verifyTick(0, 'baseline');
    await returnToTown(page); await page.keyboard.press('k');
    await skills.getByRole('button', { name: 'Talents', exact: true }).click();
    for (let rank = 1; rank <= 5; rank++) {
        const node = skills.locator('.skill-node').filter({ has: page.locator('.skill-node-title', { hasText: `${config.skill} - Mastery` }) });
        await node.scrollIntoViewIfNeeded(); await node.click();
        await expect.poll(() => page.evaluate(() => window.__statusQA.rank)).toBe(rank);
    }
    await page.locator('#btn-close-skills').click();
    await verifyTick(5, 'trained');
    await returnToTown(page); await page.reload({ waitUntil: 'networkidle' }); await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(id => window.game.player.talentRanks?.[id], config.talent)).toBe(5);
    await observe(); await verifyTick(5, 'saved');
    expect(failures, failures.join('\n')).toEqual([]);
});
