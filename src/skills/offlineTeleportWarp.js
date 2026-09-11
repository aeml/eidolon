import { Actor } from '../entities/Actor.js';
import { CONSTANTS } from '../core/Constants.js';
import { getWizardAbilityAreaRadius } from '../core/AbilityRange.js';
import { applyOfflineAbilityHit } from '../core/AbilityCritical.js';
import { clipDungeonEffectSegment } from './dungeonEffectGeometry.js';

const authoritative = (source, engine) => source.isRemote || source.isMultiplayer ||
    source.gameEngine?.isMultiplayer || engine?.isMultiplayer;

export function snapshotOfflineTeleportWarp(source, engine) {
    if (authoritative(source, engine) || source.skillRunes?.Teleport !== 'teleport_warp') return null;
    const talent = CONSTANTS.PASSIVE_TALENTS.Wizard.find(t => t.id === 'WIZ_19');
    const raw = Number(source.talentRanks?.[talent.id] || 0);
    const rank = Number.isFinite(raw) ? Math.max(0, Math.min(talent.maxRank, Math.floor(raw))) : 0;
    return {
        // Utility Teleport preserves Focus; its rune must not borrow that boost.
        damage: Math.floor((15 + source.stats.intelligence) * (1 + rank * talent.abilityDamage.damage) + 1e-9),
        radius: getWizardAbilityAreaRadius(source, 4),
        rects: engine.currentInstanceId && engine.currentInstanceType !== 'overworld'
            ? engine.currentDungeonLayout?.walkRects : null
    };
}

export function applyOfflineTeleportWarp(source, origin, engine, profile) {
    if (!profile || authoritative(source, engine)) return;
    for (const target of new Set(engine.chunkManager?.getActiveEntities() || [])) {
        if (target === source || !(target instanceof Actor) || !target.isActive || target.state === 'DEAD' ||
            target.isRemote || target.isMultiplayer || target.gameEngine?.isMultiplayer) continue;
        if (engine.currentInstanceId && target.gameEngine?.currentInstanceId &&
            engine.currentInstanceId !== target.gameEngine.currentInstanceId) continue;
        if (!engine.isHostileActorTarget?.(target)) continue;
        const body = Number.isFinite(target.radius) ? Math.max(0, target.radius) : 0;
        if (Math.hypot(target.position.x - origin.x, target.position.z - origin.z) > profile.radius + body ||
            clipDungeonEffectSegment(profile.rects, origin, target.position).blocked) continue;
        applyOfflineAbilityHit(source, target, profile.damage, 'Teleport', engine.floatingTextManager, '#88ddff');
    }
}
