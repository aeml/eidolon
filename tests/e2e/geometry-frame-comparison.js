import { profileGameplayScene } from './scene-performance.js';

export function geometryStorageBytes(geometries) {
    const buffers = new Set();
    for (const geometry of geometries) {
        for (const attribute of [geometry.index, ...Object.values(geometry.attributes), ...Object.values(geometry.morphAttributes).flat()]) {
            const array = attribute?.isInterleavedBufferAttribute ? attribute.data.array : attribute?.array;
            if (array?.buffer) buffers.add(array.buffer);
        }
    }
    return [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 0);
}

export class GeometryFrameComparison {
    constructor(renderer, pass, delivery) {
        if (renderer.render !== pass.wrapper || pass.disposed || !pass.entries.size || typeof pass.original !== 'function')
            throw Error('Prepared live geometry owner required');
        this.renderer = renderer; this.pass = pass; this.delivery = delivery;
        this.owner = renderer.render; this.source = pass.original; this.enabled = pass.enabled;
    }
    select(candidate) {
        if (this.renderer.render !== this.owner && this.renderer.render !== this.source) throw Error('Render ownership changed');
        if (this.pass.active.length) throw Error('Geometry must be restored between frames');
        this.pass.enabled = true;
        this.renderer.render = candidate ? this.owner : this.source;
    }
    read() {
        const entries = [...this.pass.entries.values()];
        return { registered: entries.length, candidateStorageBytes: geometryStorageBytes(entries.map(entry => entry.candidate)),
            workerCacheBytes: this.delivery.stats.workerCacheBytes, workerCacheEntries: this.delivery.stats.workerCacheEntries,
            requested: this.delivery.stats.requested, pending: this.delivery.jobs.size, activeJob: Boolean(this.delivery.active),
            restored: !this.pass.active.length && entries.every(entry => entry.mesh.geometry === entry.source) };
    }
    restore() {
        if (this.renderer.render !== this.owner && this.renderer.render !== this.source) return false;
        this.renderer.render = this.owner; this.pass.enabled = this.enabled;
        return true;
    }
}

export async function compareGameplayGeometryFrames(page) {
    const initial = await page.evaluate(async () => {
        const { GeometryFrameComparison } = await import('/tests/e2e/geometry-frame-comparison.js');
        const { pass, delivery } = window.__gameplayGeometryLifecycle;
        window.__geometryFrameComparison = new GeometryFrameComparison(window.game.renderSystem.renderer, pass, delivery);
        return window.__geometryFrameComparison.read();
    });
    const phases = []; let restored;
    try {
        for (const candidate of [false, true, true, false]) {
            await page.evaluate(candidate => window.__geometryFrameComparison.select(candidate), candidate);
            const profile = await profileGameplayScene(page, `geometry-real-frame-${candidate ? 'compact' : 'source-bypass'}`);
            const after = await page.evaluate(() => window.__geometryFrameComparison.read());
            phases.push({ candidate, profile, after });
        }
    } finally {
        restored = await page.evaluate(() => {
            const restored = window.__geometryFrameComparison.restore();
            delete window.__geometryFrameComparison; return restored;
        });
    }
    if (!restored) throw Error('Geometry frame comparison lost render ownership');
    return { initial, phases, restored,
        scope: 'Same running game source-controller-bypass/compact/compact/source-controller-bypass ABBA; each60warmup+180real frames. Owned candidates and worker cache remain allocated in both arms. Normal world/network/population evolution retained and recorded. This isolates submission policy more closely, not installation/memory, physical-device or battle acceptance.' };
}
