import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

const branches = [
    { branch: 'A', skills: ['Backstab', 'Weak Point Mark', 'Shadow Lunge', 'Death Spiral'] },
    { branch: 'B', skills: ['Fan of Knives', 'Serrated Edges', 'Blade Storm', 'Phantom Volley'] },
    { branch: 'C', skills: ['Smoke Bomb', 'Poison Coating', 'Tripwire', 'Cloak & Vanish'] }
];

for (const { branch, skills } of branches) for (const phone of [false, true]) {
    test.describe(`${branch} ${phone ? 'phone' : 'desktop'} rune choices`, () => {
        test.use({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 844 },
            hasTouch: phone, isMobile: phone, actionTimeout: 12_000 });
        test('all twelve choices are readable and wait for acknowledgement in prepared UI', async ({ page, baseURL }, testInfo) => {
            const failures = collectBrowserFailures(page, baseURL);
            await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
            await page.goto('/', { waitUntil: 'networkidle' });
            // Real browser inputs and UI; simulated server acknowledgements.
            await page.evaluate(async ({ phone, branch, skills }) => {
                const { UIManager } = await import('/src/ui/UIManager.js');
                const { CONSTANTS } = await import('/src/core/Constants.js');
                document.getElementById('start-screen').style.display = 'none';
                if (phone) document.body.classList.add('mobile-mode');
                const ui = new UIManager(phone), calls = [];
                const player = { id: 'prepared-rogue-ui', subType: 'Rogue', level: 100, selectedBranch: branch,
                    talentRanks: {}, skillRunes: {}, unlockedSkills: ['Piercing Throw', ...skills] };
                ui.lastPlayerRef = player;ui.showHUD();ui.skillTree.toggle();
                ui.skillTree.onSelectRune = (skill, id, requestId) => calls.push({ skill, id, requestId });
                window.__rogueRunes = { ui, player, calls, catalog: CONSTANTS.SKILL_RUNES.Rogue };
            }, { phone, branch, skills });
            const content = page.locator('#skill-tree-content');
            await (phone ? page.locator('.phone-build-tabs') : content).getByRole('button', { name: 'Runes', exact: true }).click();
            const choices = await page.evaluate(skills => window.__rogueRunes.catalog.filter(rune => skills.includes(rune.skill)), skills);
            expect(choices).toHaveLength(12);
            for (const choice of choices) {
                if (phone) await page.locator('#phone-rune-skill').selectOption(choice.skill);
                const button = phone
                    ? content.locator('article').filter({ hasText: choice.description }).getByRole('button', { name: 'Equip rune', exact: true })
                    : content.locator(`button[data-rune-id="${choice.id}"]`);
                await button.scrollIntoViewIfNeeded();
                await expect(button).toBeEnabled();await expect(button).toBeInViewport();
                if (phone) expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
                const before = await page.evaluate(skill => window.__rogueRunes.player.skillRunes[skill] || '', choice.skill);
                if (phone) await button.tap();else await button.click();
                expect(await page.evaluate(skill => window.__rogueRunes.player.skillRunes[skill] || '', choice.skill)).toBe(before);
                expect(await page.evaluate(() => {
                    const { skill, id } = window.__rogueRunes.calls.at(-1);return { skill, id };
                })).toEqual({ skill: choice.skill, id: choice.id });
                await page.evaluate(({ choice, phone }) => {
                    const { ui, player, calls } = window.__rogueRunes;
                    player.skillRunes[choice.skill] = choice.id;
                    if (phone) ui.skillTree.handleBuildActionResult({ requestId: calls.at(-1).requestId, ok: true });
                    else ui.skillTree.renderSkillTree('Rogue');
                }, { choice, phone });
                if (phone) await expect(content.locator('article').filter({ hasText: choice.description }).getByRole('button', { name: 'Remove rune', exact: true })).toBeVisible();
                else await expect(button).toHaveAttribute('aria-pressed', 'true');
                expect(await content.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
            }
            expect(await page.evaluate(() => window.__rogueRunes.calls.length)).toBe(12);
            await page.screenshot({ path: testInfo.outputPath(phone ? 'rogue-phone-runes.png' : 'rogue-desktop-runes.png') });
            await page.evaluate(() => window.__rogueRunes.ui.dispose());
            expect(failures, failures.join('\n')).toEqual([]);
        });
    });
}
