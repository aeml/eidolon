import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { createProceduralLegacyEnemy } from '../src/art/ProceduralLegacyEnemies.js';

const cases = [['Skeleton', .66], ['DemonOrc', .72], ['Imp', .54], ['Construct', .9], ['InfernoTitan', .88]];
test.each(cases)('%s swings toward its target at the unchanged damage time', (type, contact) => {
    const actor = new Actor(`strike-${type}`, {});
    actor.setMesh(createProceduralLegacyEnemy(type)); actor.isRemote = true;
    try {
        for (const interval of [1, 4.2]) {
            actor.rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), interval === 1 ? 0 : Math.PI / 2);
            actor.stats.attackSpeed = interval; actor.setAttackingState();
            const action = actor.currentAction, clip = action.getClip();
            const rate = action.getEffectiveTimeScale();
            expect(contact / rate).toBeCloseTo(interval * .35, 5);
            const position = actor.position.clone(), rotation = actor.rotation.clone();
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(actor.rotation);
            const weapon = actor.mesh.getObjectByName(`Rig_${type}Weapon`);
            const reach = () => {
                actor.mesh.updateMatrixWorld(true);
                return new THREE.Box3().setFromObject(weapon).getCenter(new THREE.Vector3()).sub(actor.position).dot(forward);
            };
            actor.update(interval * .18);
            expect(reach()).toBeLessThan(-.3);
            actor.update(interval * .17);
            expect(action.time).toBeCloseTo(contact, 5);
            // The procedural face and lookAt target are +Z. A backward sweep
            // can have correct timestamps while still hitting behind the foe.
            expect(reach()).toBeGreaterThan(.3);
            expect(actor.position).toEqual(position); expect(actor.rotation).toEqual(rotation);
            actor.update(interval * .6);
            expect(actor.currentAction).toBe(action);
            expect(action.time).toBeCloseTo(clip.duration);
            expect(actor.state).toBe('ATTACKING');
            actor.updateState('MOVING'); actor.update(1 / 60);
            expect(actor.currentAnimationName).toBe('Run');
        }
    } finally { actor.dispose(); }
});
