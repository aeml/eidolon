// Credit and reading are server-confirmed; clicking only records short-lived
// intent so a delayed response cannot open a journal on another character.
export function requestChronicleInspection(engine, entity) {
    const player = engine.player;
    if (!engine.isMultiplayer || !player || player.state === 'DEAD' || engine.currentInstanceId || !entity?.isActive || entity.type !== 'ChronicleSite') return false;
    const distance = Math.hypot(player.position.x - entity.position.x, player.position.z - entity.position.z);
    if (!Number.isFinite(distance) || distance > 5) return false;
    engine.pendingChronicleInspection = {
        entityId: entity.id, playerId: player.id, instanceId: '', expiresAt: Date.now() + 5000
    };
    engine.network.send('chronicle_inspect', { entityId: entity.id });
    return true;
}
