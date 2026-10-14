import { Projectile } from '../entities/Projectile.js';
import { Actor } from '../entities/Actor.js';
import { getAbilityAoeRadius } from './abilityRadii.js';
import { clipDungeonEffectSegment } from './dungeonEffectGeometry.js';
import { firstRockHit } from '../core/RockCollision.js';
import { getOverworldGroundHeight } from '../core/WorldGrounding.js';
import { applyOfflineAbilityHit } from '../core/AbilityCritical.js';

const authoritative = actor => actor?.isRemote || actor?.isMultiplayer || actor?.gameEngine?.isMultiplayer;
const instanceOf = actor => actor?.instanceId || actor?.gameEngine?.currentInstanceId || '';
const playerClasses = new Set(['Wizard', 'Fighter', 'Rogue', 'Cleric', 'AvengingSeraph']);
const dungeonRects = engine => engine?.currentInstanceId && engine.currentInstanceType !== 'overworld'
    ? engine.currentDungeonLayout?.walkRects : null;

function scatterPosition(engine, center, dx, dz) {
    const position = center.clone();position.x += dx;position.z += dz;
    const clipped = clipDungeonEffectSegment(dungeonRects(engine), center, position);
    position.x = clipped.x;position.z = clipped.z;
    if (!engine.currentInstanceId) {
        const rock = firstRockHit(engine.collisionManager?.rockSolids || [], center, position, 0);
        if (rock.hit) {
            position.x = center.x + (position.x - center.x) * rock.at;
            position.z = center.z + (position.z - center.z) * rock.at;
        }
    }
    position.y = getOverworldGroundHeight(engine, position) ?? 0;
    return position;
}

export function cancelOfflineMeteorCasts(owner) {
    for (const cast of owner.offlineMeteorCasts || []) cast.cancel();
    owner.offlineMeteorCasts?.clear();
}

// Admission and Focus consumption already happened in Wizard.useAbility.
// Capture the paid base damage/radius/rune once, keeping live receiving effects.
export function castOfflineMeteor(owner, engine, target, damage) {
    if (authoritative(owner) || engine.isMultiplayer) return;
    const instanceId = engine.currentInstanceId || '', center = scatterPosition(engine, target, 0, 0);
    const radius = getAbilityAoeRadius('Wizard', 'Meteor Drop', owner), runeId = owner.skillRunes?.['Meteor Drop'] || '';
    const spawn = (position, footprint, budget, delay = 1.5, scale = 1) => {
        const start = position.clone();start.y += 20 * delay;
        const meteor = new Projectile(null, owner, 'Meteor', start, position);
        meteor.damage = budget;meteor.explosionRadius = footprint;meteor.speed = 20;
        meteor.velocity.set(0, -20, 0);meteor.groundImpactPosition = position.clone();
        meteor.meteorInstanceId = instanceId;meteor.setScale(scale);
        engine.addEntity(meteor);
        engine.spawnTransientEffect?.('telegraph', position, 0xff2200, { radius: footprint, telegraphDuration: delay });
    };
    if (runeId === 'meteor_cluster') {
        [[0, 0], [-3, -2], [3, -2]].forEach(([dx, dz], i) => {
            spawn(scatterPosition(engine, center, dx, dz), radius, Math.trunc(damage * 2 / 3), 1.5 + i * .2, .7);
        });
        return;
    }
    spawn(center, radius, damage);
    if (runeId !== 'meteor_apocalypse') return;
    owner.offlineMeteorCasts ||= new Set();
    const timers = new Set(), cast = { cancel() {
        for (const timer of timers) owner.clearScheduledTask(timer);
        timers.clear();owner.offlineMeteorCasts.delete(cast);
    } };
    owner.offlineMeteorCasts.add(cast);
    for (let i = 1; i <= 5; i++) {
        const timer = owner.scheduleTask(() => {
            timers.delete(timer);
            if (!owner.isActive || owner.state === 'DEAD' || !(owner.stats.hp > 0) || authoritative(owner) || engine.isMultiplayer ||
                engine.isDestroyed || (engine.currentInstanceId || '') !== instanceId ||
                owner.instanceId && owner.instanceId !== instanceId ||
                owner.gameEngine && owner.gameEngine !== engine || engine.player && engine.player !== owner) {
                cast.cancel();return;
            }
            spawn(scatterPosition(engine, center, (Math.random() - .5) * 10, (Math.random() - .5) * 10), radius * .7, Math.trunc(damage / 2), 1.5, .7);
            if (!timers.size) owner.offlineMeteorCasts.delete(cast);
        }, i * 1000);
        timers.add(timer);
    }
}

// Ground impacts always happen at the selected point, including an empty
// target. Check current legal recipients without following a moved enemy.
export function applyOfflineMeteorImpact(meteor, engine, chunkManager, feedback) {
    const owner = meteor.owner;
    if (authoritative(owner) || engine?.isMultiplayer ||
        meteor.meteorInstanceId !== undefined && meteor.meteorInstanceId !== (engine?.currentInstanceId || '')) return;
    for (const target of new Set(chunkManager?.getActiveEntities() || [])) {
        if (!(target instanceof Actor) || target === owner || !target.isActive || target.state === 'DEAD' || !(target.stats.hp > 0) ||
            authoritative(target) || instanceOf(target) !== (engine?.currentInstanceId || '')) continue;
        const hostile = engine?.isHostileActorTarget?.(target) ?? (!target.isInvulnerable && !playerClasses.has(target.constructor.name));
        if (!hostile || Math.hypot(target.position.x - meteor.position.x, target.position.z - meteor.position.z) > meteor.explosionRadius + Math.max(0, target.radius || 0) ||
            clipDungeonEffectSegment(dungeonRects(engine), meteor.position, target.position).blocked ||
            !engine?.currentInstanceId && firstRockHit(engine?.collisionManager?.rockSolids || [], meteor.position, target.position, 0).hit) continue;
        applyOfflineAbilityHit(owner, target, meteor.damage, 'Meteor Drop', feedback, '#ff4500');
    }
}
