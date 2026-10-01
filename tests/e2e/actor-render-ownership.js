// Authored skins use their own skeleton path, never the rigid procedural
// instancer. Check positive scene/skin ownership, not arbitrary absent batches.
export function actorRenderingIsOwned(render, root) {
    if (!root || root.parent !== render.entityGroup) return false;
    const actorClass = root.userData.authoredClass;
    if (!['Fighter', 'Rogue', 'Wizard', 'Cleric'].includes(actorClass)) return render.actorInstances.roots.has(root);
    if (root.userData.proceduralHumanoid || render.actorInstances.roots.has(root)) return false;
    const body = root.getObjectByName(`${actorClass}_Body`);
    return Boolean(body?.isSkinnedMesh && body.visible && body.geometry.attributes.skinIndex &&
        body.geometry.attributes.skinWeight && body.skeleton.bones.length === 53 && root.visible);
}
