import { Actor } from '../entities/Actor.js';
import { clipDungeonEffectSegment } from './dungeonEffectGeometry.js';
import { firstRockHit } from '../core/RockCollision.js';

const authoritative = actor => actor?.isMultiplayer || actor?.isRemote || actor?.gameEngine?.isMultiplayer;
const instanceOf = actor => actor?.instanceId || actor?.gameEngine?.currentInstanceId || '';
const playerClasses = new Set(['Wizard', 'Fighter', 'Rogue', 'Cleric', 'AvengingSeraph']);

export function clearOfflineArcaneShield(owner) {
    owner.arcaneShieldActive = false;
    owner.arcaneShieldTimer = 0;
    owner.shieldHP = 0;
    owner.arcaneShieldRuneId = '';
    owner.arcaneShieldAbsorbed = 0;
    owner.arcaneShieldEngine = null;
    owner.arcaneShieldInstanceId = '';
}

export function installOfflineArcaneShield(owner, engine, capacity, duration, runeId = '') {
    clearOfflineArcaneShield(owner);
    owner.arcaneShieldActive = true;
    owner.arcaneShieldTimer = duration;
    owner.shieldHP = capacity;
    owner.arcaneShieldRuneId = runeId;
    owner.arcaneShieldEngine = engine;
    owner.arcaneShieldInstanceId = engine ? engine.currentInstanceId || '' : instanceOf(owner);
}

export function expireOfflineArcaneShield(owner, elapsedInFrame = 0) {
    if (owner.arcaneShieldActive && (!(owner.arcaneShieldTimer > elapsedInFrame) || !(owner.shieldHP > 0))) {
        clearOfflineArcaneShield(owner);
    }
}

// Capture retaliation before clearing a broken ward. The caller commits the
// original health/death-save/death first, then flushes this immutable reaction.
export function absorbOfflineArcaneShield(owner, amount, elapsedInFrame = 0) {
    expireOfflineArcaneShield(owner, elapsedInFrame);
    if (!(owner.shieldHP > 0) || !(amount > 0)) return { damage: amount };
    const absorbed = Math.min(owner.shieldHP, amount);
    owner.shieldHP -= absorbed;
    const reaction = { damage: amount - absorbed };
    // Ordinary equipment/Fighter absorption remains useful without acquiring
    // Wizard rune reactions. Only an active paid ward owns absorbed history.
    if (!owner.arcaneShieldActive) return reaction;
    owner.arcaneShieldAbsorbed = (owner.arcaneShieldAbsorbed || 0) + absorbed;
    reaction.engine = owner.arcaneShieldEngine || owner.gameEngine;
    reaction.instanceId = owner.arcaneShieldEngine ? owner.arcaneShieldInstanceId : instanceOf(owner);
    if (owner.arcaneShieldRuneId === 'arcaneshield_reflective') reaction.reflection = Math.floor(absorbed * .3);
    if (owner.shieldHP <= 0) {
        if (owner.arcaneShieldRuneId === 'arcaneshield_explosive') {
            reaction.explosion = owner.arcaneShieldAbsorbed;
            reaction.origin = owner.position.clone();
        }
        clearOfflineArcaneShield(owner);
    }
    return reaction;
}

function liveRecipient(target, instanceId) {
    return target instanceof Actor && target.isActive && target.state !== 'DEAD' && target.stats.hp > 0 &&
        !authoritative(target) && instanceOf(target) === instanceId;
}

// HP-damage reflection joins absorbed reflection before the receiving actor's
// defensive rounding. Capture before death/dispels clear the paid Fortress.
export function addOfflineDamageReflection(owner, reaction, damage, elapsed = 0) {
    if (!(damage > 0) || authoritative(owner)) return;
    let amount = owner.ironFortressTimer > elapsed && owner.ironFortressThorns ? Math.floor(damage / 5) : 0;
    if (owner.hasThornsEffect) amount += Math.floor(damage / 10);
    if (!(amount > 0)) return;
    reaction.reflection = (reaction.reflection || 0) + amount;
    reaction.engine ||= owner.gameEngine;
    reaction.instanceId ??= instanceOf(owner);
}

export function flushOfflineArcaneShieldReaction(owner, attacker, reaction) {
    const { engine, instanceId = '' } = reaction;
    if (authoritative(owner) || engine?.isMultiplayer || engine && (engine.currentInstanceId || '') !== instanceId) return;
    if (reaction.reflection > 0 && attacker !== owner && liveRecipient(attacker, instanceId)) {
        // Match the authoritative reflection path: defensive Fortress/Roar
        // remain, but no phase/shield/mark/critical/death-save/retaliation loop.
        const applied = attacker.takeDamage(reaction.reflection, owner, 0, { reflection: true });
        if (applied > 0) engine?.floatingTextManager?.spawn(applied, attacker.position, '#9edbff');
    }
    if (!(reaction.explosion > 0) || !engine) return;
    const radius = 6, origin = reaction.origin;
    const rects = instanceId && engine.currentInstanceType !== 'overworld' ? engine.currentDungeonLayout?.walkRects : null;
    engine.spawnTransientEffect?.('ring', origin, 0x4da6ff, { radius, source: owner, abilityName: 'Arcane Shield' });
    for (const target of new Set(engine.chunkManager?.getActiveEntities() || [])) {
        if (target === owner || !liveRecipient(target, instanceId)) continue;
        const hostile = engine.isHostileActorTarget?.(target) ?? (!target.isInvulnerable && !playerClasses.has(target.constructor.name));
        if (!hostile || Math.hypot(target.position.x - origin.x, target.position.z - origin.z) > radius + Math.max(0, target.radius || 0) ||
            clipDungeonEffectSegment(rects, origin, target.position).blocked) continue;
        if (!instanceId && firstRockHit(engine.collisionManager?.rockSolids || [], origin, target.position, 0).hit) continue;
        // Stored absorption is already a budget. Receiving defenses still
        // apply; changing the caster's crits, damage or marks cannot reroll it.
        const applied = target.takeDamage(reaction.explosion, owner, 0, { inherited: true });
        if (applied > 0) engine.floatingTextManager?.spawn(applied, target.position, '#4da6ff');
    }
}
