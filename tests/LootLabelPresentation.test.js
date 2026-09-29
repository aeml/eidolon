import * as THREE from 'three';
import { arrangeLootLabels, LootLabelPresentation } from '../src/core/LootLabelPresentation.js';
import { LootDrop } from '../src/entities/LootDrop.js';

const options = { width: 390, height: 844, rowHeight: 32, limit: 12 };
const item = (id, changes = {}) => ({ id, x: 195, y: 422, width: 160, selected: false, distance: 2, ...changes });

test('a pile fans into separate stable rows with room for the player', () => {
    const items = ['d', 'c', 'b', 'a'].map(id => item(id));
    const exclusion = { left: 170, right: 220, top: 380, bottom: 465 };
    const layout = arrangeLootLabels(items, { ...options, exclusions: [exclusion] });
    expect(layout).toHaveLength(4);
    expect(layout).toEqual(arrangeLootLabels([...items].reverse(), { ...options, exclusions: [exclusion] }));
    for (const a of layout) {
        expect(a.y + 18 <= exclusion.top || a.y - 18 >= exclusion.bottom).toBe(true);
        for (const b of layout) if (a !== b) expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(36);
    }
    expect(items[0].y).toBe(422);
});

test('crowd bounds prioritize the selected item; labels never leave the view', () => {
    const items = Array.from({ length: 50 }, (_, i) => item(String(i), { selected: i === 49, x: 5, y: 10 }));
    const layout = arrangeLootLabels(items, options);
    expect(layout[0].id).toBe('49');
    expect(layout.length).toBeLessThanOrEqual(12);
    for (const label of layout) {
        expect(label.x - label.width / 2).toBeGreaterThanOrEqual(0);
        expect(label.y - 18).toBeGreaterThanOrEqual(4);
        expect(label.y + 18).toBeLessThanOrEqual(840);
    }
});

test.each([[1280, 900, false, 1], [390, 844, true, .5], [844, 390, true, 2]])(
    'rendered loot remains readable and individually raycastable at %sx%s', (width, height, mobile, zoom) => {
        const camera = new THREE.OrthographicCamera(-15, 15, 15 * height / width, -15 * height / width, .1, 100);
        camera.position.set(0, 15, 15); camera.lookAt(0, 0, 0); camera.zoom = zoom; camera.updateProjectionMatrix();
        const drops = Array.from({ length: 5 }, (_, i) => {
            const drop = new LootDrop({ name: 'Rare Iron Sword', rarity: 'Rare' }, 0, 0, 'loot-' + i);
            drop.label = drop.createTextSprite(drop.itemName, drop.itemColor);
            drop.mesh.add(drop.label); drop.mesh.scale.setScalar(1.2);
            return drop;
        });
        const presentation = new LootLabelPresentation(), original = drops[0].mesh.position.clone();
        const settings = { camera, width, height, mobile };
        presentation.update(drops, settings);
        const positions = drops.map(d => d.label.position.clone());
        presentation.update(drops, { ...settings, target: drops[4] });
        for (const [i, drop] of drops.entries()) {
            expect(drop.label.visible).toBe(true);
            expect(drop.label.position.distanceTo(positions[i])).toBeLessThan(1e-8);
            const scale = drop.label.getWorldScale(new THREE.Vector3());
            expect(scale.y / ((camera.top - camera.bottom) / zoom) * height).toBeCloseTo(mobile ? 32 : 26);
            const point = drop.label.getWorldPosition(new THREE.Vector3()).project(camera);
            const ray = new THREE.Raycaster(); ray.setFromCamera(point, camera);
            expect(ray.intersectObjects(drops.map(d => d.label)).map(hit => hit.object)).toEqual([drop.label]);
            expect(drop.mesh.position).toEqual(original);
            expect(drop.mesh.getObjectByName('LootHitbox').scale.toArray()).toEqual([1, 1, 1]);
        }
        drops[0].isActive = false; drops[1].mesh.position.x = 1000;
        presentation.update(drops, settings);
        expect(drops[0].label.visible).toBe(false); expect(drops[1].label.visible).toBe(false);
        const hidden = drops[0].label.getWorldPosition(new THREE.Vector3()).project(camera);
        const ray = new THREE.Raycaster(); ray.setFromCamera(hidden, camera);
        expect(ray.intersectObject(drops[0].label)).toHaveLength(0);
        drops.forEach(d => d.dispose());
    }
);

test('label materials retain cached textures without bloom/depth writes', () => {
    const drop = new LootDrop({ name: 'Gold Ring' }, 0, 0);
    const tag = drop.createTextSprite('Gold Ring', '#ff8000'); drop.mesh.add(tag);
    expect(tag.material.depthWrite).toBe(false);
    expect(tag.material.toneMapped).toBe(false);
    expect(tag.material.map.colorSpace).toBe(THREE.SRGBColorSpace);
    drop.dispose();
});
