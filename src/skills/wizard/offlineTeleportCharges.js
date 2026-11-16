// Consume only after ordinary offline Teleport admission and landing. Both
// casts cost mana; the equipped set defers cooldown until the spare is spent.
export function commitOfflineTeleportCharge(source, engine, legacyPrimary = false) {
    if (source.isRemote || source.isMultiplayer || source.gameEngine?.isMultiplayer || engine?.isMultiplayer) return;
    const equipped = Object.values(source.activeSetBonuses || {}).some(set => set.specials?.teleportCharges > 0);
    if (!equipped) return;
    if (!(source.offlineTeleportChargeTimer > 0)) source.offlineTeleportCharges = 2;
    source.offlineTeleportCharges = Math.max(0, (source.offlineTeleportCharges || 0) - 1);
    // Use the already-committed trained/set-adjusted cooldown, never apply CDR
    // twice. As on the server, either cast restarts the full-pair recharge.
    source.offlineTeleportChargeTimer = source.cooldowns.Teleport;
    if (source.offlineTeleportCharges > 0) {
        source.cooldowns.Teleport = 0;
        if (legacyPrimary) source.abilityCooldown = 0;
    }
}
