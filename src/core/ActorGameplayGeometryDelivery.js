// Staged delivery; callers explicitly own tracking, the worker and controller.
// Never transfer a live Three buffer or keep source copies queued on the UI thread.
function copyAttribute(attribute) {
    const array = new Float32Array(attribute.count * attribute.itemSize);
    for (let i = 0; i < array.length; i++) array[i] = attribute.getComponent(Math.floor(i / attribute.itemSize), i % attribute.itemSize);
    return { itemSize: attribute.itemSize, array };
}

export function copyGameplayGeometry(generation, maxBytes) {
    const geometry = generation.source;
    const attributes = Object.values(geometry.attributes);
    const morphs = Object.values(geometry.morphAttributes).flat();
    const bytes = geometry.index.count * 4 + [...attributes, ...morphs].reduce((sum, attr) => sum + attr.count * attr.itemSize * 4, 0);
    if (bytes > maxBytes) return null;
    const body = /_Body$/.test(generation.mesh.name);
    if (body && (Object.keys(generation.mesh.morphTargetDictionary || {}).sort().join(',') !== 'Blink_L,Blink_R' ||
        Object.keys(geometry.morphAttributes).sort().join(',') !== 'normal,position' ||
        geometry.morphAttributes.position.length !== 2 || geometry.morphAttributes.normal.length !== 2)) return null;
    if (!body && morphs.length) return null;
    const source = { attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([name, attr]) => [name, copyAttribute(attr)])),
        index: new Uint32Array(geometry.index.array), morphTargetsRelative: geometry.morphTargetsRelative };
    if (body) source.morphTargets = geometry.morphAttributes.position.map((attr, index) => ({
        position: copyAttribute(attr), normal: copyAttribute(geometry.morphAttributes.normal[index]) }));
    const transfers = [source.index.buffer, ...Object.values(source.attributes).map(attr => attr.array.buffer),
        ...(source.morphTargets || []).flatMap(target => Object.values(target).map(attr => attr.array.buffer))];
    return { kind: body ? 'body' : 'color', source, bytes, transfers };
}

export class ActorGameplayGeometryDelivery {
    constructor(pass, { workerFactory = () => new Worker(new URL('./ActorGameplayGeometryWorker.bundle.js', import.meta.url), { type: 'module' }),
        maxSourceBytes = 16 * 1024 * 1024, maxJobs = 2048, timeoutMs = 30_000 } = {}) {
        if (!Number.isSafeInteger(maxSourceBytes) || maxSourceBytes < 1 || !Number.isSafeInteger(maxJobs) || maxJobs < 1 ||
            !Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Bounded delivery limits required');
        this.pass = pass; this.maxSourceBytes = maxSourceBytes; this.maxJobs = maxJobs; this.timeoutMs = timeoutMs;
        this.disposedSources = new WeakSet(); this.roots = new Map(); this.jobs = new Map(); this.queue = []; this.id = 0; this.disposed = false;
        this.stats = { requested: 0, installed: 0, stale: 0, fallback: 0, failed: 0, cacheHits: 0, rejected: 0, maxCopiedBytes: 0 };
        this.retired = (entry, reason) => {
            if (reason === 'source-disposed') { this.disposedSources.add(entry.source); this.cancel(entry.mesh); return; }
            if (reason === 'generation-changed' && this.roots.has(entry.root)) this.request(entry.mesh);
        };
        pass.retireListeners.add(this.retired);
        try {
            this.worker = workerFactory();
            this.message = event => this.complete(event.data);
            this.error = () => this.fail();
            this.worker.addEventListener('message', this.message);
            this.worker.addEventListener('error', this.error);
            this.worker.addEventListener('messageerror', this.error);
        } catch { this.fail(); }
    }

    track(root) {
        if (this.disposed || !root?.isObject3D || this.roots.has(root)) return;
        const refresh = () => this.refresh(root), removed = () => this.release(root);
        this.roots.set(root, { refresh, removed });
        root.addEventListener('equipmentvisualschanged', refresh);
        root.addEventListener('appearancechanged', refresh);
        root.addEventListener('added', refresh); root.addEventListener('removed', removed);
        this.refresh(root);
    }

    refresh(root) {
        if (this.disposed || !this.roots.has(root)) return;
        // An equip operation can remove old meshes entirely. Retire their
        // derivatives here, including while the main render is paused.
        for (const entry of this.pass.entries.values()) if (entry.root === root && !this.pass.valid(entry)) this.pass.unregister(entry.mesh);
        for (const [mesh, job] of this.jobs) if (job.generation.root === root && !this.pass.current(job.generation)) this.cancel(mesh);
        root.traverse(mesh => { if (mesh.isSkinnedMesh && mesh.visible) this.request(mesh); });
    }

    request(mesh) {
        if (this.disposed || this.failed || this.pass.disposed) return;
        const pending = this.jobs.get(mesh), installed = this.pass.entries.get(mesh);
        if (pending && this.pass.current(pending.generation) || installed && this.pass.valid(installed)) return;
        this.cancel(mesh);
        if (installed) this.pass.unregister(mesh);
        const generation = this.pass.capture(mesh);
        if (!generation || this.disposedSources.has(generation.source) || !this.roots.has(generation.root)) return;
        if (this.jobs.size >= this.maxJobs) { this.stats.rejected++; return; }
        const job = { id: ++this.id, generation };
        job.onDispose = () => { this.disposedSources.add(generation.source); this.cancel(mesh); };
        generation.source.addEventListener('dispose', job.onDispose);
        this.jobs.set(mesh, job); this.queue.push(job); this.stats.requested++; this.schedule();
    }

    cancel(mesh) {
        const job = this.jobs.get(mesh);
        if (!job) return;
        this.jobs.delete(mesh); job.generation.source.removeEventListener('dispose', job.onDispose);
        this.queue = this.queue.filter(queued => queued !== job);
    }

    release(root) {
        for (const [mesh, job] of this.jobs) if (job.generation.root === root) this.cancel(mesh);
        for (const entry of this.pass.entries.values()) if (entry.root === root) this.pass.unregister(entry.mesh);
    }

    untrack(root) {
        const listeners = this.roots.get(root);
        if (!listeners) return;
        this.roots.delete(root); this.release(root);
        root.removeEventListener('equipmentvisualschanged', listeners.refresh);
        root.removeEventListener('appearancechanged', listeners.refresh);
        root.removeEventListener('added', listeners.refresh); root.removeEventListener('removed', listeners.removed);
    }

    schedule() {
        if (!this.scheduled && !this.active && !this.failed && !this.disposed) this.scheduled = setTimeout(() => {
            this.scheduled = null; this.pump();
        }, 0);
    }

    pump() {
        if (this.disposed || this.failed || this.active) return;
        let job;
        while ((job = this.queue.shift())) {
            const { mesh } = job.generation;
            if (this.jobs.get(mesh) !== job) continue;
            if (!this.pass.current(job.generation) || !this.pass.capture(mesh)) { this.cancel(mesh); this.stats.stale++; this.request(mesh); continue; }
            try {
                const payload = copyGameplayGeometry(job.generation, this.maxSourceBytes);
                if (!payload) { this.cancel(mesh); this.stats.fallback++; continue; }
                this.active = job; this.stats.maxCopiedBytes = Math.max(this.stats.maxCopiedBytes, payload.bytes);
                this.timer = setTimeout(() => this.fail(), this.timeoutMs);
                this.worker.postMessage({ id: job.id, kind: payload.kind, source: payload.source }, payload.transfers);
                return;
            } catch { this.fail(); return; }
        }
    }

    complete(result) {
        const job = this.active;
        if (this.disposed || !job || result?.id !== job.id) return;
        clearTimeout(this.timer); this.active = null;
        this.stats.workerCacheBytes = result.cacheBytes || 0; this.stats.workerCacheEntries = result.cacheEntries || 0;
        const { mesh, source } = job.generation;
        const pending = this.jobs.get(mesh) === job;
        if (pending) this.cancel(mesh);
        if (!pending || !this.pass.current(job.generation) || !this.pass.capture(mesh)) {
            this.stats.stale++;
            if (pending) this.request(mesh);
        } else if (result.error) this.stats.failed++;
        else if (!(result.indices instanceof Uint32Array) || result.indices.length >= source.index.count) this.stats.fallback++;
        else {
            try {
                if (this.pass.register(mesh, result.indices)) {
                    this.stats.installed++; this.stats.cacheHits += result.cacheHit ? 1 : 0;
                } else this.stats.fallback++;
            } catch { this.stats.failed++; }
        }
        this.schedule();
    }

    fail() {
        if (this.failed || this.disposed) return;
        this.failed = true; this.stats.failed++;
        clearTimeout(this.timer); clearTimeout(this.scheduled); this.scheduled = null;
        this.worker?.terminate(); this.active = null;
        for (const mesh of this.jobs.keys()) this.cancel(mesh);
        this.queue.length = 0;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true; this.pass.retireListeners.delete(this.retired);
        clearTimeout(this.timer); clearTimeout(this.scheduled);
        for (const root of this.roots.keys()) this.untrack(root);
        this.worker?.removeEventListener('message', this.message);
        this.worker?.removeEventListener('error', this.error);
        this.worker?.removeEventListener('messageerror', this.error);
        this.worker?.terminate(); this.active = null;
        for (const mesh of this.jobs.keys()) this.cancel(mesh);
        this.queue.length = 0;
    }
}
