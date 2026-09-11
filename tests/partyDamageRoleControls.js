import { acquirePartyAllyPointer } from './partyDungeonControls.js';

// The same hitbox/hover acquisition works for hostiles and allies. Projection
// alone is not target acquisition: another actor or loot may cover the point.
// Hooks only read game state and issue normal pointer input. In particular,
// never assign hoveredEntity or bypass the game's attack/cast admission.
export async function attackPartyDamageTarget(input, targetId) {
    const clicks = [];
    const valid = state => state?.alive && state.allowCasts &&
        Number.isFinite(state.distance) && Number.isFinite(state.range);
    if (!await acquirePartyAllyPointer(input, targetId)) return clicks;
    let state = await input.read(targetId);
    if (!valid(state)) return clicks;
    if (state.allowApproach) {
        await input.click('left');
        clicks.push('left');
        // The first input can move either actor or start a new warning. Recheck
        // the actual target and its current range before the second input.
        if (await input.hoveredId() !== targetId) return clicks;
        state = await input.read(targetId);
    }
    if (valid(state) && state.distance <= state.range && state.cooldown <= 0) {
        await input.click('right');
        clicks.push('right');
    }
    return clicks;
}

// Choose legal self-buff inputs from the actual loadout/resources. This does
// not grant skills or stats, and never spends mana during travel/out-of-range.
export function selectPartyDamageBuff(state) {
    if (state.dead || !Number.isFinite(state.distance) || state.distance > state.range ||
        !Number.isFinite(state.mana) || state.sinceCastMs < 550) return null;
    const skill = state.className === 'Wizard' && state.healthRatio < .9 && !state.shieldActive
        ? 'Arcane Shield' : state.className === 'Rogue' && !state.poisonActive ? 'Poison Coating' : null;
    const slot = state.hotbar?.indexOf(skill) ?? -1;
    const cost = state.costs?.[skill];
    if (!skill || slot < 0 || slot > 3 || !state.unlockedSkills?.includes(skill) ||
        (state.cooldowns?.[skill] || 0) > 0 || !Number.isFinite(cost) || cost < 0 || state.mana < cost) return null;
    return { skill, key: String(slot + 1) };
}

// Client-observed timing is diagnostic, not authoritative proof of a dodge.
// Retain the latest position as well as the first early escape so re-entering
// the danger area cannot be disguised by an earlier successful movement.
export function observePartyWarning(warning, position, now) {
    const safe = Math.hypot(position.x - warning.x, position.z - warning.z) >= warning.radius + 1.5;
    const enteredDanger = warning.enteredDanger || !safe;
    const firstSafeAt = warning.firstSafeAt ??
        (enteredDanger && safe && now < warning.expires ? now : null);
    return { ...warning, safe, enteredDanger, firstSafeAt, lastObservedAt: now };
}
