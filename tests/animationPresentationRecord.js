// Serialized into the browser. Teleport intentionally suppresses local endpoint
// VFX until the server accepts/clips its landing; it uses the authoritative
// presentation path even for the owner. Never fall back to speculative VFX.
export function readAnimationPresentation(skillName) {
    const player = window.game?.player;
    return (skillName === 'Teleport'
        ? player?.lastRemoteAbilityPresentation
        : player?.lastAbilityPresentation) || null;
}
