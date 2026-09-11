import * as THREE from 'three';
import { Actor } from '../entities/Actor.js';
import { applyOfflineAbilityHit } from '../core/AbilityCritical.js';
import { clipDungeonEffectSegment } from './dungeonEffectGeometry.js';
import { getFighterEffectDuration } from './fighterEffectDuration.js';
import { getShieldSlamStunDuration } from './shieldSlamDuration.js';

export function applyOfflineShieldSlam(source, aim, engine, isFriendlyActor) {
    if (source.isRemote || source.isMultiplayer || engine.isMultiplayer) return;
    const rune = source.skillRunes?.['Shield Slam'];
    const damage = (source.stats.damage + Math.floor(source.stats.strength * 1.5)) * (rune === 'shieldslam_reverberation' ? 2 : 1);
    const duration = getShieldSlamStunDuration(source);
    const facing = new THREE.Vector3().subVectors(aim || source.position, source.position);
    facing.y = 0;
    if (!facing.lengthSq()) {
        facing.set(0, 0, 1);
        if (source.mesh?.quaternion) facing.applyQuaternion(source.mesh.quaternion);
        facing.y = 0;
    }
    facing.normalize();
    const rects = engine.currentInstanceId && engine.currentInstanceType !== 'overworld'
        ? engine.currentDungeonLayout?.walkRects : null;
    let totalDamage = 0;
    for (const target of new Set(engine.chunkManager.getActiveEntities())) {
        if (target === source || !(target instanceof Actor) || !target.isActive || target.state === 'DEAD' ||
            target.isRemote || target.isMultiplayer) continue;
        const hostile = engine.isHostileActorTarget?.(target) ?? !isFriendlyActor(target, engine);
        if (!hostile) continue;
        const dx = target.position.x - source.position.x, dz = target.position.z - source.position.z;
        const distance = Math.hypot(dx, dz);
        const body = Number.isFinite(target.radius) ? Math.max(0, target.radius) : 0;
        if (distance <= 0 || distance > 4 + body || (dx * facing.x + dz * facing.z) / distance < Math.cos(Math.PI / 4) ||
            clipDungeonEffectSegment(rects, source.position, target.position).blocked) continue;
        totalDamage += applyOfflineAbilityHit(source, target, damage, 'Shield Slam', engine.floatingTextManager, '#ffff00');
        if (!target.ccImmune) target.stunTimer = Math.max(target.stunTimer || 0, duration);
    }
    if (rune === 'shieldslam_fortify' && totalDamage > 0) {
        source.shieldHP = (source.shieldHP || 0) + totalDamage;
        source.arcaneShieldActive = true;
        source.arcaneShieldTimer = getFighterEffectDuration(source, 10);
    }
}
