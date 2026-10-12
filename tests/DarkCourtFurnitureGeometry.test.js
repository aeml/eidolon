import * as THREE from 'three';
import { createDarkCourtWorkbenchGeometry, createDarkCourtStandardGeometry } from '../src/art/DarkCourtFurnitureGeometry.js';
import { createDarkRealmScene } from '../src/art/ProceduralDarkRealm.js';
import { DARK_REALM_COURT_SOLIDS } from '../src/data/darkRealmPopulation.js';
import { darkRealmFixture } from './darkRealmFixture.js';
import { RenderSystem } from '../src/core/RenderSystem.js';

const recipes = ['shore', 'archive', 'foundry', 'city'];
const variants = ['high', 'low'].flatMap(quality => recipes.flatMap(recipe => [
    [quality, recipe, 'workbench', createDarkCourtWorkbenchGeometry],
    [quality, recipe, 'standard', createDarkCourtStandardGeometry]
]));

test.each(variants)('%s %s %s is finite, bounded and stays inside the unchanged walk solid', (quality, recipe, kind, make) => {
    const parts = make(recipe, quality), bounds = new THREE.Box3();
    try {
        const solid = DARK_REALM_COURT_SOLIDS.find(s => s.kind === kind && s.recipe === recipe);
        const collision = new THREE.Box3(new THREE.Vector3(-solid.width / 2, -1, -solid.depth / 2),
            new THREE.Vector3(solid.width / 2, solid.height, solid.depth / 2));
        let triangles = 0, minimumArea = Infinity, finite = true;
        const a = new THREE.Vector3(), b = a.clone(), c = a.clone();
        for (const [key, geometry] of Object.entries(parts)) {
            bounds.union(geometry.boundingBox); const p = geometry.attributes.position, n = geometry.attributes.normal;
            expect(geometry.attributes.uv.count).toBe(p.count);
            if (['paper', 'cloth'].includes(key)) expect(geometry.attributes.color.count).toBe(p.count);
            triangles += p.count / 3;
            for (let i = 0; i < p.count; i++) finite &&= [p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)].every(Number.isFinite)
                && Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < 1e-5;
            for (let i = 0; i < p.count; i += 3) {
                a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
                minimumArea = Math.min(minimumArea, b.sub(a).cross(c.sub(a)).length() / 2);
            }
        }
        expect(collision.containsBox(bounds)).toBe(true); expect(bounds.min.y).toBeCloseTo(.1, 5);
        expect(finite).toBe(true); expect(minimumArea).toBeGreaterThan(1e-6);
        expect(triangles).toBeLessThan(kind === 'workbench' ? 2000 : quality === 'low' ? 600 : 900);
    } finally { Object.values(parts).forEach(geometry => geometry.dispose()); }
});

test.each(['high', 'low'])('%s folded standards have a closed cloth shell, visible from both sides', quality => {
    const parts = createDarkCourtStandardGeometry('archive', quality), material = new THREE.MeshBasicMaterial();
    try {
        const p = parts.cloth.attributes.position, edges = new Map();
        const vertex = i => [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e6)).join(',');
        for (let i = 0; i < p.count; i += 3) for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
            const key = [vertex(i + a), vertex(i + b)].sort().join('|'); edges.set(key, (edges.get(key) || 0) + 1);
        }
        expect([...edges.values()].every(count => count === 2)).toBe(true);
        const mesh = new THREE.Mesh(parts.cloth, material);
        for (const side of [-1, 1]) {
            const hit = new THREE.Raycaster(new THREE.Vector3(.3, 4.4, side), new THREE.Vector3(0, 0, -side)).intersectObject(mesh)[0];
            expect(hit).toBeDefined(); expect(hit.face.normal.z * side).toBeGreaterThan(.9);
        }
    } finally { material.dispose(); Object.values(parts).forEach(geometry => geometry.dispose()); }
});

test.each(['high', 'low'])('%s courts add one shared timber batch with scene-owned disposal', quality => {
    const root = createDarkRealmScene(new THREE.Group(), darkRealmFixture(), null, { quality });
    const woods = root.children.filter(mesh => mesh.material?.userData.worldSurfaceDetail === 'timber');
    try {
        expect(woods).toHaveLength(1);
        expect(['map', 'normalMap', 'roughnessMap'].map(key => woods[0].material[key])).toEqual([null, null, null]);
        expect(woods[0].material.transparent).toBe(false);
        expect(root.userData.landmarks.filter(site => site.kind.startsWith('court-'))).toHaveLength(4);
        let disposals = 0; woods[0].material.addEventListener('dispose', () => disposals++);
        RenderSystem.prototype.disposeObjectResources.call({}, root);
        expect(disposals).toBe(1);
    } catch (error) { RenderSystem.prototype.disposeObjectResources.call({}, root); throw error; }
});
