import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

export async function reviewEquippedSkillMotions(page, testInfo) {
    const rigs = await page.evaluate(async () => {
        const { Rogue } = await import('/src/entities/Rogue.js');
        const { Cleric } = await import('/src/entities/Cleric.js');
        const { Wizard } = await import('/src/entities/Wizard.js');
        const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
        const { render, hero } = window.__dungeonArtReview;
        const rogue = new Rogue('skill-motion-rogue');
        rogue.gameEngine = { renderSystem: render };
        await rogue.ensureMesh();
        const names = { head: 'Leather Cap', chest: 'Leather Tunic', legs: 'Leather Pants', feet: 'Leather Boots',
            gloves: 'Leather Gloves', shoulders: 'Reinforced Spaulders', belt: 'Studded Belt',
            mainHand: 'Steel Dagger', offHand: 'Iron Sword', ring1: 'Ruby Ring', ring2: 'Gold Ring',
            neck: 'Pendant', trinket1: 'Amulet of Power', trinket2: 'Talisman of Speed' };
        rogue.syncEquipmentVisuals(Object.fromEntries(Object.entries(names).map(([slot, name]) => {
            const base = BASE_ITEMS.find(item => item.name === name);
            if (!base) throw new Error(`Missing motion review gear: ${name}`);
            return [slot, { ...base, id: `motion-${slot}`, baseName: name, name, level: 70, rarity: 'Uncommon',
                stats: {}, potency: 0, sockets: 0, gems: [], setId: '', uniqueEffect: '' }];
        })), { force: true });
        await rogue.mesh.userData.equipmentReady;
        render.entityGroup.add(rogue.mesh);
        const cleric = new Cleric('skill-motion-cleric');
        cleric.gameEngine = { renderSystem: render };
        await cleric.ensureMesh();
        const clericNames = { ...names, head: 'Iron Helm', chest: 'Robes', feet: 'Iron Boots', gloves: 'Silk Gloves',
            shoulders: 'Steel Pauldrons', mainHand: 'Cleric Mace', offHand: 'Wooden Shield' };
        cleric.syncEquipmentVisuals(Object.fromEntries(Object.entries(clericNames).map(([slot, name]) => {
            const base = BASE_ITEMS.find(item => item.name === name);
            if (!base) throw new Error(`Missing Cleric review gear: ${name}`);
            return [slot, { ...base, id: `cleric-motion-${slot}`, baseName: name, name, level: 70, rarity: 'Uncommon',
                stats: {}, potency: 0, sockets: 0, gems: [], setId: '', uniqueEffect: '' }];
        })), { force: true });
        await cleric.mesh.userData.equipmentReady;
        render.entityGroup.add(cleric.mesh);
        const wizard = new Wizard('skill-motion-wizard');
        wizard.gameEngine = { renderSystem: render };
        await wizard.ensureMesh();
        const wizardNames = { ...names, head: 'Silk Hood', chest: 'Robes', legs: 'Silk Skirt', feet: 'Sandals',
            gloves: 'Silk Gloves', shoulders: 'Velvet Mantle', belt: 'Silk Sash', mainHand: 'Wooden Staff', offHand: 'Spell Tome' };
        wizard.syncEquipmentVisuals(Object.fromEntries(Object.entries(wizardNames).map(([slot, name]) => {
            const base = BASE_ITEMS.find(item => item.name === name);
            if (!base) throw new Error(`Missing Wizard review gear: ${name}`);
            return [slot, { ...base, id: `wizard-motion-${slot}`, baseName: name, name, level: 70, rarity: 'Uncommon',
                stats: {}, potency: 0, sockets: 0, gems: [], setId: '', uniqueEffect: '' }];
        })), { force: true });
        await wizard.mesh.userData.equipmentReady;
        render.entityGroup.add(wizard.mesh);
        const start = hero.position.clone();
        // The last room review stands beside its wall. Move back to a clear
        // part of the same production room, at the unchanged gameplay zoom.
        start.x += 8; start.z += 6;
        window.__skillMotionReview = { render, hero, rogue, cleric, wizard, start };
        return [hero, rogue, cleric, wizard].map(actor => ({ type: actor.mesh.userData.authoredClass,
            quality: actor.mesh.userData.authoredQuality, items: actor.mesh.userData.equipmentVisualItemCount,
            motions: actor.mesh.userData.authoredSkillMotions || { families: [], clips: 0, keyframeBytes: 0 } }));
    });
    for (const rig of rigs) {
        expect(rig.items).toBe(14); expect(rig.motions.clips).toBe({ Fighter: 20, Rogue: 10, Cleric: 5, Wizard: 0 }[rig.type]);
        expect(rig.motions.keyframeBytes).toBeLessThan(100_000);
    }
    const scenarios = [
        ['Fighter', 'Shield Slam', .36, false, false], ['Fighter', 'Sweeping Strike', .5, false, false],
        ['Fighter', 'Earthshaker', .36, false, false],
        ['Fighter', 'Whirlwind', .64, false, false], ['Fighter', 'Whirlwind', .64, true, false],
        ['Fighter', 'Whirlwind', .64, false, true], ['Rogue', 'Piercing Throw', .5, false, false],
        ['Rogue', 'Phantom Volley', .5, false, false], ['Rogue', 'Death Spiral', .64, false, false],
        ['Cleric', 'Radiant Strike', .36, false, false], ['Wizard', 'Flame Whip', .36, false, false],
        ['Wizard', 'Arcane Missiles', .36, false, false]
    ];
    const reports = [];
    for (const [index, [type, skill, phase, extended, moving]] of scenarios.entries()) {
        for (const reference of [true, false]) {
            const report = await page.evaluate(async ({ type, skill, phase, extended, moving, reference }) => {
                const THREE = await import('three');
                const { render, hero, rogue, cleric, wizard, start } = window.__skillMotionReview;
                const actor = { Fighter: hero, Rogue: rogue, Cleric: cleric, Wizard: wizard }[type];
                for (const other of [hero, rogue, cleric, wizard]) other.mesh.visible = other === actor;
                window.__dungeonArtReview.ui.updatePlayerStats(actor);
                actor.mesh.userData.updateWeaponProfile(actor.equipment);
                const begin = () => {
                    actor.mixer.stopAllAction(); actor.mesh.userData.resetRestPose();
                    actor.currentAbilityAnimation = null;
                    actor.state = moving ? 'MOVING' : 'IDLE';
                    actor.skillRunes = extended ? { Whirlwind: 'whirlwind_extended' } : {};
                    actor.position.copy(start); actor.mesh.position.copy(start);
                    actor.rotation.identity(); actor.mesh.quaternion.identity();
                    actor.playAbilityAnimation(skill, reference ? { clip: 'Attack' } : {});
                };
                begin();
                const clip = actor.currentAction.getClip().name, duration = actor.currentAbilityAnimation.duration;
                const rootHeading = actor.mesh.quaternion.clone(), rootPosition = actor.position.clone();
                const bone = actor.mesh.getObjectByName('Root'), base = bone.quaternion.clone();
                let changed = false, previous = bone.quaternion.clone(), maxStep = 0;
                let calls = 0, triangles = 0;
                for (let frame = 0; frame < 40; frame++) {
                    await new Promise(requestAnimationFrame);
                    actor.updateAnimationMixer(duration / 42);
                    if (moving) actor.position.x += .04;
                    actor.mesh.position.copy(actor.position);
                    const step = bone.quaternion.angleTo(previous);
                    maxStep = Math.max(maxStep, step); changed ||= bone.quaternion.angleTo(base) > .05;
                    previous.copy(bone.quaternion);
                    render.setCameraTarget(actor.position); render.render();
                    calls = Math.max(calls, render.renderer.info.render.calls);
                    triangles = Math.max(triangles, render.renderer.info.render.triangles);
                }
                const headingUnchanged = actor.mesh.quaternion.equals(rootHeading);
                const travelled = actor.position.distanceTo(rootPosition);
                window.__skillMotionReview.sample = phase => {
                    begin(); actor.updateAnimationMixer(duration * phase);
                    render.setCameraTarget(actor.position); render.render();
                };
                window.__skillMotionReview.sample(phase);
                let invalidVertices = 0, sampledVertices = 0;
                actor.mesh.traverse(part => {
                    if (!part.isSkinnedMesh) return;
                    part.skeleton.update();
                    const point = new THREE.Vector3();
                    for (let i = 0; i < part.geometry.attributes.position.count; i += 233) {
                        point.fromBufferAttribute(part.geometry.attributes.position, i); part.applyBoneTransform(i, point);
                        if (!point.toArray().every(Number.isFinite) || point.length() > 10) invalidVertices++;
                        sampledVertices++;
                    }
                });
                return { type, skill, extended, moving, reference, clip, duration, quality: render.graphicsQuality,
                    zoom: render.currentZoom, frames: 40, rootTurnChanged: changed, maxRootStep: maxStep,
                    headingUnchanged, travelled, invalidVertices, sampledVertices, calls, triangles,
                    keyframeBytes: actor.mesh.userData.authoredSkillMotions?.keyframeBytes || 0 };
            }, { type, skill, phase, extended, moving, reference });
            reports.push(report);
            expect(report.zoom).toBe(15); expect(report.headingUnchanged).toBe(true);
            expect(report.travelled).toBeCloseTo(moving ? 1.6 : 0, 5);
            expect(report.invalidVertices).toBe(0); expect(report.sampledVertices).toBeGreaterThan(0);
            expect(report.calls).toBeLessThanOrEqual(report.quality === 'low' ? 200 : 350);
            expect(report.triangles).toBeLessThanOrEqual(report.quality === 'low' ? 85000 : 250000);
            if (!reference) {
                if (type === 'Wizard') expect(report.clip).toBe('Cast');
                else expect(report.clip).toMatch(/_Skill(?:ShieldBash|Heavy|Sweep|Spin|Throw)$/);
                if (skill === 'Whirlwind' || skill === 'Death Spiral') {
                    expect(report.rootTurnChanged).toBe(true); expect(report.maxRootStep).toBeLessThan(.6);
                }
            }
            await page.screenshot({ path: testInfo.outputPath(`skill-${index}-${reference ? 'basic-reference' : 'equipped'}.png`),
                style: '#perf-overlay { visibility: hidden !important; }' });
            if (!reference) for (const extra of [.16, .36, .82].filter(value => value !== phase)) {
                await page.evaluate(phase => window.__skillMotionReview.sample(phase), extra);
                await page.screenshot({ path: testInfo.outputPath(`skill-${index}-equipped-${extra}.png`),
                    style: '#perf-overlay { visibility: hidden !important; }' });
            }
        }
    }
    await writeFile(testInfo.outputPath('equipped-skill-motion-review.json'), JSON.stringify({
        scope: 'Prepared supplied equipped four-class motions in the production Umbral room with actual class HUD at zoom15. Basic-attack controls retain original cast durations. No server damage/contact timing, sustained party/device or listening claim.',
        rigs, reports
    }, null, 2));
    await page.evaluate(() => {
        const { rogue, cleric, wizard, hero } = window.__skillMotionReview;
        rogue.dispose(); cleric.dispose(); wizard.dispose(); hero.mesh.visible = true;
    });
}
