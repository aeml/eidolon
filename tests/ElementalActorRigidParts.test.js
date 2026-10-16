import * as THREE from 'three';
import { createProceduralSandstormDjinn, createProceduralThunderRoc } from '../src/art/ProceduralOverworldEnemies.js';
import { getHumanoidBatchGeometryCount } from '../src/art/HumanoidRenderBatches.js';

const recipes = [
    ['SandstormDjinn', createProceduralSandstormDjinn, 63, 23],
    ['ThunderRoc', createProceduralThunderRoc, 82, 22]
];
const leaves = root => { const result = []; root.traverse(p => { if (p.isMesh) result.push(p); }); return result; };
const count = p => p.geometry.index?.count ?? p.geometry.attributes.position.count;
const animationData = root => root.userData.animations.map(c => ({ name: c.name, duration: c.duration,
    tracks: c.tracks.map(t => ({ name: t.name, type: t.ValueTypeName, times: [...t.times], values: [...t.values] })) }));
const pose = (root, name, time) => {
    const mixer = new THREE.AnimationMixer(root), clip = THREE.AnimationClip.findByName(root.userData.animations, name);
    if (!clip) throw new Error(`Missing real ${name} clip`);
    const action = mixer.clipAction(clip); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
    mixer.setTime(time * clip.duration);
    root.position.set(.3, .5, -.6); root.rotation.set(.11, .7, .05); root.scale.set(1.3, .9, 1.1);
    root.updateMatrixWorld(true); return mixer;
};
function compareTriangles(reference, candidate) {
    const referenceParts = new Map(leaves(reference).map(p => [p.name, p]));
    const seen = new Set(); let vertices = 0, maxPositionError = 0, maxNormalError = 0;
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    for (const part of leaves(candidate)) {
        let offset = 0;
        for (const name of part.userData.humanoidBatchSources || [part.name]) {
            const source = referenceParts.get(name); expect(source).toBeDefined(); expect(seen.has(name)).toBe(false); seen.add(name);
            expect(part.material).toBe(source.material); expect(part.castShadow).toBe(source.castShadow);
            expect(part.receiveShadow).toBe(source.receiveShadow); expect(part.renderOrder).toBe(source.renderOrder);
            expect(part.layers.mask).toBe(source.layers.mask);
            const sourceNormal = new THREE.Matrix3().getNormalMatrix(source.matrixWorld);
            const targetNormal = new THREE.Matrix3().getNormalMatrix(part.matrixWorld);
            for (let i = 0; i < count(source); i++) {
                const si = source.geometry.index?.getX(i) ?? i, ci = part.geometry.index?.getX(offset + i) ?? offset + i;
                a.fromBufferAttribute(source.geometry.attributes.position, si).applyMatrix4(source.matrixWorld);
                b.fromBufferAttribute(part.geometry.attributes.position, ci).applyMatrix4(part.matrixWorld);
                maxPositionError = Math.max(maxPositionError, a.distanceTo(b));
                a.fromBufferAttribute(source.geometry.attributes.normal, si).applyNormalMatrix(sourceNormal);
                b.fromBufferAttribute(part.geometry.attributes.normal, ci).applyNormalMatrix(targetNormal);
                maxNormalError = Math.max(maxNormalError, a.distanceTo(b));
                const uvA = source.geometry.attributes.uv, uvB = part.geometry.attributes.uv;
                if (uvA.getX(si) !== uvB.getX(ci) || uvA.getY(si) !== uvB.getY(ci)) throw new Error(`Changed UV: ${name}/${i}`);
                vertices++;
            }
            offset += count(source);
        }
        expect(offset).toBe(count(part));
    }
    expect(seen.size).toBe(referenceParts.size);
    expect(vertices).toBe(leaves(reference).reduce((n, p) => n + count(p), 0));
    expect(maxPositionError).toBeLessThan(1e-5); expect(maxNormalError).toBeLessThan(1e-5);
}

for (const [type, make, sourceMeshes, drawMeshes] of recipes) describe(type, () => {
    test('reuses merged render resources while keeping each animation tree independent', () => {
        const first = make(), cached = getHumanoidBatchGeometryCount(), second = make();
        expect(getHumanoidBatchGeometryCount()).toBe(cached);
        const parts = leaves(first).filter(p => p.userData.humanoidBatchSources);
        expect(parts.length).toBeGreaterThan(0);
        for (const part of parts) {
            const other = second.getObjectByName(part.name);
            expect(other).not.toBe(part); expect(other.geometry).toBe(part.geometry); expect(other.material).toBe(part.material);
        }
        const a = first.getObjectByName(`Rig_${type}Body`), b = second.getObjectByName(`Rig_${type}Body`), rest = b.position.y;
        a.position.y += 3; expect(b.position.y).toBe(rest);
        first.userData.resetPose(); expect(a.position.y).toBe(rest); expect(b.position.y).toBe(rest);
    });
    test('merges constructor-owned siblings while retaining all real clip targets and shared materials', () => {
        const reference = make({ batch: false }), candidate = make();
        expect(leaves(reference)).toHaveLength(sourceMeshes); expect(leaves(candidate)).toHaveLength(drawMeshes);
        expect(animationData(candidate)).toEqual(animationData(reference));
        for (const clip of candidate.userData.animations) for (const track of clip.tracks) {
            const name = THREE.PropertyBinding.parseTrackName(track.name).nodeName;
            expect(candidate.getObjectByName(name)).toBeDefined();
        }
        candidate.updateMatrixWorld(true); reference.updateMatrixWorld(true); compareTriangles(reference, candidate);
    });
    for (const clip of ['Idle', 'Walk', 'Run', 'Attack', 'Death']) for (const time of [0, .35, .8])
        test(`${clip} ${time} preserves every triangle, normal, UV and appearance inside the live pivots`, () => {
            const reference = make({ batch: false }), candidate = make();
            const a = pose(reference, clip, time), b = pose(candidate, clip, time);
            compareTriangles(reference, candidate); a.stopAllAction(); b.stopAllAction();
        });
    test('pooled pose reset restores the actual merged tree after attack and death', () => {
        const reference = make({ batch: false }), candidate = make();
        const original = leaves(candidate).map(p => ({ part: p, geometry: p.geometry, material: p.material }));
        for (const clip of ['Attack', 'Death']) {
            const a = pose(reference, clip, .8), b = pose(candidate, clip, .8);
            a.stopAllAction(); b.stopAllAction();
            reference.userData.resetPose(); candidate.userData.resetPose();
            compareTriangles(reference, candidate);
            expect(leaves(candidate)).toHaveLength(drawMeshes);
            for (const { part, geometry, material } of original) {
                expect(candidate.getObjectById(part.id)).toBe(part); expect(part.geometry).toBe(geometry); expect(part.material).toBe(material);
            }
        }
    });
});
