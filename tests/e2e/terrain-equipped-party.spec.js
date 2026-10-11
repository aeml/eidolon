import { prepareActorCellMultiDrawParty } from './actor-cell-multidraw-party.js';
import { capturePartySubmissionFrames } from './party-submission-frames.js';
import { captureActorSubmissionCensus } from './actor-submission-census.js';
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { installBodyLodPilot } from './body-lod-pilot.js';
import { installWearableAttributePilot } from './wearable-attribute-pilot.js';
import { prepareShadowGeometryPilot, selectSimplifiedShadowGeometry } from './shadow-geometry-pilot.js';
import { prepareGameplayColorPilot } from './gameplay-color-lod-pilot.js';
import { prepareGameplayBodyPilot } from './gameplay-body-lod-pilot.js';
import { prepareActorInstanceViewPilot } from './actor-instance-view-pilot.js';
import { prepareActorShadowInfluencePilot } from './actor-shadow-influence-pilot.js';
import { measurePartyMatrixOwners } from './party-matrix-observation.js';
import { compareGameplayGeometryFrames } from './geometry-frame-comparison.js';
import { captureGameplayGeometryParty } from './gameplay-geometry-party.js';
import { installFoliageRevisionObservation, readFoliageRevisionObservation,
    restoreFoliageRevisionObservation } from './foliage-revision-observation.js';
import {
    collectBrowserFailures, loginAndEnterWorld, moveByGroundClick, projectNearestHostile,
    useEncounterQAWaypoint
} from './helpers.js';
import { captureActualSceneRenderDiagnosis } from './actual-scene-render-diagnosis.js';
import { captureEarthMovingRoute } from './earth-moving-route.js';
import { hardwareWebGLBrowserArgs } from './browserLaunchPolicy.js';
import { profileGameplayScene } from './scene-performance.js';
import { summarizePartyCPUProfile } from './party-cpu-summary.js';
import { captureUnderstoryPreparation } from './understory-preparation-diagnosis.js';
import { captureUnderstoryDetailComparison } from './understory-detail-comparison.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off', serviceWorkers:
    process.env.EIDOLON_E2E_BODY_LOD_COMPARE === '1' || process.env.EIDOLON_E2E_BODY_LOD_PILOT ||
    process.env.EIDOLON_E2E_WEARABLE_ATTRIBUTE_COMPARE === '1' || process.env.EIDOLON_E2E_WEARABLE_ATTRIBUTE_PILOT ? 'block' : 'allow' });

function observePartyTerrain() {
    const game = window.game;
    const evidence = window.__equippedTerrainParty = { states: {}, damage: [], healing: [], casts: [], projectileDraws: 0 };
    const receive = game.handleServerMessage;
    game.handleServerMessage = function (message) {
        const updates = message.type === 'state' ? message.payload : message.type === 'delta' ? message.payload?.u : null;
        for (const [id, data] of Object.entries(updates || {})) {
            if (data.type === 'Player' || evidence.states[id] || id === game.player.id) {
                const previous = evidence.states[id] || {};
                evidence.states[id] = { x: data.x ?? previous.x, y: data.y ?? previous.y, z: data.z ?? previous.z };
            }
        }
        if (message.type === 'damage' && evidence.damage.length < 100) evidence.damage.push(message.payload);
        if (message.type === 'heal' && evidence.healing.length < 100) evidence.healing.push(message.payload);
        if (message.type === 'ability_result' && evidence.casts.length < 32) evidence.casts.push(message.payload);
        return receive.call(this, message);
    };
    const render = game.renderSystem.render, observed = new WeakSet();
    game.renderSystem.render = function (...args) {
        for (const actor of game.remotePlayers.values()) {
            if (actor.type !== 'Fireball' || !actor.mesh) continue;
            actor.mesh.traverse(child => {
                if (!child.isMesh || observed.has(child)) return;
                observed.add(child);
                const before = child.onBeforeRender;
                child.onBeforeRender = function (...drawArgs) {
                    evidence.projectileDraws++;
                    return before?.apply(this, drawArgs);
                };
            });
        }
        return render.apply(this, args);
    };
}

function readPartyTerrain(ids) {
    const game = window.game, field = game.terrainElevation, seenBones = new Set();
    const actors = ids.map(id => {
        const actor = id === game.player.id ? game.player : game.remotePlayers.get(id);
        const root = actor?.mesh, authority = window.__equippedTerrainParty.states[id];
        let ownedBones = true, independentBones = true, surfaceBatches = 0;
        const bones = new Set();
        root?.traverse(child => {
            for (const bone of child.skeleton?.bones || []) bones.add(bone);
            if (child.material?.userData.fittedSurfaceAttributes) surfaceBatches++;
        });
        for (const bone of bones) {
            ownedBones &&= root.getObjectByProperty('uuid', bone.uuid) === bone;
            independentBones &&= !seenBones.has(bone);
            seenBones.add(bone);
        }
        return {
            ready: Boolean(actor?.isActive && root), class: root?.userData.authoredClass,
            bodyQuality: root?.userData.authoredQuality, items: root?.userData.equipmentVisualItemCount,
            missing: root?.userData.equipmentVisualMissing?.length || 0,
            fallback: root?.userData.equipmentVisualFallback?.length || 0,
            bodyFallback: Boolean(root?.userData.assetFallback), bones: bones.size, ownedBones, independentBones, surfaceBatches,
            ground: actor?.position && field?.sample(actor.position.x, actor.position.z),
            playerError: actor?.position && field ? Math.abs(actor.position.y - field.sample(actor.position.x, actor.position.z)) : Infinity,
            meshError: root && field ? Math.abs(root.position.y - field.sample(root.position.x, root.position.z)) : Infinity,
            authorityError: Number.isFinite(authority?.y) && field ? Math.abs(authority.y - field.sample(authority.x, authority.z)) : Infinity
        };
    });
    const cover = game.getInstanceEnvironmentGroup().children.find(root => root.userData.earthUnderstory);
    return { profile: game.terrainProfile, quality: game.renderSystem.graphicsQuality, actors,
        groundCover: { plants: cover?.userData.plantCount ?? 0, meshes: cover?.children.length ?? 0,
            spatialBatches: Boolean(cover?.children.length && cover.children.every(mesh => mesh.isBatchedMesh)),
            multiDrawAvailable: game.renderSystem.renderer.extensions.has('WEBGL_multi_draw') } };
}

test('connected equipped four-class party shares raised ground, fitted outfits, Fireball draws and targeted healing', async ({ page, browser, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_TERRAIN_PARTY !== '1', 'Explicit disposable connected terrain party check');
    test.skip(process.env.EIDOLON_TERRAIN_PARTY_RENDER_MODE !== 'four-browser', 'Four actual renderer scope only');
    expect(process.env.EIDOLON_E2E_BODY_LOD_PILOT, 'Body LOD diagnostic currently qualifies the single-renderer observer only').toBeUndefined();
    expect(process.env.EIDOLON_E2E_WEARABLE_ATTRIBUTE_PILOT, 'Wearable diagnostic currently qualifies the single-renderer observer only').toBeUndefined();
    expect(process.env.EIDOLON_E2E_SHADOW_GEOMETRY_PILOT, 'Shadow geometry pilot currently qualifies the single-renderer observer only').toBeUndefined();
    expect(process.env.EIDOLON_E2E_GAMEPLAY_COLOR_PILOT, 'Color geometry pilot currently qualifies the single-renderer observer only').toBeUndefined();
    expect(process.env.EIDOLON_E2E_GAMEPLAY_COLOR_COLLARS, 'Color seam collars currently qualify the single-renderer observer only').toBeUndefined();
    expect(process.env.EIDOLON_E2E_ACTOR_INSTANCE_VIEW_PILOT, 'Actor view filtering currently qualifies the single-renderer observer only').toBeUndefined();
    expect(process.env.EIDOLON_E2E_GAMEPLAY_BODY_PILOT, 'Body geometry pilot currently qualifies the single-renderer observer only').toBeUndefined();
    test.setTimeout(230_000);
    expect(process.env.EIDOLON_E2E_WS_URL).toMatch(/^ws:\/\/127\.0\.0\.1:\d+\/ws$/);
    expect(process.env.EIDOLON_E2E_REGISTER).toBe('0');
    const accounts = JSON.parse(process.env.EIDOLON_E2E_TERRAIN_PARTY_ACCOUNTS);
    expect(accounts.map(account => account.characterClass)).toEqual(['Fighter', 'Cleric', 'Rogue', 'Wizard']);
    const quality = process.env.EIDOLON_TERRAIN_PARTY_QUALITY;
    expect(['high', 'low']).toContain(quality);
    // Both settings use desktop input here. Narrow/touch and physical-device
    // acceptance remain separate; quality must not be confused with a phone.
    const viewport = { width: 1280, height: 844 };
    const actors = [], ownedBrowsers = [];
    const command = async (target, text) => {
        await target.locator('#chat-input').click();
        await target.locator('#chat-input').fill(text);
        await target.locator('#chat-input').press('Enter');
        if (await target.locator('#chat-input').evaluate(element => element === document.activeElement)) {
            await target.keyboard.press('Escape');
        }
    };
    try {
        for (const [index, account] of accounts.entries()) {
            let target = page;
            if (index) {
                const extra = await browser.browserType().launch({ executablePath: '/usr/bin/google-chrome',
                    headless: true, args: hardwareWebGLBrowserArgs() });
                ownedBrowsers.push(extra);
                target = await (await extra.newContext({ baseURL, viewport })).newPage();
            }
            await target.setViewportSize(viewport);
            await target.addInitScript(quality => localStorage.setItem('eidolon.graphicsQuality', quality), quality);
            const failures = collectBrowserFailures(target, baseURL);
            await loginAndEnterWorld(target, account);
            await target.evaluate(observePartyTerrain);
            actors.push({ page: target, failures, class: account.characterClass,
                id: await target.evaluate(() => window.game.player.id) });
        }
        const leader = actors[0];
        await leader.page.keyboard.press('o');
        await expect(leader.page.locator('#social-window')).toBeVisible();
        for (let index = 1; index < actors.length; index++) {
            await leader.page.locator('#party-invite-input').fill(accounts[index].username);
            await leader.page.locator('#btn-invite-party').click();
            await expect(actors[index].page.locator('#party-request-modal')).toBeVisible();
            await actors[index].page.locator('#btn-accept-party').click();
        }
        await leader.page.keyboard.press('Escape');
        await expect.poll(() => leader.page.evaluate(() => window.game.uiManager.social.partyData?.members?.length)).toBe(4);
        for (const actor of actors) {
            // Invite controls legitimately retain keyboard focus. Enter may
            // activate that button; use the player's visible chat input first.
            await actor.page.locator('#chat-input').click();
            await useEncounterQAWaypoint(actor.page);
        }
        for (const [index, actor] of actors.entries()) {
            const [x, z] = [[-6, 0], [4, 0], [0, 6], [0, -6]][index];
            await moveByGroundClick(actor.page, x, z, { moveOnly: true, allowAlternatePaths: true,
                allowJumpFallback: false, minimumDistance: 2 });
        }
        const ids = actors.map(actor => actor.id);
        const assertParty = async actor => {
            await expect.poll(async () => {
                const value = await actor.page.evaluate(readPartyTerrain, ids);
                return value.profile === 'earth-elevation-rocks-v1' && value.quality === quality &&
                    value.actors.length === 4 && value.actors.every((entry, index) => entry.ready &&
                        entry.class === actors[index].class && entry.bodyQuality === quality && entry.items === 14 &&
                        !entry.missing && !entry.fallback && !entry.bodyFallback && entry.bones > 0 &&
                        entry.ownedBones && entry.independentBones && entry.ground > 1 &&
                        entry.playerError < .1 && entry.meshError < .15 && entry.authorityError < .1);
            }, { message: 'All four actual replicated outfits/rigs must be independently owned and grounded', timeout: 30_000 }).toBe(true);
        };
        for (const actor of actors) await assertParty(actor);

        const wizard = actors[3];
        let hostile;
        await expect.poll(async () => {
            hostile = await projectNearestHostile(wizard.page);
            return Boolean(hostile?.health > 0 && hostile.distance < 20);
        }).toBe(true);
        await wizard.page.mouse.move(hostile.x, hostile.y);
        await expect.poll(() => wizard.page.evaluate(() => window.game.hoveredEntity?.id)).toBe(hostile.id);
        await wizard.page.keyboard.press('1');
        await expect.poll(() => wizard.page.evaluate(({ source, target }) => window.__equippedTerrainParty.damage.some(
            value => value.sourceId === source && value.targetId === target && value.amount > 0
        ), { source: wizard.id, target: hostile.id })).toBe(true);
        await expect.poll(() => wizard.page.evaluate(() => window.__equippedTerrainParty.projectileDraws)).toBeGreaterThan(0);
        // A bounded QA wound is preparation, not evidence of hostile damage.
        const woundSequence = await leader.page.evaluate(() => window.game.animationQAReadySequence || 0);
        await command(leader.page, '/qa-animation-ready low-health');
        await expect.poll(() => leader.page.evaluate(() => window.game.animationQAReadySequence || 0)).toBeGreaterThan(woundSequence);
        const healer = actors[1];
        await expect.poll(() => healer.page.evaluate(() => window.game.player.hotbar?.[0])).toBe('Healing Light');
        await healer.page.locator(`[data-party-support-target="${leader.id}"]`).click();
        await expect(healer.page.locator(`[data-party-support-target="${leader.id}"]`)).toBeFocused();
        await healer.page.keyboard.press('1');
        try {
            await expect.poll(() => healer.page.evaluate(({ source, target }) => window.__equippedTerrainParty.healing.some(
                value => value.sourceId === source && value.targetId === target && value.amount > 0
            ), { source: healer.id, target: leader.id })).toBe(true);
        } catch (error) {
            const diagnostic = await healer.page.evaluate(id => {
                const game = window.game, ally = game.remotePlayers.get(id);
                return { selected: game.getDesktopSupportTarget()?.id === id, skill: game.player.hotbar?.[0],
                    distance: ally?.position.distanceTo(game.player.position), hp: ally?.stats.hp,
                    casts: window.__equippedTerrainParty.casts, heals: window.__equippedTerrainParty.healing.length };
            }, leader.id);
            throw new Error(`Raised party heal failed: ${JSON.stringify(diagnostic)}`, { cause: error });
        }
        for (const actor of actors) await assertParty(actor);
        await expect(leader.page.locator('#esc-menu')).toBeHidden();
        const report = await profileGameplayScene(leader.page, `connected-equipped-raised-party-${quality}`);
        expect(report.frames).toBe(180);
        expect(report.visibleFrames).toBe(180); expect(report.restored).toBe(true);
        expect(report.frameSamples).toHaveLength(180);
        expect(report.visibility).toBe('visible');
        expect(report.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
        expect(report.drawCallsMedian).toBeGreaterThan(0);
        await testInfo.attach('connected-equipped-party-profile', { body: JSON.stringify({ ...report,
            scope: 'Four real browser clients share one GPU. Measurement, not a standalone frame-budget or physical-phone certificate.',
            party: await leader.page.evaluate(readPartyTerrain, ids) }, null, 2), contentType: 'application/json' });
        await leader.page.screenshot({ path: testInfo.outputPath(`connected-equipped-party-${quality}.png`) });
        for (const actor of actors) expect(actor.failures, actor.failures.join('\n')).toEqual([]);
        console.log('[equipped-terrain-party]', JSON.stringify({ quality, ...report }));
    } finally {
        for (const actor of actors) await actor.page.evaluate(() => window.game?.destroy?.()).catch(() => {});
        for (const extra of ownedBrowsers) await extra.close();
    }
});

// This separately measures one real renderer with three still-connected normal
// socket peers, avoiding four renderers competing for a single test GPU. It is
// not a substitute for the native four-client input/healing checks above.
test('single native renderer observes three live equipped party socket peers on raised ground', async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_TERRAIN_PARTY !== '1' ||
        process.env.EIDOLON_TERRAIN_PARTY_RENDER_MODE !== 'single-renderer', 'Explicit isolated single-renderer party scope');
    test.setTimeout((process.env.EIDOLON_TERRAIN_ART_ROUTE === '1' || process.env.EIDOLON_TERRAIN_RIG_PAIR === '1') ? 230_000 : 180_000);
    const url = process.env.EIDOLON_E2E_WS_URL;
    expect(url).toMatch(/^ws:\/\/127\.0\.0\.1:\d+\/ws$/);
    expect(process.env.EIDOLON_E2E_REGISTER).toBe('0');
    const accounts = JSON.parse(process.env.EIDOLON_E2E_TERRAIN_PARTY_ACCOUNTS);
    expect(accounts.map(account => account.characterClass)).toEqual(['Fighter', 'Cleric', 'Rogue', 'Wizard']);
    const quality = process.env.EIDOLON_TERRAIN_PARTY_QUALITY;
    expect(['high', 'low']).toContain(quality);
    const failures = collectBrowserFailures(page, baseURL), peers = [];
    let peerStage = 'joining';
    const peerLiveness = [];
    const recordPeerLiveness = stage => {
        peerStage = stage;
        peerLiveness.push({ stage, readyStates: peers.map(peer => peer.socket.readyState) });
    };
    const wearablePilot = await installWearableAttributePilot(page);
    const bodyPilot = await installBodyLodPilot(page);
    const bodySelection = process.env.EIDOLON_TERRAIN_BODY_SELECTION === '1'
        ? JSON.parse(await readFile('assets/archetypes/runtime-selection.json', 'utf8')) : null;
    const bodyResponses = [];
    if (bodySelection) {
        const paths = new Set(Object.values(bodySelection.characters).map(row => `/${row.variants[quality].file}`));
        page.on('response', response => {
            if (!paths.has(new URL(response.url()).pathname)) return;
            const row = { url: response.url(), status: response.status(), fromServiceWorker: response.fromServiceWorker() };
            bodyResponses.push(row);
        });
    }
    const waitMessage = async (peer, type, predicate = () => true) => {
        let index;
        await expect.poll(() => {
            expect(peer.errors).toEqual([]);
            index = peer.messages.findIndex(message => message.type === type && predicate(message.payload));
            return index;
        }, { timeout: 15_000, message: `Normal isolated socket acknowledgement: ${type}` }).toBeGreaterThanOrEqual(0);
        return peer.messages.splice(index, 1)[0].payload;
    };
    const send = (peer, type, payload) => peer.socket.send(JSON.stringify({ type, payload }));
    if (process.env.EIDOLON_TERRAIN_PARTY_FOLIAGE_COMPARE === '1') {
        const previous = execFileSync('git', ['show', '5c4998e9:src/core/FoliageShadowInfluence.js'], { encoding: 'utf8' });
        await page.route('**/src/core/FoliageShadowInfluenceReference.js', route => route.fulfill({ body: previous, contentType: 'text/javascript' }));
    }
    try {
        await page.setViewportSize({ width: 1280, height: 844 });
        await page.addInitScript(quality => localStorage.setItem('eidolon.graphicsQuality', quality), quality);
        await loginAndEnterWorld(page, accounts[0]);
        if (process.env.EIDOLON_E2E_STATUS_HUD_REVIEW === '1') {
            await expect.poll(() => page.evaluate(() => window.game.player.mesh?.userData.equipmentVisualItemCount)).toBe(14);
            const button = page.locator('#minimap-buff-list [data-buff-id="well_rested"]');
            await expect(button).toBeVisible();
            expect(await button.locator('svg').count()).toBe(1);
            await button.focus();
            const before = await page.evaluate(() => {
                const minimap = window.game.minimap, button = minimap.buffList.querySelector('[data-buff-id="well_rested"]');
                window.__savedStatusButton = button;
                return { label: button.getAttribute('aria-label'), seconds: window.game.player.wellRestedSeconds,
                    width: minimap.buffList.getBoundingClientRect().width };
            });
            await expect.poll(() => button.getAttribute('aria-label')).not.toBe(before.label);
            const after = await page.evaluate(() => {
                const game = window.game, minimap = game.minimap, button = window.__savedStatusButton;
                delete window.__savedStatusButton;
                return { sameButton: minimap.buffList.querySelector('[data-buff-id="well_rested"]') === button,
                    focused: document.activeElement === button, tooltipVisible: minimap.buffTooltip.style.display === 'block',
                    tooltip: minimap.buffTooltip.textContent, seconds: game.player.wellRestedSeconds,
                    equippedItems: game.player.mesh.userData.equipmentVisualItemCount, hp: game.player.stats.hp };
            });
            expect(before.width).toBeLessThanOrEqual(64);
            expect(after).toMatchObject({ sameButton: true, focused: true, tooltipVisible: true, equippedItems: 14 });
            expect(after.seconds).toBeGreaterThan(before.seconds); expect(after.hp).toBeGreaterThan(0);
            expect(after.tooltip).toContain('Well Rested');
            await page.screenshot({ path: testInfo.outputPath('actual-saved-status-hud.png') });
            await writeFile(testInfo.outputPath('actual-saved-status-hud.json'), JSON.stringify({ before, after,
                scope: 'Normal authenticated saved Fighter in actual town with14equipped slots; real server-earned WellRested timer, native focus/tooltip stability. No buff/stat/time writes.' }, null, 2));
            await page.keyboard.press('Escape');
            await expect(page.locator('#minimap-buff-tooltip')).toBeHidden();
        }
        if (process.env.EIDOLON_TERRAIN_ART_ROUTE === '1') await captureEarthMovingRoute(page, testInfo);
        if (process.env.EIDOLON_TERRAIN_RENDER_DIAGNOSTIC === '1') await captureActualSceneRenderDiagnosis(page, testInfo);
        await page.evaluate(observePartyTerrain);
        const leaderID = await page.evaluate(() => window.game.player.id);
        await page.keyboard.press('o');
        await expect(page.locator('#social-window')).toBeVisible();
        for (const account of accounts.slice(1)) {
            const peer = { socket: new globalThis.WebSocket(url), messages: [], errors: [], closes: [], openedAt: performance.now() };
            peers.push(peer);
            peer.socket.addEventListener('close', event => peer.closes.push({ stage: peerStage, code: event.code,
                clean: event.wasClean, elapsedMilliseconds: performance.now() - peer.openedAt }));
            peer.socket.addEventListener('error', () => peer.errors.push('isolated socket transport error'));
            peer.socket.addEventListener('message', event => {
                // Binary replication is consumed normally by the native browser.
                // Peers need only bounded JSON acknowledgements, never tokens/logs.
                if (typeof event.data !== 'string') return;
                const message = JSON.parse(event.data);
                if (message.type === 'error') peer.errors.push(message.payload?.message || 'server rejected isolated peer');
                if (peer.messages.length >= 256) peer.messages.shift();
                peer.messages.push(message);
            });
            await expect.poll(() => peer.socket.readyState).toBe(1);
            send(peer, 'login', { username: account.username, password: account.password });
            const login = await waitMessage(peer, 'login_success');
            expect(login.terrainProfile).toBe('earth-elevation-rocks-v1');
            send(peer, 'join', { type: account.characterClass });
            await waitMessage(peer, 'quest_update');
            // Real user-visible invitation, accepted by a real authenticated peer.
            await page.locator('#party-invite-input').fill(account.username);
            await page.locator('#btn-invite-party').click();
            const invite = await waitMessage(peer, 'party_request');
            expect(invite.targetName).toBe(accounts[0].username);
            send(peer, 'party_response', { inviterName: accounts[0].username, invitationId: invite.invitationId, accepted: true });
            await waitMessage(peer, 'party_update');
            send(peer, 'chat', { message: '/qa-waypoint encounter' });
            await waitMessage(peer, 'chat', value => value?.message?.includes('live overworld encounter'));
        }
        await expect.poll(() => page.evaluate(() => window.game.uiManager.social.partyData?.members?.length)).toBe(4);
        await page.keyboard.press('Escape');
        await expect(page.locator('#social-window')).toBeHidden();
        await page.locator('#chat-input').click();
        await useEncounterQAWaypoint(page);
        await moveByGroundClick(page, -6, 0, { moveOnly: true, allowAlternatePaths: true, allowJumpFallback: false, minimumDistance: 2 });
        const ids = await page.evaluate(leaderID => [leaderID, ...window.game.uiManager.social.partyData.members
            .map(member => member.id).filter(id => id !== leaderID)], leaderID);
        await expect.poll(async () => {
            const value = await page.evaluate(readPartyTerrain, ids);
            return value.profile === 'earth-elevation-rocks-v1' && value.quality === quality && value.actors.length === 4 &&
                value.actors.every(entry => entry.ready && entry.bodyQuality === quality && entry.items === 14 &&
                    !entry.missing && !entry.fallback && !entry.bodyFallback && entry.bones > 0 &&
                    entry.ownedBones && entry.independentBones && entry.ground > 1 && entry.playerError < .1 &&
                    entry.meshError < .15 && entry.authorityError < .1);
        }, { timeout: 30_000 }).toBe(true);
        await expect(page.locator('#esc-menu')).toBeHidden();
        for (const peer of peers) expect(peer.socket.readyState).toBe(1);
        recordPeerLiveness('preparation-start');
        if (process.env.EIDOLON_E2E_GAMEPLAY_BODY_PILOT === '1') {
            const preparation = await prepareGameplayBodyPilot(page, 'game', .006, testInfo.outputPath('gameplay-body-sources.json'));
            expect(preparation.sources).toBe(4);
            const paired = await page.evaluate(() => {
                const render = window.game.renderSystem, pilot = window.__gameplayBodyPilot;
                if (render.currentZoom < 10) throw new Error('Actual body pilot requires gameplay-size projection');
                const capture = enabled => {
                    pilot.select(enabled); render.render();
                    return { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
                };
                try {
                    return { reference: capture(false), candidate: capture(true), referenceAgain: capture(false),
                        quality: render.graphicsQuality, zoom: render.currentZoom,
                        ownedBufferBytes: [...pilot.meshes.values()].reduce((sum, entry) => sum + entry.candidate.index.array.byteLength +
                            Object.values(entry.candidate.attributes).reduce((total, attr) => total + attr.array.byteLength, 0) +
                            Object.values(entry.candidate.morphAttributes).flat().reduce((total, attr) => total + attr.array.byteLength, 0), 0) };
                } finally { pilot.select(true); }
            });
            await writeFile(testInfo.outputPath('gameplay-body-party.json'), JSON.stringify({
                scope: 'Explicit gameplay-size body index experiment in one connected renderer; full raw skin and both blink targets retained. Ordinary assets and worker. Synchronous count control before independent gear/eye and shadow preparations. No continuous LOD, device or final art acceptance.',
                preparation, paired
            }, null, 2));
            expect(paired.referenceAgain.triangles).toBe(paired.reference.triangles);
            expect(paired.candidate.triangles).toBeLessThan(paired.reference.triangles);
            console.log('[gameplay-body-party]', JSON.stringify({ paired,
                sourceTriangles: preparation.derivatives.reduce((sum, row) => sum + row.sourceTriangles, 0),
                candidateTriangles: preparation.derivatives.reduce((sum, row) => sum + row.candidateTriangles, 0) }));
            recordPeerLiveness('body-prepared');
        }
        if (process.env.EIDOLON_E2E_GAMEPLAY_COLOR_PILOT === '1') {
            const preparation = await prepareGameplayColorPilot(page, 'game', .006, testInfo.outputPath('gameplay-color-sources.json'));
            const paired = await page.evaluate(() => {
                const render = window.game.renderSystem, pilot = window.__gameplayColorPilot;
                if (render.currentZoom < 10) throw new Error('Actual color pilot requires gameplay-size projection');
                const capture = enabled => {
                    pilot.select(enabled); render.render();
                    return { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
                };
                try {
                    return { reference: capture(false), candidate: capture(true), referenceAgain: capture(false),
                        quality: render.graphicsQuality, zoom: render.currentZoom,
                        ownedBufferBytes: [...pilot.meshes.values()].reduce((sum, entry) => sum + entry.candidate.index.array.byteLength +
                            Object.values(entry.candidate.attributes).reduce((total, attr) => total + attr.array.byteLength, 0), 0) };
                } finally { pilot.select(true); }
            });
            await writeFile(testInfo.outputPath('gameplay-color-party.json'), JSON.stringify({
                scope: 'Explicit gameplay-size color index pilot in one actual connected renderer. Ordinary assets and worker; synchronous counts include its ordinary shadow effect before any separate shadow pilot. No dynamic LOD, device or final art acceptance.',
                preparation, paired
            }, null, 2));
            expect(paired.referenceAgain.triangles).toBe(paired.reference.triangles);
            expect(paired.candidate.triangles).toBeLessThan(paired.reference.triangles);
            console.log('[gameplay-color-party]', JSON.stringify({ paired,
                sourceTriangles: preparation.derivatives.reduce((sum, row) => sum + row.sourceTriangles, 0),
                candidateTriangles: preparation.derivatives.reduce((sum, row) => sum + row.candidateTriangles, 0) }));
            recordPeerLiveness('gear-prepared');
        }
        if (process.env.EIDOLON_E2E_SHADOW_GEOMETRY_PILOT === '1') {
            expect(quality, 'Shadow geometry pilot requires actual High shadows').toBe('high');
            const preparation = await prepareShadowGeometryPilot(page, 'game');
            expect(preparation.derivatives.filter(row => /_Body$/.test(row.name))).toHaveLength(4);
            const selection = await selectSimplifiedShadowGeometry(page, preparation.derivatives);
            const paired = await page.evaluate(() => {
                const render = window.game.renderSystem, pilot = window.__shadowGeometryPilot;
                const capture = enabled => {
                    // Composer fullscreen passes have their own shadow calls.
                    // Observe swaps immediately after the actual scene pass.
                    const shadow = render.renderer.shadowMap, original = shadow.render;
                    let swaps = 0;
                    shadow.render = function (...args) {
                        const result = original.apply(this, args);
                        if (args[1] === render.scene) swaps += pilot.pass.lastSwaps;
                        return result;
                    };
                    try {
                        pilot.pass.enabled = enabled; render.render();
                        return { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles, swaps };
                    } finally { shadow.render = original; }
                };
                try {
                    const reference = capture(false), candidate = capture(true), referenceAgain = capture(false);
                    const ownedBufferBytes = [...pilot.pass.entries.values()].reduce((sum, entry) => sum +
                        entry.geometry.index.array.byteLength + Object.values(entry.geometry.attributes).reduce((total, attr) => total + attr.array.byteLength, 0) +
                        (entry.geometry.morphAttributes.position || []).reduce((total, attr) => total + attr.array.byteLength, 0), 0);
                    return { reference, candidate, referenceAgain, ownedBufferBytes,
                        restored: [...pilot.pass.entries.values()].every(entry => entry.mesh.geometry === entry.source),
                        registered: pilot.pass.entries.size };
                } finally { pilot.pass.enabled = true; }
            });
            await writeFile(testInfo.outputPath('shadow-party-pilot.json'), JSON.stringify({
                scope: 'Explicit High shadow-only pilot in one actual connected renderer; ordinary selected assets and service worker. Untimed synchronous counts, no physical-device, four-renderer, battle, or production acceptance.',
                preparation, selection, paired
            }, null, 2));
            console.log('[shadow-party-pilot]', JSON.stringify({ selection, paired }));
            expect(paired.restored).toBe(true);
            expect(paired.candidate.swaps).toBeGreaterThan(0);
            expect(paired.referenceAgain.triangles).toBe(paired.reference.triangles);
            expect(paired.candidate.triangles).toBeLessThan(paired.reference.triangles);
            recordPeerLiveness('shadow-prepared');
        }
        if (process.env.EIDOLON_E2E_ACTOR_INSTANCE_VIEW_PILOT === '1') {
            const paired = await prepareActorInstanceViewPilot(page);
            await writeFile(testInfo.outputPath('actor-view-party.json'), JSON.stringify({
                scope: 'Optional actor view filtering in one actual connected renderer; exact frozen-clock RGB control and bounded CPU submission ABBA. Ordinary instancing, source geometry, assets and worker retained. No four-renderer or device acceptance.', paired
            }, null, 2));
            console.log('[actor-view-party]', JSON.stringify(paired));
            expect(paired.image.changedChannels).toBe(0);
            expect(paired.image.unstableChannels).toBe(0);
            expect(paired.referenceAgain.triangles).toBe(paired.reference.triangles);
            expect(paired.candidate.calls).toBeLessThanOrEqual(paired.reference.calls);
            expect(paired.candidate.triangles).toBeLessThan(paired.reference.triangles);
            expect(paired.candidate.stats.culled).toBeGreaterThan(0);
            for (const row of [paired.reference, paired.candidate, paired.referenceAgain, ...paired.cpu.blocks]) expect(row.restored).toBe(true);
            recordPeerLiveness('actor-view-prepared');
        }
        if (process.env.EIDOLON_E2E_ACTOR_SHADOW_INFLUENCE_PILOT === '1') {
            const paired = await prepareActorShadowInfluencePilot(page);
            await writeFile(testInfo.outputPath('actor-shadow-influence-party.json'), JSON.stringify({
                scope: 'Optional conservative shadow influence with default geometry owner and ordinary supplied assets. Strict frozen RGB controls, current rigid pivots/instance matrices and real-clock ABBA submission. Selected during following motion and180-frame actual sample. No supplied skin shadow simplification, actor hiding or target change.', paired
            }, null, 2));
            expect(paired.image.changedChannels).toBe(0); expect(paired.image.unstableChannels).toBe(0);
            expect(paired.referenceAgain.calls).toBe(paired.reference.calls);
            expect(paired.referenceAgain.triangles).toBe(paired.reference.triangles);
            expect(paired.candidate.calls).toBeLessThan(paired.reference.calls);
            expect(paired.candidate.stats.omitted).toBeGreaterThan(0);
            for (const row of [paired.reference, paired.candidate, paired.referenceAgain, ...paired.cpu.blocks]) expect(row.restored).toBe(true);
            recordPeerLiveness('actor-shadow-influence-prepared');
        }
        if (process.env.EIDOLON_E2E_GAMEPLAY_GEOMETRY_LIFECYCLE === '1' || process.env.EIDOLON_E2E_GAMEPLAY_GEOMETRY_DELIVERY === '1') {
            await captureGameplayGeometryParty(page, testInfo);
            recordPeerLiveness('geometry-lifecycle-prepared');
        }
        if (process.env.EIDOLON_E2E_ACTOR_CELL_MULTI_DRAW === '1') await prepareActorCellMultiDrawParty(page, testInfo);
        recordPeerLiveness('profiling');
        const report = await profileGameplayScene(page, `single-renderer-equipped-raised-party-${quality}`);
        expect(report.frames).toBe(180);
        expect(report.visibleFrames).toBe(180); expect(report.restored).toBe(true);
        expect(report.frameSamples).toHaveLength(180);
        expect(report.visibility).toBe('visible');
        expect(report.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
        expect(report.drawCallsMedian).toBeGreaterThan(0);
        recordPeerLiveness('profile-complete');
        if (process.env.EIDOLON_E2E_DEFAULT_ACTOR_MULTI_DRAW === '1') {
            const startup = await page.evaluate(() => {
                const render = window.game.renderSystem, owner = render.actorInstances, multi = owner?.multiDraw;
                return { selectedAutomatically: Boolean(owner?.enabled && multi?.enabled && multi.perInstanceFrustum),
                    groups: multi?.entries.size || 0, extension: render.renderer.extensions.has('WEBGL_multi_draw'),
                    restored: !owner?.hidden.length && !multi?.hidden.length && !owner?.group.visible && !multi?.group.visible };
            });
            const budget = { maximumDraws: quality === 'high' ? 350 : 200, maximumTriangles: quality === 'high' ? 250000 : 85000,
                maximumFrameMedianMs: 20, maximumFrameP95Ms: 33.4 };
            await writeFile(testInfo.outputPath('default-actor-cell-startup.json'), JSON.stringify({ startup, budget,
                profile: report, scope: 'Normal compiled game startup and untouched selected default; no manual multi-draw installation or rigid handgear pilot. One native renderer and three socket peers, ordinary generated-world population. Exact original quality budgets; final saved accounts checked by owned Go-race harness.' }, null, 2));
            expect(startup.selectedAutomatically).toBe(true); expect(startup.groups).toBeGreaterThan(0);
            expect(startup.extension).toBe(true); expect(startup.restored).toBe(true);
            expect(report.drawCallsMedian).toBeLessThanOrEqual(budget.maximumDraws);
            expect(report.trianglesMedian).toBeLessThanOrEqual(budget.maximumTriangles);
            expect(report.frameMedianMs).toBeLessThanOrEqual(budget.maximumFrameMedianMs);
            expect(report.frameP95Ms).toBeLessThanOrEqual(budget.maximumFrameP95Ms);
        }
        if (process.env.EIDOLON_E2E_PARTY_SUBMISSION_FRAMES === '1') await capturePartySubmissionFrames(page, testInfo);
        for (const peer of peers) { expect(peer.socket.readyState, JSON.stringify(peer.closes)).toBe(1); expect(peer.errors).toEqual([]); }
        const party = await page.evaluate(readPartyTerrain, ids);
        expect(party.actors.map(actor => actor.class).sort()).toEqual(['Cleric', 'Fighter', 'Rogue', 'Wizard']);
        if (bodySelection) {
            expect(wearablePilot, 'Selected-path cache qualification requires ordinary wearable assets and service worker').toBeNull();
            expect(bodyPilot, 'Selected-path qualification must use ordinary assets').toBeNull();
            const selection = bodySelection;
            const selected = await page.evaluate(async ({ ids, selection, quality }) => {
                const { MeshFactory } = await import('/src/utils/MeshFactory.js');
                const { authoredCharacterPath } = await import('/src/art/AuthoredCharacters.js');
                const { resolveAssetPath } = await import('/src/assets/assetManifest.js');
                const cache = await caches.open('eidolon-assets-2026-09-04-11');
                return Promise.all(ids.map(async id => {
                    const game = window.game, actor = id === game.player.id ? game.player : game.remotePlayers.get(id);
                    const name = actor.mesh.userData.authoredClass, variant = selection.characters[name].variants[quality];
                    const path = authoredCharacterPath(name, quality), cached = MeshFactory.cache[path];
                    const body = cached?.scene.getObjectByName(`${name}_Body`);
                    const url = new URL(resolveAssetPath(path), document.baseURI).href;
                    // Chrome may omit CDP response bodies served by a worker.
                    // Read the exact response clone that the production worker
                    // cached during this observed GET; never issue another GET.
                    const response = await cache.match(url);
                    const cachedSHA256 = response ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', await response.arrayBuffer()))]
                        .map(byte => byte.toString(16).padStart(2, '0')).join('') : null;
                    return { name, path, expectedPath: `./${variant.file}`, url,
                        expectedVersion: variant.sha256.slice(0, 16), expectedSHA256: variant.sha256,
                        cachedSHA256,
                        cachedOriginalBodyTriangles: body?.geometry.index.count / 3,
                        expectedBodyTriangles: variant.bodyTriangles,
                        liveMaskedBodyTriangles: actor.mesh.getObjectByName(`${name}_Body`).geometry.index.count / 3 };
                }));
            }, { ids, selection, quality });
            // Resource Timing's bounded buffer can omit early model requests
            // in a populated world. Keep actual response metadata from before
            // login, and hash the worker's exact cache entries above.
            await writeFile(testInfo.outputPath('selected-body-runtime.json'), JSON.stringify({ selected, bodyResponses }, null, 2));
            expect(selected).toHaveLength(4);
            for (const row of selected) {
                expect(row.path).toBe(row.expectedPath);
                expect(new URL(row.url).searchParams.get('v')).toBe(row.expectedVersion);
                expect(bodyResponses.some(response => response.url === row.url && response.status === 200 &&
                    response.fromServiceWorker), `${row.name} actual selected worker response`).toBe(true);
                expect(row.cachedSHA256, `${row.name} actual selected cached response hash`).toBe(row.expectedSHA256);
                expect(row.cachedOriginalBodyTriangles).toBe(row.expectedBodyTriangles);
                expect(row.liveMaskedBodyTriangles).toBeGreaterThan(0);
                expect(row.liveMaskedBodyTriangles).toBeLessThanOrEqual(row.expectedBodyTriangles);
            }
        }
        expect(party.groundCover.plants).toBeGreaterThan(0);
        expect(party.groundCover.spatialBatches).toBe(party.groundCover.multiDrawAvailable);
        expect(party.actors.every(entry => entry.surfaceBatches > 0), 'Actual connected class outfits must use the qualified surface submissions').toBe(true);
        // Untimed draw attribution at the renderer boundary. Per-object hooks
        // would disable eligible ActorInstanceBatches, distorting this evidence.
        const draws = await page.evaluate(() => {
            const render = window.game.renderSystem, renderer = render.renderer;
            const original = renderer.renderBufferDirect, counts = new Map();
            const boundaries = [render.scene, render.staticEnvironmentGroup, render.entityGroup];
            renderer.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
                let root = object;
                while (root.parent && !boundaries.includes(root.parent) && !root.userData.authoredClass) root = root.parent;
                const name = root.userData.authoredClass ? `Equipped ${root.userData.authoredClass}`
                    : root.userData.tiledRealmGround ? 'Canonical terrain tiles' : root.name || root.type;
                const entry = counts.get(name) || { name, color: 0, shadow: 0, triangles: 0 };
                counts.set(name, entry);
                entry[camera === render.camera ? 'color' : 'shadow']++;
                const vertices = group?.count ?? Math.min(geometry.drawRange.count,
                    geometry.index?.count ?? geometry.attributes.position.count);
                if (object.isBatchedMesh) {
                    for (let i = 0; i < object._multiDrawCount; i++) entry.triangles += object._multiDrawCounts[i] / 3;
                } else entry.triangles += vertices / 3 * (object.isInstancedMesh ? object.count :
                    geometry.isInstancedBufferGeometry ? geometry.instanceCount : 1);
                return original.call(this, camera, scene, geometry, material, object, group);
            };
            try {
                render.render();
                return [...counts.values()].sort((a, b) => b.color + b.shadow - a.color - a.shadow);
            } finally { renderer.renderBufferDirect = original; }
        });
        if (process.env.EIDOLON_E2E_ACTOR_BATCH_CENSUS === '1') await captureActorSubmissionCensus(page, testInfo);
        const pairedDraws = await page.evaluate(() => {
            const render = window.game.renderSystem, instances = render.actorInstances;
            const enabled = instances.enabled;
            const capture = value => {
                instances.enabled = value; render.render();
                return { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
            };
            try { return { without: capture(false), with: capture(true) }; }
            finally { instances.enabled = enabled; instances.endFrame(); }
        });
        expect(pairedDraws.with.calls).toBeLessThan(pairedDraws.without.calls);
        if (process.env.EIDOLON_E2E_GAMEPLAY_COLOR_COLLARS === '1') {
            const census = await page.evaluate(() => {
                const game = window.game, rows = [];
                for (const actor of [game.player, ...game.remotePlayers.values()]) {
                    const actorClass = actor.mesh?.userData.authoredClass;
                    if (!['Fighter', 'Cleric', 'Rogue', 'Wizard'].includes(actorClass)) continue;
                    actor.mesh.traverseVisible(mesh => {
                        const geometry = mesh.geometry, material = mesh.material;
                        if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh || !geometry?.index) return;
                        rows.push({ actorClass, name: mesh.name, triangles: geometry.index.count / 3,
                            vertices: geometry.attributes.position.count, castShadow: mesh.castShadow,
                            attributes: Object.keys(geometry.attributes), morphs: Object.keys(geometry.morphAttributes),
                            groups: geometry.groups.length, fullRange: geometry.drawRange.start === 0 && geometry.drawRange.count === Infinity,
                            material: Array.isArray(material) ? 'multiple' : material?.type,
                            transparent: material?.transparent, opacity: material?.opacity,
                            textured: Boolean(material?.map || material?.normalMap || material?.roughnessMap || material?.metalnessMap) });
                    });
                }
                return rows;
            });
            await writeFile(testInfo.outputPath('equipped-rigid-census.json'), JSON.stringify({
                scope: 'Untimed visible indexed rigid meshes beneath the four equipped roots after profiling; source metadata only, no geometry reduction or draw attribution guarantee.',
                rows: census
            }, null, 2));
        }
        await testInfo.attach('single-renderer-live-party-profile', { body: JSON.stringify({ ...report, party,
            scope: 'One actual GPU renderer, three live normal authenticated socket peers; standing/movement snapshot, not peer input or a battle frame-budget certificate.'
        }, null, 2), contentType: 'application/json' });
        if (process.env.EIDOLON_TERRAIN_UNDERSTORY_DETAIL_COMPARE === '1') await captureUnderstoryDetailComparison(page, testInfo);
        await testInfo.attach('untimed-party-draw-attribution', { body: JSON.stringify(draws, null, 2), contentType: 'application/json' });
        await testInfo.attach('untimed-same-scene-instance-comparison', { body: JSON.stringify({ ...pairedDraws,
            scope: 'Two untimed synchronous renders of the same party/poses/camera. Borrowed exact geometry; aggregate instance bounds may draw more offscreen triangles. Not a frame-budget certificate.'
        }, null, 2), contentType: 'application/json' });
        if (process.env.EIDOLON_TERRAIN_PARTY_SUBMISSION_COMPARE === '1') {
            // Diagnostic only: alternate identical plant content in this actual
            // connected scene. Actors, AI, weather and normal RAF stay live.
            // Record entity counts rather than treating another fixture's
            // different population as a comparable performance baseline.
            await page.evaluate(async () => {
                const { createEarthUnderstory } = await import('/src/art/EarthUnderstory.js');
                const game = window.game, render = game.renderSystem;
                const parent = game.getInstanceEnvironmentGroup();
                const spatial = parent.children.find(root => root.userData.earthUnderstory);
                if (!spatial?.children.every(mesh => mesh.isBatchedMesh)) throw new Error('Paired diagnostic requires actual spatial production cover');
                const original = createEarthUnderstory({ quality: render.graphicsQuality, terrainElevation: game.terrainElevation });
                if (original.userData.plantCount !== spatial.userData.plantCount) throw new Error('Paired diagnostic lost plants');
                window.__understorySubmissionComparison = { parent, spatial, original, render };
            });
            const phases = [];
            try {
                for (const mode of ['original', 'spatial', 'spatial', 'original']) {
                    await page.evaluate(async mode => {
                        const state = window.__understorySubmissionComparison;
                        state.original.removeFromParent(); state.spatial.removeFromParent(); state.parent.add(state[mode]);
                        for (let i = 0; i < 20; i++) await new Promise(resolve => requestAnimationFrame(resolve));
                    }, mode);
                    phases.push({ mode, ...await profileGameplayScene(page, `paired-ground-cover-${mode}`) });
                }
            } finally {
                await page.evaluate(() => {
                    const state = window.__understorySubmissionComparison;
                    state.original.removeFromParent(); state.spatial.removeFromParent(); state.parent.add(state.spatial);
                    state.render.disposeObjectResources(state.original); delete window.__understorySubmissionComparison;
                });
            }
            await testInfo.attach('paired-ground-cover-profile', { body: JSON.stringify({ phases,
                scope: 'Alternating full-game samples of the same connected party and exact plant content; normal simulation and natural entity changes retained. Diagnostic, not physical-device or busy-battle certification.'
            }, null, 2), contentType: 'application/json' });
            console.log('[paired-ground-cover-profile]', JSON.stringify(phases));
        }
        if (process.env.EIDOLON_TERRAIN_PARTY_FOLIAGE_COMPARE === '1') {
            await page.evaluate(async () => {
                const { FoliageShadowInfluence: Reference } = await import('/src/core/FoliageShadowInfluenceReference.js');
                const render = window.game.renderSystem;
                window.__foliageProjectionComparison = { render, candidate: render.foliageShadowInfluence,
                    previous: new Reference(render.scene, [render.scene, render.environmentGroup,
                        render.staticEnvironmentGroup, render.instanceEnvironmentGroup]) };
            });
            const phases = [];
            try {
                for (const mode of ['previous', 'candidate', 'candidate', 'previous']) {
                    await page.evaluate(async mode => {
                        const state = window.__foliageProjectionComparison;
                        state.render.foliageShadowInfluence.endFrame(); state.render.foliageShadowInfluence = state[mode];
                        for (let i = 0; i < 20; i++) await new Promise(resolve => requestAnimationFrame(resolve));
                    }, mode);
                    phases.push({ mode, ...await profileGameplayScene(page, `paired-foliage-projection-${mode}`) });
                }
            } finally {
                await page.evaluate(() => {
                    const state = window.__foliageProjectionComparison;
                    state.render.foliageShadowInfluence.endFrame(); state.render.foliageShadowInfluence = state.candidate;
                    state.previous.dispose(); delete window.__foliageProjectionComparison;
                });
            }
            await testInfo.attach('paired-foliage-projection-profile', { body: JSON.stringify({ phases,
                scope: 'Same connected game scene; exact predecessor versus conservative swept-volume scene projection. Actors/AI/clocks stay live. No physical-device or busy-battle certificate.'
            }, null, 2), contentType: 'application/json' });
            console.log('[paired-foliage-projection-profile]', JSON.stringify(phases));
        }
        if (process.env.EIDOLON_TERRAIN_PARTY_FITTED_SURFACE_COMPARE === '1') {
            const phases = [];
            const select = async mode => page.evaluate(async mode => {
                const game = window.game;
                const actors = [game.player, ...[...game.remotePlayers.values()].filter(actor => actor.mesh?.userData.fittedEquipment)];
                if (actors.length !== 4) throw new Error('Surface comparison requires four live fitted class roots');
                for (const actor of actors) {
                    actor.mesh.userData.fittedEquipmentSurfaceBatching = mode === 'candidate';
                    actor.syncEquipmentVisuals(actor.equipment, { force: true });
                }
                await Promise.all(actors.map(actor => actor.mesh.userData.equipmentReady));
                for (const actor of actors) {
                    if (actor.mesh.userData.equipmentVisualItemCount !== 14 || actor.mesh.userData.equipmentVisualMissing?.length)
                        throw new Error('Comparison altered the full outfit');
                }
                for (let i = 0; i < 20; i++) await new Promise(resolve => requestAnimationFrame(resolve));
            }, mode);
            try {
                for (const mode of ['previous', 'candidate', 'candidate', 'previous']) {
                    await select(mode);
                    phases.push({ mode, ...await profileGameplayScene(page, `paired-fitted-surface-${mode}`) });
                }
            } finally { await select('candidate'); }
            await testInfo.attach('paired-fitted-surface-profile', { body: JSON.stringify({ phases,
                scope: 'Same connected normal four-class/three-peer scene; exact original fitted surfaces versus qualified attribute submissions. Full outfits preserved and live actors/AI/game clocks retained. No physical-device or busy-battle certificate.'
            }, null, 2), contentType: 'application/json' });
            console.log('[paired-fitted-surface-profile]', JSON.stringify(phases));
        }
        if (process.env.EIDOLON_TERRAIN_PARTY_CPU_PROFILE === '1') {
            // Opt-in diagnosis AFTER the frame sample, never part of its timing.
            // CPU profiles contain function/source identities, not chat or args.
            const session = await page.context().newCDPSession(page);
            try {
                await page.evaluate(installFoliageRevisionObservation);
                await session.send('Profiler.enable');
                await session.send('Profiler.start');
                await page.waitForTimeout(3_000);
                const { profile } = await session.send('Profiler.stop');
                const { summary, callerChains } = summarizePartyCPUProfile(profile, new URL(baseURL).origin);
                const foliage = await page.evaluate(readFoliageRevisionObservation);
                await testInfo.attach('diagnostic-cpu-functions', { body: JSON.stringify({
                    scope: 'Three-second opt-in CPU function sample with foliage revision/visit counters; probe/profiling overhead excluded from the preceding frame report.',
                    summary, callerChains, foliage
                }, null, 2), contentType: 'application/json' });
                console.log('[diagnostic-party-cpu]', JSON.stringify(summary));
                console.log('[diagnostic-party-cpu-callers]', JSON.stringify(callerChains));
                console.log('[diagnostic-foliage-revisions]', JSON.stringify(foliage));
            } finally {
                try {
                    const restored = await page.evaluate(restoreFoliageRevisionObservation);
                    expect(restored, 'Diagnostic wrappers must restore their owned controller methods').toBe(true);
                } finally { await session.detach(); }
            }
        }
        if (process.env.EIDOLON_E2E_GEOMETRY_FRAME_ABBA === '1') {
            const comparison = await compareGameplayGeometryFrames(page);
            expect(comparison.restored).toBe(true);
            for (const { profile, after } of comparison.phases) {
                expect(profile.frames).toBe(180); expect(profile.visibility).toBe('visible');
                expect(profile.visibleFrames).toBe(180); expect(profile.restored).toBe(true);
                expect(profile.frameSamples).toHaveLength(180);
                expect(after.restored).toBe(true); expect(after.pending).toBe(0); expect(after.activeJob).toBe(false);
                for (const field of ['registered', 'candidateStorageBytes', 'workerCacheBytes', 'workerCacheEntries', 'requested'])
                    expect(after[field], field).toBe(comparison.initial[field]);
            }
            await testInfo.attach('geometry-real-frame-abba', { body: JSON.stringify(comparison, null, 2), contentType: 'application/json' });
        }
        if (process.env.EIDOLON_TERRAIN_PARTY_MATRIX_OWNERS === '1') {
            const matrixOwners = await measurePartyMatrixOwners(page);
            expect(matrixOwners.restored).toBe(true);
            await testInfo.attach('diagnostic-matrix-owners', {
                body: JSON.stringify(matrixOwners, null, 2), contentType: 'application/json'
            });
        }
        if (process.env.EIDOLON_TERRAIN_UNDERSTORY_PREPARATION === '1') {
            await captureUnderstoryPreparation(page, `equipped-party-${quality}`, testInfo);
        }
        await page.screenshot({ path: testInfo.outputPath(`single-renderer-equipped-party-${quality}.png`) });
        if (bodyPilot) {
            const substitution = bodyPilot.read(), classes = substitution.requested.filter(row => row.quality === quality).map(row => row.actorClass).sort();
            expect(classes).toEqual(['Cleric', 'Fighter', 'Rogue', 'Wizard']);
            await writeFile(testInfo.outputPath('body-pilot-substitution.json'), JSON.stringify(substitution, null, 2));
        }
        if (wearablePilot) {
            const substitution = wearablePilot.read();
            expect(substitution.requested.length).toBeGreaterThan(0);
            expect(substitution.requested.every(row => row.quality === quality)).toBe(true);
            expect(new Set(substitution.requested.map(row => row.actorClass)).size).toBe(4);
            await writeFile(testInfo.outputPath('wearable-pilot-substitution.json'), JSON.stringify(substitution, null, 2));
        }
        expect(failures, failures.join('\n')).toEqual([]);
        console.log('[single-renderer-terrain-party]', JSON.stringify({ quality, ...report }));
        console.log('[untimed-party-draw-attribution]', JSON.stringify(draws.slice(0, 16)));
        console.log('[untimed-same-scene-instance-comparison]', JSON.stringify(pairedDraws));
    } finally {
        await page.evaluate(() => {
            window.__actorInstanceViewPilot?.dispose(); delete window.__actorInstanceViewPilot;
            if (window.__gameplayGeometryLifecycle?.runtime) window.game.renderSystem.setActorGameplayGeometryEnabled(false);
            window.__gameplayGeometryLifecycle?.delivery?.dispose();
            window.__gameplayGeometryLifecycle?.pass.dispose(); delete window.__gameplayGeometryLifecycle;
            window.__shadowGeometryPilot?.pass.dispose(); delete window.__shadowGeometryPilot;
            window.__gameplayColorPilot?.dispose(); delete window.__gameplayColorPilot;
            window.__gameplayBodyPilot?.dispose(); delete window.__gameplayBodyPilot;
            window.game?.destroy?.();
        }).catch(() => {});
        await writeFile(testInfo.outputPath('party-peer-liveness.json'), JSON.stringify({
            stages: peerLiveness, beforeCleanupReadyStates: peers.map(peer => peer.socket.readyState), closes: peers.map(peer => peer.closes)
        }, null, 2));
        for (const peer of peers) peer.socket.close();
    }
});
