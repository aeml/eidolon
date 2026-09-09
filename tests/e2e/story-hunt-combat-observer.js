export async function installStoryHuntCombatObserver(page) {
    await page.evaluate(async () => {
        const { createEarnedCombatEvidence, recordEarnedCombatMessage } = await import('/tests/earnedCombatEvidence.js');
        window.__storyHuntCombatEvidence = createEarnedCombatEvidence();
        if (window.__storyHuntCombatObserverInstalled) return;
        window.__storyHuntCombatObserverInstalled = true;
        const game = window.game, original = game.handleServerMessage.bind(game);
        game.handleServerMessage = message => {
            if (game.player?.id) recordEarnedCombatMessage(window.__storyHuntCombatEvidence, message, game.player.id, Date.now());
            return original(message);
        };
    });
}

export async function readStoryHuntCombatEvidence(page) {
    return page.evaluate(() => window.__storyHuntCombatEvidence || null);
}
