import fs from 'node:fs';
import { QuestUI } from '../src/ui/QuestUI.js';

describe('first-dungeon preparation guidance', () => {
    test('the current Help guide agrees with the dungeon family requirements', () => {
        const doc = new DOMParser().parseFromString(fs.readFileSync('index.html', 'utf8'), 'text/html');
        const help = doc.getElementById('help-screen').textContent;
        expect(help).not.toContain('unlocks all base dungeons');
        expect(help).toContain('Level 30 unlocks Verdant Bastion Catacombs');
    });
    test('town guidance does not claim that every dungeon unlocks at 30', () => {
        const ui = new QuestUI({
            getLastPlayer: () => ({ level: 36, quests: [], position: { x: 0, z: 200 } }),
            getCurrentInstanceType: () => 'overworld'
        });
        const objective = ui.buildTownProgressionObjective([]);
        expect(objective.hint).not.toContain('all base dungeons');
        expect(objective.hint).toContain('Verdant Bastion');
    });

});
