import { AvengingSeraph } from '../entities/AvengingSeraph.js';
import { getAbilityPresentation, isAbilityVisualLayerEnabled } from './abilityVisualManifest.js';
import { getAbilityAoeArc, getAbilityAoeRadius, isAoeBoundaryVisualType } from './abilityRadii.js';

const CLASS_FALLBACKS = Object.freeze({
    Fighter: Object.freeze({ color: 0xffaa55, type: 'wave' }),
    Rogue: Object.freeze({ color: 0xaaaaaa, type: 'smoke' }),
    Wizard: Object.freeze({ color: 0x66bbff, type: 'ring' }),
    Cleric: Object.freeze({ color: 0xffff99, type: 'buff' })
});

function resolvePosition(entity, targetPos, anchor) {
    if (anchor === 'target' && targetPos &&
        Number.isFinite(targetPos.x) && Number.isFinite(targetPos.z)) {
        return targetPos.clone ? targetPos.clone() : targetPos;
    }
    return entity.position?.clone ? entity.position.clone() : entity.position;
}

export function resolveRemoteSkillVisual(entity, skillName, targetPos) {
    const className = entity?.constructor?.name || entity?.meshType || entity?.subType || '';

    if (entity instanceof AvengingSeraph && skillName === 'Smite') {
        return {
            color: 0xffff00,
            type: 'impact',
            origin: resolvePosition(entity, targetPos, 'target')
        };
    }

    const presentation = getAbilityPresentation(className, skillName);
    if (!presentation) {
        const fallback = CLASS_FALLBACKS[className] || { color: 0xffffff, type: 'impact' };
        return {
            ...fallback,
            origin: resolvePosition(entity, targetPos, 'source'),
            fallback: true
        };
    }

    const gameplayRadius = getAbilityAoeRadius(className, skillName, entity)
        ?? getAbilityAoeRadius(className, presentation.canonicalName, entity);
    const gameplayArc = getAbilityAoeArc(className, skillName)
        ?? getAbilityAoeArc(className, presentation.canonicalName);
    const layers = presentation.layers
        .filter((entry) => isAbilityVisualLayerEnabled(entry, entity, presentation.canonicalName))
        .map((entry) => ({
        color: entry.color,
        type: entry.type,
        origin: resolvePosition(entity, targetPos, entry.anchor),
        ...(gameplayRadius && isAoeBoundaryVisualType(entry.type)
            ? { radius: gameplayRadius, ...(gameplayArc ? { arc: gameplayArc } : {}) }
            : {})
        }));

    if (layers.length === 1) return layers[0];
    return { layers };
}
