import { expect } from '@playwright/test';
import { dungeonPlaythroughOptions } from '../dungeonPlaythroughCatalog.js';
import { EARTH_DUNGEON_CHAPTER, readChronicleChapter, verifyEarthDungeonChronicleTurnIn } from './chronicle-earth-route.js';
import { playDungeonThroughInputs } from './dungeon-playthrough-route.js';
import { createEarnedDungeonCombat } from './earned-dungeon-combat.js';
import { earnedFighterPreparationBudget } from '../earnedPreparationPolicy.js';
import { readPlayerState } from './helpers.js';
import { upgradeEarnedEquipment, readEarnedGear } from './earned-equipment-upgrades.js';
import { earnedTownRecoveryEnabled } from '../earnedRecoveryPolicy.js';

// Called only after the no-grants opening/collection/contracts route. Never use
// the prepared dungeon spec's level grant, encounter waypoint or rune setup.
export async function clearEarnedVerdant(page, credentials, { runPhase = (_id, body) => body() } = {}) {
    const player = await readPlayerState(page);
    expect(player.level).toBeGreaterThanOrEqual(30);
    expect(player.state).not.toBe('DEAD');
    const className = await page.evaluate(() => window.game.player.constructor.name);
    expect(['Wizard', 'Fighter', 'Rogue', 'Cleric']).toContain(className);
    const chapter = await readChronicleChapter(page, EARTH_DUNGEON_CHAPTER);
    expect(chapter?.accepted).toBe(true);
    expect(chapter?.completed).toBe(false);
    expect(chapter?.count).toBe(0);
    await page.locator('#btn-close-dungeon-menu').click();
    await upgradeEarnedEquipment(page);
    const gear = await readEarnedGear(page);
    const beforeCombat = await createEarnedDungeonCombat(page, className);
    const started = Date.now();
    console.log(`[fresh-dungeon] earned entry ${JSON.stringify({ level: player.level,
        health: (await readPlayerState(page)).health, equipment: gear.equipment,
        runLevel: 30, difficulty: 'normal' })}`);
    await runPhase('dungeon', () => playDungeonThroughInputs(page, {
        playthrough: dungeonPlaythroughOptions({}), fullRun: true, fallbackRun: false,
        useTownGuide: true, beforeCombat, recoverBetweenRooms: earnedTownRecoveryEnabled(),
        ...(className === 'Fighter' ? { requiredFighterSkills: earnedFighterPreparationBudget({
            level: player.level, statPoints: 0, talentPoints: 0 }).expectedSkills } : {})
    }));
    await runPhase('dungeon-turn-in', async () => {
        const defense = await page.evaluate(() => ({
            movement: window.__freshFighterCombat?.counts || window.__freshWizardDefense?.counts,
            casts: window.__earnedDungeonCasts || null
        }));
        await verifyEarthDungeonChronicleTurnIn(page, credentials);
        const rewarded = await readChronicleChapter(page, EARTH_DUNGEON_CHAPTER);
        expect(rewarded.grantedGold).toBeGreaterThan(0);
        expect((rewarded.grantedXP || 0) + (rewarded.grantedResonanceXP || 0)).toBeGreaterThan(0);
        console.log(`[fresh-dungeon] complete ${JSON.stringify({ entryLevel: player.level,
            earnedLevel: (await readPlayerState(page)).level, defense,
            grantedGold: rewarded.grantedGold, grantedXP: rewarded.grantedXP,
            grantedResonanceXP: rewarded.grantedResonanceXP,
            seconds: Math.round((Date.now() - started) / 1000) })}`);
    });
}
