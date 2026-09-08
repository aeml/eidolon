// Procedural materials are shared. Stealth owns temporary copies and restores
// only the meshes it changed, never making input-only geometry visible.
const appearances = new WeakMap();

export function restoreActorStealthAppearance(actor) {
    const entries = appearances.get(actor);
    if (!entries) return;
    for (const [mesh, entry] of entries) {
        if (mesh.material === entry.applied) mesh.material = entry.original;
        for (const material of entry.copies) material.dispose();
    }
    appearances.delete(actor);
}

export function applyActorStealthAppearance(actor) {
    if (!actor.mesh) return;
    let entries = appearances.get(actor);
    if (!entries) appearances.set(actor, entries = new Map());
    const present = new Set();
    actor.mesh.traverse(mesh => {
        if (!mesh.isMesh || !mesh.material || mesh.name === 'ActorInteractionHitbox') return;
        present.add(mesh);
        const prior = entries.get(mesh);
        if (prior?.applied === mesh.material) return;
        if (prior) for (const material of prior.copies) material.dispose();
        const original = mesh.material;
        const copies = [];
        const fade = material => {
            if (material.opacity === 0 || !material.visible) return material;
            const copy = material.clone();
            copy.transparent = true;
            copy.opacity = material.opacity * .3;
            copies.push(copy);
            return copy;
        };
        const applied = Array.isArray(original) ? original.map(fade) : fade(original);
        mesh.material = applied;
        entries.set(mesh, { original, applied, copies });
    });
    // Retire detached equipment, including meshes returned to a model pool.
    for (const [mesh, entry] of entries) {
        if (present.has(mesh)) continue;
        if (mesh.material === entry.applied) mesh.material = entry.original;
        for (const material of entry.copies) material.dispose();
        entries.delete(mesh);
    }
}
