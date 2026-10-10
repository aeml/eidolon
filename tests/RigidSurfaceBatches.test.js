import * as THREE from 'three';
import { createProceduralTownActor, TOWN_ACTOR_TYPES } from '../src/art/ProceduralTownActors.js';
import { createProceduralInfernoTitan, createProceduralDemonOrc } from '../src/art/ProceduralLegacyEnemies.js';
import { batchRigidSurfaceParts, isOwnedRigidSurfaceMaterial } from '../src/art/RigidSurfaceBatches.js';
import { MeshFactory } from '../src/utils/MeshFactory.js';
import { ActorInstanceBatches } from '../src/art/ActorInstanceBatches.js';

const factories = [...TOWN_ACTOR_TYPES.map(type => [type, options => createProceduralTownActor(type, options)]),
    ['InfernoTitan', createProceduralInfernoTitan], ['DemonOrc', createProceduralDemonOrc]];
const meshes = root => { const list = []; root.traverseVisible(part => { if (part.isMesh) list.push(part); }); return list; };

function compare(source, packed) {
    source.updateMatrixWorld(true); packed.updateMatrixWorld(true);
    const remaining = new Set(meshes(source));
    for (const part of meshes(packed)) {
        if (!part.userData.humanoidBatchSources) {
            const reference = source.getObjectByName(part.name);
            expect(reference.geometry).toBe(part.geometry); expect(reference.material).toBe(part.material);
            expect(reference.matrixWorld.elements).toEqual(part.matrixWorld.elements); remaining.delete(reference); continue;
        }
        let offset = 0;
        for (const name of part.userData.humanoidBatchSources) {
            const reference = source.getObjectByName(name), geometry = reference.geometry;
            expect(remaining.delete(reference)).toBe(true);
            expect(reference.parent.name).toBe(part.parent.name);
            expect(reference.castShadow).toBe(part.castShadow); expect(reference.receiveShadow).toBe(part.receiveShadow);
            const count = geometry.index?.count || geometry.attributes.position.count;
            for (let i = 0; i < count; i++, offset++) {
                const index = geometry.index ? geometry.index.getX(i) : i;
                const expected = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, index).applyMatrix4(reference.matrixWorld);
                const actual = new THREE.Vector3().fromBufferAttribute(part.geometry.attributes.position, offset).applyMatrix4(part.matrixWorld);
                expect(actual.distanceTo(expected)).toBeLessThan(1e-5);
                const expectedNormal = new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, index)
                    .applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(reference.matrixWorld));
                const actualNormal = new THREE.Vector3().fromBufferAttribute(part.geometry.attributes.normal, offset)
                    .applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(part.matrixWorld));
                expect(actualNormal.distanceTo(expectedNormal)).toBeLessThan(1e-5);
                for (const c of [0, 1]) expect(part.geometry.attributes.uv.getComponent(offset, c)).toBe(geometry.attributes.uv.getComponent(index, c));
                if (part.userData.rigidSurfaceBatch) {
                    const material = reference.material;
                    const diffuse = [...material.color.toArray(), material.roughness].map(Math.fround);
                    const emissive = [...material.emissive.toArray().map(value => value * material.emissiveIntensity), material.metalness].map(Math.fround);
                    for (let c = 0; c < 4; c++) {
                        expect(part.geometry.attributes.fittedDiffuseRoughness.getComponent(offset, c)).toBe(diffuse[c]);
                        expect(part.geometry.attributes.fittedEmissiveMetalness.getComponent(offset, c)).toBe(emissive[c]);
                    }
                } else expect(part.material).toBe(reference.material);
            }
        }
        expect(part.geometry.attributes.position.count).toBe(offset);
    }
    expect(remaining.size).toBe(0);
}

test.each(factories)('%s packed PBR retains every animated triangle, pivot, normal, UV and exact surface constant', (type, make) => {
    const source = make(), packed = make({ batch: true, surfaceAttributes: true });
    expect(meshes(packed).length).toBeLessThan(meshes(make({ batch: true })).length);
    for (const clip of source.userData.animations) {
        const mixers = [source, packed].map(root => new THREE.AnimationMixer(root));
        mixers.forEach(mixer => { mixer.clipAction(clip).play(); mixer.update(.37); });
        compare(source, packed);
        mixers.forEach(mixer => { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); });
        source.userData.resetPose(); packed.userData.resetPose();
    }
    const again = make({ batch: true, surfaceAttributes: true });
    for (const part of meshes(packed)) {
        expect(again.getObjectByName(part.name).geometry).toBe(part.geometry);
        expect(again.getObjectByName(part.name).material).toBe(part.material);
    }
});

test('trusted shader callbacks are factory-owned and reject copies and later replacement', () => {
    const root = createProceduralInfernoTitan({ batch: true, surfaceAttributes: true });
    const material = meshes(root).find(part => part.userData.rigidSurfaceBatch).material;
    expect(isOwnedRigidSurfaceMaterial(material)).toBe(true);
    expect(isOwnedRigidSurfaceMaterial(material.clone())).toBe(false);
    const compile = material.onBeforeCompile; material.onBeforeCompile = () => {};
    try { expect(isOwnedRigidSurfaceMaterial(material)).toBe(false); } finally { material.onBeforeCompile = compile; }
    const shader = { vertexShader: '#include <begin_vertex>', fragmentShader: 'vec4 diffuseColor = vec4( diffuse, opacity );\nvec3 totalEmissiveRadiance = emissive;\n#include <roughnessmap_fragment>\n#include <metalnessmap_fragment>' };
    compile(shader);
    expect(shader.vertexShader).toContain('flat varying vec4');
    expect(shader.fragmentShader).toContain('roughnessFactor *= vFittedDiffuseRoughness.a');
    expect(shader.fragmentShader).toContain('metalnessFactor *= vFittedEmissiveMetalness.a');
});

test.each(['callback', 'shader', 'texture', 'transparent', 'animated', 'morph', 'skinned', 'draw-range'])('%s surfaces retain individual rendering', kind => {
    const root = new THREE.Group(), material = new THREE.MeshStandardMaterial();
    root.userData.animations = []; root.userData.humanoidRenderBatches = { sourceMeshes: 2, drawMeshes: 2 };
    const parts = [0, 1].map(i => { const part = new THREE.Mesh(new THREE.BoxGeometry(), material); part.name = `Part${i}`; root.add(part); return part; });
    if (kind === 'callback') parts.forEach(part => { part.onBeforeRender = () => {}; });
    if (kind === 'shader') material.onBeforeCompile = () => {};
    if (kind === 'texture') material.map = new THREE.Texture();
    if (kind === 'transparent') material.transparent = true;
    if (kind === 'animated') root.userData.animations = [new THREE.AnimationClip('Move', 1, [new THREE.NumberKeyframeTrack('Part0.position[x]', [0, 1], [0, 1])])];
    if (kind === 'morph') parts.forEach(part => { part.geometry.morphAttributes.position = [part.geometry.attributes.position.clone()]; });
    if (kind === 'skinned') parts.forEach(part => { part.isSkinnedMesh = true; });
    if (kind === 'draw-range') parts.forEach(part => { part.geometry.setDrawRange(3, 3); });
    batchRigidSurfaceParts(root); expect(meshes(root)).toEqual(parts);
});

test('packed rigs keep independent live instances and restore visibility and borrowed resources', () => {
    const scene = new THREE.Scene();
    const roots = [0, 1, 2].map(i => { const root = createProceduralInfernoTitan({ batch: true, surfaceAttributes: true }); root.position.x = i * 4; scene.add(root); return root; });
    const instances = new ActorInstanceBatches(scene); scene.updateMatrixWorld(true);
    try {
        instances.beginFrame(); expect(instances.batches.size).toBeGreaterThan(0);
        expect([...instances.batches.values()].some(batch => isOwnedRigidSurfaceMaterial(batch.material))).toBe(true);
        instances.endFrame(); expect(roots.every(root => meshes(root).length === root.userData.humanoidRenderBatches.drawMeshes)).toBe(true);
    } finally { instances.dispose(); }
});

test('unused scalar-material box groups retain every triangle when combined across PBR values', () => {
    const root = new THREE.Group(); root.userData.animations = [];
    root.userData.humanoidRenderBatches = { sourceMeshes: 2, drawMeshes: 2 };
    for (const color of [0xaa2200, 0x113366]) {
        const part = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color }));
        part.name = `Box${color}`; part.position.x = root.children.length * 2; root.add(part);
        expect(part.geometry.groups.length).toBe(6);
    }
    batchRigidSurfaceParts(root);
    expect(meshes(root)).toHaveLength(1);
    expect(meshes(root)[0].geometry.attributes.position.count).toBe(72);
    expect(root.userData.humanoidRenderBatches.drawMeshes).toBe(1);
});

test.each(factories)('%s production uses shared packed constructor surfaces and pooled reset', async (type, make) => {
    const root = await MeshFactory.createMeshForType(type), reference = make({ batch: true, surfaceAttributes: true });
    expect(root.userData.humanoidRenderBatches).toEqual(reference.userData.humanoidRenderBatches);
    for (const part of meshes(root)) {
        expect(part.geometry).toBe(reference.getObjectByName(part.name).geometry);
        expect(part.material).toBe(reference.getObjectByName(part.name).material);
    }
    const part = meshes(root).find(part => part.userData.rigidSurfaceBatch), rest = part.matrix.clone();
    part.position.x += 5; part.updateMatrix(); part.visible = false;
    MeshFactory.releaseMesh(type, root); expect(MeshFactory.getPooledMesh(type)).toBe(root);
    expect(part.visible).toBe(true); expect(part.matrix.elements).toEqual(rest.elements);
});
