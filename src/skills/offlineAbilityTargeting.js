import { Actor } from '../entities/Actor.js';
import { clipDungeonEffectSegment } from './dungeonEffectGeometry.js';

// Offline target selection only. Online casts always use server validation.
// Cast reach is measured from the caster, independently of cursor pick radius.
export function findOfflineAbilityTarget(caster, engine, aim, { range, cursorRadius, padCursor = false }) {
    const rects = engine.currentInstanceId && engine.currentInstanceType !== 'overworld'
        ? engine.currentDungeonLayout?.walkRects : null;
    let nearest = cursorRadius;
    let selected = null;
    for (const entity of engine.chunkManager.getActiveEntities()) {
        if (!(entity instanceof Actor) || entity === caster || !entity.isActive || entity.state === 'DEAD') continue;
        const hostile = typeof engine.isHostileActorTarget === 'function'
            ? engine.isHostileActorTarget(entity)
            : !entity.isInvulnerable && !['Wizard', 'Cleric', 'Fighter', 'Rogue', 'AvengingSeraph'].includes(entity.constructor.name);
        if (!hostile) continue;
        const radius = entity.radius || 0;
        if (Math.hypot(entity.position.x - caster.position.x, entity.position.z - caster.position.z) > range + radius) continue;
        if (clipDungeonEffectSegment(rects, caster.position, entity.position).blocked) continue;
        const distance = Math.hypot(entity.position.x - aim.x, entity.position.z - aim.z);
        if (distance < nearest + (padCursor ? radius : 0)) {
            nearest = distance;
            selected = entity;
        }
    }
    return selected;
}
