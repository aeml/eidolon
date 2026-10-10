import { GeometryFrameComparison, geometryStorageBytes } from './e2e/geometry-frame-comparison.js';
import { BufferGeometry, Float32BufferAttribute, InterleavedBuffer, InterleavedBufferAttribute } from 'three';

function fixture() {
    const source = () => {}, owner = () => {};
    const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0], 3));
    const pass = { wrapper: owner, original: source, enabled: false, active: [],
        entries: new Map([[1, { source: geometry, candidate: geometry, mesh: { geometry } }]]) };
    const renderer = { render: owner }, delivery = { stats: { workerCacheBytes: 10, workerCacheEntries: 1, requested: 1 }, jobs: new Map() };
    return { source, owner, pass, renderer, delivery, geometry };
}
test('real-frame selection bypasses only its controller and restores the original policy', () => {
    const f = fixture(), comparison = new GeometryFrameComparison(f.renderer, f.pass, f.delivery);
    comparison.select(false); expect(f.renderer.render).toBe(f.source);
    expect(comparison.read()).toMatchObject({ registered: 1, candidateStorageBytes: 12, pending: 0, activeJob: false, restored: true });
    comparison.select(true); expect(f.renderer.render).toBe(f.owner);
    expect(comparison.restore()).toBe(true); expect(f.pass.enabled).toBe(false); f.geometry.dispose();
});
test('external ownership and in-progress geometry are never overwritten', () => {
    const f = fixture(), comparison = new GeometryFrameComparison(f.renderer, f.pass, f.delivery);
    f.pass.active.push({}); expect(() => comparison.select(false)).toThrow('between frames'); f.pass.active.length = 0;
    const external = () => {}; f.renderer.render = external;
    expect(() => comparison.select(false)).toThrow('ownership changed'); expect(comparison.restore()).toBe(false);
    expect(f.renderer.render).toBe(external); f.geometry.dispose();
});
test('storage counts shared interleaved buffers once and includes morph and index storage', () => {
    const geometry = new BufferGeometry(), data = new InterleavedBuffer(new Float32Array(12), 6);
    geometry.setAttribute('position', new InterleavedBufferAttribute(data, 3, 0));
    geometry.setAttribute('normal', new InterleavedBufferAttribute(data, 3, 3)); geometry.setIndex([0, 1, 0]);
    geometry.morphAttributes.position = [new Float32BufferAttribute(new Float32Array(6), 3)];
    expect(geometryStorageBytes([geometry, geometry])).toBe(48 + 6 + 24); geometry.dispose();
});
