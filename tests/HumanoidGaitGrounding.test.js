import * as THREE from 'three';
import * as factories from '../src/art/ProceduralHumanoid.js';
import { applyProceduralEquipment } from '../src/art/ProceduralEquipment.js';

const classes = ['Fighter', 'Rogue', 'Wizard', 'Cleric'];
function soleHeight(root) {
    root.updateMatrixWorld(true);
    let lowest = Infinity;
    const point = new THREE.Vector3();
    for (const side of ['Left', 'Right']) root.getObjectByName(`Equipment_Foot${side}`).traverseVisible(mesh => {
        if (!mesh.isMesh) return;
        const p = mesh.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
            point.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
            lowest = Math.min(lowest, point.y);
        }
    });
    return lowest;
}

test.each(classes.flatMap(type => [null, 'Iron Boots', 'Leather Boots', 'Sandals'].map(gear => [type, gear])))(
    '%s/%s walking contacts the ground and running retains alternating stance/flight', (type, gear) => {
        const root = factories[`createProcedural${type}`]({ batch: true });
        if (gear) applyProceduralEquipment(root, { feet: { id: 'gait-boots', baseName: gear,
            name: gear, type: 'ARMOR', slot: 'feet', rarity: 'Rare', level: 42 } });
        const originalPosition = root.position.clone(), originalRotation = root.quaternion.clone();
        for (const name of ['Walk', 'Run']) {
            const clip = root.userData.animations.find(clip => clip.name === name);
            const mixer = new THREE.AnimationMixer(root); mixer.clipAction(clip).play();
            let low = Infinity, high = -Infinity;
            for (let i = 0; i < 96; i++) {
                const phase = i / 96;
                mixer.setTime(phase * clip.duration);
                const y = soleHeight(root);
                expect(Number.isFinite(y)).toBe(true);
                expect(y).toBeGreaterThan(-.012);
                expect(y).toBeLessThan(name === 'Walk' ? .025 : .12);
                if (name === 'Run' && Math.cos(phase * Math.PI * 4) < -.5) expect(y).toBeLessThan(.025);
                low = Math.min(low, y); high = Math.max(high, y);
            }
            if (name === 'Run') expect(high - low).toBeGreaterThan(.07);
            expect(root.position.equals(originalPosition)).toBe(true);
            expect(root.quaternion.equals(originalRotation)).toBe(true);
            const track = clip.tracks.find(t => t.name === 'Rig_Hips.position[y]');
            expect(track.values[0]).toBe(track.values.at(-1));
            expect(track.times.at(-1)).toBeCloseTo(clip.duration, 6);
            mixer.stopAllAction(); mixer.uncacheRoot(root);
        }
    }
);

test.each(classes)('%s profile reuse preserves bind pose and independent animation buffers', type => {
    const a = factories[`createProcedural${type}`](), b = factories[`createProcedural${type}`]();
    const pose = root => {
        const values = [];
        root.traverse(o => values.push([o.name, ...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray()]));
        return values;
    };
    expect(pose(a)).toEqual(pose(b));
    for (const name of ['Walk', 'Run']) {
        const track = root => root.userData.animations.find(c => c.name === name).tracks.find(t => t.name === 'Rig_Hips.position[y]');
        expect(track(a).values).toEqual(track(b).values);
        expect(track(a).values).not.toBe(track(b).values);
    }
});
