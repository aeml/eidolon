import * as THREE from 'three';
import { createDarkRealmScene } from '../src/art/ProceduralDarkRealm.js';
import { DARK_REALM_COURTS } from '../src/data/darkRealmPopulation.js';
import { darkRealmFixture } from './darkRealmFixture.js';
import { RenderSystem } from '../src/core/RenderSystem.js';

test.each(['high', 'low'])('%s paper, cloth and masonry use local bounds without losing any district', quality => {
    const root = createDarkRealmScene(new THREE.Group(), darkRealmFixture(), null, { quality });
    try {
        root.updateMatrixWorld(true);
        const groups = root.children.filter(n => n.userData.sceneryDistrict);
        expect(groups).toHaveLength(11);
        for (const site of DARK_REALM_COURTS) {
            const courts = groups.filter(n => n.userData.sceneryDistrict === site.id);
            expect(courts).toHaveLength(site.recipe === 'foundry' ? 1 : 2);
            for (const mesh of courts) {
                const bounds = new THREE.Box3().setFromObject(mesh);
                expect(bounds.min.x).toBeGreaterThan(site.x - 15);
                expect(bounds.max.x).toBeLessThan(site.x + 15);
                expect(bounds.min.z).toBeGreaterThan(site.z - 12);
                expect(bounds.max.z).toBeLessThan(site.z + 8);
                expect(mesh.frustumCulled).toBe(true);
                expect(mesh.castShadow && mesh.receiveShadow).toBe(true);
            }
            expect(groups.filter(n => n.userData.sceneryDistrict === `skyline-${site.recipe}`)).toHaveLength(1);
        }
    } finally { RenderSystem.prototype.disposeObjectResources.call({}, root); }
});

test.each(['high', 'low'])('%s ordinary camera frustum retains nearby court surfaces and rejects distant courts', quality => {
    const root = createDarkRealmScene(new THREE.Group(), darkRealmFixture(), null, { quality });
    try {
        root.updateMatrixWorld(true);
        for (const site of DARK_REALM_COURTS) {
            const focus = new THREE.Vector3(site.x, 0, site.z + 4);
            const camera = new THREE.OrthographicCamera(-24, 24, 16, -16, .1, 2000);
            camera.position.copy(focus).add(new THREE.Vector3(100, 100, 100)); camera.lookAt(focus); camera.updateMatrixWorld(true);
            const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
            for (const mesh of root.children.filter(n => n.userData.sceneryDistrict?.startsWith('court-'))) {
                expect(frustum.intersectsObject(mesh)).toBe(mesh.userData.sceneryDistrict === site.id);
            }
        }
    } finally { RenderSystem.prototype.disposeObjectResources.call({}, root); }
});

test.each(['high', 'low'])('%s sibling groups dispose every shared material and owned geometry exactly once', quality => {
    const root = createDarkRealmScene(new THREE.Group(), darkRealmFixture(), null, { quality });
    const geometryCounts = new Map(), materialCounts = new Map();
    root.traverse(node => {
        if (!node.isMesh) return;
        geometryCounts.set(node.geometry, 0);
        if (!materialCounts.has(node.material)) {
            materialCounts.set(node.material, 0);
            node.material.addEventListener('dispose', () => materialCounts.set(node.material, materialCounts.get(node.material) + 1));
        }
        node.geometry.addEventListener('dispose', () => geometryCounts.set(node.geometry, geometryCounts.get(node.geometry) + 1));
    });
    RenderSystem.prototype.disposeObjectResources.call({}, root);
    expect(geometryCounts.size).toBe(49);
    expect([...geometryCounts.values()].every(n => n === 1)).toBe(true);
    expect([...materialCounts.values()].every(n => n === 1)).toBe(true);
});
