import { AUTHORITATIVE_SHAPE_ABILITIES } from './abilityRadii.js';

// Shared ownership/footprint metadata used when accepting a local prediction.
// Keep effect construction in GameEngine and shape comparison in each consumer.
export function attachAbilityShapeMetadata(effect, position, options) {
    if (!AUTHORITATIVE_SHAPE_ABILITIES.has(options.abilityName) || !Number.isFinite(options.radius)) return;
    effect.abilityShape = { sourceId: options.source?.id, skillName: options.abilityName, x: position.x, z: position.z,
        radius: options.radius, arc: options.arc, authoritative: Boolean(options.authoritativeShape) };
    if (options.abilityName === 'Earthshaker') Object.assign(effect.abilityShape, {
        shapeKind: options.shapeKind, phase: options.phase || '',
        directionX: options.direction?.x, directionZ: options.direction?.z });
}
