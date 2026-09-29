import * as THREE from 'three';
import { createLanternholdArchPanel, createLanternholdArchFrame } from '../src/art/LanternholdFacadeGeometry.js';
import { createProceduralLanternholdStructure } from '../src/art/ProceduralLanternholdArchitecture.js';

test('carved surround is an open ring with finite inner walls, not a filled glowing panel', () => {
    const geometry = createLanternholdArchFrame(), panel = createLanternholdArchPanel();
    const material = new THREE.MeshBasicMaterial();
    const frame = new THREE.Mesh(geometry, material), glass = new THREE.Mesh(panel, material);
    frame.updateMatrixWorld(true); glass.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 3), new THREE.Vector3(0, 0, -1));
    expect(ray.intersectObject(frame)).toHaveLength(0);
    expect(ray.intersectObject(glass).length).toBeGreaterThan(0);
    ray.ray.origin.x = .46;
    expect(ray.intersectObject(frame).length).toBeGreaterThan(0);
    for (const part of [geometry, panel]) {
        expect(part.attributes.normal.array.every(Number.isFinite)).toBe(true);
        part.computeBoundingBox();
        expect(part.boundingBox.min.x).toBeGreaterThan(-.53);
        expect(part.boundingBox.max.x).toBeLessThan(.53);
        expect(part.boundingBox.max.y).toBeLessThan(.53);
    }
    geometry.dispose(); panel.dispose(); material.dispose();
});

test.each([['oathhall', 'oathhall:lower-window:-6.3'], ['trading_house', 'compact:ledger-window:-4.55'], ['blacksmith', 'smithy:west-window']])(
    '%s puts glass behind the frame lip and preserves the door identity', (id, prefix) => {
        const root = createProceduralLanternholdStructure(id);
        root.updateMatrixWorld(true);
        const pane = root.getObjectByName(`${prefix}:amber-pane`), frame = root.getObjectByName(`${prefix}:carved-surround`);
        const paneBounds = new THREE.Box3().setFromObject(pane), frameBounds = new THREE.Box3().setFromObject(frame);
        expect(frameBounds.max.z - paneBounds.max.z).toBeGreaterThan(.1);
        expect(frameBounds.min.y).toBeLessThan(paneBounds.min.y);
        expect(frameBounds.max.y).toBeGreaterThan(paneBounds.max.y);
        const parts = []; root.traverse(part => { if (part.name.endsWith(':black-oak-door')) parts.push(part); });
        expect(parts).toHaveLength(1);
        expect(parts[0].material.userData.worldSurfaceDetail).toBe('timber');
    });

test('Trading House entrance lanterns no longer cover the inner glazing', () => {
    const root = createProceduralLanternholdStructure('trading_house'); root.updateMatrixWorld(true);
    for (const [side, name] of [[-1, 'west'], [1, 'east']]) {
        const pane = new THREE.Box3().setFromObject(root.getObjectByName(`compact:ledger-window:${side * 2.8}:amber-pane`));
        const lantern = new THREE.Box3().setFromObject(root.getObjectByName(`compact:${name}-lantern:lantern-cage`));
        const gap = side > 0 ? pane.min.x - lantern.max.x : lantern.min.x - pane.max.x;
        expect(gap).toBeGreaterThan(.05);
    }
});
