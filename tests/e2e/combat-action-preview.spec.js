import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

// Give each rendered cue its own normal test budget and fresh effect lifecycle.
// Eight software-rendered screenshots in one test exhausted the shared deadline
// on hosted runners, obscuring which phase/quality actually failed.
for (const quality of ['high', 'low']) for (const phase of [1, 2, 3, 4]) {
    test(`Eidolon cue ${phase} on ${quality} renders distinct geometry and releases its effects`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
        await page.waitForFunction(() => window.__eidolonAnimationGallery?.ready);
        await page.evaluate(() => {
            const gallery = window.__eidolonAnimationGalleryController;
            gallery.playActorState('Idle'); // Clear the gallery's default persistent spell before counting owned effects.
            gallery.remoteActor.mesh.visible = false;
            gallery.targetActor.mesh.visible = false;
            gallery.renderSystem.applyLightingPreset('umbral_nexus', true);
            document.querySelectorAll('#repro-hud, #animation-gallery, #perf-overlay').forEach(el => { el.style.display = 'none'; });
        });
        const result = await page.evaluate(async ({ phase, quality }) => {
            const { createTransientEffect } = await import('/src/core/TransientEffects.js');
            const gallery = window.__eidolonAnimationGalleryController;
            gallery.renderSystem.setGraphicsQuality(quality);
            const scene = gallery.renderSystem.effectGroup;
            const before = scene.children.length;
            const effect = createTransientEffect(scene, 'eidolon_aid', gallery.actor.position, 0xffffff, { phase, quality });
            effect.update(.8);
            window.__aidRender = { effect, before };
            gallery.renderSystem.render();
            return { count: effect.meshes[0].children.length, geometry: effect.meshes[0].children[0].geometry.type };
        }, { phase, quality });
        expect(result.count).toBe(quality === 'low' ? 4 : 8);
        expect(result.geometry).toBe(['DodecahedronGeometry', 'SphereGeometry', 'ConeGeometry', 'TorusGeometry'][phase - 1]);
        await page.screenshot({ path: testInfo.outputPath(`eidolon-${phase}-${quality}.png`) });
        expect(await page.evaluate(() => {
            const { effect, before } = window.__aidRender;
            effect.dispose();
            return !effect.isActive && window.__eidolonAnimationGalleryController.renderSystem.effectGroup.children.length === before;
        })).toBe(true);
        expect(failures, failures.join('\n')).toEqual([]);
    });
}

for (const [width, height] of [[1280, 720], [390, 844], [844, 390]]) {
    test(`${width}x${height}: Eidolon aid remains readable beside immediate target and danger feedback`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async mobile => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', mobile);
            const ui = Object.create(UIManager.prototype);
            for (const [key, id] of Object.entries({ combatIntentPanel: 'combat-intent-panel',
                combatIntentName: 'combat-intent-name', combatIntentMeta: 'combat-intent-meta',
                combatIntentStatus: 'combat-intent-status' })) ui[key] = document.getElementById(id);
            window.__phasePreview = ui;
            ui.updateCombatIntent({ entityId: 'king', name: 'Malachar', distance: 2, status: 'in_range' });
        }, width < 900);
        const notice = page.locator('.eidolon-phase-notice');
        for (const [index, eidolon] of ['Orun', 'Neris', 'Pyralis', 'Aeral'].entries()) {
            await page.evaluate(({ phase, eidolon }) => {
                const ui = window.__phasePreview;
                const elements = ['Earth', 'Water', 'Fire', 'Air'];
                const titles = ['The Root Holds', 'The Tide Remembers', 'The Will to Burn', 'The Unbound Sky'];
                const effects = [
                    'Orun anchors the raid. Damage dealt by the Dark King is reduced by 20%.',
                    "Neris restores 25% of every living raider's maximum health.",
                    "Pyralis sears 8% of Malachar's maximum health and exposes him to 25% more player damage.",
                    'Aeral restores all mana and the full resonance increases player damage to Malachar by 35%.'
                ];
                ui.showEidolonPhaseNotice({ phase, eidolon, element: elements[phase - 1],
                    title: `Phase ${phase} · ${titles[phase - 1]}`, effect: effects[phase - 1] });
                ui.updateCombatIntent({ entityId: 'king', name: 'Malachar', distance: 3, status: 'in_range' });
                ui.showCombatCallout({ title: 'MEMORY FRACTURE', subtitle: 'Leave the marked circle before impact.', duration: 4 });
            }, { phase: index + 1, eidolon });
            await expect(notice).toContainText(`Phase ${index + 1} of 4`);
            await expect(notice).toContainText(eidolon);
            await expect(page.locator('#combat-intent-name')).toHaveText('MEMORY FRACTURE');
            if (width >= 900) await expect.poll(async () => {
                const n = await notice.boundingBox(), card = await page.locator('#combat-intent-panel').boundingBox();
                return n.y >= card.y + card.height;
            }).toBe(true);
            else await expect(notice.locator('.eidolon-phase-notice__compact').first()).toBeVisible();
            const box = await notice.boundingBox();
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(width);
            expect(box.y + box.height).toBeLessThanOrEqual(height);
            expect(await notice.evaluate(el => el.scrollWidth <= el.clientWidth && getComputedStyle(el).pointerEvents === 'none')).toBe(true);
        }
        await page.screenshot({ path: testInfo.outputPath('eidolon-and-danger.png') });
        await page.evaluate(() => window.__phasePreview.setConnectionState('lost'));
        await expect(notice).toHaveCount(0);
        expect(failures, failures.join('\n')).toEqual([]);
    });
}

for (const [width, height, mobile] of [[1280, 720, false], [390, 844, true], [844, 390, true]]) {
    test(`${width}x${height}: quest-giver card names its story or daily role`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        // Actual NPC, hint builder, UI and CSS in a presentation fixture. This
        // does not claim pointer selection, server interaction or physical touch.
        await page.evaluate(async mobile => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { GameEngine } = await import('/src/core/GameEngine.js');
            const { QuestNPC } = await import('/src/entities/QuestNPC.js');
            const { Vector3 } = await import('three');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', mobile);
            const ui = Object.create(UIManager.prototype);
            Object.assign(ui, {
                dungeonEntranceHint: document.getElementById('dungeon-entrance-hint'),
                dungeonEntranceHintName: document.getElementById('dungeon-entrance-hint-name'),
                dungeonEntranceHintStatus: document.getElementById('dungeon-entrance-hint-status'),
                dungeonEntranceHintPrompt: document.getElementById('dungeon-entrance-hint-prompt')
            });
            const engine = Object.create(GameEngine.prototype);
            engine.player = { position: new Vector3() };
            window.__questRolePreview = { ui, show: (story, distance) => {
                const npc = new QuestNPC(`role-preview-${story}`, { story });
                npc.position.set(distance, 0, 0);
                ui.updateDungeonEntranceHint(engine.buildDungeonEntranceHint(npc));
            } };
        }, mobile);
        const panel = page.locator('#dungeon-entrance-hint');
        for (const [story, title, role] of [[true, 'Archmage Ilyra', 'Story quests'], [false, 'Quest Giver', 'Daily contracts']]) {
            for (const [distance, status] of [[3, 'In range'], [12, 'Move closer']]) {
                await page.evaluate(({ story, distance }) => window.__questRolePreview.show(story, distance), { story, distance });
                await expect(panel).toBeVisible();
                await expect(page.locator('#dungeon-entrance-hint-name')).toHaveText(title);
                await expect(page.locator('#dungeon-entrance-hint-status')).toHaveText(`${role} • ${status}`);
                const bounds = await panel.boundingBox();
                expect(bounds.x).toBeGreaterThanOrEqual(0);
                expect(bounds.y).toBeGreaterThanOrEqual(0);
                expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
                expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
                expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
                if (distance === 3) await panel.screenshot({ path: testInfo.outputPath(story ? 'story-role.png' : 'daily-role.png') });
            }
        }
        await page.evaluate(() => window.__questRolePreview.ui.clearDungeonEntranceHint());
        await expect(panel).toBeHidden();
        expect(failures, failures.join('\n')).toEqual([]);
    });
}

for (const [width, height] of [[1280, 720], [390, 844], [844, 390]]) {
    test(`${width}x${height}: combat card shows cast cost without invented damage`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        // Presentation fixture using the real controller/UI/CSS. No claim of
        // an actual server cast, combat outcome or physical-phone verification.
        await page.evaluate(async mobile => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { AbilityController } = await import('/src/core/AbilityController.js');
            const { GameEngine } = await import('/src/core/GameEngine.js');
            const { Vector3 } = await import('three');
            document.getElementById('start-screen').style.display = 'none';
            const ui = Object.create(UIManager.prototype);
            Object.assign(ui, { isMobile: mobile,
                combatIntentPanel: document.getElementById('combat-intent-panel'),
                combatIntentName: document.getElementById('combat-intent-name'),
                combatIntentMeta: document.getElementById('combat-intent-meta'),
                combatIntentStatus: document.getElementById('combat-intent-status'),
                combatIntentPreviewBasic: document.getElementById('combat-intent-preview-basic'),
                combatIntentPreviewAbility: document.getElementById('combat-intent-preview-ability'),
                combatIntentPreviewAbilityLabel: document.getElementById('combat-intent-preview-ability-label') });
            const player = { constructor: { name: 'Wizard' }, abilityName: 'Fireball', stats: { damage: 5 },
                position: new Vector3(0, 0, 200), safeZoneId: '' };
            const controller = new AbilityController({ player });
            const target = { id: 'imp', name: 'Imp', subType: 'Imp', level: 20,
                constructor: { name: 'Imp' }, position: new Vector3(11.2, 0, 200) };
            const engine = Object.create(GameEngine.prototype);
            Object.assign(engine, { player, abilityController: controller, getEffectiveCombatTarget: () => target });
            const refresh = () => ui.updateCombatIntent(engine.buildCombatIntentState());
            window.__combatPreview = { player, refresh, ui };
            refresh();
        }, width < 900);
        await expect(page.locator('#combat-intent-preview-basic')).toHaveText('5');
        await expect(page.locator('#combat-intent-preview-ability')).toHaveText('30 MP');
        await expect(page.locator('#combat-intent-panel')).not.toContainText('~');
        await page.evaluate(() => {
            window.__combatPreview.player.stats.manaCostReduction = .1;
            window.__combatPreview.refresh();
        });
        await expect(page.locator('#combat-intent-preview-ability')).toHaveText('27 MP');
        if (width >= 900) await expect(page.getByText('Attack power', { exact: true })).toBeVisible();
        else await expect(page.locator('#combat-intent-name')).toHaveText('Level 20 • Imp');
        const bounds = await page.locator('#combat-intent-panel').boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
        await page.screenshot({ path: testInfo.outputPath('combat-card.png') });
        await page.evaluate(() => {
            window.__combatPreview.player.safeZoneId = 'lanternhold';
            window.__combatPreview.refresh();
        });
        await expect(page.locator('#combat-intent-status')).toHaveText('Leave the safe zone');
        await expect(page.locator('#combat-intent-status')).not.toHaveClass(/is-in-range/);
        await page.screenshot({ path: testInfo.outputPath('safe-zone-warning.png') });
        await page.evaluate(() => {
            window.__combatPreview.player.safeZoneId = '';
            window.__combatPreview.refresh();
        });
        await expect(page.locator('#combat-intent-status')).toHaveText('In Range');
        await page.evaluate(() => window.__combatPreview.ui.showCombatCallout({
            title: 'THE CHRONICLE IS COMPLETE', subtitle: 'The four crystals sing as one.',
            metaText: 'Manual turn-in confirmed', label: 'Fourfold Chronicle', tone: 'victory', duration: 30
        }));
        await expect(page.locator('#combat-intent-name')).toHaveText('THE CHRONICLE IS COMPLETE');
        expect(await page.locator('#combat-intent-name').evaluate(element =>
            element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight)).toBe(true);
        const noticeBounds = await page.locator('#combat-intent-panel').boundingBox();
        expect(noticeBounds.x).toBeGreaterThanOrEqual(0);
        expect(noticeBounds.y).toBeGreaterThanOrEqual(0);
        expect(noticeBounds.x + noticeBounds.width).toBeLessThanOrEqual(width);
        expect(noticeBounds.y + noticeBounds.height).toBeLessThanOrEqual(height);
        await expect(page.getByText('Attack power', { exact: true })).toBeHidden();
        await expect(page.locator('#combat-intent-preview-ability-label')).toHaveText('Fourfold Chronicle');
        await page.locator('#combat-intent-panel').screenshot({ path: testInfo.outputPath('chronicle-notice.png') });
        await page.evaluate(() => window.__combatPreview.refresh());
        await expect(page.locator('#combat-intent-preview-basic')).toHaveText('5');
        if (width >= 900) await expect(page.getByText('Attack power', { exact: true })).toBeVisible();
        await page.evaluate(() => window.__combatPreview.ui.clearCombatIntent());
        await expect(page.locator('#combat-intent-panel')).toBeHidden();
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
