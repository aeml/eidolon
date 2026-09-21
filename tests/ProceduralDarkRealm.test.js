import * as THREE from 'three';
import { createDarkRealmScene } from '../src/art/ProceduralDarkRealm.js';
import { darkRealmFixture } from './darkRealmFixture.js';

test('expedition renders one floor union, four distinct districts and elemental camp lanterns', () => {
    const layout = darkRealmFixture(), scene = new THREE.Group();
    const before = JSON.stringify(layout);
    const root = createDarkRealmScene(scene, layout);
    expect(root.parent).toBe(scene);
    expect(root.position.toArray()).toEqual([40000, 0, 40800]);
    expect(JSON.stringify(layout)).toBe(before);
    const floors = root.children.filter(child => child.name === 'dark-realm-union-floor');
    const rects = floors.map(floor => floor.userData.walkSurface);
    const area = rects.reduce((sum, r) => sum + (r.right - r.left) * (r.bottom - r.top), 0);
    expect(area).toBe(1084000);
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        expect(Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
            Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)).toBe(false);
    }
    expect(new Set(root.userData.landmarks.map(p => p.kind)))
        .toEqual(new Set(['resonance-lantern', 'shore', 'archive', 'foundry', 'city']));
    expect(root.userData.landmarks.filter(p => p.kind === 'resonance-lantern')).toHaveLength(4);
    for (const landmark of root.userData.landmarks) {
        expect(layout.walkRects.some(r => Math.abs(landmark.x - r.x) <= r.width / 2 &&
            Math.abs(landmark.z - r.z) <= r.height / 2)).toBe(false);
    }
    const meshes = [];
    root.traverse(node => { if (node.isMesh) meshes.push(node); });
    expect(meshes.length).toBeLessThan(50);
    for (const mesh of meshes) {
        const bounds = new THREE.Box3().setFromObject(mesh);
        expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)).toBe(true);
    }
});

test('missing authoritative geography cannot silently create an overworld scene', () => {
    expect(() => createDarkRealmScene(new THREE.Group(), {})).toThrow('authoritative geography');
});
