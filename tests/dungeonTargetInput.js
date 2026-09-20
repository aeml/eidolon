import { acquirePartyAllyPointer } from './partyDungeonControls.js';

// Serialized into the browser in place of the existing hover read: no extra
// polling or forced raycast. Keep only the latest failed acquisition's sample
// so a later ground sidestep cannot erase the evidence of what prevented aim.
export function readDungeonTargetPointerInPage(id) {
    const g = window.game, hovered = g.hoveredEntity?.id;
    if (g && window.__partyClearEvidence && hovered !== id) {
        const actor = g.remotePlayers.get(id), mesh = actor?.mesh;
        const proxy = g.getRaycastMeshForEntity(actor);
        const vector = value => value ? { x: value.x, y: value.y, z: value.z } : null;
        window.__partyClearEvidence.lastMissedTargetProbe = {
            id, at: performance.now(), hovered: hovered || null,
            hits: (g.raycastHitEntities || []).map(entity => entity.id),
            pointer: vector(g.inputManager.mouse), overCanvas: g.inputManager.pointerOverCanvas,
            needsRaycast: g.needsRaycast, frame: g.frameCount,
            ray: { origin: vector(g.inputManager.raycaster.ray.origin), direction: vector(g.inputManager.raycaster.ray.direction) },
            logicalPosition: vector(actor?.position), meshPosition: vector(mesh?.position),
            meshAttached: Boolean(mesh?.parent), meshVisible: mesh?.visible ?? null,
            proxyOwner: proxy?.userData?.entityId || null,
            proxyWorld: proxy?.matrixWorld?.elements?.slice() || null,
            proxyBounds: proxy?.geometry?.boundingBox ? {
                min: vector(proxy.geometry.boundingBox.min), max: vector(proxy.geometry.boundingBox.max)
            } : null
        };
    }
    return hovered;
}

// Aim only through ordinary pointer movement. Party bodies can obscure the
// boss's center; return the acquired hitbox point, never the covered center.
export async function aimDungeonCombatTarget(input, targetId, requireHover = false) {
    if (!requireHover) {
        const point = await input.project(targetId);
        if (!point?.visible) return null;
        await input.move(point.x, point.y);
        await input.settle();
        return point;
    }
    let aimedPoint = null;
    const acquired = await acquirePartyAllyPointer({ ...input,
        project: async (id, hitboxPoint) => {
            aimedPoint = await input.project(id, hitboxPoint);
            return aimedPoint;
        }
    }, targetId);
    return acquired ? aimedPoint : null;
}
