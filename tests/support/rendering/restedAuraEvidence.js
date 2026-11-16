// Acceptance of read-only native scene observations, not prepared actor state.
const budgets = Object.freeze({ high: { meshes: 5, sparks: 16 }, low: { meshes: 4, sparks: 8 } });

// Self-contained for injection into a real browser; observation only. Check
// ancestor visibility as well as attachment so a hidden group cannot pass.
export function readRestedAura(actor, scene) {
    const aura = actor?.attachedStatusEffects?.get('well_rested');
    let meshes = 0, invalid = 0, batches = 0, sparks = 0, ownerGroups = 0;
    aura?.group.traverse(part => {
        if (!part.isMesh) return;
        if (part.visible) meshes++;
        if (part.visible && part.isInstancedMesh) { batches++; sparks += part.count; }
        if (part.geometry?.type === 'BoxGeometry' || !part.material?.transparent || part.material?.depthWrite) invalid++;
    });
    scene?.traverse(part => {
        if (part.name === `AttachedStatusEffect:well_rested:${actor?.id}`) ownerGroups++;
    });
    let visibleInScene = Boolean(aura), reachedScene = false;
    for (let parent = aura?.group; parent; parent = parent.parent) {
        visibleInScene &&= parent.visible;
        if (parent === scene) reachedScene = true;
    }
    const hitbox = actor?.mesh?.getObjectByName('ActorInteractionHitbox');
    return { bank: actor?.wellRestedSeconds, state: actor?.state,
        attached: Boolean(aura?.group.parent), quality: aura?.quality,
        meshes, invalid, batches, sparks, ownerGroups,
        visibleInScene: Boolean(visibleInScene && reachedScene),
        ownerMatches: Boolean(aura && aura.group.userData.ownerId === actor.id),
        distance: aura && actor.mesh ? aura.group.position.distanceTo(actor.mesh.position) : null,
        hitboxOpacity: hitbox?.material?.opacity ?? null };
}

export function restedAuraMeetsBudget(aura, quality) {
    const budget = budgets[quality];
    return Boolean(budget && aura && Number.isFinite(aura.bank) && aura.bank > 0 &&
        aura.attached && aura.quality === quality && aura.meshes === budget.meshes &&
        aura.batches === 2 && aura.sparks === budget.sparks && aura.ownerGroups === 1 &&
        aura.invalid === 0 && aura.ownerMatches && Number.isFinite(aura.distance) &&
        aura.distance >= 0 && aura.distance < .2);
}
