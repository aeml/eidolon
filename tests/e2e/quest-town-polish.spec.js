import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('Ilyra dialogue, manual quest acknowledgement and a crowded tracker remain usable', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { UIManager } = await import('/src/ui/UIManager.js');
        const ui = new UIManager(false);
        const quest = { id: 'chronicle_01_bell_below', category: 'chronicle', chapter: 1, title: 'The Bell That Rang Below', description: 'I am Ilyra, keeper of the Fourfold Chronicle. The four crystals are faltering, and my wards cannot reach their buried sanctums. I need your help to save Eidolon. Face the risen dead beyond our walls and bring me the echoes bound inside them; together we can trace the wound.', lore: 'Orun of Root and Stone, Neris of Tide and Memory, Pyralis of Flame and Will, and Aeral of Sky and Freedom keep the elements willing to shelter mortal lands.', objectiveText: 'Defeat three risen dead beyond Lanternhold and bring their echoes to Ilyra.', count: 3, maxCount: 3, rewardXP: 500, accepted: true, completed: false };
        const player = { position: { x: 20, z: 200 }, level: 15, quests: [quest, ...Array.from({ length: 26 }, (_, i) => ({ id: `daily_${i}`, category: 'daily', title: `Daily Hunt ${i + 1}`, target: 'Skeleton', maxCount: 100, count: i * 3, rewardXP: 50000, accepted: true, completed: false }))] };
        ui.lastPlayerRef = player;
        document.getElementById('start-screen').style.display = 'none';
        ui.toggleChat(true);
        ui.updateJournal(player.quests);
        ui.quest.onCompleteQuest = (id) => { window.__requestedQuest = id; };
        window.__questFixture = { ui, player };
        ui.toggleQuestWindow('story');
    });
    const panel = page.locator('#quest-window');
    await expect(panel).toContainText('save Eidolon');
    await expect(page.locator('#objectives-list .objective-entry')).toHaveCount(3);
    await expect(page.locator('.objectives-panel__more')).toContainText('View all 27 objectives');
    for (const [width, height] of [[1440, 1000], [1280, 600], [390, 844], [320, 640]]) {
        await page.setViewportSize({ width, height });
        await page.evaluate(() => window.__questFixture.ui.reflowVisibleWindows());
        await expect.poll(() => page.evaluate(() => document.getElementById('objectives-panel').getBoundingClientRect().bottom + 8 <= document.getElementById('chat-box').getBoundingClientRect().top)).toBe(true);
        await expect(panel.getByRole('button', { name: 'Complete Quest', exact: true })).toBeVisible();
        expect(await panel.evaluate((node) => { const rect = node.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight && node.scrollWidth <= node.clientWidth; })).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`quest-${width}-${height}.png`) });
    }
    await panel.getByRole('button', { name: 'Complete Quest', exact: true }).click();
    await expect(panel).not.toContainText('Reward received');
    expect(await page.evaluate(() => window.__requestedQuest)).toBe('chronicle_01_bell_below');
    await page.evaluate(() => {
        const { ui, player } = window.__questFixture;
        player.quests[0].completed = true;
        player.quests.push({ ...player.quests[0], id: 'chronicle_02_seeds_first_grove', chapter: 2, title: 'Seeds of the First Grove', accepted: false, completed: false, count: 0 });
        ui.updateQuestWindow(player.quests);
        ui.updateJournal(player.quests);
    });
    await expect(panel).toContainText('I once called him a fellow keeper');
    await expect(panel).toContainText('Reward received · 500 XP');
    await panel.getByRole('button', { name: 'Continue conversation' }).click();
    await expect(panel.getByRole('button', { name: 'Accept Quest', exact: true })).toBeVisible();
    await page.locator('#btn-close-quest').click();
    await page.locator('.objectives-panel__more').click();
    await expect(page.locator('#quest-journal')).toBeVisible();
    await expect(page.locator('#chat-box')).toBeVisible();
    expect(failures, failures.join('\n')).toEqual([]);
});

test('cherubs and blue/gold NPC markers render with the production models', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__eidolonAnimationGallery?.ready);
    await page.evaluate(async () => {
        const THREE = await import('three');
        const { QuestNPC } = await import('/src/entities/QuestNPC.js');
        const { SpiritGuardiansEffect } = await import('/src/entities/SpiritGuardiansEffect.js');
        const gallery = window.__eidolonAnimationGalleryController;
        gallery.cleanupPresentation();
        [gallery.actor, gallery.remoteActor, gallery.targetActor].forEach((actor) => { if (actor?.mesh) actor.mesh.visible = false; });
        document.querySelectorAll('#repro-hud, #animation-gallery, #perf-overlay').forEach((node) => { node.style.display = 'none'; });
        const render = gallery.renderSystem;
        render.setZoom(6);
        render.camera.position.set(0, 4, 12);
        gallery.controls.target.set(0, 1.5, 0);
        gallery.controls.update();
        const npcs = [];
        for (const story of [false, true]) {
            const npc = new QuestNPC(`marker-fixture-${story}`, { story });
            await npc.ensureMesh();
            npc.position.set(story ? 2.8 : -2.8, 0, 0);
            npc.resetTransformInterpolation();
            npc.render(1);
            npc.markerSymbol = '!';
            npc.refreshQuestMarker();
            render.scene.add(npc.mesh);
            npcs.push(npc);
        }
        const effect = new SpiritGuardiansEffect(render.effectGroup, { id: 'cherub-gallery', position: new THREE.Vector3(), state: 'IDLE', mesh: new THREE.Group(), skillRunes: {} });
        // Close-up of actual generated figures, not a modified gameplay radius.
        const cherub = effect.guardians[0].clone();
        cherub.position.set(0, 0.2, 1);
        cherub.rotation.set(0, 0, 0);
        cherub.scale.setScalar(2.1);
        render.scene.add(cherub);
        effect.group.visible = false;
        window.__questArt = { effect, cherub, npcs };
    });
    await page.screenshot({ path: testInfo.outputPath('cherub-and-quest-offers.png') });
    await page.evaluate(() => window.__questArt.npcs.forEach((npc) => { npc.markerSymbol = '?'; npc.refreshQuestMarker(); }));
    await page.screenshot({ path: testInfo.outputPath('cherub-and-quest-turnins.png') });
    expect(await page.evaluate(() => window.__questArt.npcs.map((npc) => npc.questMarker.userData))).toEqual([
        { symbol: '?', questKind: 'daily' }, { symbol: '?', questKind: 'story' }
    ]);
    await page.evaluate(() => { const art = window.__questArt; art.cherub.removeFromParent(); art.effect.dispose(); art.npcs.forEach((npc) => npc.dispose()); });
    expect(failures, failures.join('\n')).toEqual([]);
});
