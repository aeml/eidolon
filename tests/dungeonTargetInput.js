import { acquirePartyAllyPointer } from './partyDungeonControls.js';

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
