// The early world warmup runs before joining. Prepare the actual saved player
// appearance after its authoritative state and fitted equipment have arrived.
// Optional scenery, remote actors and geometry-worker jobs remain deferred.
export function prepareConnectedPlayerView(engine, { timeoutMs = 30_000 } = {}) {
    if (engine?.isDestroyed) return Promise.resolve(false);
    if (!engine?.isMultiplayer || !engine.renderSystem?.prepareInitialView) return Promise.resolve(true);
    if (engine._connectedViewPreparation) return engine._connectedViewPreparation.promise;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('A bounded character-view timeout is required');
    const player = engine.player, render = engine.renderSystem;
    const task = { request: null, timer: null, done: false, warming: false, observed: null };
    task.promise = new Promise((resolve, reject) => {
        task.finish = (ready, error) => {
            if (task.done) return;
            task.done = true;
            if (task.request !== null) cancelAnimationFrame(task.request);
            if (task.timer !== null) clearTimeout(task.timer);
            if (engine._connectedViewPreparation === task) engine._connectedViewPreparation = null;
            if (error) reject(error); else resolve(ready);
        };
    });
    task.cancel = () => task.finish(false);
    engine._connectedViewPreparation = task;
    const alive = () => Boolean(player) && !engine.isDestroyed && engine.player === player && player.isActive !== false &&
        engine.renderSystem === render && !render._disposed;
    const attached = root => {
        for (let node = root; node; node = node.parent) if (node === render.scene) return true;
        return false;
    };
    const schedule = () => {
        if (!task.done && !task.warming && task.request === null) task.request = requestAnimationFrame(check);
    };
    const current = observed => alive() && !player.isMeshLoading && task.observed === observed && player.mesh === observed.root &&
        player.mesh.userData.equipmentReady === observed.equipment && attached(observed.root);
    function check() {
        task.request = null;
        if (task.done) return;
        if (!alive()) { task.finish(false); return; }
        const root = player.mesh;
        if (!engine._initialPlayerStateReceived || !root || player.isMeshLoading || !attached(root)) { schedule(); return; }
        const equipment = root.userData.equipmentReady;
        if (!task.observed || task.observed.root !== root || task.observed.equipment !== equipment) {
            const observed = task.observed = { root, equipment, ready: !equipment?.then, failed: false, error: null };
            if (!observed.ready) Promise.resolve(equipment).then(() => {
                if (!task.done) { observed.ready = true; schedule(); }
            }, error => {
                if (!task.done) { observed.failed = true; observed.error = error; schedule(); }
            });
        }
        const observed = task.observed;
        if (observed.failed) { task.finish(false, observed.error || new Error('Your character equipment could not finish loading.')); return; }
        if (!observed.ready) { schedule(); return; }
        task.warming = true;
        const shouldContinue = () => !task.done && current(observed);
        try {
            Promise.resolve(render.prepareInitialView({ shouldContinue })).then(ready => {
                if (task.done) return;
                task.warming = false;
                if (!alive()) task.finish(false);
                else if (ready && current(observed)) task.finish(true);
                else schedule();
            }, error => task.finish(false, error));
        } catch (error) { task.finish(false, error); }
    }
    task.timer = setTimeout(() => task.finish(false,
        new Error('Your character view did not finish loading. Please try again.')), timeoutMs);
    check();
    return task.promise;
}

export function cancelConnectedPlayerView(engine) {
    engine?._connectedViewPreparation?.cancel();
}
