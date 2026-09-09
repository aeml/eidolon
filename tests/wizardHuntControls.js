import { clipDungeonEffectSegment } from '../src/skills/dungeonEffectGeometry.js';

// Query detached positions along the entire ordinary walking path. An endpoint
// beyond a town wall is not evidence that a ground-click retreat can reach it.
export function isEarnedRetreatPathClear(manager, position, radius, delta) {
    const steps = Math.ceil(Math.hypot(delta.x, delta.z) / .25);
    let previous = position.clone();
    for (let step = 1; step <= steps; step++) {
        const point = position.clone();
        point.x += delta.x * step / steps;
        point.z += delta.z * step / steps;
        const corrected = manager.checkCollision(point, radius, previous);
        if (corrected && corrected.distanceTo(point) > .00001) return false;
        previous = point;
    }
    return true;
}

export function retreatCrossesActorBody(state, delta) {
    const lengthSquared = delta.x * delta.x + delta.z * delta.z;
    if (lengthSquared <= 0) return false;
    return (state.threats || []).some(enemy => {
        const offsetX = enemy.x - state.x, offsetZ = enemy.z - state.z;
        const t = Math.max(0, Math.min(1, (offsetX * delta.x + offsetZ * delta.z) / lengthSquared));
        return Math.hypot(offsetX - t * delta.x, offsetZ - t * delta.z) <
            (state.radius || 1.25) + (enemy.radius || 1.25);
    });
}

// Traveling through a realm is not an instruction to clear every spawn along
// the road. Use the real shield when needed, fight only to recover from danger,
// and otherwise continue toward the waypoint. Site combat retains its own plan.
export function planWizardTravelDefense(state) {
    if (state.className !== 'Wizard' || state.dead || !state.threats?.length) return null;
    const defensive = planWizardHuntStep(state);
    if (defensive?.action === 'shield') return defensive;
    return state.healthRatio < .35 ? { action: 'fight' } : null;
}

// Optional full-kit strategy for prepared investigation fixtures. Ordinary
// fresh-hunt baselines keep their existing shield/retreat-only strategy.
export function planWizardCrowdControl(state) {
    const slot = state.hotbar?.indexOf('Gravity Well') ?? -1;
    if (state.className !== 'Wizard' || state.dead || slot < 0 || slot > 3 ||
        !state.unlockedSkills?.includes('Gravity Well') || state.mana < state.wellCost ||
        (state.cooldowns?.['Gravity Well'] || 0) > 0 || state.sinceCastMs < 550) return null;
    const nearby = (state.threats || []).filter(enemy => Math.hypot(enemy.x - state.x, enemy.z - state.z) <= 12);
    const groups = nearby.map(center => nearby.filter(enemy => Math.hypot(enemy.x - center.x, enemy.z - center.z) <= 6));
    groups.sort((a, b) => b.length - a.length);
    const group = groups[0];
    if (!group || group.length < 3) return null;
    return { action: 'gravity-well', key: String(slot + 1),
        x: group.reduce((total, enemy) => total + enemy.x, 0) / group.length - state.x,
        z: group.reduce((total, enemy) => total + enemy.z, 0) / group.length - state.z };
}

// Read-only strategy for earned-route QA. It chooses ordinary inputs, never
// grants progress, changes positions or relaxes the hunt's death bound.
export function planWizardHuntStep(state) {
    return state.className === 'Wizard' ? planRangedHuntStep(state) : null;
}

export function planRangedHuntStep(state) {
    if (!['Wizard', 'Rogue'].includes(state.className) || state.dead || !state.threats?.length) return null;
    const threats = state.threats.map(enemy => ({ ...enemy,
        meleeReach: Number.isFinite(enemy.meleeReach) ? Math.max(3, enemy.meleeReach) : 3,
        distance: Math.hypot(state.x - enemy.x, state.z - enemy.z) }))
        .sort((a, b) => (a.distance - a.meleeReach) - (b.distance - b.meleeReach));
    const nearest = threats[0];
    const clearance = nearest.distance - nearest.meleeReach;
    const shieldIndex = (state.hotbar || []).indexOf('Arcane Shield');
    if (state.className === 'Wizard' && clearance < 6 && state.healthRatio < 0.8 && state.shieldHP <= 0 &&
        shieldIndex >= 0 && shieldIndex < 4 && state.unlockedSkills?.includes('Arcane Shield') && state.mana >= state.shieldCost &&
        (state.cooldowns?.['Arcane Shield'] || 0) <= 0 && state.sinceCastMs >= 550) {
        return { action: 'shield', key: String(shieldIndex + 1) };
    }
    if (clearance >= 3) return null;
    // Optional collection strategy: healthy characters can trade ordinary hits
    // instead of continuously dragging the pack into unrelated stronger areas.
    // Existing hunt/dungeon callers retain their unconditional spacing policy.
    if (Number.isFinite(state.retreatBelowHealthRatio) &&
        state.healthRatio >= state.retreatBelowHealthRatio) return null;
    const angle = Math.atan2(state.z - nearest.z, state.x - nearest.x);
    const inDungeon = state.walkRects?.length > 0;
    const encounter = state.encounter;
    // Dungeon corners can require turning back toward the room interior. Retain
    // the open-world strategy, but reject full paths through walls in instances.
    const offsets = inDungeon || encounter || state.canRetreat ? Array.from({ length: 16 }, (_, i) => i * Math.PI / 8)
        : [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2];
    const radius = Number.isFinite(state.radius) ? state.radius : 1.25;
    const floors = inDungeon ? state.walkRects.map(rect => ({ ...rect,
        width: rect.width - 2 * radius, height: rect.height - 2 * radius })) : null;
    const options = offsets.map(offset => {
        const x = Math.cos(angle + offset) * 9, z = Math.sin(angle + offset) * 9;
        const clearance = Math.min(...threats.map(enemy =>
            Math.hypot(state.x + x - enemy.x, state.z + z - enemy.z) - enemy.meleeReach));
        return { x, z, clearance };
    }).filter(option => !encounter || Math.hypot(state.x + option.x - encounter.x,
        state.z + option.z - encounter.z) <= encounter.radius)
        .filter(option => !inDungeon || !clipDungeonEffectSegment(floors, state,
        { x: state.x + option.x, z: state.z + option.z }).blocked)
        .filter(option => !state.canRetreat || state.canRetreat(option))
        .sort((a, b) => b.clearance - a.clearance);
    // A constrained player may need to keep fighting; do not invent a successful
    // retreat or require a ground click into a wall. Combat watchdogs still apply.
    if (!options.length) return null;
    return { action: 'retreat', x: options[0].x, z: options[0].z,
        ...(state.canJump && retreatCrossesActorBody(state, options[0]) ? { useJump: true } : {}) };
}
