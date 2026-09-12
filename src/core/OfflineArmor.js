function isOffline(actor) {
    return actor && !actor.isRemote && !actor.isMultiplayer && !actor.gameEngine?.isMultiplayer;
}

// Keep equipment armor intact: repeated hits refresh one flat reduction rather
// than subtracting from a mutable stat that recalculation can replace.
export function applyOfflineArmorMelt(target, duration) {
    if (!isOffline(target) || target.state === 'DEAD' || target.isActive === false ||
        !(duration > 0) || !Number.isFinite(duration)) return false;
    target.armorReduction = 5;
    target.armorReductionTimer = duration;
    return true;
}

export function getOfflineEffectiveArmor(target) {
    const raw = Number(target?.stats?.defense);
    const defense = Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0;
    const reduction = isOffline(target) && target.armorReductionTimer > 0 ? Number(target.armorReduction) : 0;
    return Math.max(0, defense - (Number.isFinite(reduction) ? Math.max(0, Math.trunc(reduction)) : 0));
}

// Same basic-attack armor penetration as combat_attack.go. This is not a
// universal spell mitigation rule: Backstab owns its separate rune ordering.
const HALF_ARMOR_ATTACKERS = new Set([
    'InfernoTitan', 'Siren', 'FrostGuardian', 'MountainTroll', 'AquaGolem',
    'RootboundWarden', 'BriarMatron', 'RustboundColossus', 'HollowSentinel',
    'AvengingSeraph', 'Avenging Seraph'
]);

export function getOfflineBasicAttackArmor(source, target) {
    const armor = getOfflineEffectiveArmor(target);
    const type = source?.meshType || source?.subType || source?.constructor?.name;
    return HALF_ARMOR_ATTACKERS.has(type) ? Math.trunc(armor / 2) : armor;
}
