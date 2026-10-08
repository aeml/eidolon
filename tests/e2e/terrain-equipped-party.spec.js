import { expect, test } from '@playwright/test';
import {
    collectBrowserFailures, loginAndEnterWorld, moveByGroundClick, projectNearestHostile,
    useEncounterQAWaypoint
} from './helpers.js';
import { hardwareWebGLBrowserArgs } from './browserLaunchPolicy.js';
import { profileGameplayScene } from './scene-performance.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

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
        let ownedBones = true, independentBones = true;
        const bones = new Set();
        root?.traverse(child => {
            for (const bone of child.skeleton?.bones || []) bones.add(bone);
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
            bodyFallback: Boolean(root?.userData.assetFallback), bones: bones.size, ownedBones, independentBones,
            ground: actor?.position && field?.sample(actor.position.x, actor.position.z),
            playerError: actor?.position && field ? Math.abs(actor.position.y - field.sample(actor.position.x, actor.position.z)) : Infinity,
            meshError: root && field ? Math.abs(root.position.y - field.sample(root.position.x, root.position.z)) : Infinity,
            authorityError: Number.isFinite(authority?.y) && field ? Math.abs(authority.y - field.sample(authority.x, authority.z)) : Infinity
        };
    });
    return { profile: game.terrainProfile, quality: game.renderSystem.graphicsQuality, actors };
}

test('connected equipped four-class party shares raised ground, fitted outfits, Fireball draws and targeted healing', async ({ page, browser, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_TERRAIN_PARTY !== '1', 'Explicit disposable connected terrain party check');
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
