import { Actor } from '../entities/Actor.js';
import { getAbilityAoeRadius } from './abilityRadii.js';
import { getRogueEffectDuration } from './rogueEffectDuration.js';
import { clipDungeonEffectSegment } from './dungeonEffectGeometry.js';

export function applyOfflineSmokeBomb(source, engine) {
    if (source.isRemote || source.isMultiplayer || engine.isMultiplayer || source.gameEngine?.isMultiplayer) return;
    const radius = getAbilityAoeRadius('Rogue', 'Smoke Bomb', source);
    const duration = getRogueEffectDuration(source, 5);
    const rects = engine.currentInstanceId && engine.currentInstanceType !== 'overworld'
        ? engine.currentDungeonLayout?.walkRects : null;
    for (const target of new Set(engine.chunkManager.getActiveEntities())) {
        if (!(target instanceof Actor) || target === source || !target.isActive || target.state === 'DEAD' ||
            !(target.stats?.hp > 0) || target.isRemote || target.isMultiplayer ||
            target.instanceId && target.instanceId !== (source.instanceId || engine.currentInstanceId)) continue;
        const hostile = engine.isHostileActorTarget?.(target) ??
            (!target.isInvulnerable && !['Wizard', 'Cleric', 'Fighter', 'Rogue', 'AvengingSeraph'].includes(target.constructor.name));
        if (!hostile) continue;
        const body = Number.isFinite(target.radius) ? Math.max(0, target.radius) : 0;
        if (Math.hypot(target.position.x - source.position.x, target.position.z - source.position.z) > radius + body ||
            clipDungeonEffectSegment(rects, source.position, target.position).blocked) continue;
        if (!target.ccImmune) {
            target.slowTimer = duration;
            target.slowFactor = .5;
        }
        target.accuracyReductionTimer = duration;
        target.accuracyReductionFactor = .3;
        engine.floatingTextManager?.spawn('BLIND!', target.position, '#aaaaaa');
    }
}
