import { expect } from '@playwright/test';
import { chronicleHunts } from '../../src/data/chronicleHunts.generated.js';

const firstWaterHunt = chronicleHunts.find(hunt => hunt.previousQuestId === 'chronicle_03_roots_remember');

// Fresh campaign handoff: the ferry expedition precedes the flood shelter.
// Read only replicated progress; do not accept it or manufacture prerequisites.
export async function verifyFreshWaterHandoff(page) {
    expect(firstWaterHunt?.realm).toBe('water');
    await expect.poll(() => page.evaluate(({ id, laterID }) => window.game.player.quests
        .filter(quest => quest.id === id || quest.id === laterID)
        .map(quest => ({ id: quest.id, accepted: quest.accepted, completed: quest.completed, count: quest.count })),
    { id: firstWaterHunt.id, laterID: firstWaterHunt.beforeQuestId }), {
        message: 'Offer the first Water expedition, without accepting it or skipping ahead to the shelter'
    }).toEqual([{ id: firstWaterHunt.id, accepted: false, completed: false, count: 0 }]);
}
