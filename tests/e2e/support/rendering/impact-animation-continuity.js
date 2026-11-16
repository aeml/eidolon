import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

// Reuse the eight independently loaded, fully equipped supplied class rigs.
// This is an isolated message/mixer/render check, not network combat timing.
export async function captureImpactAnimationContinuity(page, testInfo) {
    const reports = await page.evaluate(async () => {
        const THREE = await import('three');
        const { GameEngine } = await import('/src/core/GameEngine.js');
        const { actors, renderer, scene, camera } = window.__classGear;
        const skills = { Fighter: 'Whirlwind', Rogue: 'Piercing Throw', Wizard: 'Fireball', Cleric: 'Radiant Strike' };
        const reports = [];
        for (const { actor, root, type, quality, gear } of actors) {
            const wasRemote = actor.isRemote;
            const attackSpeed = actor.stats.attackSpeed;
            actor.isRemote = true;
            actor.stats.attackSpeed = 1;
            root.userData.updateWeaponProfile(gear);
            const cues = [], feedback = [];
            const engine = Object.assign(Object.create(GameEngine.prototype), {
                player: { id: 'impact-listener', position: new THREE.Vector3(0, 0, 4) },
                remotePlayers: new Map([[actor.id, actor]]),
                readabilityFeedbackTimestamps: new Map(),
                floatingTextManager: { spawn() {} },
                renderCombatFeedback: data => feedback.push(data),
                playAudioCue: (cue, options) => cues.push({ cue, options })
            });
            const pose = () => {
                const values = [];
                root.traverse(part => values.push(...part.position.toArray(), ...part.quaternion.toArray(), ...part.scale.toArray()));
                return values;
            };
            const damage = kind => {
                const action = actor.currentAction, time = action.time, timer = actor.attackTimer;
                const ability = actor.currentAbilityAnimation, state = actor.state, before = pose();
                engine.handleServerMessage({ type: 'damage', payload: {
                    sourceId: actor.id, targetId: engine.player.id, amount: 8, kind
                } });
                const after = pose();
                if (actor.currentAction !== action || action.time !== time || actor.attackTimer !== timer ||
                    actor.currentAbilityAnimation !== ability || actor.state !== state ||
                    before.some((value, i) => value !== after[i])) throw new Error(`Impact interrupted ${type}/${quality}/${kind}`);
                const scale = action.getEffectiveTimeScale();
                actor.update(1 / 60);
                if (action.getEffectiveTimeScale() !== scale) throw new Error(`Remote update retimed ${type}/${quality}/${kind}`);
                if (!(action.time > time)) throw new Error(`Mixer did not advance ${type}/${quality}/${kind}`);
                renderer.render(scene, camera);
                return { clip: action.getClip().name, before: time, after: action.time };
            };
            try {
                const strikes = [];
                for (let strike = 0; strike < 2; strike++) {
                    engine.handleServerMessage({ type: 'attack', payload: {
                        sourceId: actor.id, targetId: engine.player.id
                    } });
                    actor.updateAnimationMixer(.35);
                    strikes.push(damage('physical'));
                    for (let frame = 0; frame < 12; frame++) {
                        actor.updateAnimationMixer(1 / 60);
                        renderer.render(scene, camera);
                    }
                }
                actor.playAbilityAnimation(skills[type]);
                actor.updateAnimationMixer(.1);
                const cast = damage('fire');
                const periodic = damage('poison');
                reports.push({ type, quality, items: root.userData.equipmentVisualItemCount,
                    strikes, cast, periodic, feedback: feedback.length, cues,
                    animationFrames: 28 });
            } finally {
                if (actor.attackTimer) actor.clearScheduledTask(actor.attackTimer);
                actor.attackTimer = null;
                actor.currentAbilityAnimation = null;
                actor.state = 'IDLE';
                actor.isRemote = wasRemote;
                actor.stats.attackSpeed = attackSpeed;
                actor.playAnimation('Idle', true, true);
            }
        }
        return reports;
    });
    expect(reports).toHaveLength(8);
    for (const report of reports) {
        expect(report.items).toBe(14);
        expect(report.feedback).toBe(4);
        expect(report.cues).toHaveLength(4);
        expect(report.cues.every(cue => cue.cue === 'combat.hit')).toBe(true);
        expect(report.cues[3].options.periodic).toBe(true);
        if (report.type === 'Rogue') expect(report.strikes.map(strike => strike.clip)).toEqual(['Dagger_Attack', 'Sword_Attack_Left']);
    }
    await writeFile(testInfo.outputPath('impact-animation-continuity.json'), JSON.stringify({
        scope: 'Eight supplied High/Low class rigs with 14 slots; explicit starts, damage message admission and 224 prepared animation/render frames, including 32 remote Actor updates with preserved cast speed. Audio calls retained; no speaker, live network, device or combat-performance claim.',
        reports
    }, null, 2));
}
