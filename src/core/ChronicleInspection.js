// Credit and reading are server-confirmed; clicking only records short-lived
// intent so a delayed response cannot open a journal on another character.
import { getRecordedChronicleDiscoveries } from './ChronicleInvestigation.js';

// A deliberate keyboard inspection is independent of combat raycast priority.
// Only nearby, accepted story evidence is eligible; it still needs the normal
// server acknowledgement and never grants credit or completes a quest locally.
export function requestNearbyChronicleInspection(engine) {
    const player = engine.player;
    if (!player || engine.uiManager?.isEscMenuOpen || engine.uiManager?.isPatchNotesOpen || engine.uiManager?.isHelpOpen) return false;
    const candidates = [];
    for (const entity of engine.chunkManager?.getActiveEntities?.() || []) {
        if (!entity?.isActive || entity.type !== 'ChronicleSite' || !entity.discovery) continue;
        const { chapter, site } = entity.discovery;
        const quest = player.quests?.find(value => value.id === chapter.id);
        if (!quest?.accepted || quest.completed) continue;
        const recorded = getRecordedChronicleDiscoveries(quest);
        if (site.requires && !recorded.some(value => value.id === site.requires)) continue;
        const distance = Math.hypot(player.position.x - entity.position.x, player.position.z - entity.position.z);
        if (!Number.isFinite(distance) || distance > 5) continue;
        candidates.push({ entity, distance, recorded: recorded.some(value => value.id === site.id) });
    }
    candidates.sort((a, b) => Number(a.recorded) - Number(b.recorded) || a.distance - b.distance || a.entity.id.localeCompare(b.entity.id));
    return candidates.length ? requestChronicleInspection(engine, candidates[0].entity) : false;
}

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
