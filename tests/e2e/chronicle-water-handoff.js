import { expect } from '@playwright/test';
import { chronicleExpeditions } from '../../src/data/chronicleExpeditions.generated.js';

const firstWaterStep = chronicleExpeditions.find(hunt => hunt.previousQuestId === 'chronicle_03_roots_remember');

// Fresh campaign handoff: the road dispatch precedes the ferry investigation.
// Read only replicated progress; do not accept it or manufacture prerequisites.
export async function verifyFreshWaterHandoff(page) {
    expect(firstWaterStep?.type).toBe('INVESTIGATE');
    await expect.poll(() => page.evaluate(({ id, laterID }) => window.game.player.quests
        .filter(quest => quest.id === id || quest.id === laterID)
        .map(quest => ({ id: quest.id, accepted: quest.accepted, completed: quest.completed, count: quest.count })),
    { id: firstWaterStep.id, laterID: firstWaterStep.beforeQuestId }), {
        message: 'Offer the first Water expedition, without accepting it or skipping ahead to the shelter'
    }).toEqual([{ id: firstWaterStep.id, accepted: false, completed: false, count: 0 }]);
}
