import * as THREE from 'three';
import { applyOfflineAbilityHit } from '../core/AbilityCritical.js';
import {Actor} from './Actor.js';
import {getAbilityAoeRadius} from '../skills/abilityRadii.js';
import {clipDungeonEffectSegment} from '../skills/dungeonEffectGeometry.js';
import {applyOfflineHealing,getAbilityHealingAmount} from '../core/AbilityHealing.js';
import { getClericEffectDuration } from '../skills/clericEffectDuration.js';
import { getAbilityCooldown } from '../core/AbilityEconomy.js';

const playerClasses = new Set(['Fighter','Rogue','Wizard','Cleric','AvengingSeraph']);
const alive = entity => entity instanceof Actor && entity.isActive && entity.state !== 'DEAD' && !entity.isRemote && !entity.isMultiplayer && !entity.gameEngine?.isMultiplayer;
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const body = entity => Number.isFinite(entity.radius) ? Math.max(0,entity.radius) : 0;
const walkRects = engine => engine?.currentInstanceId && engine.currentInstanceType !== 'overworld' ? engine.currentDungeonLayout?.walkRects : null;
const hostile = (source,target,engine) => target !== source && (typeof engine?.isHostileActorTarget === 'function'
    ? engine.isHostileActorTarget(target) : !playerClasses.has(target.constructor.name));
const actors = (source,engine) => new Set([source,...(engine?.chunkManager?.getActiveEntities() || [])]);

export function resolveOfflineClericHealTarget(source,aim,engine) {
    let selected = source, nearest = 3;
    for (const target of actors(source,engine)) {
        if (!alive(target) || hostile(source,target,engine) || distance(source.position,target.position) > 15+body(target) ||
            clipDungeonEffectSegment(walkRects(engine),source.position,target.position).blocked) continue;
        const cursorDistance = distance(aim || source.position,target.position);
        if (cursorDistance < nearest) { selected = target; nearest = cursorDistance; }
    }
    return selected;
}

export function applyOfflineHealingLight(source,target,engine) {
    const amount = getAbilityHealingAmount(source,'Healing Light',30+3*source.stats.wisdom);
    const radius = getAbilityAoeRadius('Cleric','Healing Light',source);
    if (radius) {
        const center = source.healingLightMassRevival ? source.position : target.position;
        for (const ally of actors(source,engine)) {
            // Friendly circles intentionally heal through walls, unlike selecting
            // a direct target or dealing hostile cone damage.
            if (alive(ally) && !hostile(source,ally,engine) && distance(center,ally.position) <= radius+body(ally)) {
                applyOfflineHealing(ally,amount,engine?.floatingTextManager);
            }
        }
    } else applyOfflineHealing(target,amount,engine?.floatingTextManager);

    // Mass Revival has its own branch on the server; it does not inherit Renewal
    // or Divine's single-target side effects from the equipped Healing Light rune.
    if (source.healingLightMassRevival) return;
    const rune = source.skillRunes?.['Healing Light'];
    if (rune === 'healinglight_renewal') {
        target.healingLightRenewal = {amount:Math.max(1,Math.floor(amount/25)),elapsed:0,
            ticks:Math.floor(getClericEffectDuration(source,'Healing Light',5)),floatingTextManager:engine?.floatingTextManager};
    } else if (rune === 'healinglight_divine') {
        if (target.stunTimer > 0) target.stunTimer = 0;
        else if (target.rootTimer > 0) target.rootTimer = 0;
        else if (target.slowTimer > 0) { target.slowTimer = 0; target.slowFactor = 0; }
        else if (target.bleedTimer > 0) { target.bleedTimer = 0; target.bleedStacks = 0; target.bleedTickDamage = 0; target.bleedTickTimer = 0; }
        else if (target.poisonTimer > 0) { target.poisonTimer = 0; target.poisonStacks = 0; target.poisonTickDamage = 0; target.poisonTickTimer = 0; }
    }
}

export function applyOfflineDivineIntervention(source, primary, engine) {
    if (!alive(source) || engine?.isMultiplayer) return;
    const skill = 'Divine Intervention', rune = source.skillRunes?.[skill];
    const recipients = [primary];
    if (rune === 'divineintervention_miracle') {
        let nearest = null, minimum = 15;
        for (const target of actors(source, engine)) {
            if (target === primary || !alive(target) || hostile(source, target, engine) ||
                clipDungeonEffectSegment(walkRects(engine), source.position, target.position).blocked) continue;
            const range = distance(source.position, target.position);
            if (range < minimum) { nearest = target; minimum = range; }
        }
        if (nearest) recipients.push(nearest);
    }
    const duration = getClericEffectDuration(source, skill, 10);
    for (const target of recipients) {
        if (!alive(target)) continue;
        target.divineInterventionActive = true;
        target.divineInterventionTimer = duration;
        applyOfflineHealing(target, getAbilityHealingAmount(source, skill, Math.floor(target.stats.maxHp/2)), engine?.floatingTextManager);
        if (rune === 'divineintervention_guardian') {
            target.divineInterventionGuardianTimer = getClericEffectDuration(source, skill, 5);
        }
        engine?.floatingTextManager?.spawn('DIVINE PROTECTION', target.position, '#ffd700');
        source.spawnVisualEffect(engine, target.position, 0xffd700, 'pillar');
    }
    const setCooldown = Object.values(source.activeSetBonuses || {}).some(set => set.specials?.divineInterventionCD > 0);
    source.cooldowns[skill] = getAbilityCooldown(source, skill, (setCooldown ? 60 : 120)*(rune === 'divineintervention_quick' ? .5 : 1));
}

export function applyOfflineRadiantStrike(source,aim,engine,holyFury = false) {
    const radius = getAbilityAoeRadius('Cleric','Radiant Strike',source);
    const forward = new THREE.Vector3().subVectors(aim || source.position,source.position); forward.y = 0;
    if (forward.lengthSq() === 0) {
        forward.set(0,0,1);
        if (source.mesh?.quaternion) forward.applyQuaternion(source.mesh.quaternion);
        forward.y = 0;
    }
    forward.normalize();
    const rawRank = Number(source.talentRanks?.CLR_11 || 0);
    const mastery = Number.isFinite(rawRank) ? Math.max(0,Math.min(5,Math.floor(rawRank))) : 0;
    let damage = Math.floor((source.stats.damage+2*source.stats.wisdom)*(1+.04*mastery));
    const rune = source.skillRunes?.['Radiant Strike'];
    if (rune === 'radiantstrike_smite') damage = Math.floor(damage*1.5);
    let totalDamage = 0;
    for (const target of actors(source,engine)) {
        if (!alive(target) || !hostile(source,target,engine)) continue;
        const dx = target.position.x-source.position.x, dz = target.position.z-source.position.z;
        const length = Math.hypot(dx,dz);
        if (!(length > 0) || length > radius+body(target) || (forward.x*dx+forward.z*dz)/length <= Math.cos(Math.PI/3) ||
            clipDungeonEffectSegment(walkRects(engine),source.position,target.position).blocked) continue;
        const before = target.stats.hp;
        const hit = holyFury && target.markWeaknessTimer > 0 ? damage*2 : damage;
        // Preserve receiving-side HP accounting for lifesteal and text.
        applyOfflineAbilityHit(source,target,hit,'Radiant Strike');
        const actual = Math.max(0,before-target.stats.hp);
        totalDamage += actual;
        if (actual > 0) engine?.floatingTextManager?.spawn(Math.floor(actual),target.position,'#ffff00');
        if (rune === 'radiantstrike_chains' && !target.ccImmune) target.rootTimer = getClericEffectDuration(source,'Radiant Strike',2);
        if (rune === 'radiantstrike_purge') {
            if (target.blessingZealTimer > 0) { target.blessingZealTimer = 0; target.blessingZealFactor = 0; }
            else if (target.shieldHP > 0) { target.shieldHP = 0; target.arcaneShieldTimer = 0; }
            else if (target.berserkerEdgeActive) {
                target.berserkerEdgeActive = false; target.berserkerEdgeTimer = 0;
                target.berserkerEdgeMultiplier = 1;
                target.recalculateStats?.();
            }
            else if (target.ironFortressTimer > 0) { target.ironFortressTimer = 0; target.ironFortressReduction = 0; }
        }
    }
    if (Object.values(source.activeSetBonuses || {}).some(bonus=>bonus.specials?.radiantStrikeLifesteal > 0)) {
        applyOfflineHealing(source,totalDamage,engine?.floatingTextManager);
    }
}
