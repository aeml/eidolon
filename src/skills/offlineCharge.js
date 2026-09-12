import { Actor } from '../entities/Actor.js';
import { applyOfflineAbilityHit } from '../core/AbilityCritical.js';
import { getFighterEffectDuration } from './fighterEffectDuration.js';
import { getFighterAbilityDamageMultiplier } from './fighterAbilityDamage.js';
import { clipDungeonEffectSegment, resolveDungeonMovementEndpoint } from './dungeonEffectGeometry.js';

const offline = actor => actor && !actor.isRemote && !actor.isMultiplayer && !actor.gameEngine?.isMultiplayer;
const floors = engine => engine?.currentInstanceId && engine.currentInstanceType !== 'overworld'
    ? engine.currentDungeonLayout?.walkRects : null;

export function cancelOfflineCharge(source) {
    const cast = source.offlineCharge;
    if (!cast) return;
    if (cast.rune === 'charge_unstoppable') source.ccImmune = cast.priorImmunity;
    source.offlineCharge = null;
    source.isCharging = false;
    source.chargeTarget = null;
    if (source.state === 'ATTACKING') source.state = 'IDLE';
}

export function beginOfflineCharge(source, aim, engine) {
    const end = aim.clone(), origin = source.position.clone();
    const distance = Math.hypot(end.x - origin.x, end.z - origin.z);
    const rune = source.skillRunes?.Charge || '';
    const ratio = (distance > 28 ? 28 / distance : 1) * (rune === 'charge_momentum' ? 1.5 : 1);
    end.x = origin.x + (end.x - origin.x) * ratio;
    end.z = origin.z + (end.z - origin.z) * ratio;
    const landing = resolveDungeonMovementEndpoint(floors(engine), origin, end);
    source.chargeTarget = end.set(landing.x, origin.y, landing.z);
    source.offlineCharge = { origin, rune, instance: engine?.currentInstanceId || '', engine,
        armorDuration: getFighterEffectDuration(source, 5), priorImmunity: Boolean(source.ccImmune) };
    if (rune === 'charge_unstoppable') source.ccImmune = true;
    source.isCharging = true; source.isShatteringCharge = false;
    source.state = 'ATTACKING'; source.targetPosition = null; source.velocity.set(0, 0, 0);
    if (source.mesh) {
        source.mesh.lookAt(source.chargeTarget); source.rotation.copy(source.mesh.quaternion);
    }
    // The visible destination must agree with Momentum and clipped floors.
    source.spawnAbilityPresentation(engine, 'Charge', source.chargeTarget);
}

export function advanceOfflineCharge(source, dt, engine, isFriendlyActor) {
    const cast = source.offlineCharge;
    if (!cast) return;
    if (!offline(source) || engine?.isMultiplayer || source.state === 'DEAD' || !source.isActive ||
        !source.isCharging || !source.chargeTarget || engine !== cast.engine ||
        cast.instance !== (engine?.currentInstanceId || '')) {
        cancelOfflineCharge(source); return;
    }
    if (source.stunTimer > 0) return;
    const rects = floors(engine);
    const landing = resolveDungeonMovementEndpoint(rects, source.position, source.chargeTarget);
    const dx = landing.x - source.position.x, dz = landing.z - source.position.z;
    const distance = Math.hypot(dx, dz), travel = Math.max(0, dt) * 50;
    if (distance > travel) {
        source.position.x += dx / distance * travel; source.position.z += dz / distance * travel;
        source.mesh?.position.copy(source.position);
        return;
    }
    source.position.x = landing.x; source.position.z = landing.z;
    source.mesh?.position.copy(source.position);
    cancelOfflineCharge(source); source.playAnimation('Idle');
    let damage = Math.trunc(source.stats.damage * 1.5 * 1.3 * getFighterAbilityDamageMultiplier(source, 'Charge'));
    if (cast.rune === 'charge_momentum') {
        damage = Math.trunc(damage * (1 + Math.min(Math.hypot(landing.x - cast.origin.x, landing.z - cast.origin.z) / 30, 1)));
    }
    if (cast.rune === 'charge_unstoppable') {
        source.runeArmorBuff = .2; source.runeArmorBuffTimer = cast.armorDuration;
    }
    for (const target of new Set(engine?.chunkManager?.getActiveEntities?.() || [])) {
        if (target === source || !(target instanceof Actor) || !offline(target) || !target.isActive || target.state === 'DEAD') continue;
        if (engine.currentInstanceId && target.gameEngine?.currentInstanceId && engine.currentInstanceId !== target.gameEngine.currentInstanceId) continue;
        if (!(engine.isHostileActorTarget?.(target) ?? !isFriendlyActor(target, engine))) continue;
        const body = Number.isFinite(target.radius) ? Math.max(0, target.radius) : 0;
        const tx = target.position.x - landing.x, tz = target.position.z - landing.z, range = Math.hypot(tx, tz);
        if (range > 16 + body || clipDungeonEffectSegment(rects, landing, target.position).blocked) continue;
        applyOfflineAbilityHit(source, target, damage, 'Charge', engine.floatingTextManager, '#ff0000');
        if (cast.rune === 'charge_shockwave' && target.state !== 'DEAD' && !target.ccImmune &&
            !target.ironFortressImmovable && range > 0 && range <= 5 + body) {
            const end = resolveDungeonMovementEndpoint(rects, target.position,
                { x: target.position.x + tx / range * 4, z: target.position.z + tz / range * 4 });
            target.position.x = end.x; target.position.z = end.z;
            target.mesh?.position.copy(target.position);
        }
    }
}
