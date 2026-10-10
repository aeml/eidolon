import { readPlayerStateInPage } from '../groundInputObservations.js';
import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { moveByGroundClick, projectEntity, projectNearestHostile, projectVerdantEntrance,
    readPlayerState, returnToTown, setAutoLootThroughSettings } from './helpers.js';

const liveTarget = async page => {
    for (let step = 0; step < 6; step++) {
        const target = await projectNearestHostile(page);
        if (target) return target;
        const point = await page.evaluate(() => {
            const game = window.game, p = game.player.position;
            const nearest = [...game.remotePlayers.values()].filter(e => e.isActive && e.state !== 'DEAD' && game.isHostileActorTarget(e))
                .sort((a, b) => a.position.distanceTo(p) - b.position.distanceTo(p))[0];
            if (!nearest) return null;
            const direction = nearest.position.clone().sub(p), distance = direction.length();
            direction.multiplyScalar(Math.min(12, distance) / Math.max(.001, distance));
            return { x: direction.x, z: direction.z };
        });
        expect(point, 'The actual populated scene must provide a live hostile').toBeTruthy();
        await moveByGroundClick(page, point.x, point.z, { moveOnly: true, allowAlternatePaths: true, allowJumpFallback: false, minimumDistance: .1 });
    }
    throw Error('No live hostile became available through bounded ordinary movement');
};

async function defeat(page, testInfo, stage, target = null) {
    target ||= await liveTarget(page);
    const initial = await readPlayerState(page), samples = [];
    const attempt = { target, stage, inputs: [], samples };
    try {
    const pointer = await projectEntity(page, target.id);
    expect(pointer?.visible).toBe(true);
    await page.mouse.move(pointer.x, pointer.y); await page.waitForTimeout(75);
    const protectedAlready = await page.evaluate(() => window.game.player.ironFortressTimer > 0);
    if (!protectedAlready) {
        await page.keyboard.press('4'); attempt.inputs.push('4:IronFortress');
        await expect.poll(() => page.evaluate(() => window.game.player.ironFortressTimer)).toBeGreaterThan(0);
    }
    await page.mouse.click(pointer.x, pointer.y, { button: 'right' }); attempt.inputs.push('RMB:Charge');
    await page.waitForTimeout(350);
    let selectedId = target.id;
    await expect.poll(async () => {
        const state = await page.evaluate(id => {
            const game = window.game, pending = game.pendingInteraction;
            const selected = pending?.id && pending.isActive && game.isHostileActorTarget(pending) ? pending : game.remotePlayers.get(id);
            return { id: selected?.id || id, dead: !selected || selected.state === 'DEAD' || !selected.isActive || (selected.health ?? selected.stats?.hp) <= 0,
                hp: game.player.stats.hp, instance: game.currentInstanceId || '',
                localState: game.player.state, clip: game.player.currentAction?.getClip?.().name,
                clipTime: game.player.currentAction?.time, cooldown: game.player.abilityCooldown,
                targetHp: selected?.health ?? selected?.stats?.hp,
                position: game.player.position.toArray(), ironFortress: game.player.ironFortressTimer } ;
        }, selectedId);
        selectedId = state.id; samples.push({ time: performance.now(), ...state });
        expect(state.hp).toBeGreaterThan(0); expect(state.instance).toBe(initial.instanceId || '');
        if (state.dead) return true;
        const point = await projectEntity(page, selectedId);
        if (point?.visible) {
            await page.mouse.move(point.x, point.y); await page.waitForTimeout(50);
            await page.mouse.click(point.x, point.y);
            if (samples.length === 1) { await page.keyboard.press('2'); attempt.inputs.push('2:Whirlwind'); }
            if (samples.length % 8 === 0) { await page.keyboard.press('3'); attempt.inputs.push('3:ShieldSlam'); }
        }
        return false;
    }, { timeout: 20_000, intervals: [100, 200], message: 'Ordinary pointer attacks must defeat the actual acquired hostile' }).toBe(true);
    return { requestedTarget: target.id, acquiredTarget: selectedId, subtype: target.subType,
        initialHealth: target.health, initially: { x: initial.x, z: initial.z } };
    } catch (error) { attempt.failure = { name: error.name, message: error.message }; throw error; }
    finally { await writeFile(testInfo.outputPath(`fight-${stage}-attempt.json`), JSON.stringify(attempt, null, 2)); }
}

export async function beginFightReview(page) {
    const previousAutoLoot = await page.evaluate(() => window.game.autoLootEnabled);
    await setAutoLootThroughSettings(page, false);
    // Install the shared pointer observer first; our message observer then
    // delegates to it and can retire without overwriting another owner.
    await page.evaluate(readPlayerStateInPage, { observeClicks: true });
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar.slice(0, 4))).toEqual(['Charge', 'Whirlwind', 'Shield Slam', 'Iron Fortress']);
    await page.evaluate(() => {
        const game = window.game, audio = game.audioManager;
        const proof = window.__equippedFightReview = { damage: [], abilities: [], audio: [],
            audioStateBefore: audio?.context?.state ?? audio?.audioContext?.state ?? null };
        const original = game.handleServerMessage, descriptor = Object.getOwnPropertyDescriptor(game, 'handleServerMessage');
        const receive = function (message) {
            if (message.type === 'damage' && proof.damage.length < 256) {
                const data = message.payload;
                proof.damage.push({ time: performance.now(), amount: data.amount, sourceId: data.sourceId, targetId: data.targetId,
                    localSource: data.sourceId === game.player.id, localTarget: data.targetId === game.player.id,
                    localState: game.player.state, clip: game.player.currentAction?.getClip?.().name, clipTime: game.player.currentAction?.time });
            }
            if (message.type === 'ability_result' && proof.abilities.length < 32)
                proof.abilities.push({ time: performance.now(), ...message.payload });
            return original.call(this, message);
        };
        game.handleServerMessage = receive;
        const play = audio?.play, playDescriptor = audio && Object.getOwnPropertyDescriptor(audio, 'play');
        function observedPlay(cue, options) {
            if (proof.audio.length < 128) proof.audio.push({ cue, time: performance.now() });
            return play.call(this, cue, options);
        }
        if (play) audio.play = observedPlay;
        window.__finishEquippedFightReview = () => {
            const messageOwned = game.handleServerMessage === receive, audioOwned = !play || audio.play === observedPlay;
            if (messageOwned) {
                if (descriptor) Object.defineProperty(game, 'handleServerMessage', descriptor); else delete game.handleServerMessage;
            }
            if (play && audioOwned) {
                if (playDescriptor) Object.defineProperty(audio, 'play', playDescriptor); else delete audio.play;
            }
            proof.audioStateAfter = audio?.context?.state ?? audio?.audioContext?.state ?? null;
            delete window.__finishEquippedFightReview; delete window.__equippedFightReview;
            return { ...proof, messageOwned, audioOwned, hooksRestored: messageOwned && audioOwned };
        };
    });
    return previousAutoLoot;
}

export async function captureEarthFight(page, testInfo, sample, screenshot) {
    const recorded = await defeat(page, testInfo, 'recorded-kit');
    await screenshot('earth-fight-after-kit');
    const nextTarget = await liveTarget(page);
    const profiling = sample('earth-active-fight', { warmupFrames: 0, activity: true })
        .then(profile => ({ profile }), error => ({ error }));
    await expect.poll(() => page.evaluate(() => window.game.loop.name)).toBe('observedLoop');
    const profiled = await defeat(page, testInfo, 'profiled-kit', nextTarget);
    const result = await profiling;
    if (result.error) throw result.error;
    const profile = result.profile;
    const activeFrames = profile.frameSamples.filter(s => s.activity.localState === 'ATTACKING' ||
        /attack|charge/i.test(s.activity.localClip || '') || s.activity.attackingHostiles > 0).length;
    await writeFile(testInfo.outputPath('earth-fight.json'), JSON.stringify({ recorded, profiled, profile, activeFrames,
        scope: 'Two live overworld defeats using the prepared already-unlocked branchA Fighter kit through ordinary hotbar/pointer controls. No health/damage/cooldown changes. First kill recorded; second sampled without screencast.180real intervals with explicit0warmup after the already-warmed continuous route. Active frame count is explicit; a mixed attack/recovery sample cannot establish sustained combat or all-class balance/pacing.' }, null, 2));
    expect(activeFrames).toBeGreaterThan(0);
}

export async function captureFirstDungeon(page, testInfo, walkTo, screenshot, sample) {
    // Refresh the existing defensive skill through ordinary input before
    // moving past the actual populated approach; no health/cooldown mutation.
    if (await page.evaluate(() => window.game.player.ironFortressTimer <= 0)) {
        await page.keyboard.press('4');
        await expect.poll(() => page.evaluate(() => window.game.player.ironFortressTimer)).toBeGreaterThan(0);
    }
    // Follow the existing authored Bastion road around its solid western wall.
    for (const [x, z] of [[725, 200], [755, 260], [800, 270], [800, 242]]) await walkTo(x, z);
    let pointer;
    await expect.poll(async () => {
        pointer = await projectVerdantEntrance(page);
        if (!pointer?.visible) return false;
        await page.mouse.move(pointer.x, pointer.y);
        return true;
    }).toBe(true);
    await page.mouse.click(pointer.x, pointer.y);
    await expect(page.locator('#dungeon-menu')).toBeVisible();
    await expect(page.locator('#dungeon-type-select')).toHaveValue('verdant_bastion_catacombs');
    await page.locator('#diff-btn-normal').click();
    await page.locator('#dungeon-run-level-select').selectOption('30');
    await page.locator('#btn-enter-dungeon').click();
    await expect.poll(() => page.evaluate(() => {
        const g = window.game;
        return g.currentInstanceType === 'verdant_bastion_catacombs' && Boolean(g.currentInstanceId && g.currentDungeonLayout) &&
            g.collisionManager.dungeonWalkableRects.length > 0 && g.player.mesh.userData.equipmentVisualItemCount === 14;
    }), { timeout: 30_000 }).toBe(true);
    await moveByGroundClick(page, 2, 0, { moveOnly: true, allowAlternatePaths: true, allowJumpFallback: false, minimumDistance: .1 });
    await screenshot('first-dungeon-entry');
    const profile = await sample('first-dungeon-start', { activity: true });
    await writeFile(testInfo.outputPath('first-dungeon.json'), JSON.stringify({ profile,
        scope: 'Normal real portal UI after continuous authored-road movement; prepared level30normal Verdant entry, equipment retained and first-room movement/real180frame sample. Not a dungeon clear, earned story progression, sustained dungeon combat or device/art approval.' }, null, 2));
    await returnToTown(page, { allowRespawn: false });
    await moveByGroundClick(page, 2, 0, { moveOnly: true, allowAlternatePaths: true, allowJumpFallback: false, minimumDistance: .1 });
    await screenshot('recall-town');
}

export async function finishFightReview(page, testInfo, previousAutoLoot) {
    const evidence = await page.evaluate(() => window.__finishEquippedFightReview());
    await writeFile(testInfo.outputPath('fight-events.json'), JSON.stringify(evidence, null, 2));
    await setAutoLootThroughSettings(page, previousAutoLoot);
    return evidence;
}
