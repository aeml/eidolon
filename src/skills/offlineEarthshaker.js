import * as THREE from 'three';
import { Actor } from '../entities/Actor.js';
import { applyOfflineAbilityHit } from '../core/AbilityCritical.js';
import { clipDungeonEffectSegment } from './dungeonEffectGeometry.js';
import { getFighterEffectDuration } from './fighterEffectDuration.js';
import { getFighterAbilityDamage } from './fighterAbilityDamage.js';
import { getAbilityAreaRadius } from '../core/AbilityRange.js';
import { spawnEarthshakerPresentation } from './earthshakerPresentation.js';

// Paid offline casts only. Multiplayer prediction never calls this handler.
export function applyOfflineEarthshaker(source, aim, engine, isFriendlyActor) {
    if (source.isRemote || source.isMultiplayer || engine.isMultiplayer) return;
    const origin = source.position.clone();
    const instance = engine.currentInstanceId;
    const rune = source.skillRunes?.Earthshaker;
    const radius = getAbilityAreaRadius(source, 'Fighter', 6, 'Earthshaker');
    const aftershockRadius = getAbilityAreaRadius(source, 'Fighter', 3.5, 'Earthshaker');
    const damage = getFighterAbilityDamage(source, 'Earthshaker', Math.floor(source.stats.damage + source.stats.strength * 2));
    const stun = getFighterEffectDuration(source, rune === 'earthshaker_seismic' ? 4 : 2);
    const aftershockStun = getFighterEffectDuration(source, 1);
    const facing = new THREE.Vector3().subVectors(aim || origin, origin);
    facing.y = 0;
    if (!facing.lengthSq()) {
        facing.set(0, 0, 1);
        if (source.mesh?.quaternion) facing.applyQuaternion(source.mesh.quaternion);
        facing.y = 0;
    }
    facing.normalize();

    const impact = (radius, amount, duration, line) => {
        const rects = engine.currentInstanceId && engine.currentInstanceType !== 'overworld'
            ? engine.currentDungeonLayout?.walkRects : null;
        for (const target of new Set(engine.chunkManager.getActiveEntities())) {
            if (target === source || !(target instanceof Actor) || !target.isActive || target.state === 'DEAD' ||
                target.isRemote || target.isMultiplayer) continue;
            if (target.instanceId && target.instanceId !== instance) continue;
            const hostile = engine.isHostileActorTarget?.(target) ?? !isFriendlyActor(target, engine);
            if (!hostile) continue;
            const body = Number.isFinite(target.radius) ? Math.max(0, target.radius) : 0;
            const dx = target.position.x - origin.x, dz = target.position.z - origin.z;
            const forward = dx * facing.x + dz * facing.z;
            const lateral = Math.abs(dx * facing.z - dz * facing.x);
            const hit = line ? forward >= 0 && forward <= radius + body && lateral <= radius/4 + body
                : Math.hypot(dx, dz) <= radius + body;
            if (!hit || clipDungeonEffectSegment(rects, origin, target.position).blocked) continue;
            applyOfflineAbilityHit(source, target, amount, 'Earthshaker', engine.floatingTextManager, '#ffff00');
            if (!target.ccImmune) {
                target.stunTimer = Math.max(target.stunTimer || 0, duration);
                engine.floatingTextManager?.spawn('Knockdown!', target.position, '#ffffff');
            }
        }
    };

    impact(radius, damage, stun, rune === 'earthshaker_fissure');
    if (rune === 'earthshaker_aftershock') {
        source.scheduleTask(() => {
            if (!source.isActive || source.state === 'DEAD' || source.isRemote || source.isMultiplayer ||
                engine.isMultiplayer || source.gameEngine !== engine || engine.currentInstanceId !== instance) return;
            spawnEarthshakerPresentation(engine, source, null, { shapeResolved: true, shapeKind: 'circle', phase: 'aftershock',
                origin, targetX: origin.x + facing.x, targetZ: origin.z + facing.z, radius: aftershockRadius });
            impact(aftershockRadius, Math.floor(damage / 2), aftershockStun, false);
        }, 1000);
    }
}
