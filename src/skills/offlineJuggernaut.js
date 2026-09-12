import { Actor } from '../entities/Actor.js';
import { applyOfflineAbilityHit } from '../core/AbilityCritical.js';
import { getAbilityAoeRadius } from './abilityRadii.js';
import { getFighterAbilityDamage } from './fighterAbilityDamage.js';
import { getFighterEffectDuration } from './fighterEffectDuration.js';
import { clipDungeonEffectSegment } from './dungeonEffectGeometry.js';

// Paid offline shockwave only. Keep server-compatible planar body/wall/hostile
// admission; authoritative multiplayer damage is never predicted here.
export function applyOfflineJuggernaut(source, engine, isFriendlyActor) {
    if (source.isRemote || source.isMultiplayer || engine.isMultiplayer || source.gameEngine?.isMultiplayer) return;
    const skill = 'Juggernaut Charge', radius = getAbilityAoeRadius('Fighter', skill, source);
    const damage = getFighterAbilityDamage(source, skill, Math.floor(source.stats.damage + source.stats.strength));
    const duration = getFighterEffectDuration(source, 5);
    const rects = engine.currentInstanceId && engine.currentInstanceType !== 'overworld' ? engine.currentDungeonLayout?.walkRects : null;
    for (const target of new Set(engine.chunkManager.getActiveEntities())) {
        if (target === source || !(target instanceof Actor) || !target.isActive || target.state === 'DEAD' ||
            !(target.stats?.hp > 0) || target.isRemote || target.isMultiplayer ||
            target.instanceId && target.instanceId !== (source.instanceId || engine.currentInstanceId)) continue;
        if (!(engine.isHostileActorTarget?.(target) ?? !isFriendlyActor(target, engine))) continue;
        const body = Number.isFinite(target.radius) ? Math.max(0, target.radius) : 0;
        if (Math.hypot(target.position.x-source.position.x, target.position.z-source.position.z) > radius+body ||
            clipDungeonEffectSegment(rects, source.position, target.position).blocked) continue;
        applyOfflineAbilityHit(source, target, damage, skill, engine.floatingTextManager, '#ffff00');
        if (!target.ccImmune) {
            target.slowTimer = duration; target.slowFactor = .6;
            engine.floatingTextManager?.spawn('Slowed!', target.position, '#00ffff');
        }
    }
}
