import * as THREE from 'three';
import { createDarkDistrictArchitectureGeometry } from '../src/art/DarkDistrictArchitectureGeometry.js';
import { createDarkRealmScene, getDarkRealmCampColliders, getDarkRealmCourtColliders } from '../src/art/ProceduralDarkRealm.js';
import { darkRealmFixture } from './darkRealmFixture.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { RenderSystem } from '../src/core/RenderSystem.js';

const recipes = ['shore', 'archive', 'foundry', 'city'];
const variants = ['high', 'low'].flatMap(quality => recipes.map(recipe => [quality, recipe]));
const heights = { shore: 20, archive: 20, foundry: 28, city: 42 };

test.each(variants)('%s %s architecture is bounded, finite and uses nondegenerate surfaces', (quality, recipe) => {
    const parts = createDarkDistrictArchitectureGeometry(recipe, quality), bounds = new THREE.Box3();
    try {
        let triangles = 0, minimumArea = Infinity, valid = true;
        const a = new THREE.Vector3(), b = a.clone(), c = a.clone();
        for (const g of Object.values(parts)) {
            bounds.union(g.boundingBox); const p = g.attributes.position, n = g.attributes.normal;
            expect(g.attributes.uv.count).toBe(p.count); triangles += p.count / 3;
            for (let i = 0; i < p.count; i++) valid &&= [p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)].every(Number.isFinite)
                && Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < 1e-5;
            for (let i = 0; i < p.count; i += 3) {
                a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
                minimumArea = Math.min(minimumArea, b.sub(a).cross(c.sub(a)).length() / 2);
            }
        }
        const ceiling = { shore: 37, archive: 20.5, foundry: 50, city: 51 }[recipe];
        expect(new THREE.Box3(new THREE.Vector3(-16, -2, -14), new THREE.Vector3(16, ceiling, 14)).containsBox(bounds)).toBe(true);
        expect(bounds.min.y).toBe(-2); expect(valid).toBe(true); expect(minimumArea).toBeGreaterThan(.001);
        expect(triangles).toBeLessThan(quality === 'low' ? 350 : 500);
        expect(Object.keys(parts).sort()).toEqual(['bronze', 'glow', 'shadow', 'stone']);
    } finally { Object.values(parts).forEach(g => g.dispose()); }
});

test.each(variants)('%s %s windows have real frame openings and recessed opaque panes', (quality, recipe) => {
    const parts = createDarkDistrictArchitectureGeometry(recipe, quality), material = new THREE.MeshBasicMaterial();
    try {
        const y = recipe === 'archive' ? 13.9 : heights[recipe] * .65;
        const frame = new THREE.Mesh(parts.bronze, material), pane = new THREE.Mesh(parts.glow, material);
        for (const x of [-7, 7]) for (const side of [-1, 1]) {
            const ray = new THREE.Raycaster(new THREE.Vector3(x, y, side === 1 ? 20 : 10.8), new THREE.Vector3(0, 0, -side));
            const hit = ray.intersectObject(pane)[0];
            expect(hit).toBeDefined(); expect(hit.face.normal.z * side).toBeGreaterThan(.99);
            if (side === 1) expect(ray.intersectObject(frame).some(h => h.point.z > hit.point.z)).toBe(false);
        }
    } finally { material.dispose(); Object.values(parts).forEach(g => g.dispose()); }
});

test.each(['high', 'low'])('%s archive roof is closed and its slopes face the sky', quality => {
    const parts = createDarkDistrictArchitectureGeometry('archive', quality), material = new THREE.MeshBasicMaterial();
    try {
        const p = parts.shadow.attributes.position, edges = new Map();
        const vertex = i => [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e6)).join(',');
        for (let i = 0; i < p.count; i += 3) for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
            const key = [vertex(i + a), vertex(i + b)].sort().join('|'); edges.set(key, (edges.get(key) || 0) + 1);
        }
        expect([...edges.values()].every(count => count === 2)).toBe(true);
        const mesh = new THREE.Mesh(parts.shadow, material);
        for (const [x, z] of [[0, 5], [0, -5], [14, 0], [-14, 0]]) {
            const hit = new THREE.Raycaster(new THREE.Vector3(x, 25, z), new THREE.Vector3(0, -1, 0)).intersectObject(mesh)[0];
            expect(hit).toBeDefined(); expect(hit.face.normal.y).toBeGreaterThan(.8);
        }
    } finally { material.dispose(); Object.values(parts).forEach(g => g.dispose()); }
});

test.each(['high', 'low'])('%s districts retain all placements, shared materials and walking authority', quality => {
    const collision = new CollisionManager();
    const root = createDarkRealmScene(new THREE.Group(), darkRealmFixture(), collision, { quality });
    try {
        const meshes = []; root.traverse(n => { if (n.isMesh) meshes.push(n); });
        expect(meshes).toHaveLength(48); // Shared court timber plus bounded paper/cloth/masonry groups.
        for (const recipe of recipes) expect(root.userData.landmarks.filter(p => p.kind === recipe)).toHaveLength(8);
        expect(collision.colliders).toEqual([...getDarkRealmCampColliders(), ...getDarkRealmCourtColliders()]);
    } finally { RenderSystem.prototype.disposeObjectResources.call({}, root); }
});
