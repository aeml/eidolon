import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { moveByGroundClick, readPlayerState, useVerdantQAWaypoint } from './helpers.js';
import { profileGameplayScene } from './scene-performance.js';

// Explicit disposable-game diagnosis. Instrument only untimed renders; retain
// the normal loop/animation/network for profiles and real movement input.
export async function captureActualSceneRenderDiagnosis(page, testInfo) {
    await expect.poll(() => page.evaluate(() => window.game?.player?.mesh?.userData.equipmentVisualItemCount)).toBe(14);
    const scenes = [];
    const record = async label => {
        const profile = await profileGameplayScene(page, label);
        const attribution = await page.evaluate(() => {
            const render = window.game.renderSystem, renderer = render.renderer;
            const boundaries = new Set([render.scene, render.staticEnvironmentGroup, render.instanceEnvironmentGroup,
                render.entityGroup, render.actorInstances?.group].filter(Boolean));
            const shadowCameras = new Set(), lights = [];
            render.scene.traverse(light => {
                if (!light.isLight) return;
                if (light.shadow?.camera) shadowCameras.add(light.shadow.camera);
                lights.push({ name: light.name, type: light.type, intensity: light.intensity, visible: light.visible,
                    castShadow: light.castShadow, near: light.shadow?.camera.near, far: light.shadow?.camera.far });
            });
            const original = renderer.renderBufferDirect, counts = new Map();
            renderer.renderBufferDirect = function(camera, scene, geometry, material, object, group) {
                let root = object;
                while (root.parent && !boundaries.has(root.parent) && !root.userData.authoredClass) root = root.parent;
                const name = root.userData.authoredClass ? `Equipped ${root.userData.authoredClass}` : root.name || root.type;
                const entry = counts.get(name) || { name, color: 0, shadow: 0, other: 0, triangles: 0, meshes: new Set() };
                counts.set(name, entry); entry.meshes.add(object);
                entry[camera === render.camera ? 'color' : shadowCameras.has(camera) ? 'shadow' : 'other']++;
                if (object.isMesh) {
                    const vertices = group?.count ?? Math.min(geometry.drawRange.count,
                        geometry.index?.count ?? geometry.attributes.position.count);
                    if (object.isBatchedMesh) for (let i = 0; i < object._multiDrawCount; i++) entry.triangles += object._multiDrawCounts[i] / 3;
                    else entry.triangles += vertices / 3 * (object.isInstancedMesh ? object.count : 1);
                }
                return original.call(this, camera, scene, geometry, material, object, group);
            };
            try {
                render.render();
                return { totals: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }, lights,
                    roots: [...counts.values()].map(entry => ({ ...entry, meshes: entry.meshes.size }))
                        .sort((a, b) => b.color + b.shadow + b.other - a.color - a.shadow - a.other) };
            } finally { renderer.renderBufferDirect = original; }
        });
        const scene = { label, profile, attribution }; scenes.push(scene);
        await writeFile(testInfo.outputPath('actual-scene-diagnosis.json'), JSON.stringify({ scenes }, null, 2));
        scene.paired = process.env.EIDOLON_TERRAIN_RIG_PAIR === '1' ? await profileOwnedRigPair(page, label, testInfo) : null;
        await writeFile(testInfo.outputPath('actual-scene-diagnosis.json'), JSON.stringify({ scenes }, null, 2));
        await page.screenshot({ path: testInfo.outputPath(`${label}.png`) });
    };
    await record('actual-town');
    // Capture the active action and leg/spine quaternions while ordinary
    // ground-click movement is live. No manual mixer advance/forced pose.
    await page.evaluate(() => {
        const actor = window.game.player, bones = [];
        actor.mesh.traverse(part => { if (part.isBone && /^(?:thigh|calf|foot|spine)_/.test(part.name)) bones.push(part); });
        const samples = []; let request;
        const frame = () => {
            const action = actor.currentAction;
            samples.push({ state: actor.state, x: actor.position.x, z: actor.position.z, mixerTime: actor.mixer.time,
                logicalAnimation: actor.currentAnimationName, clip: action?.getClip().name, actionTime: action?.time,
                effectiveTimeScale: action?.getEffectiveTimeScale(), weight: action?.getEffectiveWeight(),
                expectedMovementTimeScale: actor.getMovementAnimationTimeScale(), speed: actor.stats.speed,
                bones: bones.map(bone => ({ name: bone.name, quaternion: bone.quaternion.toArray() })) });
            if (samples.length < 120) request = requestAnimationFrame(frame);
        };
        request = requestAnimationFrame(frame);
        window.__actualMotionDiagnosis = { samples, stop: () => cancelAnimationFrame(request) };
    });
    try {
        await moveByGroundClick(page, 0, -14, { moveOnly: true, requireClearPath: true, allowAlternatePaths: false,
            allowJumpFallback: false, minimumDistance: 2 });
        await expect.poll(async () => (await readPlayerState(page)).state).toBe('IDLE');
    } finally {
        const motion = await page.evaluate(() => {
            const observation = window.__actualMotionDiagnosis; observation.stop(); delete window.__actualMotionDiagnosis;
            return { samples: observation.samples };
        });
        await writeFile(testInfo.outputPath('actual-movement-animation.json'), JSON.stringify(motion, null, 2));
        if (process.env.EIDOLON_TERRAIN_RIG_PAIR === '1') {
            const moving = motion.samples.filter(sample => sample.state === 'MOVING' && sample.logicalAnimation === 'Run');
            expect(moving.length).toBeGreaterThan(2);
            for (const sample of moving) expect(sample.effectiveTimeScale).toBeCloseTo(sample.expectedMovementTimeScale, 5);
            expect(new Set(moving.map(sample => sample.actionTime)).size).toBeGreaterThan(2);
            const changedBones = moving[0].bones.filter((bone, index) => moving.some(sample =>
                sample.bones[index].quaternion.some((value, component) => value !== bone.quaternion[component])));
            expect(changedBones.length).toBeGreaterThan(2);
        }
    }
    await useVerdantQAWaypoint(page);
    await record('actual-verdant-approach');
    await writeFile(testInfo.outputPath('actual-scene-diagnosis.json'), JSON.stringify({
        scope: 'Prepared real disposable server/native GPU Fighter. Town and fixed QA Verdant forecourt snapshots, actual actor movement sample. Untimed attribution is separate from normal180-frame profiles. Not a route/campaign/physical-phone/final-art acceptance.', scenes
    }, null, 2));
}

// Compare the same live actor roots, animated pivots, materials and supplied
// player with independent unbatched constructor leaves. Only reviewed merged
// sibling leaves are exchanged; hitboxes, actor state and network stay live.
async function profileOwnedRigPair(page, label, testInfo) {
    const census = await page.evaluate(async () => {
        const town = await import('/src/art/ProceduralTownActors.js');
        const enemies = await import('/src/art/ProceduralLegacyEnemies.js');
        const roots = [];
        window.game.renderSystem.entityGroup.traverse(root => {
            if (root.userData.humanoidRenderBatches &&
                [...town.TOWN_ACTOR_TYPES, 'InfernoTitan'].includes(root.userData.proceduralActorType)) roots.push(root);
        });
        const records = [];
        for (const root of roots) {
            const type = root.userData.proceduralActorType;
            const source = type === 'InfernoTitan' ? enemies.createProceduralInfernoTitan() : town.createProceduralTownActor(type);
            root.traverse(part => {
                if (!part.userData.humanoidBatchSources) return;
                const leaves = part.userData.humanoidBatchSources.map(name => {
                    const original = source.getObjectByName(name);
                    if (!original || original.parent.name !== part.parent.name) throw new Error('Unmatched live rigid pivot');
                    const leaf = original.clone(false);
                    leaf.material = part.material;
                    return leaf;
                });
                records.push({ parent: part.parent, combined: part, leaves, root });
            });
        }
        if (!records.length) throw new Error('No measured owned rigid actor batches');
        const instanceRenderer = window.game.renderSystem.actorInstances;
        if (!instanceRenderer.enabled) throw new Error('Normal production actor instances must be enabled');
        const originalBatches = new Map(roots.map(root => [root, root.userData.humanoidRenderBatches]));
        window.__actualRigidPair = { records,
            switchVariant(reference) {
                // Retain existing Skeleton/humanoid instancing in the control.
                // Only reviewed new families temporarily leave the instance roster.
                for (const root of roots) {
                    root.userData.humanoidRenderBatches = reference ? undefined : originalBatches.get(root);
                    if (!reference) instanceRenderer.register(root);
                }
                instanceRenderer.dirty = true;
                for (const { parent, combined, leaves } of records) {
                    if (reference) { parent.remove(combined); parent.add(...leaves); }
                    else { parent.remove(...leaves); parent.add(combined); }
                }
            } };
        return { roots: roots.map(root => ({ type: root.userData.proceduralActorType, id: root.userData.entityId,
            ...root.userData.humanoidRenderBatches })), mergedGroups: records.length,
            referenceLeaves: records.reduce((sum, record) => sum + record.leaves.length, 0) };
    });
    const profiles = [];
    try {
        for (const reference of [true, false, false, true]) {
            await page.evaluate(reference => window.__actualRigidPair.switchVariant(reference), reference);
            profiles.push({ reference, ...await profileGameplayScene(page, `${label}-${reference ? 'source' : 'batched'}`) });
            await writeFile(testInfo.outputPath(`${label}-rig-pair.json`), JSON.stringify({ census, profiles }, null, 2));
        }
    } finally {
        await page.evaluate(() => {
            window.__actualRigidPair.switchVariant(false);
            delete window.__actualRigidPair;
        });
    }
    return { scope: 'ABBA normal-loop180-frame live source-leaf/constructor-batch-plus-reviewed-instance comparison; same registered actor roots and animation pivots. Server population continues naturally. No teleport, hidden content, imported player replacement or manual mixer.', census, profiles };
}
