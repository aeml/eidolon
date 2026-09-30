import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';
import { readFileSync } from 'node:fs';

const dungeonFixture = JSON.parse(readFileSync('tests/fixtures/production-dungeon-layouts.json', 'utf8'))
    .find(fixture => fixture.dungeonType === 'verdant_bastion_catacombs');

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

// Real instance transitions on a prepared local engine. No account, network
// combat, earned currency, completed dungeon or device-FPS claim.
for (const quality of ['high', 'low']) test(`${quality}: repeated town, dungeon, casino floors, gear and death return to warmed resources`, async ({ page, baseURL }, testInfo) => {
    test.setTimeout(180_000);
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    expect(dungeonFixture).toBeDefined();
    const reports = await page.evaluate(async ({ quality, layout }) => {
        const { GameEngine } = await import('/src/core/GameEngine.js');
        const { Fighter } = await import('/src/entities/Fighter.js');
        const { BASE_ITEMS, RARITY } = await import('/src/core/ItemSystem.js');
        const { EQUIPMENT_RENDER_SLOTS } = await import('/src/art/ProceduralEquipment.js');
        document.getElementById('start-screen').style.display = 'none';
        const socket = { readyState: WebSocket.OPEN, send() {}, close() { throw Error('Borrowed socket closed'); } };
        const engine = new GameEngine('Fighter', false, true, '', '', socket);
        engine.renderSystem.setGraphicsQuality(quality);
        engine.player = new Fighter('transition-player'); engine.player.gameEngine = engine;
        await engine.player.ensureMesh(); engine.addEntity(engine.player);
        const gear = [0, 1].map(index => Object.fromEntries(EQUIPMENT_RENDER_SLOTS.map(slot => {
            const candidates = BASE_ITEMS.filter(item => item.slot === slot.replace(/[12]$/, ''));
            const base = candidates[index % candidates.length];
            return [slot, { ...base, id: `lifetime-${index}-${slot}`, baseName: base.name, rarity: RARITY.RARE }];
        })));
        const reports = [], player = engine.player;
        const capture = label => {
            player.render(1); engine.casino.beforeUpdate(0);
            engine.renderSystem.setCameraTarget(player.position);
            engine.renderSystem.updateEnvironmentLighting(player.position, 0);
            engine.renderSystem.render();
            const hitbox = player.mesh.getObjectByName('ActorInteractionHitbox');
            return { label, ...engine.renderSystem.renderer.info.memory,
                chunks: engine.chunkManager.chunks.size, activeActors: engine.chunkManager.getActiveEntities().length,
                playerTracked: engine.chunkManager.chunks.get(player._chunkKey)?.has(player) === true,
                playerAttached: player.mesh.parent === engine.renderSystem.entityGroup,
                hiddenHitbox: hitbox.material.opacity === 0 && hitbox.material.colorWrite === false };
        };
        try {
            for (let cycle = 0; cycle < 3; cycle++) {
                await engine.enterInstance('', 'overworld', null, null, { x: -1.25, y: .5, z: 200 });
                for (const equipment of [gear[0], gear[1], gear[0]]) {
                    const fit = player.syncEquipmentVisuals(equipment);
                    if (fit.items !== 14 || fit.missing.length) throw Error('Incomplete transition gear');
                    capture('gear');
                }
                player.die(); player.respawn(-1.25, 200); reports.push({ cycle, ...capture('town-death') });
                await engine.enterInstance(`lifetime-dungeon-${cycle}`, 'verdant_bastion_catacombs', layout);
                reports.push({ cycle, ...capture('dungeon') });
                // Render a real equipped actor, then place its ownership only
                // in a dormant chunk. Transition must release it, not retain a
                // model merely because it is absent from the remote map.
                const actor = new Fighter('transition-remote'); actor.gameEngine = engine;
                await actor.ensureMesh(); actor.syncEquipmentVisuals(gear[0]);
                actor.position.copy(player.position); engine.addEntity(actor); actor.render(1); capture('remote');
                engine.chunkManager.chunks.get(actor._chunkKey).delete(actor);
                actor.position.set(9000, 0, 9000); actor._chunkKey = engine.chunkManager.getChunkKey(9000, 9000);
                engine.chunkManager.chunks.set(actor._chunkKey, new Set([actor]));
                await engine.enterInstance('lanternhold-casino', 'casino', null, null, { x: 0, y: .5, z: 152 });
                if (actor.isActive || actor.mesh) throw Error('Dormant actor retained after casino entry');
                engine.casino.setFloor({ upstairs: false, x: 0, y: .5, z: 152 }); reports.push({ cycle, ...capture('casino-public') });
                engine.casino.setFloor({ upstairs: true, x: 0, y: 8.5, z: 152 }); reports.push({ cycle, ...capture('casino-vip') });
                engine.casino.setFloor({ upstairs: false, x: 0, y: .5, z: 152 });
            }
        } finally { engine.destroy(); }
        return reports;
    }, { quality, layout: dungeonFixture.layout });
    await testInfo.attach('transition-resources', { body: JSON.stringify(reports), contentType: 'application/json' });
    console.log('[transition-resources]', quality, JSON.stringify(reports));
    for (const report of reports) {
        expect(report.geometries).toBeGreaterThan(0); expect(report.playerTracked).toBe(true);
        expect(report.playerAttached).toBe(true); expect(report.hiddenHitbox).toBe(true);
        expect(report.chunks).toBe(1);
    }
    for (const label of ['town-death', 'dungeon', 'casino-public', 'casino-vip']) {
        const warm = reports.find(report => report.cycle === 1 && report.label === label);
        const repeat = reports.find(report => report.cycle === 2 && report.label === label);
        expect(repeat.geometries, `${label} geometries`).toBe(warm.geometries);
        expect(repeat.textures, `${label} textures`).toBe(warm.textures);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
