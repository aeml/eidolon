import { expect } from '@playwright/test';

// Auto-chase or loot travel can cross back into sanctuary during an encounter.
// Leave through ordinary input before attacking; do not reset the caller's
// combat deadline or turn off the authoritative protection/healing rules.
export async function leaveEarnedCombatSafety(page, leaveTown) {
    const state = await page.evaluate(() => ({ zone: window.game.player.safeZoneId,
        dead: window.game.player.state === 'DEAD' }));
    if (!state.zone || state.dead) return false;
    expect(typeof leaveTown, 'Safe-zone combat recovery requires normal travel').toBe('function');
    await leaveTown();
    await expect.poll(() => page.evaluate(() => window.game.player.safeZoneId)).toBe('');
    return true;
}
