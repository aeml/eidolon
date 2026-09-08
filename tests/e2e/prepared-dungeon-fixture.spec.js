import { expect, test } from '@playwright/test';
import { initializePreparedDungeonFixture } from './prepared-dungeon-fixture.js';
import { prepareDungeonWizard } from './prepared-dungeon-wizard.js';
import { credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test('prepared dungeon setup restores only its starting fixture and retains equipped runes on reuse', async ({ page }) => {
    test.setTimeout(180_000);
    await loginAndEnterWorld(page, credentialsFromEnvironment());
    expect(await page.evaluate(() => window.game.player.constructor.name)).toBe('Wizard');
    await initializePreparedDungeonFixture(page);
    await prepareDungeonWizard(page);
    const build = () => page.evaluate(() => ({ ranks: { ...window.game.player.talentRanks },
        rune: window.game.player.skillRunes.Fireball, points: window.game.player.talentPoints }));
    const trained = await build();
    expect(trained.rune).toBe('fireball_empowered');
    const mana = await page.evaluate(() => window.game.player.stats.mana);
    await page.mouse.click(640, 300, { button: 'right' });
    await expect.poll(() => page.evaluate(() => window.game.player.stats.mana)).toBeLessThan(mana);
    const depleted = await page.evaluate(() => window.game.player.stats.mana);
    await initializePreparedDungeonFixture(page);
    expect(await page.evaluate(() => window.game.player.stats.mana)).toBeGreaterThan(depleted);
    await prepareDungeonWizard(page);
    expect(await build()).toEqual(trained);
    console.log('[prepared-fixture-reuse] real cast depleted mana; explicit next-test setup restored starting bars; repeated rune preparation retained the existing build');
});
