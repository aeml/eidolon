import { Actor } from '../entities/Actor.js';
import { applyOfflineAbilityHit } from '../core/AbilityCritical.js';
import { applyOfflineArmorMelt } from '../core/OfflineArmor.js';
import { getAbilityAreaRadius } from '../core/AbilityRange.js';
import { getFighterEffectDuration } from './fighterEffectDuration.js';
import { getFighterAbilityDamageMultiplier } from './fighterAbilityDamage.js';
import { clipDungeonEffectSegment, resolveDungeonMovementEndpoint } from './dungeonEffectGeometry.js';

const SKILL = 'Shattering Charge';
const offline = actor => actor && !actor.isRemote && !actor.isMultiplayer && !actor.gameEngine?.isMultiplayer;
const floors = engine => engine?.currentInstanceId && engine.currentInstanceType !== 'overworld'
    ? engine.currentDungeonLayout?.walkRects : null;

export function beginOfflineShatteringCharge(source, aim, engine) {
    const end = aim.clone();
    const distance = Math.hypot(end.x - source.position.x, end.z - source.position.z);
    if (distance > 28) {
        end.x = source.position.x + (end.x - source.position.x) * 28 / distance;
        end.z = source.position.z + (end.z - source.position.z) * 28 / distance;
    }
    const landing = resolveDungeonMovementEndpoint(floors(engine), source.position, end);
    source.chargeTarget = end.set(landing.x, source.position.y, landing.z);
    source.shatteringArmorDuration = getFighterEffectDuration(source, 5);
    source.shatteringInstanceId = engine?.currentInstanceId || '';
    source.isCharging = source.isShatteringCharge = true;
    source.state = 'ATTACKING';
    source.targetPosition = null;
    source.velocity.set(0, 0, 0);
    if (source.mesh) {
        source.mesh.lookAt(source.chargeTarget);
        source.rotation.copy(source.mesh.quaternion);
    }
}

export function advanceOfflineShatteringCharge(source, dt, engine, isFriendlyActor) {
    if (!offline(source) || engine?.isMultiplayer || source.state === 'DEAD' || !source.chargeTarget ||
        source.shatteringInstanceId !== (engine?.currentInstanceId || '')) {
        source.isCharging = source.isShatteringCharge = false;
        source.shatteringArmorDuration = 0;
        source.shatteringInstanceId = null;
        if (source.state === 'ATTACKING') source.state = 'IDLE';
        return;
    }
    const rects = floors(engine);
    const landing = resolveDungeonMovementEndpoint(rects, source.position, source.chargeTarget);
    const dx = landing.x - source.position.x, dz = landing.z - source.position.z;
    const distance = Math.hypot(dx, dz);
    const travel = Math.max(0, dt) * 50;
    if (distance > travel) {
        source.position.x += dx / distance * travel;
        source.position.z += dz / distance * travel;
        return;
    }
    source.position.x = landing.x; source.position.z = landing.z;
    source.isCharging = source.isShatteringCharge = false;
    source.state = 'IDLE'; source.playAnimation('Idle');
    const duration = source.shatteringArmorDuration;
    source.shatteringArmorDuration = 0;
    source.shatteringInstanceId = null;
    // Damage/area use impact-time training, as on the server; only the status
    // duration is captured by the paid cast before travel begins.
    const damage = Math.trunc(source.stats.damage * 1.5 * 1.3 * getFighterAbilityDamageMultiplier(source, SKILL));
    const radius = getAbilityAreaRadius(source, 'Fighter', 16, SKILL);
    for (const target of new Set(engine?.chunkManager?.getActiveEntities?.() || [])) {
        if (target === source || !(target instanceof Actor) || !offline(target) || !target.isActive || target.state === 'DEAD') continue;
        if (engine.currentInstanceId && target.gameEngine?.currentInstanceId &&
            engine.currentInstanceId !== target.gameEngine.currentInstanceId) continue;
        const hostile = engine.isHostileActorTarget?.(target) ?? !isFriendlyActor(target, engine);
        if (!hostile) continue;
        const body = Number.isFinite(target.radius) ? Math.max(0, target.radius) : 0;
        if (Math.hypot(target.position.x - landing.x, target.position.z - landing.z) > radius + body ||
            clipDungeonEffectSegment(rects, landing, target.position).blocked) continue;
        applyOfflineAbilityHit(source, target, damage, SKILL, engine.floatingTextManager, '#ff0000');
        if (applyOfflineArmorMelt(target, duration)) {
            engine.floatingTextManager?.spawn?.('Armor Break!', target.position, '#ffffff');
            source.spawnVisualEffect(engine, target.position, 0xffffff, 'impact');
        }
    }
}
