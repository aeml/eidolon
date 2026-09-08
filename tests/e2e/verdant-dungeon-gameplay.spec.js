import { expect, test } from '@playwright/test';
import { dungeonPlaythroughOptions } from '../dungeonPlaythroughCatalog.js';
import { playDungeonThroughInputs } from './dungeon-playthrough-route.js';
import { prepareDungeonWizard } from './prepared-dungeon-wizard.js';
import { createEarnedWizardDefense } from './earned-wizard-defense.js';
import { prepareEarthChronicleThroughPlay, verifyEarthDungeonChronicleTurnIn } from './chronicle-earth-route.js';
import {
    collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel,
    loginAndEnterWorld, returnToTown
} from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
const fallbackRun = process.env.EIDOLON_E2E_DUNGEON_FALLBACK === '1';
const playthrough = dungeonPlaythroughOptions(process.env);
const fullRun = fallbackRun || process.env.EIDOLON_E2E_FULL_DUNGEON === '1' || playthrough.dungeonType !== 'verdant_bastion_catacombs';
const chronicleEarth = process.env.EIDOLON_E2E_CHRONICLE_EARTH === '1';
if (chronicleEarth && (!fullRun || playthrough.dungeonType !== 'verdant_bastion_catacombs' || process.env.EIDOLON_E2E_REGISTER !== '1')) {
    throw new Error('Earth Chronicle verification requires a full Verdant run with a fresh disposable character');
}

async function prepareFighterSkills(page) {
    if (!await page.evaluate(() => window.game.player.abilityName === 'Charge')) return;
    // A freshly created character has only Charge. Select a normal level-unlocked
    // specialization through the UI so melee QA exercises attacks and damage skills.
    await page.keyboard.press('k');
    const skills = page.locator('#skill-tree-window');
    await expect(skills).toBeVisible();
    await skills.getByRole('button', { name: 'Skills', exact: true }).click();
    const branch = page.locator('.skill-branch').first();
    await expect(branch).toContainText('Shield & Mitigation');
    const select = branch.getByRole('button', { name: 'Select Spec' });
    if (await select.count()) await select.click();
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar?.slice(0, 2)))
        .toEqual(['Whirlwind', 'Shield Slam']);
    if (fullRun) {
        await expect.poll(() => page.evaluate(() => window.game.player.hotbar?.slice(0, 4)))
            .toEqual(['Whirlwind', 'Shield Slam', 'Iron Fortress', 'Guardian Roar']);
        for (const [skill, id, name] of [
            ['Whirlwind', 'whirlwind_bloodwhirl', 'Bloodwhirl'],
            ['Shield Slam', 'shieldslam_fortify', 'Fortify'],
            ['Iron Fortress', 'ironfortress_extended', 'Extended']
        ]) {
            await skills.getByRole('button', { name: 'Runes', exact: true }).click();
            const card = skills.getByText(skill, { exact: true }).locator('..');
            await card.getByText(name, { exact: true }).click();
            await expect.poll(() => page.evaluate(skill => window.game.player.skillRunes?.[skill], skill)).toBe(id);
        }
    }
    await page.locator('#btn-close-skills').click();
    await expect(skills).toBeHidden();
}


test(fullRun ? `${playthrough.name} complete ${fallbackRun ? 'fallback' : 'generated'} run remains playable` : 'Verdant ordinary encounters, first boss, and later spawns remain playable', async ({ page, baseURL }) => {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password, 'Requires a dedicated QA character');
    // Each encounter is bounded independently; the whole route still has a
    // forty-minute ceiling including mobs, traversal and completed-run re-entry.
    test.setTimeout(fullRun ? 2_400_000 : 1_500_000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    await ensureDungeonReadyLevel(page);
    await prepareFighterSkills(page);
    await prepareDungeonWizard(page);
    if (chronicleEarth) await prepareEarthChronicleThroughPlay(page);
    if (fallbackRun) {
        await returnToTown(page);
        const chat = page.locator('#chat-input');
        await chat.click();
        await chat.fill('/qa-dungeon-fallback-next');
        await chat.press('Enter');
        await expect(page.locator('#chat-messages')).toContainText('Next fresh dungeon will use its complete fallback route');
    }
    const beforeCombat = await createEarnedWizardDefense(page);
    await playDungeonThroughInputs(page, { playthrough, fullRun, fallbackRun, useTownGuide: false, beforeCombat });
    if (chronicleEarth) await verifyEarthDungeonChronicleTurnIn(page, credentials);
    expect(failures, failures.join('\n')).toEqual([]);
});
