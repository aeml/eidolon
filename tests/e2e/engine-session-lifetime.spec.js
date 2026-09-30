import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

// Prepared local scene owners, not account/server reconnect acceptance.
// Exercise the real constructor, models, renderer and destructor without
// running a campaign or adding power/currency to any character.
for (const quality of ['high', 'low']) test(`${quality}: three retired engines release their own HUD, map listeners and GPU contexts`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async quality => {
        const { GameEngine } = await import('/src/core/GameEngine.js');
        const { Fighter } = await import('/src/entities/Fighter.js');
        const { BASE_ITEMS, RARITY } = await import('/src/core/ItemSystem.js');
        const { EQUIPMENT_RENDER_SLOTS } = await import('/src/art/ProceduralEquipment.js');
        document.getElementById('start-screen').style.display = 'none';
        const reports = [];
        for (let session = 0; session < 3; session++) {
            const socket = { readyState: WebSocket.OPEN, send() {}, close() { throw Error('Borrowed socket closed'); } };
            const engine = new GameEngine('Fighter', false, true, '', '', socket);
            engine.renderSystem.setGraphicsQuality(quality);
            engine.player = new Fighter(`lifetime-${session}`);
            engine.player.gameEngine = engine;
            await engine.player.ensureMesh();
            const equipment = Object.fromEntries(EQUIPMENT_RENDER_SLOTS.map(slot => {
                const base = BASE_ITEMS.find(item => item.slot === slot.replace(/[12]$/, ''));
                return [slot, { ...base, id: `fixture-${slot}`, baseName: base.name, rarity: RARITY.RARE }];
            }));
            const fit = engine.player.syncEquipmentVisuals(equipment);
            if (fit.items !== 14 || fit.missing.length) throw Error('Incomplete lifetime fixture equipment');
            engine.renderSystem.add(engine.player.mesh);
            engine.renderSystem.setCameraTarget(engine.player.position);
            engine.renderSystem.render();
            const render = engine.renderSystem, context = render.renderer.getContext();
            const before = { ...render.renderer.info.memory };
            const minimaps = document.querySelectorAll('#minimap-hud').length;
            engine.destroy(); engine.destroy();
            await new Promise(resolve => requestAnimationFrame(resolve));
            reports.push({ before, minimaps, retiredMinimaps: document.querySelectorAll('#minimap-hud').length,
                retiredTooltips: document.querySelectorAll('#minimap-buff-tooltip').length,
                mapOwnerCleared: !document.getElementById('world-map').__eidolonWorldMap,
                mapListenersAborted: engine.worldMap.listeners.signal.aborted,
                playerInactive: !engine.player.isActive,
                canvasDetached: !render.renderer.domElement.isConnected,
                contextLost: context.isContextLost(), socketOpen: socket.readyState === WebSocket.OPEN });
        }
        return reports;
    }, quality);
    await testInfo.attach('engine-retirement', { body: JSON.stringify(result), contentType: 'application/json' });
    console.log('[engine-retirement]', JSON.stringify(result));
    for (const report of result) {
        expect(report.before.geometries).toBeGreaterThan(0);
        expect(report.minimaps).toBe(1); expect(report.retiredMinimaps).toBe(0); expect(report.retiredTooltips).toBe(0);
        expect(report.mapOwnerCleared).toBe(true); expect(report.mapListenersAborted).toBe(true);
        expect(report.playerInactive).toBe(true); expect(report.canvasDetached).toBe(true);
        expect(report.contextLost).toBe(true); expect(report.socketOpen).toBe(true);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
