import * as THREE from 'three';
import { performance } from 'node:perf_hooks';
import { createEarthUnderstory } from '../src/art/EarthUnderstory.js';
import { EARTH_ELEVATION } from '../src/data/worldElevation.js';
import { FoliageShadowInfluence } from '../src/core/FoliageShadowInfluence.js';

// CPU diagnostic: real scene matrices, foliage controller, outer renderer
// sphere tests and BatchedMesh per-plant draw preparation. No GPU, RAF, actor,
// network or whole-game frame-budget claim follows from these timings.
const views = [[-75, -330], [-33, -235], [340, 200], [470, 200], [600, 200]];
const samples = [], frustum = new THREE.Frustum(), projection = new THREE.Matrix4();
const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)];
function resources(root) {
    const geometries = new Set(), textures = new Set();
    let bytes = 0;
    root.traverse(mesh => {
        if (!mesh.isMesh) return;
        if (!geometries.has(mesh.geometry)) {
            geometries.add(mesh.geometry);
            for (const attribute of Object.values(mesh.geometry.attributes)) bytes += attribute.array.byteLength;
        }
        if (mesh.isInstancedMesh) bytes += mesh.instanceMatrix.array.byteLength + mesh.instanceColor.array.byteLength;
        for (const texture of [mesh._matricesTexture, mesh._indirectTexture, mesh._colorsTexture]) if (texture && !textures.has(texture)) {
            textures.add(texture); bytes += texture.image.data.byteLength;
        }
    });
    return { geometryBuffers: geometries.size, dataTextures: textures.size, bufferBytes: bytes };
}
function setup(quality, spatialBatches) {
    const root = createEarthUnderstory({ quality, terrainElevation: EARTH_ELEVATION, spatialBatches });
    const scene = new THREE.Scene(); scene.add(root);
    const controller = new FoliageShadowInfluence(scene);
    const camera = new THREE.OrthographicCamera(-18 * 1280 / 844, 18 * 1280 / 844, 18, -18, .1, 2000);
    const footprint = resources(root);
    const tick = () => {
        scene.updateMatrixWorld(); camera.updateMatrixWorld();
        controller.beginFrame(scene, camera);
        frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        let draws = 0, triangles = 0;
        for (const mesh of root.children) {
            if (!mesh.visible || !frustum.intersectsObject(mesh)) continue;
            draws++;
            if (mesh.isBatchedMesh) {
                mesh.onBeforeRender(null, scene, camera, mesh.geometry, mesh.material);
                for (let i = 0; i < mesh._multiDrawCount; i++) triangles += mesh._multiDrawCounts[i] / 3;
            } else triangles += mesh.geometry.attributes.position.count / 3 * mesh.count;
        }
        controller.endFrame();
        return { draws, triangles };
    };
    return { root, camera, controller, footprint, tick };
}
for (const quality of ['high', 'low']) {
    const alternatives = [setup(quality, false), setup(quality, true)];
    for (const [x, z] of views) {
        for (const state of alternatives) {
            const focus = new THREE.Vector3(x, EARTH_ELEVATION.sample(x, z), z);
            state.camera.position.copy(focus).add(new THREE.Vector3(100, 100, 100)); state.camera.lookAt(focus);
            for (let i = 0; i < 100; i++) state.tick();
        }
        const times = [[], []];
        for (let round = 0; round < 6; round++) for (const index of (round % 2 ? [1, 0] : [0, 1])) {
            for (let i = 0; i < 150; i++) {
                const start = performance.now(); alternatives[index].tick();
                times[index].push(performance.now() - start);
            }
        }
        samples.push({ quality, view: [x, z], modes: alternatives.map((state, index) => ({
            spatialBatches: Boolean(index), plants: state.root.userData.plantCount, meshes: state.root.children.length,
            ...state.footprint, submitted: state.tick(), frames: times[index].length,
            medianCpuMs: percentile(times[index], .5), p95CpuMs: percentile(times[index], .95)
        })) });
    }
    for (const state of alternatives) {
        state.controller.dispose();
        const materials = new Set(), geometries = new Set();
        state.root.traverse(mesh => {
            if (!mesh.isMesh) return;
            materials.add(mesh.material);
            if (mesh.isBatchedMesh) mesh.dispose();
            else if (!geometries.has(mesh.geometry)) { geometries.add(mesh.geometry); mesh.geometry.dispose(); }
        });
        for (const material of materials) material.dispose();
    }
}
console.log(JSON.stringify({ measuredAt: new Date().toISOString(), scope: 'CPU-only ground-cover diagnostic', samples }, null, 2));
