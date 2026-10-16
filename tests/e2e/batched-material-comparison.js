import { profileGameplayScene } from './scene-performance.js';
import { profileProgramFeatures } from './program-feature-observation.js';

export async function compareBatchedMaterialFrames(page) {
    const select = enabled => page.evaluate(async enabled => {
        const owner = window.game.renderSystem.actorInstances?.multiDraw;
        if (!owner?.materialVariantPool) throw new Error('Actual multi-draw owner required');
        if (!window.__batchedMaterialComparison) window.__batchedMaterialComparison = { owner, initial: owner.materialVariants };
        if (window.__batchedMaterialComparison.owner !== owner) throw new Error('Comparison lost multi-draw owner');
        owner.materialVariants = enabled;
        for (let i = 0; i < 60; i++) await new Promise(resolve => requestAnimationFrame(resolve));
    }, enabled);
    const snapshot = () => page.evaluate(() => {
        const owner = window.__batchedMaterialComparison.owner, pool = owner.materialVariantPool;
        return { enabled: owner.materialVariants, active: pool.entries.size, created: pool.created,
            retired: pool.retired, synchronizations: pool.synchronizations, fallbacks: pool.fallbacks };
    });
    const phases = [];
    let restored;
    try {
        for (const enabled of [false, true, true, false]) {
            await select(enabled); const before = await snapshot();
            const profile = await profileGameplayScene(page, enabled ? 'owned-batched-material' : 'borrowed-batched-material');
            // Separate metadata instrumentation, excluded from frame timings.
            const programs = await profileProgramFeatures(page), after = await snapshot();
            phases.push({ enabled, before, after, profile, programs });
        }
    } finally {
        restored = await page.evaluate(async () => {
            const entry = window.__batchedMaterialComparison;
            if (!entry) return false;
            entry.owner.materialVariants = entry.initial;
            for (let i = 0; i < 2; i++) await new Promise(resolve => requestAnimationFrame(resolve));
            const pool = entry.owner.materialVariantPool;
            const result = { policy: entry.owner.materialVariants === entry.initial,
                initial: entry.initial, active: pool.entries.size, created: pool.created, retired: pool.retired };
            delete window.__batchedMaterialComparison; return result;
        });
    }
    return { phases, restored, scope: 'Borrowed/owned/owned/borrowed policy within one current-source four-class scene; ordinary simulation and natural population/draw changes retained. Separate120worldcall metadata probes after180frame samples. No source/texture/geometry writes, visibility policy changes or original performance/device clearance.' };
}

export async function captureBatchedMaterialSubmissions(page) {
    return page.evaluate(() => {
        const game = window.game, system = game.renderSystem, owner = system.actorInstances?.multiDraw;
        if (!owner?.materialVariantPool) throw new Error('Actual multi-draw owner required');
        const initial = owner.materialVariants, identities = new WeakMap();
        let next = 0;
        const identity = object => {
            if (!object) return 0;
            if (!identities.has(object)) identities.set(object, ++next);
            return identities.get(object);
        };
        const state = () => {
            const actors = [];
            for (const actor of game.activeEntitiesCache) {
                const meshes = [];
                actor.mesh?.traverse(node => meshes.push([identity(node), node.visible, identity(node.geometry),
                    node.geometry?.attributes.position?.version, node.geometry?.index?.version, ...node.matrixWorld.elements]));
                actors.push([identity(actor), ...actor.position.toArray(), meshes]);
            }
            return JSON.stringify([system.camera.matrixWorld.elements, system.camera.projectionMatrix.elements, actors]);
        };
        const rows = [];
        let reference, restored;
        try {
            // All four submissions run synchronously in one browser task.
            // No simulation/network update or pose write occurs between them.
            for (const enabled of [false, true, true, false]) {
                owner.materialVariants = enabled; system.render();
                const current = state(); reference ??= current;
                rows.push({ enabled, calls: system.renderer.info.render.calls, triangles: system.renderer.info.render.triangles,
                    actorCount: game.activeEntitiesCache.length, poseAndGeometryStable: current === reference,
                    activeVariants: owner.materialVariantPool.entries.size });
            }
        } finally {
            owner.materialVariants = initial; system.render();
            const pool = owner.materialVariantPool;
            restored = { policy: owner.materialVariants === initial, initial, active: pool.entries.size,
                created: pool.created, retired: pool.retired };
        }
        return { rows, restored,
            scope: 'Four synchronous full-world render submissions at one camera/actor pose, without advancing simulation or writing actors. Internal pose/geometry identities are compared but never emitted. Count diagnostic only; render caches/uniforms update normally. This is not frame timing, performance acceptance or a frozen-world speedup.' };
    });
}
