import { expect, test } from './static-delivery-test.js';
import { profileGameplayScene } from './scene-performance.js';
import { storePersistentQALootSpare } from './persistent-qa-stash.js';
import {
    collectBrowserFailures,
    credentialsFromEnvironment,
    ensureDungeonReadyLevel,
    enterAndExitDungeon,
    exerciseAreaHazards,
    exerciseCombatAndLoot,
    exerciseMenus,
    exerciseMovement,
    exerciseReconnect,
    loginAndEnterWorld,
    projectGroundOffset,
    verifyPersistenceAfterFreshLogin
} from './helpers.js';

const credentials = credentialsFromEnvironment();
const hasCredentials = Boolean(credentials.username && credentials.password);

// Credentialed recordings can expose account identifiers or form inputs.
// The anonymous route retains all three failure artifact types.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test.describe('dedicated QA character', () => {
    test.skip(!hasCredentials, 'Set EIDOLON_E2E_USERNAME and EIDOLON_E2E_PASSWORD for character QA');

    test('long Ctrl-click jump completes in about 1.5 seconds total', async ({ page, baseURL }, testInfo) => {
        test.skip(process.env.EIDOLON_E2E_JUMP_TIMING !== '1', 'Explicit fresh live jump acceptance');
        test.skip(process.env.EIDOLON_E2E_JUMP_TIMING !== '1', 'Focused connected jump timing route');
        const failures = collectBrowserFailures(page, baseURL);
        await loginAndEnterWorld(page, credentialsFromEnvironment());
        await page.waitForFunction(() => Boolean(window.game?.player?.mesh?.parent));
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        let target;
        for (const [x, z] of [[27, 0], [-27, 0], [0, 27], [0, -27]]) {
            const availableDistance = await page.evaluate(({ x, z }) => {
                const game = window.game, start = game.player.position, end = start.clone();
                end.x += x; end.z += z;
                game.collisionManager?.constrainRockMovementDestination?.(start, end, game.player.radius || 0);
                game.collisionManager?.constrainToDungeonWalkableArea?.(end, game.player.radius || 0);
                return Math.hypot(end.x - start.x, end.z - start.z);
            }, { x, z });
            if (availableDistance < 20.25) continue;
            const candidate = await projectGroundOffset(page, x, z, { allowScaling: false });
            if (candidate?.canvas) { target = candidate; break; }
        }
        expect(target, 'A full long-jump destination must be visible on the canvas').toBeTruthy();
        await page.evaluate(() => {
            const record = window.__jumpTiming = { frames: 0, acceptedDuration: null, history: [] };
            const canvas = window.game.renderSystem.renderer.domElement;
            const clicked = event => {
                if (!event.isTrusted || !event.ctrlKey || event.button !== 0) return;
                record.clickedAt = performance.now();
                canvas.removeEventListener('pointerdown', clicked, true);
            };
            canvas.addEventListener('pointerdown', clicked, true);
            const sample = () => {
                const game = window.game, jump = game.playerJumpState, now = performance.now();
                if (jump) {
                    record.startedAt ??= now;
                    record.frames++;
                    record.history.push({ elapsedMs: now - record.clickedAt, elapsed: jump.elapsed, progress: jump.progress, serverDriven: jump.serverDriven });
                    record.distance = Math.hypot(jump.end.x - jump.start.x, jump.end.z - jump.start.z);
                    record.end = { x: jump.end.x, z: jump.end.z };
                    if (jump.serverDriven) record.acceptedDuration = jump.duration;
                } else if (record.startedAt && game.player.state !== 'JUMPING') {
                    record.positionError = Math.hypot(game.player.position.x - record.end.x, game.player.position.z - record.end.z);
                    record.renderError = Math.hypot(game.player.mesh.position.x - record.end.x, game.player.mesh.position.z - record.end.z);
                    record.elapsedMs = now - record.clickedAt;
                    record.observedFlightMs = now - record.startedAt;
                    canvas.removeEventListener('pointerdown', clicked, true);
                    return;
                }
                if (!record.startedAt || now - record.startedAt < 5_000) requestAnimationFrame(sample);
                else canvas.removeEventListener('pointerdown', clicked, true);
            };
            requestAnimationFrame(sample);
        });
        await page.keyboard.down('Control');
        try { await page.mouse.click(target.x, target.y); }
        finally { await page.keyboard.up('Control'); }
        await expect.poll(() => page.evaluate(() => window.__jumpTiming.elapsedMs), { timeout: 6_000 }).toBeGreaterThan(0);
        const result = await page.evaluate(() => window.__jumpTiming);
        await testInfo.attach('connected-jump-timing', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
        expect(Number.isFinite(result.clickedAt), 'Total time starts at the trusted native Ctrl-click').toBe(true);
        expect(result.distance).toBeGreaterThanOrEqual(20.25);
        expect(result.acceptedDuration).toBeCloseTo(1.3, 6);
        expect(result.elapsedMs).toBeGreaterThan(1_250);
        expect(result.elapsedMs).toBeLessThan(1_600);
        expect(result.positionError).toBeLessThan(.1);
        expect(result.renderError).toBeLessThan(.1);
        expect(failures, failures.join('\n')).toEqual([]);
    });

    test('logs in, enters the world, moves, opens gameplay UI, and reconnects', async ({ page, baseURL }, testInfo) => {
        test.setTimeout(600_000);
        const failures = collectBrowserFailures(page, baseURL);
        if (process.env.EIDOLON_E2E_CAPTURE_VISUALS === '1' || process.env.EIDOLON_E2E_PROFILE_VISUALS === '1') await page.setViewportSize({ width: 1440, height: 1000 });
        await loginAndEnterWorld(page, credentials);
        const readReplicatedStash = async () => {
            await expect.poll(() => page.evaluate(() => Array.isArray(window.game?.player?.stash)), {
                timeout: 10_000, message: 'Login must replicate authoritative storage, including an empty stash'
            }).toBe(true);
            return page.evaluate(() => window.game.player.stash);
        };
        const initialStash = await readReplicatedStash();
        await page.evaluate(() => {
            const game = window.game;
            window.__questQASends = [];
            const originalSend = game.network.send.bind(game.network);
            game.network.send = (type, payload) => {
                window.__questQASends.push({ type, payload });
                return originalSend(type, payload);
            };
            game.uiManager.toggleQuestWindow();
        });
        try {
            await expect.poll(() => page.evaluate(() =>
                window.game?.player?.quests?.some?.((quest) => quest.id === 'daily_skeleton') || false
            ), {
                message: 'opening the quest giver must reconcile the level-one starter daily catalog',
                timeout: 20_000
            }).toBe(true);
        } catch (error) {
            const diagnostic = await page.evaluate(() => ({
                sent: window.__questQASends,
                socket: window.game?.network?.socket?.readyState,
                queuedTypes: window.game?.network?.messageQueue?.map?.((message) => message.type),
                quests: window.game?.player?.quests,
                requestCallback: typeof window.game?.uiManager?.quest?.onRequestQuests,
                questText: document.getElementById('quest-list')?.textContent
            }));
            throw new Error(`Quest giver did not reconcile the starter catalog: ${JSON.stringify(diagnostic)}`, {
                cause: error
            });
        }
        if (process.env.EIDOLON_E2E_REGISTER === '1') {
            await page.locator('#quest-list .quest-contract').first().click();
            await expect(page.locator('#quest-list').getByRole('button', { name: 'Accept Quest' }).first()).toBeVisible();
        }
        await page.evaluate(() => window.game?.uiManager?.toggleQuestWindow());
        if (process.env.EIDOLON_E2E_PROFILE_VISUALS === '1') {
            for (const quality of ['high', 'low']) {
                await page.evaluate((quality) => window.game.renderSystem.setGraphicsQuality(quality), quality);
                for (const state of ['closed', 'preview', 'closed-again']) {
                    await page.evaluate((state) => {
                        const ui = window.game.uiManager;
                        ui.closePrimaryHudMenus();
                        if (state === 'preview') ui.toggleCharacterSheet();
                    }, state);
                    const metrics = await profileGameplayScene(page, `${quality}-${state}`);
                    console.log(`Scene profile: ${JSON.stringify(metrics)}`);
                    await testInfo.attach(`scene-${quality}-${state}`, { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
                    expect(metrics.frames).toBe(180);
                    expect(metrics.previewFramesDuringSample).toBe(0);
                }
            }
            await page.evaluate(() => window.game.renderSystem.setGraphicsQuality('high'));
        }
        if (process.env.EIDOLON_E2E_CAPTURE_VISUALS === '1') {
            // Opt-in component crops only: no authentication forms, account
            // identifiers, chat transcripts or full-page credentialed captures.
            for (const id of ['game-timer', 'objectives-panel', 'player-hud']) {
                await page.locator(`#${id}`).screenshot({ path: testInfo.outputPath(`polish-${id}.png`) });
            }
            // A ground-only crop right of the local actor and away from chat.
            await page.screenshot({ path: testInfo.outputPath('polish-town-surface.png'), clip: { x: 900, y: 350, width: 480, height: 280 } });
            for (const [key, id] of [['i', 'inventory-screen'], ['j', 'quest-journal'], ['k', 'skill-tree-window']]) {
                await page.keyboard.press(key);
                await expect(page.locator(`#${id}`)).toBeVisible();
                await expect.poll(() => page.locator(`#${id}`).evaluate((element) => {
                    const bounds = element.getBoundingClientRect();
                    const header = element.querySelector('.window-header').getBoundingClientRect();
                    return {
                        fits: bounds.x >= 0 && bounds.y >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight,
                        headerUncovered: element.contains(document.elementFromPoint(header.x + 20, header.y + header.height / 2)),
                        aboveHud: ['objectives-panel', 'game-timer'].every((id) =>
                            Number(getComputedStyle(document.getElementById(id)).zIndex) < Number(getComputedStyle(element).zIndex))
                    };
                })).toEqual({ fits: true, headerUncovered: true, aboveHud: true });
                await page.locator(`#${id}`).screenshot({ path: testInfo.outputPath(`polish-${id}.png`) });
                await page.keyboard.press('Escape');
            }
        }
        await exerciseMovement(page);
        await exerciseMenus(page);
        await exerciseReconnect(page);
        expect(await readReplicatedStash(), 'Transport resume must retain exact stash contents').toEqual(initialStash);
        // A fresh page cannot pass by retaining the pre-disconnect client array.
        await loginAndEnterWorld(page, credentials);
        expect(await readReplicatedStash(), 'Fresh login must republish exact stash contents').toEqual(initialStash);
        expect(failures, failures.join('\n')).toEqual([]);
    });

    test('kills and loots in the overworld, enters and exits a dungeon, and persists', async ({ page, baseURL }) => {
        test.skip(process.env.EIDOLON_E2E_FULL_GAMEPLAY !== '1', 'Enable for an extended disposable-character run');
        test.setTimeout(900_000);
        const failures = collectBrowserFailures(page, baseURL);
        await loginAndEnterWorld(page, credentials);
        await ensureDungeonReadyLevel(page);
        await exerciseAreaHazards(page);
        const lootReceipt = await exerciseCombatAndLoot(page, { storeSpare: storePersistentQALootSpare });
        await enterAndExitDungeon(page);
        await exerciseReconnect(page);
        await verifyPersistenceAfterFreshLogin(page, credentials, lootReceipt);
        expect(failures, failures.join('\n')).toEqual([]);
    });

    test('enters and exits a dungeon through the allowlisted QA waypoint', async ({ page, baseURL }, testInfo) => {
        test.skip(process.env.EIDOLON_E2E_PORTAL_ONLY !== '1', 'Enable for focused portal QA');
        test.setTimeout(600_000);
        const failures = collectBrowserFailures(page, baseURL);
        await loginAndEnterWorld(page, credentials);
        await ensureDungeonReadyLevel(page);
        await page.evaluate(() => {
            const game = window.game;
            const events = [];
            const record = event => {
                if (events.length < 64) events.push({ ...event, at: performance.now(),
                    instance: game.currentInstanceType, position: game.player.position.toArray(),
                    jumping: Boolean(game.playerJumpState || game.player.state === 'JUMPING') });
            };
            const send = game.network.send;
            const receive = game.handleServerMessage;
            game.network.send = function (type, payload, ...rest) {
                if (type === 'recall') record({ type: 'request', context: payload?.movementContext });
                return send.call(this, type, payload, ...rest);
            };
            game.handleServerMessage = function (message, ...rest) {
                if (message.type === 'interaction_cast' && message.payload?.kind === 'recall') {
                    const { id, target: context, state, duration } = message.payload;
                    record({ type: 'cast', id, context, state, duration });
                } else if (message.type === 'error') record({ type: 'error', message: message.payload });
                return receive.call(this, message, ...rest);
            };
            window.__dungeonRecallAudit = { events, stop() {
                game.network.send = send;
                game.handleServerMessage = receive;
                return { events, restored: game.network.send === send && game.handleServerMessage === receive };
            } };
        });
        let audit;
        try {
            await enterAndExitDungeon(page);
            await enterAndExitDungeon(page, { beforeExit: async () => {
                // A stationary recall cannot bypass an actual Ctrl-click jump.
                // Try B in flight, verify its cancellation/rejection, then retry
                // after landing through the same ordinary three-second cast.
                await expect.poll(() => page.evaluate(() => Boolean(
                    window.game?.currentDungeonLayout &&
                    window.game?.collisionManager?.dungeonWalkableRects?.length
                )), { timeout: 15_000 }).toBe(true);
                let target;
                await expect.poll(async () => {
                    target = await projectGroundOffset(page, 10, 0);
                    return Boolean(target?.canvas);
                }, { timeout: 15_000, message: 'dungeon camera must settle on a visible jump destination' }).toBe(true);
                await page.keyboard.down('Control');
                try {
                    await page.mouse.click(target.x, target.y);
                } finally {
                    await page.keyboard.up('Control');
                }
                await page.waitForFunction(() => Boolean(
                    window.game?.playerJumpState || window.game?.player?.state === 'JUMPING'
                ), null, { timeout: 3_000 });
                const instance = await page.evaluate(() => window.game.currentInstanceType);
                const firstEvent = await page.evaluate(() => window.__dungeonRecallAudit.events.length);
                await page.keyboard.press('b');
                await expect.poll(() => page.evaluate(offset => {
                    const events = window.__dungeonRecallAudit.events.slice(offset);
                    return events.some(event => event.type === 'cast' && ['cancelled', 'rejected'].includes(event.state));
                }, firstEvent), { timeout: 3_000, message: 'Recall requested in flight must be cancelled or rejected by the server' }).toBe(true);
                const attempt = await page.evaluate(offset => window.__dungeonRecallAudit.events.slice(offset), firstEvent);
                const request = attempt.find(event => event.type === 'request');
                expect(request?.jumping, 'The real B key must reach recall while the player is airborne').toBe(true);
                const casts = attempt.filter(event => event.type === 'cast' && event.context === request.context);
                expect(casts.some(event => event.state === 'completed')).toBe(false);
                if (casts.some(event => event.state === 'cancelled')) {
                    const started = casts.find(event => event.state === 'started');
                    expect(started?.duration).toBe(3);
                    expect(casts.find(event => event.state === 'cancelled')?.id).toBe(started.id);
                } else {
                    expect(casts.map(event => event.state)).toEqual(['rejected']);
                    await expect(page.locator('.action-error-notice')).toContainText('Stand still before starting this cast');
                }
                await expect.poll(() => page.evaluate(() => Boolean(
                    !window.game.playerJumpState && window.game.player.state === 'IDLE' && !window.game.pendingTownRecall
                )), { timeout: 3_000 }).toBe(true);
                // Wait beyond the cancelled cast's deadline. Its stale timer must
                // never teleport the player once the jump has landed.
                await page.waitForTimeout(3_100);
                expect(await page.evaluate(() => window.game.currentInstanceType)).toBe(instance);
                await expect(page.locator('#interaction-cast')).toBeHidden();
            } });
        } finally {
            audit = await page.evaluate(() => window.__dungeonRecallAudit.stop());
            await testInfo.attach('dungeon-stationary-recall', { body: JSON.stringify(audit), contentType: 'application/json' });
        }
        expect(audit.restored).toBe(true);
        const requests = audit.events.filter(event => event.type === 'request');
        const completed = audit.events.filter(event => event.type === 'cast' && event.state === 'completed');
        expect(requests).toHaveLength(3);
        expect(completed).toHaveLength(2);
        for (const completion of completed) {
            const request = requests.find(event => event.context === completion.context);
            expect(request.jumping).toBe(false);
            expect(completion.at - request.at, 'Each successful recall keeps the full three-second cast').toBeGreaterThanOrEqual(3_000);
        }
        // Only a proven rejection of the deliberately airborne request may
        // contribute the corresponding console error. All other failures stay fatal.
        const rejections = audit.events.filter(event => event.type === 'cast' && event.state === 'rejected');
        const standingErrors = failures.filter(message => message.startsWith('console: Server Error: Stand still before starting this cast ['));
        expect(standingErrors).toHaveLength(rejections.length);
        expect(audit.events.filter(event => event.type === 'error').map(event => event.message))
            .toEqual(rejections.map(() => 'Stand still before starting this cast'));
        expect(failures.filter(message => !standingErrors.includes(message)), failures.join('\n')).toEqual([]);
    });
});
