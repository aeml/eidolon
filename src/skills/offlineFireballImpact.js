import { Actor } from '../entities/Actor.js';
import { AreaOfEffect } from '../entities/AreaOfEffect.js';
import { applyOfflineAbilityHit } from '../core/AbilityCritical.js';
import { getOverworldGroundHeight } from '../core/WorldGrounding.js';
import { clipDungeonEffectSegment } from './dungeonEffectGeometry.js';

const authoritative = actor => actor?.isRemote || actor?.isMultiplayer || actor?.gameEngine?.isMultiplayer;
const playerClasses = new Set(['Wizard', 'Cleric', 'Fighter', 'Rogue', 'AvengingSeraph']);

export function isOfflineFireballTarget(source, target, engine) {
    if (!(target instanceof Actor) || target === source || !target.isActive || target.state === 'DEAD' ||
        authoritative(source) || authoritative(target) || engine?.isMultiplayer) return false;
    if (target.gameEngine?.currentInstanceId && target.gameEngine.currentInstanceId !== (engine?.currentInstanceId || '')) return false;
    return typeof engine?.isHostileActorTarget === 'function' ? engine.isHostileActorTarget(target)
        : !target.isInvulnerable && !playerClasses.has(target.constructor.name);
}

function spawnMagmaGround(projectile, actualHit, engine, rects) {
    const damage = Math.floor(actualHit / 6);
    if (!engine || damage <= 0) return;
    const owner = projectile.owner, instance = engine.currentInstanceId || '';
    const origin = projectile.position.clone();
    origin.y = getOverworldGroundHeight(engine, origin) ?? 0;
    const field = new AreaOfEffect(engine, owner, origin, {
        radius: 5, duration: 3, damage: 0, damageInterval: 1, effectType: 'BurningGround', skillName: 'Fireball',
        onTick: (currentEngine, zone) => {
            if ((currentEngine.currentInstanceId || '') !== instance || !owner.isActive || currentEngine.isMultiplayer || authoritative(owner)) {
                zone.isActive = false; return;
            }
            for (const target of currentEngine.chunkManager?.getActiveEntities() || []) {
                if (!isOfflineFireballTarget(owner, target, currentEngine) ||
                    Math.hypot(target.position.x - zone.position.x, target.position.z - zone.position.z) > zone.radius + (target.radius || 0) ||
                    clipDungeonEffectSegment(rects, zone.position, target.position).blocked) continue;
                // This budget inherited the real first hit. Receiver defenses
                // still apply, but criticals/outgoing/vulnerability cannot be
                // multiplied again at every pulse or by a changed loadout.
                const before = target.stats.hp;
                const received = target.takeDamage(damage, owner, 0, { inherited: true });
                const applied = Number.isFinite(received) ? Math.max(0, received) : Math.max(0, before - target.stats.hp);
                if (applied > 0) currentEngine.floatingTextManager?.spawn(applied, target.position, '#ff8800');
            }
        }
    });
    // First pulse on the next simulation frame, then at one-second intervals.
    // Three seconds is a ground lifetime: leaving stops damage, entering gains it.
    field.tickTimer = 1;
    // ChunkManager iterates a live entity set. A field added by an impact can
    // otherwise consume the whole birth frame a second time and expire early.
    const bornFrame = engine.chunkManager?.frameCount;
    if (Number.isInteger(bornFrame)) {
        const update = field.update.bind(field);
        field.update = (dt, ...args) => {
            if (engine.chunkManager.frameCount !== bornFrame) update(dt, ...args);
        };
    }
    engine.addEntity(field);
}

export function resolveOfflineFireballImpact(projectile, direct, candidates, engine, feedback, rects) {
    const owner = projectile.owner, radius = projectile.explosionRadius || 10;
    let actualHit = 0;
    for (const target of new Set([direct, ...candidates])) {
        if (!isOfflineFireballTarget(owner, target, engine) ||
            Math.hypot(target.position.x - projectile.position.x, target.position.z - projectile.position.z) > radius + (target.radius || 0) ||
            clipDungeonEffectSegment(rects, projectile.position, target.position).blocked) continue;
        let damage = target === direct ? projectile.damage : Math.floor(projectile.damage * .4);
        if (projectile.fireballWellBoost && (target.slowTimer > 0 || target.ccImmune)) damage *= 2;
        const resolution = target === direct ? {} : null;
        applyOfflineAbilityHit(owner, target, damage, 'Fireball', feedback, '#ff4500', false, resolution);
        if (resolution) actualHit = resolution.damage;
    }
    projectile.hitEntities.add(direct.id);
    if (projectile.fireballRuneId === 'fireball_magma') spawnMagmaGround(projectile, actualHit, engine, rects);
    if (projectile.fireballRuneId !== 'fireball_chain' || !(projectile.bounces > 0)) return false;

    let next = null, nearest = 15;
    for (const target of candidates) {
        if (!isOfflineFireballTarget(owner, target, engine) || projectile.hitEntities.has(target.id) ||
            clipDungeonEffectSegment(rects, projectile.position, target.position).blocked) continue;
        const distance = Math.hypot(target.position.x - projectile.position.x, target.position.z - projectile.position.z);
        if (distance <= .5 || distance > nearest || distance === nearest && (!next || String(target.id) >= String(next.id))) continue;
        nearest = distance; next = target;
    }
    if (!next) return false;
    projectile.velocity.set(next.position.x - projectile.position.x, 0, next.position.z - projectile.position.z).normalize().multiplyScalar(20);
    projectile.speed = 20;
    if (projectile.bounces === 3) projectile.damage = Math.floor(projectile.damage / 2);
    projectile.bounces--;
    return true;
}
