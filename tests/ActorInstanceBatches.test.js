import * as THREE from 'three';
import { jest } from '@jest/globals';
import { ActorInstanceBatches } from '../src/art/ActorInstanceBatches.js';
import { createProceduralSkeleton, createProceduralImp } from '../src/art/ProceduralLegacyEnemies.js';

function fixture() {
    const scene = new THREE.Scene(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
    const actors = [0, 1].map(index => {
        const root = new THREE.Group(); root.userData.proceduralHumanoid = true;
        const mesh = new THREE.Mesh(geometry, material); mesh.position.x = 2; mesh.castShadow = true;
        root.position.set(index * 4, 0, 0); root.add(mesh); scene.add(root); return { root, mesh };
    });
    const instances = new ActorInstanceBatches(scene);
    const begin = () => { scene.updateMatrixWorld(true); instances.beginFrame(); };
    return { scene, geometry, material, actors, instances, begin };
}

test('borrows exact surfaces and retains parent-transformed world positions', () => {
    const f = fixture(); f.scene.position.x = 10; f.begin();
    expect(f.instances.batches.size).toBe(1);
    const batch = [...f.instances.batches.values()][0], matrix = new THREE.Matrix4();
    expect(batch.geometry).toBe(f.geometry); expect(batch.material).toBe(f.material);
    expect(batch.count).toBe(2); expect(batch.castShadow).toBe(true); expect(batch.morphTexture).toBeNull();
    f.actors.forEach(({ mesh }, index) => {
        batch.getMatrixAt(index, matrix); matrix.premultiply(batch.matrixWorld);
        expect(matrix.elements).toEqual(mesh.matrixWorld.elements);
    });
    f.actors.forEach(({ mesh }) => expect(mesh.visible).toBe(false));
    f.instances.endFrame(); f.actors.forEach(({ mesh }) => expect(mesh.visible).toBe(true));
    expect(f.instances.group.visible).toBe(false); f.instances.dispose();
});

test('a stretched parent and rotated child retain the original inverse-transpose normal path', () => {
    const f = fixture(), { root, mesh } = f.actors[1];
    try {
        root.scale.set(2, 1, 1);
        mesh.rotation.z = Math.PI / 4;
        f.scene.updateMatrixWorld(true);
        // Reproduce the pinned Three shader's unsupported shear: scaling each
        // normal component by a column length is not an inverse transpose.
        const e = mesh.matrixWorld.elements;
        const lengths = [0, 4, 8].map(i => e[i] ** 2 + e[i + 1] ** 2 + e[i + 2] ** 2);
        const shaderNormal = new THREE.Vector3(1 / lengths[0], 0, 0)
            .applyMatrix3(new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld)).normalize();
        const correctNormal = new THREE.Vector3(1, 0, 0)
            .applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld));
        expect(shaderNormal.distanceTo(correctNormal)).toBeGreaterThan(.5);
        f.instances.beginFrame();
        expect(f.instances.batches.size).toBe(0);
        expect(mesh.visible).toBe(true);
        expect(mesh.geometry).toBe(f.geometry); expect(mesh.material).toBe(f.material);
        f.instances.endFrame();
        root.scale.set(1, 1, 1); f.begin();
        expect(f.instances.batches.size).toBe(1);
        expect(mesh.visible).toBe(false);
        f.instances.endFrame();
        root.scale.set(2, 1, 1); f.begin();
        expect(f.instances.batches.size).toBe(0);
        expect(mesh.visible).toBe(true);
    } finally { f.instances.dispose(); }
});

test('rotated nonuniform scale without shear remains instanceable', () => {
    const f = fixture();
    try {
        for (const { mesh } of f.actors) {
            mesh.scale.set(2, .6, 1.3); mesh.rotation.set(.3, .5, .7);
        }
        f.begin();
        expect(f.instances.batches.size).toBe(1);
        expect([...f.instances.batches.values()][0].count).toBe(2);
        f.instances.endFrame();
        for (const { mesh } of f.actors) expect(mesh.visible).toBe(true);
    } finally { f.instances.dispose(); }
});

test.each(['Idle', 'Walk', 'Run', 'Attack', 'Death'])('reviewed Skeleton instances retain independent %s pivot transforms and visibility', state => {
    const scene = new THREE.Scene();
    const roots = [0, 1, 2].map(index => {
        const root = createProceduralSkeleton({ batch: true });
        root.position.x = index * 4;
        const mixer = new THREE.AnimationMixer(root);
        mixer.clipAction(root.userData.animations.find(clip => clip.name === state)).play();
        mixer.update(.2 + index * .17);
        scene.add(root); return root;
    });
    const instances = new ActorInstanceBatches(scene);
    try {
        scene.updateMatrixWorld(true);
        const visibility = new Map();
        roots.forEach(root => root.traverse(part => visibility.set(part, part.visible)));
        instances.beginFrame();
        expect(instances.roots.size).toBe(3);
        expect(instances.batches.size).toBeGreaterThan(0);
        const matrix = new THREE.Matrix4();
        for (const batch of instances.batches.values()) {
            const parts = instances.hidden.filter(part => part.geometry === batch.geometry && part.material === batch.material &&
                part.castShadow === batch.castShadow && part.receiveShadow === batch.receiveShadow);
            expect(batch.count).toBe(parts.length);
            for (let index = 0; index < batch.count; index++) {
                batch.getMatrixAt(index, matrix); matrix.premultiply(batch.matrixWorld);
                expect(parts.some(part => part.matrixWorld.elements.every((value, element) =>
                    Math.abs(value - matrix.elements[element]) < .00001))).toBe(true);
            }
        }
        instances.endFrame();
        for (const [part, visible] of visibility) expect(part.visible).toBe(visible);
        roots[2].removeFromParent(); scene.updateMatrixWorld(true); instances.beginFrame();
        expect(instances.roots.size).toBe(2);
        instances.endFrame();
        roots.forEach(root => root.userData.resetPose());
        for (const [part, visible] of visibility) expect(part.visible).toBe(visible);
    } finally { instances.dispose(); }
});

test('unbatched Skeleton, unreviewed enemy and supplied actor do not enter the rigid instance roster', () => {
    const scene = new THREE.Scene();
    scene.add(createProceduralSkeleton(), createProceduralImp());
    const supplied = new THREE.Group(); supplied.userData.authoredClass = 'Fighter';
    supplied.add(new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    scene.add(supplied);
    const instances = new ActorInstanceBatches(scene);
    try { expect(instances.roots.size).toBe(0); } finally { instances.dispose(); }
});

test.each(['transparent', 'customDepth', 'customRender', 'customShader', 'skinned', 'morph', 'mirrored', 'hidden', 'other-layer', 'other-shadow', 'nonprocedural', 'sheared', 'projective', 'degenerate'])('%s retains the normal rendering path', kind => {
    const f = fixture(), { root, mesh } = f.actors[1];
    if (kind === 'transparent') mesh.material = new THREE.MeshStandardMaterial({ transparent: true });
    if (kind === 'customDepth') mesh.customDepthMaterial = new THREE.MeshDepthMaterial();
    if (kind === 'customRender') mesh.onBeforeRender = () => {};
    if (kind === 'customShader') { mesh.material = mesh.material.clone(); mesh.material.onBeforeCompile = () => {}; }
    if (kind === 'skinned') mesh.isSkinnedMesh = true;
    if (kind === 'morph') { mesh.geometry = mesh.geometry.clone(); mesh.geometry.morphAttributes.position = [mesh.geometry.attributes.position.clone()]; }
    if (kind === 'mirrored') mesh.scale.x = -1;
    if (kind === 'hidden') root.visible = false;
    if (kind === 'other-layer') mesh.layers.set(1);
    if (kind === 'other-shadow') mesh.castShadow = false;
    if (kind === 'nonprocedural') root.userData.proceduralHumanoid = false;
    if (kind === 'sheared') { mesh.matrixAutoUpdate = false; mesh.matrix.makeShear(.5, 0, 0, 0, 0, 0); }
    if (kind === 'projective') { mesh.matrixAutoUpdate = false; mesh.matrix.elements[3] = .1; }
    if (kind === 'degenerate') mesh.scale.x = 0;
    f.begin(); expect(f.instances.batches.size).toBe(0); expect(mesh.visible).toBe(true); f.instances.dispose();
});

test('retired buckets release only owned instance buffers and restore original hooks/visibility', () => {
    const f = fixture(), originalBefore = f.instances.before, originalAfter = f.instances.after;
    f.begin(); const batch = [...f.instances.batches.values()][0], dispose = jest.spyOn(batch, 'dispose');
    const geometry = jest.spyOn(f.geometry, 'dispose'), material = jest.spyOn(f.material, 'dispose');
    f.instances.endFrame(); f.actors[1].root.removeFromParent(); f.begin();
    expect(dispose).toHaveBeenCalledTimes(1); expect(f.instances.batches.size).toBe(0);
    f.instances.dispose(); f.instances.dispose();
    expect(geometry).not.toHaveBeenCalled(); expect(material).not.toHaveBeenCalled();
    expect(f.scene.onBeforeRender).toBe(originalBefore); expect(f.scene.onAfterRender).toBe(originalAfter);
    expect(f.instances.group.parent).toBeNull(); jest.restoreAllMocks();
    f.instances.register(f.actors[0].root); expect(f.instances.roots.size).toBe(0);
});

test('disposing during a frame restores sources and never erases a replacement hook', () => {
    const f = fixture(); f.begin(); const replacement = () => {}; f.scene.onBeforeRender = replacement;
    f.instances.dispose(); expect(f.scene.onBeforeRender).toBe(replacement);
    f.actors.forEach(({ mesh }) => expect(mesh.visible).toBe(true));
});

test('distant instance positions retain fractional equipment transforms', () => {
    const f = fixture();
    try {
        f.actors.forEach(({ root, mesh }, index) => {
            root.position.set(50000.123 + index * 4, 0, 20000.456);
            mesh.position.set(2.12345, .45678, .98765);
        });
        f.begin();
        const batch = [...f.instances.batches.values()][0], local = new THREE.Matrix4(), world = new THREE.Matrix4();
        f.actors.forEach(({ mesh }, index) => {
            batch.getMatrixAt(index, local); world.multiplyMatrices(batch.matrixWorld, local);
            for (let element = 0; element < 16; element++) {
                expect(Math.abs(world.elements[element] - mesh.matrixWorld.elements[element])).toBeLessThan(.00001);
            }
        });
    } finally { f.instances.dispose(); }
});

test('reuses unchanged roster and detects material, geometry, revision, cell and actor membership changes', () => {
    const f = fixture(); f.begin(); const roster = f.instances.roster; f.instances.endFrame(); f.begin();
    expect(f.instances.roster).toBe(roster);
    f.instances.endFrame(); f.actors[1].mesh.material = f.material.clone(); f.begin();
    expect(f.instances.roster).not.toBe(roster); expect(f.instances.batches.size).toBe(0);
    f.instances.endFrame(); f.actors[1].mesh.material = f.material;
    f.actors[1].root.userData.equipmentVisualRevision = 1; f.begin();
    expect(f.instances.batches.size).toBe(1);
    f.instances.endFrame(); f.actors[1].root.position.x = 200; f.begin();
    expect(f.instances.batches.size).toBe(0);
    f.instances.endFrame(); f.actors[1].root.position.x = 4;
    f.actors[1].mesh.geometry = f.geometry.clone(); f.begin(); expect(f.instances.batches.size).toBe(0);
    f.instances.endFrame(); f.actors[1].root.removeFromParent(); f.begin(); expect(f.instances.roots.size).toBe(1);
    f.scene.add(f.actors[1].root); f.actors[1].mesh.geometry = f.geometry;
    f.instances.register(f.actors[1].root); f.begin(); expect(f.instances.batches.size).toBe(1); f.instances.dispose();
});
