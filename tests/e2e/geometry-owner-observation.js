// Browser-side observation only. Never changes owner/worker policy or source
// geometry; wait for actual asynchronous preparation before counting resources.
export async function waitForGeometryOwner(render) {
    const owner = render.actorGameplayGeometry;
    if (!owner) throw Error('Default geometry owner missing');
    const deadline = performance.now() + 90_000;
    while (owner.delivery.active || owner.delivery.jobs.size || owner.delivery.queue.length) {
        if (owner.delivery.failed || owner.delivery.stats.failed) throw Error('Default geometry preparation failed');
        if (performance.now() > deadline) throw Error('Default geometry preparation timeout');
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    if (owner.delivery.failed || owner.delivery.stats.failed) throw Error('Default geometry worker failed');
    return { roots: owner.delivery.roots.size, entries: owner.pass.entries.size,
        workerStarted: Boolean(owner.delivery.worker), cacheHits: owner.delivery.stats.cacheHits,
        workerCacheBytes: owner.delivery.stats.workerCacheBytes || 0,
        workerCacheEntries: owner.delivery.stats.workerCacheEntries || 0,
        valid: [...owner.pass.entries.values()].every(entry => owner.pass.valid(entry)),
        restored: !owner.pass.active.length && [...owner.pass.entries.values()].every(entry => entry.mesh.geometry === entry.source) };
}
