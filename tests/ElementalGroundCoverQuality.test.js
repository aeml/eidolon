import * as THREE from 'three';
import { createHash } from 'node:crypto';
import { createElementalGroundCover, updateElementalGroundCoverQuality } from '../src/art/ElementalGroundCover.js';
import { WATER_LOCATIONS, FIRE_LOCATIONS, AIR_LOCATIONS } from '../src/data/elementalPopulation.js';
import { RenderSystem } from '../src/core/RenderSystem.js';

const fingerprint = geometry => Object.fromEntries(['position', 'normal', 'color'].map(name =>
    [name, createHash('sha256').update(new Uint8Array(geometry.attributes[name].array.buffer)).digest('hex')]));

test.each([['water', WATER_LOCATIONS[0]], ['fire', FIRE_LOCATIONS[0]], ['air', AIR_LOCATIONS[0]]])(
    '%s settings switches preserve scene identities and regenerate exact canonical detail', (realm, site) => {
        const render = new RenderSystem(false), root = new THREE.Group(), material = new THREE.MeshStandardMaterial();
        const mesh = createElementalGroundCover(site, realm, [], material);
        root.position.set(site.x, 0, site.z); root.add(mesh); render.instanceEnvironmentGroup.add(root);
        const parent = mesh.parent, initial = fingerprint(mesh.geometry), replaced = [];
        let materialDisposals = 0;
        material.addEventListener('dispose', () => materialDisposals++);
        try {
            for (const next of ['low', 'high', 'low', 'medium']) {
                const before = mesh.geometry;
                let disposals = 0; before.addEventListener('dispose', () => disposals++);
                render.setGraphicsQuality(next);
                expect(disposals).toBe(1); replaced.push(before);
                expect(mesh.parent).toBe(parent); expect(mesh.material).toBe(material);
                expect(mesh.position.toArray()).toEqual([0, 0, 0]);
                expect(root.position.toArray()).toEqual([site.x, 0, site.z]);
                expect(mesh.castShadow).toBe(false); expect(mesh.receiveShadow).toBe(true);
                expect(mesh.userData.elementalGroundCover.quality).toBe(next === 'low' ? 'low' : 'high');
                const expected = createElementalGroundCover(site, realm, [], material, next);
                expect(mesh.userData.plantCount).toBe(expected.userData.plantCount);
                expect(fingerprint(mesh.geometry)).toEqual(fingerprint(expected.geometry));
                expect(mesh.geometry.boundingSphere.radius).toBeGreaterThan(0);
                expected.geometry.dispose();
                const unchanged = mesh.geometry;
                render.setGraphicsQuality(next);
                expect(mesh.geometry).toBe(unchanged);
            }
            expect(fingerprint(mesh.geometry)).toEqual(initial);
            expect(new Set(replaced).size).toBe(4);
            expect(materialDisposals).toBe(0);
        } finally { render.dispose(); }
        expect(materialDisposals).toBe(1);
    });

test('absent roots and unrelated meshes are left untouched', () => {
    const root = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    root.add(mesh); const geometry = mesh.geometry;
    try {
        updateElementalGroundCoverQuality(null, 'low');
        updateElementalGroundCoverQuality(root, 'low');
        expect(mesh.geometry).toBe(geometry);
    } finally { geometry.dispose(); mesh.material.dispose(); }
});
