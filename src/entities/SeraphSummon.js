import { CONSTANTS } from '../core/Constants.js';
import { Actor } from './Actor.js';
import { rollOfflineCriticalDamage } from '../core/AbilityCritical.js';
import { clipDungeonEffectSegment } from '../skills/dungeonEffectGeometry.js';

const authoritative = actor => actor?.isMultiplayer || actor?.isRemote || actor?.gameEngine?.isMultiplayer;

export function getSeraphTraining(owner) {
    let damage = 0, duration = 0;
    const className = owner?.meshType || owner?.subType || owner?.constructor?.name;
    for (const talent of CONSTANTS.PASSIVE_TALENTS[className] || []) {
        const bonus = talent.summonTraining;
        if (!bonus) continue;
        const [prefix, number] = talent.id.split('_');
        let rank = 0;
        for (const id of new Set([talent.id, `${prefix}_${Number(number)}`])) {
            const value = Number(owner.talentRanks?.[id] || 0);
            if (Number.isFinite(value)) rank = Math.max(rank, Math.min(talent.maxRank, Math.floor(value)));
        }
        damage += rank*(bonus.damage || 0);
        duration += rank*(bonus.duration || 0);
    }
    const permanent = Object.values(owner.activeSetBonuses || {}).some(set => set.specials?.permanentSeraph > 0);
    return { damage: Math.floor((50+2*owner.stats.wisdom)*(1+damage)+1e-9),
        duration: Math.min(300, (permanent ? 300 : 15)*(1+duration)) };
}

export function configureOfflineSeraph(seraph, owner, engine) {
    if (authoritative(owner) || engine?.isMultiplayer) return false;
    const training = getSeraphTraining(owner);
    seraph.offlineOwner = owner;
    seraph.gameEngine = engine;
    seraph.ownerId = owner.id;
    seraph.offlineInstanceId = engine.currentInstanceId || '';
    seraph.position.copy(owner.position); seraph.position.y = 0;
    seraph.summonDamage = training.damage;
    seraph.summonRemaining = training.duration;
    seraph.summonAttackCooldown = 0;
    seraph.stats.hp = seraph.stats.maxHp = 500+10*owner.stats.wisdom;
    seraph.stats.speed = 6; seraph.stats.hpRegen = 0;
    (owner.offlineSeraphs ||= new Set()).add(seraph);
    return true;
}

export function dismissOfflineSeraph(seraph) {
    seraph.offlineOwner?.offlineSeraphs?.delete(seraph);
    seraph.offlineOwner = null;
    seraph.isActive = false;
    seraph.state = 'DEAD';
    if (seraph.gameEngine?.chunkManager?.removeEntity) seraph.gameEngine.chunkManager.removeEntity(seraph);
    else seraph.dispose();
}

export function updateOfflineSeraph(seraph, dt) {
    const owner = seraph.offlineOwner, engine = seraph.gameEngine;
    if (!owner || !engine || authoritative(owner) || authoritative(seraph) || owner.isActive === false ||
        owner.state === 'DEAD' || seraph.state === 'DEAD' || owner.disconnected ||
        (engine.currentInstanceId || '') !== seraph.offlineInstanceId) {
        dismissOfflineSeraph(seraph); return false;
    }
    if (!(dt > 0) || !Number.isFinite(dt)) return false;
    seraph.summonRemaining -= dt;
    if (seraph.summonRemaining <= 0) { dismissOfflineSeraph(seraph); return false; }
    seraph.summonAttackCooldown -= dt;
    const rects = engine.currentDungeonLayout?.walkRects || [];
    let target = null, distance = 15;
    for (const entity of engine.chunkManager.getActiveEntities()) {
        if (!(entity instanceof Actor) || entity === seraph || entity === owner || !entity.isActive ||
            entity.state === 'DEAD' || authoritative(entity)) continue;
        const hostile = typeof engine.isHostileActorTarget === 'function' ? engine.isHostileActorTarget(entity)
            : !['Fighter', 'Rogue', 'Wizard', 'Cleric', 'AvengingSeraph'].includes(entity.constructor.name);
        const candidateDistance = Math.hypot(entity.position.x-seraph.position.x, entity.position.z-seraph.position.z);
        if (!hostile || candidateDistance >= distance || clipDungeonEffectSegment(rects, seraph.position, entity.position).blocked) continue;
        target = entity; distance = candidateDistance;
    }
    if (target) {
        seraph.targetPosition = null;
        seraph.velocity.set(0, 0, 0);
        seraph.rotation.setFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.atan2(target.position.x-seraph.position.x, target.position.z-seraph.position.z));
        if (seraph.summonAttackCooldown <= 0) {
            seraph.summonAttackCooldown = 1.5;
            let amount = seraph.summonDamage;
            if (owner.hasLuckyEffect && Math.random() < .1) amount *= 2;
            const hit = rollOfflineCriticalDamage(owner, amount, 'Avenging Seraph');
            amount = Math.floor(hit.amount*(1+Math.max(0, owner.stats.holyDamageBonus || 0))+1e-9);
            target.takeDamage(amount, owner);
            engine.floatingTextManager?.spawn(amount, target.position, hit.critical ? '#ffd166' : '#ffffff');
            seraph.state = 'ATTACKING';
            seraph.playAnimation('Attack', false, true);
            seraph.spawnVisualEffect(engine, target.position, 0xffffff, 'burst');
        }
    } else if (Math.hypot(owner.position.x-seraph.position.x, owner.position.z-seraph.position.z) > 3) {
        seraph.move(owner.position);
    } else {
        seraph.targetPosition = null; seraph.velocity.set(0, 0, 0); seraph.state = 'IDLE';
    }
    return true;
}
