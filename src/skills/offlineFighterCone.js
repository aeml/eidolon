import * as THREE from 'three';
import { Actor } from '../entities/Actor.js';
import { applyOfflineAbilityHit } from '../core/AbilityCritical.js';
import { clipDungeonEffectSegment } from './dungeonEffectGeometry.js';
import { getAbilityAoeArc, getAbilityAoeRadius } from './abilityRadii.js';
import { getFighterAbilityDamage } from './fighterAbilityDamage.js';

// Shared paid-cast geometry: aim, planar body-padded radius, fixed cone angle,
// current scene and authoritative-style wall exclusions. Never predict damage.
export function applyOfflineFighterCone(source, aim, engine, isFriendlyActor, skill, damage, stun = 0) {
    if (source.isRemote || source.isMultiplayer || engine.isMultiplayer || source.gameEngine?.isMultiplayer) return 0;
    const radius = getAbilityAoeRadius('Fighter', skill, source), arc = getAbilityAoeArc('Fighter', skill, source);
    const facing = new THREE.Vector3().subVectors(aim || source.position, source.position);
    facing.y = 0;
    if (!facing.lengthSq()) {
        facing.set(0, 0, 1);
        if (source.mesh?.quaternion) facing.applyQuaternion(source.mesh.quaternion);
        facing.y = 0;
    }
    facing.normalize();
    const rects = engine.currentInstanceId && engine.currentInstanceType !== 'overworld' ? engine.currentDungeonLayout?.walkRects : null;
    let totalDamage = 0;
    for (const target of new Set(engine.chunkManager.getActiveEntities())) {
        if (target === source || !(target instanceof Actor) || !target.isActive || target.state === 'DEAD' ||
            !(target.stats?.hp > 0) || target.isRemote || target.isMultiplayer ||
            target.instanceId && target.instanceId !== (source.instanceId || engine.currentInstanceId)) continue;
        const hostile = engine.isHostileActorTarget?.(target) ?? !isFriendlyActor(target, engine);
        if (!hostile) continue;
        const dx = target.position.x - source.position.x, dz = target.position.z - source.position.z;
        const distance = Math.hypot(dx, dz), body = Number.isFinite(target.radius) ? Math.max(0, target.radius) : 0;
        if (distance <= 0 || distance > radius + body || (dx * facing.x + dz * facing.z) / distance < Math.cos(arc / 2) ||
            clipDungeonEffectSegment(rects, source.position, target.position).blocked) continue;
        totalDamage += applyOfflineAbilityHit(source, target, damage, skill, engine.floatingTextManager, '#ffff00');
        if (stun > 0 && !target.ccImmune) target.stunTimer = Math.max(target.stunTimer || 0, stun);
        if (skill === 'Sweeping Strike') engine.floatingTextManager?.spawn('Threat!', target.position, '#ff0000');
    }
    return totalDamage;
}

export function applyOfflineSweepingStrike(source, aim, engine, isFriendlyActor) {
    const damage = getFighterAbilityDamage(source, 'Sweeping Strike', source.stats.damage + Math.floor(source.stats.strength * 1.2));
    return applyOfflineFighterCone(source, aim, engine, isFriendlyActor, 'Sweeping Strike', damage);
}
