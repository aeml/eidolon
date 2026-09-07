import { jest } from '@jest/globals';
import { GameEngine } from '../src/core/GameEngine.js';

test.each(['valid', 'other_character', 'other_scene', 'expired', 'other_site', 'dead', 'unsolicited'])('discovery acknowledgement respects active reading intent: %s', scenario => {
    const engine = Object.create(GameEngine.prototype);
    engine.player = { id: 'reader', state: 'IDLE' };
    engine.currentInstanceId = '';
    engine.uiManager = { quest: { openChronicleDiscovery: jest.fn() } };
    engine.pendingChronicleInspection = { playerId: 'reader', instanceId: '', entityId: 'chronicle-site-mara_diary', expiresAt: Date.now() + 5000 };
    if (scenario === 'other_character') engine.player.id = 'different-reader';
    if (scenario === 'other_scene') engine.currentInstanceId = 'dungeon';
    if (scenario === 'expired') engine.pendingChronicleInspection.expiresAt = Date.now() - 1;
    if (scenario === 'other_site') engine.pendingChronicleInspection.entityId = 'chronicle-site-dain_ledger';
    if (scenario === 'dead') engine.player.state = 'DEAD';
    if (scenario === 'unsolicited') engine.pendingChronicleInspection = null;
    const receipt = { questId: 'chronicle_earth_keepers_house', siteId: 'mara_diary', recorded: true };
    engine.handleServerMessage({ type: 'chronicle_discovery', payload: receipt });
    expect(engine.uiManager.quest.openChronicleDiscovery).toHaveBeenCalledTimes(scenario === 'valid' ? 1 : 0);
    expect(engine.pendingChronicleInspection).toBeNull();
});
