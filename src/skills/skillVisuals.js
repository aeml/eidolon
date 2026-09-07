import { AvengingSeraph } from '../entities/AvengingSeraph.js';
import { getAbilityPresentation, isAbilityVisualLayerEnabled } from './abilityVisualManifest.js';
import { getAbilityAoeArc, getAbilityAoeRadius, isAoeBoundaryVisualType, SELF_CENTERED_SHAPE_ABILITIES } from './abilityRadii.js';

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

export function resolveRemoteSkillVisual(entity, skillName, targetPos, shape = {}) {
    const className = entity?.meshType || entity?.subType || entity?.constructor?.name || '';

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

    const resolvedHealing = skillName === 'Healing Light' && (shape.shapeResolved || Number.isFinite(shape.radius));
    const gameplayRadius = resolvedHealing ? (shape.radius > 0 ? shape.radius : null) : Number.isFinite(shape.radius) && shape.radius > 0 ? shape.radius
        : (getAbilityAoeRadius(className, skillName, entity) ?? getAbilityAoeRadius(className, presentation.canonicalName, entity));
    const gameplayArc = Number.isFinite(shape.arc) && shape.arc > 0 && shape.arc <= 2 * Math.PI ? shape.arc
        : (getAbilityAoeArc(className, skillName, entity) ?? getAbilityAoeArc(className, presentation.canonicalName, entity));
    const layers = presentation.layers
        .filter((entry) => resolvedHealing && entry.runeOnly === 'healinglight_beacon'
            ? gameplayRadius > 0 : isAbilityVisualLayerEnabled(entry, entity, presentation.canonicalName))
        .map((entry) => ({
        color: entry.color,
        type: entry.type,
        // A self-centered cleanse is fixed at its accepted cast point, not at
        // the observer's newer interpolated actor position.
        origin: resolvePosition(entity, targetPos, SELF_CENTERED_SHAPE_ABILITIES.has(skillName) && Number.isFinite(shape.radius) && shape.radius > 0 ? 'target' : entry.anchor),
        ...(gameplayRadius && isAoeBoundaryVisualType(entry.type)
            ? { radius: gameplayRadius, ...(gameplayArc ? { arc: gameplayArc } : {}) }
            : {})
        }));

    if (layers.length === 1) return layers[0];
    return { layers };
}
