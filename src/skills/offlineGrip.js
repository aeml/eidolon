import { Actor } from '../entities/Actor.js';
import { getAbilityRange } from '../core/AbilityRange.js';
import { clipDungeonEffectSegment } from './dungeonEffectGeometry.js';
import { getFighterEffectDuration } from './fighterEffectDuration.js';

// Resolve before spending resources. Grip is a single-target planar pull;
// area talents do not expand its range or its body-padded cursor tolerance.
export function findOfflineGripTarget(source, aim, engine, isFriendlyActor) {
    if (source.isRemote || source.isMultiplayer || engine.isMultiplayer || source.gameEngine?.isMultiplayer ||
        ![aim?.x, aim?.z].every(Number.isFinite)) return null;
    const range = getAbilityRange(source, 'Unbreakable Grip', 10);
    const rects = engine.currentInstanceId && engine.currentInstanceType !== 'overworld' ? engine.currentDungeonLayout?.walkRects : null;
    let best = null, bestDistance = Infinity;
    for (const target of new Set(engine.chunkManager.getActiveEntities())) {
        if (target === source || !(target instanceof Actor) || !target.isActive || target.state === 'DEAD' ||
            !(target.stats?.hp > 0) || target.isRemote || target.isMultiplayer ||
            target.instanceId && target.instanceId !== (source.instanceId || engine.currentInstanceId)) continue;
        if (!(engine.isHostileActorTarget?.(target) ?? !isFriendlyActor(target, engine))) continue;
        const body = Number.isFinite(target.radius) ? Math.max(0, target.radius) : 0;
        const distance = Math.hypot(target.position.x-aim.x, target.position.z-aim.z);
        if (distance >= 3+body || distance >= bestDistance ||
            Math.hypot(target.position.x-source.position.x, target.position.z-source.position.z) > range+body ||
            clipDungeonEffectSegment(rects, source.position, target.position).blocked) continue;
        best = target; bestDistance = distance;
    }
    return best;
}

export function applyOfflineGrip(source, target, engine) {
    if (!target || source.isRemote || source.isMultiplayer || engine.isMultiplayer || source.gameEngine?.isMultiplayer || target.ccImmune) return;
    if (!target.ironFortressImmovable) {
        const dx = target.position.x-source.position.x, dz = target.position.z-source.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance > 2) {
            target.position.x = source.position.x + dx*2/distance;
            target.position.z = source.position.z + dz*2/distance;
        }
        engine.floatingTextManager?.spawn('Pulled!', target.position, '#ffffff');
        source.spawnVisualEffect(engine, target.position, 0xffffff, 'impact');
    }
    target.rootTimer = getFighterEffectDuration(source, 1, 'Unbreakable Grip');
}
