import * as THREE from 'three';
import { jest } from '@jest/globals';
import {
    LANTERNHOLD_STRUCTURE_DEFINITIONS,
    LANTERNHOLD_STRUCTURE_IDS,
    createLanternholdCampPlacements,
    createProceduralLanternholdCampField,
    createProceduralLanternholdStructure,
    getProceduralLanternholdCacheMetrics
} from '../src/art/ProceduralLanternholdArchitecture.js';
import { MeshFactory } from '../src/utils/MeshFactory.js';

const REQUIRED_IDENTITY_PARTS = Object.freeze({
    oathhall: ['oathhall:bell-tower', 'oathhall:oath-bell', 'oathhall:belfry-spire'],
    trading_post: ['market:merchant-counter', 'market:ledger:-3.25', 'market:votive:lantern-flame',
        'market:tensioned-cloth-canopy', 'market:sealed-crate:lid:0', 'market:wrapped-bundle:0',
        'market:supply-cask:0', 'market:cask-hoop:1:2'],
    blacksmith: ['smithy:chimney-stack', 'smithy:horned-stack-cap', 'smithy:sign-anvil',
        'smithy:repair-rack-crossbar', 'smithy:unfinished-blade:0', 'smithy:hammer-head'],
    camp: ['camp:grave-road-tent', 'camp:oathfire-ring', 'camp:split-oath-banner'],
    trading_house: ['compact:gilded-ledger-sign', 'compact:chained-scale-ring', 'compact:scale-pan:-1'],
    forge: ['forge:white-hot-mouth', 'forge:crowned-hood', 'forge:anvil-face'],
    stash: ['stash:black-oak-coffer', 'stash:oath-lock', 'stash:lock-rune']
});

function visibleMeshes(root) {
    const meshes = [];
    root.traverse((object) => {
        if (object.isMesh && object.userData.proceduralTownPart) meshes.push(object);
    });
    return meshes;
}

describe('procedural Lanternhold architecture', () => {
    test('market supplies meet the actual platform and stacked crates meet each other', () => {
        const root = createProceduralLanternholdStructure('trading_post'); root.updateMatrixWorld(true);
        const bounds = name => new THREE.Box3().setFromObject(root.getObjectByName(name));
        const floor = bounds('market:cut-stone-plinth').max.y;
        for (const name of ['market:rear-supply-chest', 'market:supply-cask:0', 'market:supply-cask:1',
            'market:sealed-crate:face:0:-1']) {
            expect(bounds(name).min.y).toBeCloseTo(floor, 6);
        }
        const lower = bounds('market:sealed-crate:face:0:-1');
        const upper = bounds('market:stacked-crate:face:0:-1');
        expect(upper.min.y).toBeCloseTo(lower.max.y, 6);
    });
    test('pilgrim hearth and folded bedroll meet the town ground without changing the camp footprint or batches', () => {
        const camp = createProceduralLanternholdStructure('camp');
        camp.updateMatrixWorld(true);
        const ground = .025 - .005; // Town surface minus the existing field origin.
        const ring = new THREE.Box3().setFromObject(camp.getObjectByName('camp:oathfire-ring'));
        const bedroll = camp.getObjectByName('camp:bedroll');
        const bed = new THREE.Box3().setFromObject(bedroll);
        expect(ring.min.y).toBeGreaterThanOrEqual(ground - .001);
        expect(ring.min.y).toBeLessThan(ground + .01);
        expect(bed.min.y).toBeGreaterThanOrEqual(ground - .001);
        expect(bed.min.y).toBeLessThan(ground + .01);
        expect(bedroll.geometry.attributes.position.count / 3).toBeLessThan(200);
        expect(bedroll.geometry.attributes.position.count / 3).toBeGreaterThan(100);
        for (const index of [0, 1]) {
            const log = new THREE.Box3().setFromObject(camp.getObjectByName(`camp:hearth-log:${index}`));
            expect(log.min.y).toBeGreaterThanOrEqual(ground - .001);
            expect(log.min.x).toBeGreaterThan(ring.min.x);
            expect(log.max.x).toBeLessThan(ring.max.x);
            expect(log.min.z).toBeGreaterThan(ring.min.z);
            expect(log.max.z).toBeLessThan(ring.max.z);
        }
        const lower = new THREE.Box3().setFromObject(camp.getObjectByName('camp:hearth-log:0'));
        const upper = new THREE.Box3().setFromObject(camp.getObjectByName('camp:hearth-log:1'));
        expect(upper.min.y).toBeCloseTo(lower.max.y, 6);
        const placements = createLanternholdCampPlacements(0, 200);
        const field = createProceduralLanternholdCampField(placements);
        expect(placements).toHaveLength(15);
        expect(field.children).toHaveLength(9);
        const triangles = field.children.reduce((sum, mesh) =>
            sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3 * mesh.count, 0);
        expect(triangles).toBeLessThanOrEqual(20000);
    });
    test('camp canvas and entrance share physical cloth detail without new material buckets', () => {
        const camp = createProceduralLanternholdStructure('camp');
        for (const name of ['camp:grave-road-tent', 'camp:open-tent-flap']) {
            const material = camp.getObjectByName(name).material;
            expect(material.userData.worldSurfaceDetail).toBe('canvas');
            expect([material.map, material.normalMap, material.roughnessMap]).toEqual([null, null, null]);
        }
    });
    test('smithy workbench and repair supplies are outside the wall, inside the unchanged building envelope', () => {
        const root = createProceduralLanternholdStructure('blacksmith');
        root.updateMatrixWorld(true);
        const wall = new THREE.Box3().setFromObject(root.getObjectByName('smithy:stone-workshop'));
        for (const name of ['smithy:side-workbench', 'smithy:waiting-billet:0', 'smithy:hammer-head']) {
            const bounds = new THREE.Box3().setFromObject(root.getObjectByName(name));
            expect(bounds.min.z).toBeGreaterThan(wall.max.z);
            expect(bounds.max.z).toBeLessThan(LANTERNHOLD_STRUCTURE_DEFINITIONS.blacksmith.bounds[2] / 2);
        }
    });
    test('covers every authored town-building role with an intentional style and exact gameplay bounds', () => {
        expect(LANTERNHOLD_STRUCTURE_IDS).toEqual([
            'oathhall',
            'trading_post',
            'blacksmith',
            'camp',
            'trading_house',
            'forge',
            'stash'
        ]);

        for (const structureId of LANTERNHOLD_STRUCTURE_IDS) {
            const definition = LANTERNHOLD_STRUCTURE_DEFINITIONS[structureId];
            const root = createProceduralLanternholdStructure(structureId);
            root.updateMatrixWorld(true);
            const bounds = new THREE.Box3().setFromObject(root);
            const size = bounds.getSize(new THREE.Vector3());
            const gameplayBounds = root.getObjectByName(`${structureId}:gameplay-bounds`);
            const parts = visibleMeshes(root);

            expect(root.userData).toEqual(expect.objectContaining({
                proceduralTownStructure: true,
                structureId,
                artStyle: definition.artStyle,
                role: definition.role,
                gameplayBounds: definition.bounds
            }));
            expect(definition.artStyle).toMatch(/^Lanternhold /);
            expect(gameplayBounds).toBeTruthy();
            expect(gameplayBounds.material.visible).toBe(false);
            expect(gameplayBounds.userData.gameplayBounds).toBe(true);
            expect(size.toArray()).toEqual(expect.arrayContaining(definition.bounds));
            definition.bounds.forEach((value, index) => expect(size.getComponent(index)).toBeCloseTo(value, 5));
            expect(bounds.min.y).toBeCloseTo(0, 5);
            expect(parts.length).toBeGreaterThanOrEqual(structureId === 'camp' ? 13 : 11);
            expect(parts.every((part) => part.geometry?.isBufferGeometry)).toBe(true);
            expect(parts.every((part) => part.material?.flatShading || part.name === 'camp:grave-road-tent')).toBe(true);
            expect(parts.every((part) => [
                part.position.x, part.position.y, part.position.z,
                part.scale.x, part.scale.y, part.scale.z
            ].every(Number.isFinite))).toBe(true);

            const contractMin = new THREE.Vector3(-definition.bounds[0] / 2, 0, -definition.bounds[2] / 2);
            const contractMax = new THREE.Vector3(definition.bounds[0] / 2, definition.bounds[1], definition.bounds[2] / 2);
            for (const part of parts) {
                const partBounds = new THREE.Box3().setFromObject(part);
                expect(partBounds.min.x).toBeGreaterThanOrEqual(contractMin.x - 1e-6);
                expect(partBounds.min.y).toBeGreaterThanOrEqual(contractMin.y - 1e-6);
                expect(partBounds.min.z).toBeGreaterThanOrEqual(contractMin.z - 1e-6);
                expect(partBounds.max.x).toBeLessThanOrEqual(contractMax.x + 1e-6);
                expect(partBounds.max.y).toBeLessThanOrEqual(contractMax.y + 1e-6);
                expect(partBounds.max.z).toBeLessThanOrEqual(contractMax.z + 1e-6);
            }
        }
    });

    test('gives every structure semantic identity pieces instead of anonymous fallback boxes', () => {
        for (const [structureId, expectedNames] of Object.entries(REQUIRED_IDENTITY_PARTS)) {
            const root = createProceduralLanternholdStructure(structureId);
            const names = new Set(visibleMeshes(root).map((part) => part.name));
            expectedNames.forEach((name) => expect(names).toContain(name));
        }
    });

    test('shares immutable rendering resources while keeping each structure transform-owned', () => {
        const first = createProceduralLanternholdStructure('trading_house');
        const second = createProceduralLanternholdStructure('trading_house');
        const firstParts = new Map(visibleMeshes(first).map((part) => [part.name, part]));
        const secondParts = new Map(visibleMeshes(second).map((part) => [part.name, part]));

        expect(first).not.toBe(second);
        for (const [name, firstPart] of firstParts) {
            expect(secondParts.get(name).geometry).toBe(firstPart.geometry);
            expect(secondParts.get(name).material).toBe(firstPart.material);
            expect(secondParts.get(name)).not.toBe(firstPart);
        }
        first.position.set(20, 3, -5);
        expect(second.position.toArray()).toEqual([0, 0, 0]);
        expect(getProceduralLanternholdCacheMetrics()).toEqual({
            geometries: 23,
            materials: 15,
            structures: 7
        });
    });

    test('batches settlement landmarks by material and instances all fifteen camps', () => {
        const landmarkIds = ['oathhall', 'trading_post', 'blacksmith'];
        const landmarks = landmarkIds.map((structureId) =>
            createProceduralLanternholdStructure(structureId, { optimized: true })
        );
        const placements = createLanternholdCampPlacements(0, 200);
        const campField = createProceduralLanternholdCampField(placements);

        for (const landmark of landmarks) {
            const definition = LANTERNHOLD_STRUCTURE_DEFINITIONS[landmark.userData.structureId];
            const bounds = new THREE.Box3().setFromObject(landmark);
            const size = bounds.getSize(new THREE.Vector3());
            expect(landmark.userData.renderBatched).toBe(true);
            expect(landmark.userData.sourceMeshCount).toBeGreaterThan(landmark.userData.drawMeshCount);
            expect(landmark.userData.drawMeshCount).toBeLessThanOrEqual(10);
            definition.bounds.forEach((value, index) => expect(size.getComponent(index)).toBeCloseTo(value, 5));
        }

        expect(campField.userData).toEqual(expect.objectContaining({
            proceduralTownCampField: true,
            instanceCount: 15,
            sourceMeshCount: 255,
            drawMeshCount: 9
        }));
        expect(campField.children).toHaveLength(9);
        expect(campField.children.every((part) => part.isInstancedMesh && part.count === 15)).toBe(true);
        const matrix = new THREE.Matrix4();
        for (const part of campField.children) {
            for (let index = 0; index < part.count; index += 1) {
                part.getMatrixAt(index, matrix);
                expect(matrix.elements.every(Number.isFinite)).toBe(true);
            }
        }
        const settlementDrawMeshes = landmarks.reduce(
            (total, landmark) => total + landmark.userData.drawMeshCount,
            campField.userData.drawMeshCount
        );
        expect(settlementDrawMeshes).toBe(38);
    });

    test('routes every interactive town object through generated geometry without invoking GLTFLoader', async () => {
        const loadSpy = jest.spyOn(MeshFactory, 'loadModel');
        try {
            const expected = {
                TradingHouse: 'trading_house',
                Forge: 'forge',
                Stash: 'stash'
            };
            for (const [type, structureId] of Object.entries(expected)) {
                const mesh = await MeshFactory.createMeshForType(type);
                expect(mesh.userData).toEqual(expect.objectContaining({
                    proceduralTownStructure: true,
                    structureId,
                    renderBatched: true
                }));
            }
            expect(loadSpy).not.toHaveBeenCalled();
        } finally {
            loadSpy.mockRestore();
        }
    });

    test('canvas hems ground on the town surface instead of retaining the buried legacy origin', () => {
        const placements = createLanternholdCampPlacements(0, 200);
        const field = createProceduralLanternholdCampField(placements);
        const canvas = field.children.find(part => part.material.flatShading === false);
        expect(canvas).toBeDefined();
        const matrix = new THREE.Matrix4();
        for (let i = 0; i < canvas.count; i++) {
            canvas.getMatrixAt(i, matrix);
            expect(canvas.geometry.boundingBox.clone().applyMatrix4(matrix).min.y).toBeCloseTo(.025, 6);
        }
        expect(canvas.material.vertexColors).toBe(true);
        expect(canvas.material.map).toBeNull();
    });

    test('places all fifteen outer-town camps deterministically with the existing clearance contract', () => {
        const first = createLanternholdCampPlacements(0, 200);
        const second = createLanternholdCampPlacements(0, 200);

        expect(second).toEqual(first);
        expect(first).toHaveLength(15);
        for (const [index, placement] of first.entries()) {
            expect(Math.hypot(placement.x, placement.z - 200)).toBeGreaterThanOrEqual(50);
            expect(Number.isFinite(placement.rotation)).toBe(true);
            for (const other of first.slice(index + 1)) {
                expect(Math.hypot(placement.x - other.x, placement.z - other.z)).toBeGreaterThanOrEqual(20);
            }
        }
    });

    test('fails loudly for an unmapped structure family', () => {
        expect(() => createProceduralLanternholdStructure('generic-building'))
            .toThrow('Unknown Lanternhold structure: generic-building');
    });
});
