import * as THREE from 'three';
import {
    DUNGEON_ENTRANCE_DEFINITIONS,
    DUNGEON_ENTRANCE_IDS,
    createProceduralDungeonEntrance,
    getProceduralDungeonEntranceCacheMetrics
} from '../src/art/ProceduralDungeonEntrances.js';

const EXPECTED_CONTRACTS = Object.freeze({
    verdant_bastion_catacombs: {
        bounds: [76.13120079040527, 61.46895885467529, 72.87123918533325],
        position: [800, 0, 200],
        semanticParts: ['verdant:witch-gate:eidolic-veil', 'verdant:antler-trunk:-1', 'verdant:funerary-sun']
    },
    molten_core: {
        bounds: [76.23759984970093, 71.23167991638184, 75.87180137634277],
        position: [-2400, 0, 200],
        semanticParts: ['molten:furnace-mouth:eidolic-veil', 'molten:great-chain-upper:-1', 'molten:threshold-rift']
    },
    tempest_spire: {
        bounds: [44.4045615196228, 76.54812097549438, 48.13672065734863],
        position: [2400, 0, 200],
        semanticParts: ['tempest:storm-eye:eidolic-veil', 'tempest:floating-slate:-1:0', 'tempest:lightning-leg-a:1']
    },
    abyssal_well: {
        bounds: [76.47827863693237, 37.49948024749756, 52.10767984390259],
        position: [0, 0, -1400],
        semanticParts: ['abyssal:black-water-eye', 'abyssal:reliquary-gate:eidolic-veil', 'abyssal:anchor-tentacle-front:1']
    }
});

describe('procedural dungeon entrances', () => {
    test.each([false, true])('Molten gate faces its east approach within the unchanged gameplay box (batched=%s)', optimized => {
        const root = createProceduralDungeonEntrance('molten_core', { optimized });
        root.updateMatrixWorld(true);
        const visibleBounds = new THREE.Box3();
        root.traverse(part => {
            if (part.userData.proceduralDungeonEntrancePart) visibleBounds.union(new THREE.Box3().setFromObject(part));
        });
        expect(visibleBounds.max.y).toBeLessThan(37);
        expect(visibleBounds.max.y).toBeGreaterThan(30);
        expect(visibleBounds.min.y).toBeGreaterThanOrEqual(0);
        expect(root.userData.interactionRadius).toBe(DUNGEON_ENTRANCE_DEFINITIONS.molten_core.interactionRadius);
        const ray = new THREE.Raycaster(new THREE.Vector3(45, 6.6, 0), new THREE.Vector3(-1, 0, 0));
        const hit = ray.intersectObject(root, true).find(hit => hit.object.material.visible !== false);
        expect(hit.object.userData.portalSurface).toBe(true);
        expect(hit.point.x).toBeCloseTo(32.49, 2);
        if (!optimized) {
            const gate = root.getObjectByName('molten:furnace-mouth:eidolic-veil');
            expect(gate.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(6.6);
            const normal = new THREE.Vector3(0, 0, 1).transformDirection(gate.matrixWorld);
            expect(normal.x).toBeCloseTo(1); expect(normal.z).toBeCloseTo(0);
            const vault = root.getObjectByName('molten:kiln-vault');
            // Real recessed chamber behind the foregate, not a solid box.
            const interior = new THREE.Raycaster(new THREE.Vector3(25, 4, 0), new THREE.Vector3(-1, 0, 0));
            const hit = interior.intersectObject(vault)[0];
            expect(hit.point.x).toBeCloseTo(-18.9, 2);
        }
    });
    test('Bastion has an open ruined hall, finite broken parapets and curved bark roots', () => {
        const root = createProceduralDungeonEntrance('verdant_bastion_catacombs', { optimized: false });
        root.updateMatrixWorld(true);
        const hall = root.getObjectByName('verdant:gatehouse');
        const ray = new THREE.Raycaster(new THREE.Vector3(0, 100, -5), new THREE.Vector3(0, -1, 0));
        const hits = ray.intersectObject(hall);
        expect(hits.length).toBeGreaterThan(0);
        expect(hits[0].point.y).toBeCloseTo(2); // Floor, not a solid roof at 13.5m.
        for (const side of [-1, 1]) {
            const parapet = root.getObjectByName(`verdant:tower-crown:${side}`);
            const normals = parapet.geometry.attributes.normal.array;
            expect([...normals].every(Number.isFinite)).toBe(true);
            const bounds = new THREE.Box3().setFromObject(parapet);
            expect(bounds.min.y).toBeGreaterThanOrEqual(17);
            expect(bounds.max.y).toBeLessThan(20);
            const branch = root.getObjectByName(`verdant:antler-trunk:${side}`);
            expect(branch.material.userData.worldSurfaceDetail).toBe('bark');
            expect(branch.geometry.attributes.position.count).toBeGreaterThan(80);
        }
        expect(root.getObjectByName('verdant:gatehouse-crown')).toBeUndefined();
    });

    test.each(DUNGEON_ENTRANCE_IDS)('%s batches a depth-writing, animated veil without extra transparent layers', dungeonType => {
        const raw = createProceduralDungeonEntrance(dungeonType, { optimized: false });
        const veil = [];
        raw.traverse(part => {
            if (part.isMesh && part.material.userData.dungeonVeilTime) veil.push(part);
        });
        expect(veil).toHaveLength(1);
        const material = veil[0].material;
        expect(material.transparent).toBe(false);
        expect(material.depthWrite).toBe(true);
        expect(material.map).toBeNull();
        expect(material.userData.worldSurfaceDetail).toBeUndefined();
        const batched = createProceduralDungeonEntrance(dungeonType);
        const part = batched.children.find(part => part.material === material);
        expect(part.userData.portalSurface).toBe(true);
        material.userData.dungeonVeilTime.value = -1;
        part.onBeforeRender();
        expect(material.userData.dungeonVeilTime.value).toBeGreaterThanOrEqual(0);
        const shader = { uniforms: {}, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
        material.onBeforeCompile(shader);
        expect(shader.uniforms.dungeonVeilTime).toBe(material.userData.dungeonVeilTime);
        expect(shader.fragmentShader).toContain('totalEmissiveRadiance += dungeonVeilTint');
        expect(shader.fragmentShader).toContain('#include <opaque_fragment>');
        expect(shader.fragmentShader).toContain('#include <fog_fragment>');
    });

    test.each([false, true])('Verdant visible towers fit the approach view without changing legacy bounds (batched=%s)', optimized => {
        const root = createProceduralDungeonEntrance('verdant_bastion_catacombs', { optimized });
        root.updateMatrixWorld(true);
        const visibleBounds = new THREE.Box3();
        root.traverse(part => {
            if (part.userData.proceduralDungeonEntrancePart) visibleBounds.union(new THREE.Box3().setFromObject(part));
        });
        expect(visibleBounds.max.y).toBeLessThan(31);
        expect(visibleBounds.max.y).toBeGreaterThan(28);
        expect(visibleBounds.min.y).toBeGreaterThanOrEqual(0);
        expect(visibleBounds.getSize(new THREE.Vector3()).x).toBeGreaterThan(60);
        expect(new THREE.Box3().setFromObject(root).max.y).toBeCloseTo(61.46895885467529);
        expect(root.userData.interactionRadius).toBe(DUNGEON_ENTRANCE_DEFINITIONS.verdant_bastion_catacombs.interactionRadius);
    });

    test('Verdant threshold is visibly aligned with the reachable forecourt', () => {
        const root = createProceduralDungeonEntrance('verdant_bastion_catacombs', { optimized: false });
        const gate = root.getObjectByName('verdant:witch-gate:eidolic-veil');
        const position = gate.getWorldPosition(new THREE.Vector3());
        expect(position.x).toBe(0);
        expect(position.z).toBeGreaterThan(32);
        expect(position.z).toBeLessThan(root.userData.interactionRadius);
        expect(position.y).toBe(6);
        const arch = root.getObjectByName('verdant:carved-foregate');
        expect(arch.material.userData.worldSurfaceDetail).toBe('fieldstone');
        const bounds = new THREE.Box3().setFromObject(arch);
        expect(bounds.min.y).toBeGreaterThan(0);
        expect(bounds.max.y).toBeLessThan(12.5);
        expect(bounds.min.z).toBeGreaterThan(29);
        expect(bounds.max.z).toBeLessThan(33);
        // The real carved opening remains empty, not a textured solid box.
        const ray = new THREE.Raycaster(new THREE.Vector3(0, 7, 40), new THREE.Vector3(0, 0, -1));
        expect(ray.intersectObject(arch)).toHaveLength(0);
    });

    test.each(DUNGEON_ENTRANCE_IDS)('%s has world-scaled stone detail without texturing portal surfaces', dungeonType => {
        const source = createProceduralDungeonEntrance(dungeonType, { optimized: false });
        const batched = createProceduralDungeonEntrance(dungeonType);
        const stone = new Set(), portalMaterials = new Set();
        source.traverse(part => {
            if (!part.isMesh) return;
            if (part.material.userData.worldSurfaceDetail) stone.add(part.material);
            if (part.userData.portalSurface) portalMaterials.add(part.material);
        });
        expect(stone.size).toBe(dungeonType === 'verdant_bastion_catacombs' ? 3 : 2);
        const surface = dungeonType === 'verdant_bastion_catacombs' ? 'fortress' : dungeonType === 'molten_core' ? 'fieldstone' : dungeonType === 'tempest_spire' ? 'slate' : 'stone';
        expect([...stone].map(material => material.userData.worldSurfaceDetail)).toContain(surface);
        for (const material of stone) {
            expect(batched.children.some(part => part.material === material)).toBe(true);
            expect(material.depthTest).toBe(true);
            expect(material.depthWrite).toBe(true);
            expect(material.transparent).toBe(false);
        }
        for (const material of portalMaterials) expect(material.userData.worldSurfaceDetail).toBeUndefined();
    });

    test('catalogs every production threshold with its measured legacy contract', () => {
        expect(DUNGEON_ENTRANCE_IDS).toEqual(Object.keys(EXPECTED_CONTRACTS));
        for (const dungeonType of DUNGEON_ENTRANCE_IDS) {
            const definition = DUNGEON_ENTRANCE_DEFINITIONS[dungeonType];
            const expected = EXPECTED_CONTRACTS[dungeonType];
            expect(definition.bounds).toEqual(expected.bounds);
            expect(definition.position).toEqual(expected.position);
            expect(definition.interactionRadius).toBeCloseTo(
                Math.min(expected.bounds[0], expected.bounds[2]) * 0.45,
                10
            );
            expect(definition.artStyle).toMatch(/Thorncrypt|Furnace Below|Shattered Aerie|Drowned Sanctum/);
        }
    });

    test.each(DUNGEON_ENTRANCE_IDS)('%s owns intentional themed parts and an exact grounded gameplay box', (dungeonType) => {
        const entrance = createProceduralDungeonEntrance(dungeonType, { optimized: false });
        const definition = DUNGEON_ENTRANCE_DEFINITIONS[dungeonType];
        const expected = EXPECTED_CONTRACTS[dungeonType];
        const gameplayBounds = entrance.getObjectByName(`${dungeonType}:gameplay-bounds`);

        expect(entrance.name).toBe('DungeonEntrance');
        expect(entrance.userData).toEqual(expect.objectContaining({
            dungeonType,
            artStyle: definition.artStyle,
            proceduralDungeonEntrance: true,
            gameplayBounds: expected.bounds,
            interactionRadius: definition.interactionRadius
        }));
        expect(gameplayBounds).toBeInstanceOf(THREE.Mesh);
        expect(gameplayBounds.position.y).toBeCloseTo(expected.bounds[1] / 2, 10);
        expect(gameplayBounds.scale.toArray()).toEqual(expected.bounds);
        expect(gameplayBounds.material.visible).toBe(false);
        for (const name of expected.semanticParts) expect(entrance.getObjectByName(name)).toBeTruthy();

        entrance.updateMatrixWorld(true);
        const actual = new THREE.Box3().setFromObject(entrance);
        const actualSize = actual.getSize(new THREE.Vector3()).toArray();
        expected.bounds.forEach((value, index) => expect(actualSize[index]).toBeCloseTo(value, 5));
        expect(actual.min.y).toBeCloseTo(0, 5);
        const visibleParts = [];
        entrance.traverse((part) => {
            if (part.isMesh && part.userData.proceduralDungeonEntrancePart) visibleParts.push(part);
        });
        expect(visibleParts.length).toBeGreaterThanOrEqual(24);
        expect(visibleParts.some((part) => part.userData.portalSurface)).toBe(true);
        expect(visibleParts.every((part) => [
            ...part.position.toArray(),
            part.rotation.x, part.rotation.y, part.rotation.z,
            ...part.scale.toArray()
        ].every(Number.isFinite))).toBe(true);
    });

    test('batches each production entrance by regional material without sharing mutable roots', () => {
        const firstRoots = [];
        for (const dungeonType of DUNGEON_ENTRANCE_IDS) {
            const first = createProceduralDungeonEntrance(dungeonType);
            const second = createProceduralDungeonEntrance(dungeonType);
            firstRoots.push(first);
            expect(first).not.toBe(second);
            expect(first.userData.renderBatched).toBe(true);
            expect(first.userData.sourceMeshCount).toBeGreaterThanOrEqual(24);
            expect(first.userData.drawMeshCount).toBeLessThanOrEqual(9);
            expect(first.children.filter((part) => part.userData.proceduralDungeonEntrancePart)).toHaveLength(
                first.userData.drawMeshCount
            );
            expect(first.children[0].geometry).toBe(second.children[0].geometry);
            expect(first.children[0].material).toBe(second.children[0].material);
            first.position.x = 99;
            expect(second.position.x).toBe(0);
        }
        expect(new Set(firstRoots.map((root) => root.userData.artStyle)).size).toBe(4);
        expect(getProceduralDungeonEntranceCacheMetrics()).toEqual({
            geometries: 34,
            materials: 30,
            entrances: 4
        });
    });

    test('rejects unknown entrance routes instead of hiding coverage behind a fallback', () => {
        expect(() => createProceduralDungeonEntrance('unmapped_void')).toThrow(
            'Unknown procedural dungeon entrance: unmapped_void'
        );
    });
});
