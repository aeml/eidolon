import * as THREE from 'three';
import { getAbilityAreaRadius } from '../core/AbilityRange.js';

// A Fissure's radius is its forward length; its half-width scales at the same
// rate (base 1.5 / 6). Accepted origin and aim retain the cast's planar heading
// even after the observer receives a newer actor position or private build.
export function resolveEarthshakerFootprint(source, aim, accepted = null) {
    const authoritative = accepted?.shapeResolved === true;
    const phase = authoritative ? accepted.phase || '' : '';
    if (authoritative && (!['', 'aftershock'].includes(phase) ||
        !['circle', 'line'].includes(accepted.shapeKind) ||
        (phase && accepted.shapeKind !== 'circle') ||
        !Number.isFinite(accepted.origin?.x) || !Number.isFinite(accepted.origin?.z) ||
        !Number.isFinite(accepted.targetX) || !Number.isFinite(accepted.targetZ))) return null;
    const base = phase === 'aftershock' ? 3.5 : 6;
    const radius = authoritative ? accepted.radius : getAbilityAreaRadius(source, 'Fighter', base, 'Earthshaker');
    if (!Number.isFinite(radius) || radius < base - 1e-6 || radius > base * 1.35 + 1e-6) return null;
    const origin = authoritative
        ? new THREE.Vector3(accepted.origin.x, source.position?.y || 0, accepted.origin.z)
        : source.position.clone();
    const direction = authoritative ? new THREE.Vector3(accepted.targetX-origin.x, 0, accepted.targetZ-origin.z)
        : new THREE.Vector3((aim?.x ?? origin.x)-origin.x, 0, (aim?.z ?? origin.z)-origin.z);
    if (direction.lengthSq() <= .000001) {
        direction.set(0, 0, 1);
        if (source.mesh?.quaternion) direction.applyQuaternion(source.mesh.quaternion);
        direction.y = 0;
    }
    direction.normalize();
    const shapeKind = authoritative ? accepted.shapeKind : source.skillRunes?.Earthshaker === 'earthshaker_fissure' ? 'line' : 'circle';
    return { origin, direction, radius, halfWidth: shapeKind === 'line' ? radius/4 : 0,
        arc: 2*Math.PI, shapeKind, phase, authoritative };
}

export function spawnEarthshakerPresentation(engine, source, aim, accepted = null, reconcile = false) {
    if (typeof engine?.spawnTransientEffect !== 'function') return false;
    const shape = resolveEarthshakerFootprint(source, aim, accepted);
    if (!shape) return false;
    if (reconcile) {
        const previous = (engine.effects || []).filter(effect => effect.isActive &&
            effect.abilityShape?.sourceId === source.id && effect.abilityShape.skillName === 'Earthshaker' &&
            (effect.abilityShape.phase || '') === shape.phase);
        if (previous.length && previous.every(({ abilityShape: old }) => old.shapeKind === shape.shapeKind &&
            Math.abs(old.radius-shape.radius) < 1e-6 && Math.hypot(old.x-shape.origin.x, old.z-shape.origin.z) < 1e-6 &&
            (shape.shapeKind !== 'line' || Math.hypot(old.directionX-shape.direction.x, old.directionZ-shape.direction.z) < 1e-6))) {
            previous.forEach(effect => { effect.abilityShape.authoritative = true; });
            return true;
        }
        previous.forEach(effect => effect.dispose());
        engine.effects = (engine.effects || []).filter(effect => !previous.includes(effect));
    }
    return engine.spawnTransientEffect('wave', shape.origin, 0xb66b35, { source, abilityName: 'Earthshaker',
        radius: shape.radius, arc: shape.arc, halfWidth: shape.halfWidth, direction: shape.direction,
        shapeKind: shape.shapeKind, phase: shape.phase, authoritativeShape: shape.authoritative });
}
