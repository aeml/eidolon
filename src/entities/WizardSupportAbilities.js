import { Actor } from './Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { getAbilityAoeRadius } from '../skills/abilityRadii.js';

export function getWizardEffectDuration(source, skill, baseSeconds) {
    if (source?.meshType !== 'Wizard' || source.isRemote || source.isMultiplayer || source.gameEngine?.isMultiplayer) return baseSeconds;
    let bonus = 0;
    for (const talent of CONSTANTS.PASSIVE_TALENTS.Wizard) {
        const effect = talent.abilityDuration;
        if (!effect || effect.skill && effect.skill !== skill) continue;
        const raw = Number(source.talentRanks?.[talent.id] || 0);
        const rank = Number.isFinite(raw) ? Math.max(0, Math.min(talent.maxRank, Math.floor(raw))) : 0;
        bonus += effect.duration * rank;
    }
    return Math.min(300, baseSeconds * (1 + bonus));
}

const friendlyClasses = new Set(['Wizard', 'Cleric', 'Fighter', 'Rogue', 'AvengingSeraph']);

export function applyOfflineTimeWarp(source, engine) {
    if (source.isRemote || source.isMultiplayer || engine?.isMultiplayer || source.gameEngine?.isMultiplayer) return;
    const radius = getAbilityAoeRadius('Wizard', 'Time Warp', source);
    const duration = getWizardEffectDuration(source, 'Time Warp', 8);
    // Snapshot before recalculation; the actual equipped set owns this effect.
    const zoneWide = Object.values(source.activeSetBonuses || {}).some(set => set.specials?.timeWarpZone > 0);
    for (const target of new Set([source, ...(engine?.chunkManager?.getActiveEntities() || [])])) {
        if (!(target instanceof Actor) || !target.isActive || target.state === 'DEAD' || target.isRemote ||
            target.isMultiplayer || target.gameEngine?.isMultiplayer) continue;
        if (engine?.currentInstanceId && target.gameEngine?.currentInstanceId &&
            engine.currentInstanceId !== target.gameEngine.currentInstanceId) continue;
        const hostile = target !== source && (typeof engine?.isHostileActorTarget === 'function'
            ? engine.isHostileActorTarget(target) : !friendlyClasses.has(target.constructor.name));
        if (hostile) continue;
        const distance = Math.hypot(target.position.x - source.position.x, target.position.z - source.position.z);
        // Friendly circular support intentionally crosses walls, as on server.
        if (!zoneWide && distance > radius + (target.radius || 0)) continue;
        target.hasteTimer = duration;
        target.hasteFactor = .5;
        target.recalculateStats();
        engine?.floatingTextManager?.spawn('TIME WARP!', target.position, '#ffd700');
    }
}
