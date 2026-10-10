import * as THREE from 'three';
import { jest } from '@jest/globals';
import { ActorInstanceMultiDraw } from '../src/art/ActorInstanceMultiDraw.js';

function fixture() {
    const group = new THREE.Group(), material = new THREE.MeshStandardMaterial();
    const sources = [new THREE.BoxGeometry(), new THREE.SphereGeometry(1, 6, 4)].map((geometry, i) => {
        geometry.clearGroups();
        const mesh = new THREE.InstancedMesh(geometry, material, 4); mesh.count = 2; mesh.castShadow = true;
        mesh.matrixWorld.makeTranslation(49984, 0, 19968);
        for (let j = 0; j < 2; j++) mesh.setMatrixAt(j, new THREE.Matrix4().makeTranslation(i + .1234567, j * 2, 3.987654));
        mesh.computeBoundingSphere(); group.add(mesh); return mesh;
    });
    const owner = new ActorInstanceMultiDraw(group), camera = new THREE.PerspectiveCamera();
    const renderer = { extensions: { has: () => true } };
    const begin = () => owner.beginFrame(renderer, camera, sources);
    return { group, sources, material, owner, camera, renderer, begin };
}

test('same-origin source geometry and existing float32 instance rows survive delivery exactly', () => {
    const f = fixture();
    try {
        f.begin(); expect(f.owner.entries.size).toBe(1);
        const { mesh, sourceSlots } = [...f.owner.entries.values()][0];
        expect(mesh.material).toBe(f.material); expect(mesh.matrixWorld.elements).toEqual(f.sources[0].matrixWorld.elements);
        for (const { source, slots } of sourceSlots) for (let i = 0; i < source.count; i++) {
            const original = new THREE.Matrix4(), deliveredMatrix = new THREE.Matrix4();
            mesh.getMatrixAt(slots[i], deliveredMatrix); source.getMatrixAt(i, original);
            expect(deliveredMatrix.elements).toEqual(original.elements);
            const range = mesh.getGeometryRangeAt(mesh._instanceInfo[slots[i]].geometryIndex);
            for (const [name, attr] of Object.entries(source.geometry.attributes)) {
                const delivered = mesh.geometry.attributes[name];
                expect(Array.from(delivered.array.subarray(range.vertexStart * attr.itemSize,
                    (range.vertexStart + range.vertexCount) * attr.itemSize))).toEqual(Array.from(attr.array));
            }
            expect(Array.from(mesh.geometry.index.array.subarray(range.start, range.start + range.count), value => value - range.vertexStart))
                .toEqual(Array.from(source.geometry.index.array));
        }
        expect(f.sources.every(source => !source.visible)).toBe(true);
        f.owner.endFrame(); expect(f.sources.every(source => source.visible)).toBe(true); expect(f.owner.group.visible).toBe(false);
    } finally { f.owner.dispose(); }
});

test.each(['no-extension', 'array-camera', 'different-origin', 'different-material', 'different-shadow', 'different-layer', 'partial-range', 'morph'])('%s keeps original buckets', boundary => {
    const f = fixture();
    try {
        if (boundary === 'no-extension') f.renderer.extensions.has = () => false;
        if (boundary === 'array-camera') f.camera.isArrayCamera = true;
        if (boundary === 'different-origin') f.sources[1].matrixWorld.elements[12] += 64;
        if (boundary === 'different-material') f.sources[1].material = f.material.clone();
        if (boundary === 'different-shadow') f.sources[1].castShadow = false;
        if (boundary === 'different-layer') f.sources[1].layers.set(1);
        if (boundary === 'partial-range') f.sources[1].geometry.setDrawRange(0, 3);
        if (boundary === 'morph') f.sources[1].geometry.morphAttributes.position = [f.sources[1].geometry.attributes.position.clone()];
        f.begin(); expect(f.owner.entries.size).toBe(0); expect(f.sources.every(source => source.visible)).toBe(true);
    } finally { f.owner.dispose(); }
});

test('each pass culls the complete original instance bucket instead of individual primitives', () => {
    const f = fixture();
    try {
        f.sources[0].matrixWorld.identity(); f.sources[1].matrixWorld.makeTranslation(0, 0, 0);
        for (let i = 0; i < 2; i++) {
            f.sources[0].setMatrixAt(i, new THREE.Matrix4().makeTranslation(0, 0, -5));
            f.sources[1].setMatrixAt(i, new THREE.Matrix4().makeTranslation(100, 0, -5));
        }
        f.sources.forEach(source => source.computeBoundingSphere()); f.begin();
        const { mesh, sourceSlots } = [...f.owner.entries.values()][0];
        const list = sourceSlots.flatMap(({ slots, source }) => slots.slice(0, source.count).map(index => ({ index })));
        mesh.customSort(list, f.camera);
        expect(list.map(v => v.index)).toEqual(sourceSlots[0].slots.slice(0, 2));
        const shadowCamera = new THREE.OrthographicCamera(90, 110, 10, -10, .1, 100);
        const shadowList = sourceSlots.flatMap(({ slots, source }) => slots.slice(0, source.count).map(index => ({ index })));
        mesh.customSort(shadowList, shadowCamera);
        expect(shadowList.map(v => v.index)).toEqual(sourceSlots[1].slots.slice(0, 2));
    } finally { f.owner.dispose(); }
});

test('changing buffer versions rebuilds owned copies and retirement releases textures without disposing borrowed assets', () => {
    const f = fixture();
    try {
        f.begin(); const first = [...f.owner.entries.values()][0].mesh;
        const disposed = jest.spyOn(first, 'dispose'), material = jest.spyOn(f.material, 'dispose');
        const originals = f.sources.map(source => jest.spyOn(source.geometry, 'dispose'));
        f.owner.endFrame(); f.sources[0].geometry.attributes.position.needsUpdate = true; f.begin();
        expect(disposed).toHaveBeenCalledTimes(1); expect([...f.owner.entries.values()][0].mesh).not.toBe(first);
        const mesh = [...f.owner.entries.values()][0].mesh;
        const geometry = jest.spyOn(mesh.geometry, 'dispose'), matrices = jest.spyOn(mesh._matricesTexture, 'dispose'), indirect = jest.spyOn(mesh._indirectTexture, 'dispose');
        f.owner.dispose(); f.owner.dispose();
        expect(geometry).toHaveBeenCalledTimes(1); expect(matrices).toHaveBeenCalledTimes(1); expect(indirect).toHaveBeenCalledTimes(1);
        expect(material).not.toHaveBeenCalled(); originals.forEach(spy => expect(spy).not.toHaveBeenCalled());
        expect(f.sources.every(source => source.visible)).toBe(true);
    } finally { f.owner.dispose(); jest.restoreAllMocks(); }
});


test('replacing an attribute without changing its version refreshes the copied geometry', () => {
    const f = fixture();
    try {
        f.begin(); const previous = [...f.owner.entries.values()][0].mesh;
        f.owner.endFrame();
        const attr = f.sources[0].geometry.attributes.position.clone();
        attr.setX(0, attr.getX(0) + .25);
        f.sources[0].geometry.setAttribute('position', attr); f.begin();
        expect([...f.owner.entries.values()][0].mesh).not.toBe(previous);
    } finally { f.owner.dispose(); }
});
