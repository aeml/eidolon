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

// Read-only strategy for earned-route QA. It chooses ordinary inputs, never
// grants progress, changes positions or relaxes the hunt's death bound.
export function planWizardHuntStep(state) {
    if (state.className !== 'Wizard' || state.dead || !state.threats?.length) return null;
    const threats = state.threats.map(enemy => ({ ...enemy,
        distance: Math.hypot(state.x - enemy.x, state.z - enemy.z) })).sort((a, b) => a.distance - b.distance);
    const nearest = threats[0];
    const shieldIndex = (state.hotbar || []).indexOf('Arcane Shield');
    if (nearest.distance < 9 && state.healthRatio < 0.8 && state.shieldHP <= 0 &&
        shieldIndex >= 0 && shieldIndex < 4 && state.unlockedSkills?.includes('Arcane Shield') && state.mana >= state.shieldCost &&
        (state.cooldowns?.['Arcane Shield'] || 0) <= 0 && state.sinceCastMs >= 550) {
        return { action: 'shield', key: String(shieldIndex + 1) };
    }
    if (nearest.distance >= 6) return null;
    const angle = Math.atan2(state.z - nearest.z, state.x - nearest.x);
    const inDungeon = state.walkRects?.length > 0;
    // Dungeon corners can require turning back toward the room interior. Retain
    // the open-world strategy, but reject full paths through walls in instances.
    const offsets = inDungeon || state.canRetreat ? Array.from({ length: 16 }, (_, i) => i * Math.PI / 8)
        : [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2];
    const radius = Number.isFinite(state.radius) ? state.radius : 1.25;
    const floors = inDungeon ? state.walkRects.map(rect => ({ ...rect,
        width: rect.width - 2 * radius, height: rect.height - 2 * radius })) : null;
    const options = offsets.map(offset => {
        const x = Math.cos(angle + offset) * 9, z = Math.sin(angle + offset) * 9;
        const clearance = Math.min(...threats.map(enemy => Math.hypot(state.x + x - enemy.x, state.z + z - enemy.z)));
        return { x, z, clearance };
    }).filter(option => !inDungeon || !clipDungeonEffectSegment(floors, state,
        { x: state.x + option.x, z: state.z + option.z }).blocked)
        .filter(option => !state.canRetreat || state.canRetreat(option))
        .sort((a, b) => b.clearance - a.clearance);
    // A constrained player may need to keep fighting; do not invent a successful
    // retreat or require a ground click into a wall. Combat watchdogs still apply.
    if (!options.length) return null;
    return { action: 'retreat', x: options[0].x, z: options[0].z };
}
