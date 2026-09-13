import { jest } from '@jest/globals';
import * as THREE from 'three';
import fs from 'node:fs';
import { CHRONICLE_WITNESSES } from '../src/data/chronicleWitnesses.js';
import { CHRONICLE_RESTORATIONS } from '../src/core/ChronicleRestoration.js';
import { chronicleInvestigations } from '../src/data/chronicleInvestigations.generated.js';
import { getWitnessConversation } from '../src/ui/ChronicleWitnessConversation.js';
import { ChronicleWitness } from '../src/entities/ChronicleWitness.js';
import { Actor } from '../src/entities/Actor.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { QuestUI } from '../src/ui/QuestUI.js';

test.each(CHRONICLE_WITNESSES)('$name has a shared neutral identity and spoiler-gated dialogue without changing quests', witness => {
    const server = fs.readFileSync('server/internal/game/chronicle_witnesses.go', 'utf8');
    expect(server).toContain(`{"${witness.id}", "${witness.name}", ${witness.x}}`);
    expect(server).toContain(`Z: ${witness.z}`);
    expect(Math.hypot(witness.x, witness.z - 200)).toBeLessThan(50);
    expect(getWitnessConversation(witness.id, []).topics).toHaveLength(1);
    const quests = chronicleInvestigations.filter(chapter => chapter.realm === witness.realm)
        .map(chapter => ({ id: chapter.id, accepted: true, investigationMask: (1 << chapter.sites.length) - 1 }));
    const snapshot = JSON.stringify(quests);
    expect(getWitnessConversation(witness.id, quests).topics).toHaveLength(3);
    expect(JSON.stringify(quests)).toBe(snapshot);
    const receipt = { id: CHRONICLE_RESTORATIONS[witness.realm].questId, count: 1, maxCount: 1 };
    expect(getWitnessConversation(witness.id, [...quests, receipt]).topics).toHaveLength(3);
    receipt.completed = true;
    expect(getWitnessConversation(witness.id, [...quests, receipt]).topics).toHaveLength(4);
    const npc = GameEngine.prototype.createRemotePlayer.call({}, 'NPC', witness.id, 'ChronicleWitness');
    expect(npc).toBeInstanceOf(ChronicleWitness);
    expect(npc).not.toBeInstanceOf(Actor);
    expect(GameEngine.prototype.isInteractableEntity(npc)).toBe(true);
});

test.each(['near', 'far', 'dead', 'instance', 'removed', 'nonfinite'])('physical witness conversation guards: %s', scenario => {
    const npc = new ChronicleWitness(CHRONICLE_WITNESSES[0].id);
    const open = jest.fn(() => true);
    const engine = { player: { position: new THREE.Vector3(0, 0, 4), state: 'IDLE' }, uiManager: { quest: { openWitnessConversation: open } } };
    if (scenario === 'far') engine.player.position.z = 6;
    if (scenario === 'dead') engine.player.state = 'DEAD';
    if (scenario === 'instance') engine.currentInstanceId = 'dungeon';
    if (scenario === 'removed') npc.isActive = false;
    if (scenario === 'nonfinite') engine.player.position.z = NaN;
    expect(npc.interact(engine)).toBe(scenario === 'near');
    expect(open).toHaveBeenCalledTimes(scenario === 'near' ? 1 : 0);
});

test('witness reading survives quest refresh, never offers quest actions, and closes on character change', () => {
    document.body.innerHTML = '<div id="quest-window" style="display:none"><div class="window-header"><span></span></div><div id="quest-list"></div></div>';
    let player = { id: 'reader', state: 'IDLE', quests: [] };
    const ui = new QuestUI({ getLastPlayer: () => player });
    ui.onAcceptQuest = jest.fn(); ui.onCompleteQuest = jest.fn(); ui.onRequestQuests = jest.fn();
    expect(ui.openWitnessConversation(CHRONICLE_WITNESSES[0].id)).toBe(true);
    const topic = ui.questList.querySelector('details');
    topic.open = true;
    ui.updateQuestWindow([]);
    expect(ui.questList.querySelector('details')).toBe(topic);
    expect(topic.open).toBe(true);
    expect(ui.questList.querySelector('[data-quest-action]')).toBeNull();
    expect(ui.onAcceptQuest).not.toHaveBeenCalled();
    expect(ui.onCompleteQuest).not.toHaveBeenCalled();
    expect(ui.onRequestQuests).not.toHaveBeenCalled();
    player = { ...player, id: 'another-reader' };
    ui.updateQuestWindow([]);
    expect(ui.isQuestWindowOpen).toBe(false);
    expect(ui.questList.childElementCount).toBe(0);
    ui.openWitnessConversation(CHRONICLE_WITNESSES[0].id);
    ui.toggleQuestWindow('story');
    expect(ui.witnessId).toBeNull();
    expect(document.querySelector('.window-header span').textContent).toContain('ILYRA');
});
