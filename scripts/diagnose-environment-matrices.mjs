import * as THREE from 'three';
import { performance } from 'node:perf_hooks';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { FoliageShadowInfluence } from '../src/core/FoliageShadowInfluence.js';
import { cacheUnchangedLocalMatrix } from '../src/core/UnchangedLocalMatrix.js';
import { EARTH_ELEVATION } from '../src/data/worldElevation.js';
import { EARTH_OUTCROP_PROFILE } from '../src/data/earthOutcrops.js';
const scene = new THREE.Scene(), environment = new THREE.Group(), root = new THREE.Group();
scene.add(environment); environment.add(root);
const owned = [scene, environment, root].map(cacheUnchangedLocalMatrix);
const foliage = new FoliageShadowInfluence(scene, [root]);
// Node has no DOM. Retain the casino plaque mesh/material/texture ownership;
// only its three text-paint operations are stubbed for this matrix-only probe.
globalThis.document = { createElement: tag => {
    if (tag !== 'canvas') throw new Error(`Unexpected DOM dependency: ${tag}`);
    return { getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) };
} };
const world = new WorldGenerator(root, new CollisionManager(), { graphicsQuality: 'high', terrainElevation: EARTH_ELEVATION, terrainProfile: EARTH_OUTCROP_PROFILE });
await world.loadTrees(0, 200); await world.loadBuildings(0, 200); await world.createOverworldStructures();
scene.updateMatrixWorld(true);
const counts = { objects: 0, groups: 0, meshes: 0, instanced: 0, batched: 0, automaticMeshes: 0 };
root.traverse(part => { counts.objects++; counts.groups += Number(Boolean(part.isGroup)); counts.meshes += Number(Boolean(part.isMesh));
    counts.instanced += Number(Boolean(part.isInstancedMesh)); counts.batched += Number(Boolean(part.isBatchedMesh));
    counts.automaticMeshes += Number(Boolean(part.isMesh && part.matrixAutoUpdate)); });
const saved = new Map(); root.traverse(part => saved.set(part, part.matrixWorld.clone()));
const measure = () => {
    for (let i = 0; i < 100; i++) scene.updateMatrixWorld();
    const samples = [];
    for (let i = 0; i < 600; i++) { const start = performance.now(); scene.updateMatrixWorld(); samples.push(performance.now() - start); }
    samples.sort((a, b) => a - b); return { medianMs: samples[300], p95Ms: samples[570] };
};
const reports = [{ mode: 'current', ...measure() }], restorers = [];
root.traverse(part => { const restore = cacheUnchangedLocalMatrix(part); if (restore) restorers.push(restore); });
reports.push({ mode: 'environment-groups', ...measure() });
for (const [part, matrix] of saved) if (!part.matrixWorld.equals(matrix)) throw new Error('Unchanged geometry moved');
restorers.forEach(restore => restore()); reports.push({ mode: 'current-again', ...measure() });
console.log(JSON.stringify({ scope: 'CPU-only actual authored world matrix diagnostic; casino sign canvas paint stubbed, geometry retained. No renderer/actors/RAF/visual/device budget claim', counts, cachedGroups: restorers.length, reports }, null, 2));
foliage.dispose(); owned.forEach(restore => restore());
