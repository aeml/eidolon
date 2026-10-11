import { Object3D } from 'three';

// Opt-in root-boundary measurement, never a runtime transform replacement.
// Categories are fixed source roles; no entity IDs, names or arguments leave
// the page. Nested owner times overlap and must not be added together.
export function observePartyMatrixOwners(scene, groups, foliage, entities, now) {
    const supplied = new Set(['Fighter', 'Rogue', 'Wizard', 'Cleric']);
    const roles = new Map([[scene, 'scene']]);
    for (const [role, root] of groups) if (root && !roles.has(root)) roles.set(root, role);
    for (const root of foliage) if (root && !roles.has(root)) roles.set(root, 'foliage');
    for (const root of entities) if (root && !roles.has(root)) {
        const actorClass = root.userData.authoredClass;
        roles.set(root, supplied.has(actorClass) ? `supplied-${actorClass}` : 'other-entity');
    }
    const entries = [], skipped = [];
    for (const [root, role] of roles) {
        if (root.updateMatrixWorld !== Object3D.prototype.updateMatrixWorld) { skipped.push(role); continue; }
        const descriptor = Object.getOwnPropertyDescriptor(root, 'updateMatrixWorld');
        const original = root.updateMatrixWorld;
        const row = { role, nodes: 0, meshes: 0, calls: 0, totalMs: 0, maxMs: 0 };
        root.traverse(node => { row.nodes++; if (node.isMesh) row.meshes++; });
        const wrapper = function (...args) {
            const start = now();
            try { return original.apply(this, args); }
            finally {
                const elapsed = Math.max(0, now() - start);
                row.calls++; row.totalMs += elapsed; row.maxMs = Math.max(row.maxMs, elapsed);
            }
        };
        root.updateMatrixWorld = wrapper;
        entries.push({ root, descriptor, wrapper, row });
    }
    let restored = false;
    return {
        read: () => ({ owners: entries.map(entry => ({ ...entry.row })).sort((a, b) => b.totalMs - a.totalMs), skipped: [...skipped] }),
        restore: () => {
            if (restored) return true;
            let owned = true;
            for (const { root, descriptor, wrapper } of entries) {
                if (root.updateMatrixWorld !== wrapper) { owned = false; continue; }
                if (descriptor) Object.defineProperty(root, 'updateMatrixWorld', descriptor);
                else delete root.updateMatrixWorld;
            }
            restored = true;
            return owned;
        }
    };
}

export async function measurePartyMatrixOwners(page) {
    return page.evaluate(async () => {
        const { observePartyMatrixOwners } = await import('/tests/e2e/party-matrix-observation.js');
        const game = window.game, render = game.renderSystem;
        const observation = observePartyMatrixOwners(render.scene, [
            ['environment-group', render.environmentGroup],
            ['static-environment-group', render.staticEnvironmentGroup],
            ['instance-environment-group', render.instanceEnvironmentGroup],
            ['entity-group', render.entityGroup]
        ], render.foliageShadowInfluence?.roots || [], render.entityGroup.children, performance.now.bind(performance));
        let report, restored;
        try {
            for (let frame = 0; frame < 90; frame++) await new Promise(resolve => requestAnimationFrame(resolve));
            report = observation.read();
        } finally {
            restored = observation.restore();
        }
        if (!restored) throw Error('Matrix diagnostic could not restore its owned wrappers');
        return { frames: 90, ...report, restored: true,
            scope: 'Inclusive elapsed time at stock updateMatrixWorld owner boundaries over90real RAF callbacks. Nested rows overlap, wrappers/profiling/shared-host scheduling add overhead; not exclusive CPU or an uninstrumented frame budget. No transform/visibility/material policy changed.' };
    });
}
