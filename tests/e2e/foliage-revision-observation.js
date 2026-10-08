// Serialized into the existing page only for the opt-in, post-timing probe.
// Counts real controller calls/revisions; never changes culling decisions.
export function installFoliageRevisionObservation() {
    if (window.__terrainFoliageDiagnostic) throw new Error('Foliage diagnostic is already installed');
    const controller = window.game.renderSystem.foliageShadowInfluence;
    const originalBegin = controller.beginFrame, originalVisit = controller.visit;
    const counters = { frames: 0, visits: 0, viewChanges: 0, shadowChanges: 0,
        initialRoots: controller.roots.size };
    const begin = function (...args) {
        const view = this.viewRevision, shadow = this.shadowRevision;
        const result = originalBegin.apply(this, args);
        counters.frames++;
        if (view !== this.viewRevision) counters.viewChanges++;
        if (shadow !== this.shadowRevision) counters.shadowChanges++;
        return result;
    };
    const visit = object => { counters.visits++; return originalVisit(object); };
    controller.beginFrame = begin; controller.visit = visit;
    window.__terrainFoliageDiagnostic = {
        counters,
        restore() {
            if (controller.beginFrame === begin) controller.beginFrame = originalBegin;
            if (controller.visit === visit) controller.visit = originalVisit;
            return controller.beginFrame === originalBegin && controller.visit === originalVisit;
        }
    };
}

export function readFoliageRevisionObservation() {
    return { ...window.__terrainFoliageDiagnostic.counters };
}

export function restoreFoliageRevisionObservation() {
    const probe = window.__terrainFoliageDiagnostic;
    const restored = !probe || probe.restore();
    delete window.__terrainFoliageDiagnostic;
    return restored;
}
