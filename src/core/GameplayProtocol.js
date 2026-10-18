// Capability boundary for stationary casts and authoritative roof movement.
// Keep this independent of release numbers: compatible patches may reconnect.
export const GAMEPLAY_PROTOCOL = 'stationary-actions-roofs-v1';
export const GAME_UPDATE_MESSAGE = 'The game has been updated. Reload this page to continue with your saved character.';

export function acceptsGameplayProtocol(payload) {
    return payload?.gameplayProtocol === GAMEPLAY_PROTOCOL;
}
