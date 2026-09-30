import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { collectBrowserFailures } from './helpers.js';

// Exported CasinoTables, checked against Go in TestCasinoBrowserFixtureMatchesCatalog.
const catalog = JSON.parse(readFileSync('tests/fixtures/casino-browser-catalog.json', 'utf8'));

for (const quality of ['high', 'low']) test(`${quality}: full casino catalog and five game interfaces retire cleanly across three visits`, async ({ page, baseURL }, testInfo) => {
    test.setTimeout(120_000);
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.addInitScript(() => {
        const active = window.__casinoLifetimeIntervals = new Set();
        const start = window.setInterval.bind(window), stop = window.clearInterval.bind(window);
        window.setInterval = (...args) => { const id = start(...args); active.add(id); return id; };
        window.clearInterval = id => { active.delete(id); stop(id); };
    });
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async ({ quality, tables }) => {
        const THREE = await import('three');
        const { GameEngine } = await import('/src/core/GameEngine.js');
        const { Fighter } = await import('/src/entities/Fighter.js');
        const { Entity } = await import('/src/entities/Entity.js');
        const { BASE_ITEMS, RARITY } = await import('/src/core/ItemSystem.js');
        const { applyProceduralEquipment, EQUIPMENT_RENDER_SLOTS } = await import('/src/art/ProceduralEquipment.js');
        document.getElementById('start-screen').style.display = 'none';
        const socket = { readyState: WebSocket.OPEN, send() {}, close() { throw Error('Borrowed socket closed'); } };
        // The page-owned analytics sampler persists independently of games.
        // Track exact pre-existing IDs, not a blanket numeric timer allowance.
        const applicationIntervals = new Set(window.__casinoLifetimeIntervals);
        const ownedIntervals = () => [...window.__casinoLifetimeIntervals].filter(id => !applicationIntervals.has(id)).length;
        const engine = new GameEngine('Fighter', false, true, '', '', socket);
        engine.renderSystem.setGraphicsQuality(quality);
        const player = engine.player = new Fighter('casino-lifetime-player'); player.gameEngine = engine;
        await player.ensureMesh(); engine.addEntity(player);
        const gear = Object.fromEntries(EQUIPMENT_RENDER_SLOTS.map(slot => {
            const base = BASE_ITEMS.find(item => item.slot === slot.replace(/[12]$/, ''));
            return [slot, { ...base, id: `casino-${slot}`, baseName: base.name, rarity: RARITY.RARE }];
        }));
        if (player.syncEquipmentVisuals(gear).items !== 14) throw Error('Incomplete player gear');
        const casino = engine.casino, render = engine.renderSystem, reports = [], games = [];
        const renderFrame = () => {
            const entities = engine.chunkManager.getActiveEntities();
            entities.forEach(entity => entity.render(1)); casino.beforeUpdate(0); casino.render(entities); render.render();
        };
        const memory = label => ({ label, ...render.renderer.info.memory,
            instanceBatches: render.actorInstances.batches.size,
            playerInstanceRegistered: render.actorInstances.roots.has(player.mesh),
            intervals: ownedIntervals(), seats: casino.furniture.userData.seats.length,
            furnitureRoots: render.scene.children.filter(child => child.name === 'casino-furniture').length });
        const machine = { theme: 'earth', lore: 'Orun remembers.', mechanic: 'Sticky middle-reel wilds.', freeSpins: 5,
            symbols: ['Seed', 'Fern', 'Amber', 'Roadward', 'Rootheart', 'Orun', 'Living root', 'Vault key'],
            weights: [24, 20, 16, 12, 10, 8, 5, 5], pays: Array.from({ length: 6 }, () => [6, 16, 28]),
            bonusTitle: 'The archive', bonusChoices: ['Open the chest', 'Read the tablet', 'Follow the root'] };
        const view = (table, cycle) => {
            const common = { available: true, processing: false, currency: table.currency, balance: table.currency === 'ep' ? 100 : 100000, gold: 100000,
                minBet: 20, maxBet: table.currency === 'ep' ? 100 : 100000, betStep: 20, roundId: `life-${cycle}-${table.id}`,
                serverNow: new Date().toISOString(), dealAt: new Date(Date.now() + 30000).toISOString(), phase: 'playing',
                players: [{ playerId: player.id, name: 'Fighter', seat: 0, bet: 20, buyIn: 100 },
                    { playerId: 'companion', name: 'Companion', seat: 1, bet: 20, buyIn: 100 }] };
            const round = { revision: 1, deadline: common.dealAt, turnPlayerId: player.id };
            if (table.game === 'blackjack') return { blackjack: { ...common, round: { ...round, dealer: [9], dealerHidden: true,
                turnHand: 0, actions: ['hit', 'stand'], players: common.players.map(p => ({ ...p, hands: [{ cards: [10, 3], bet: 20 }] })) } } };
            if (table.game === 'poker') return { poker: { ...common, round: { ...round, phase: 'playing', street: 'flop', board: [0, 9, 10],
                buttonSeat: 0, actions: ['fold', 'call', 'raise'], callAmount: 10, minimumRaiseTo: 30, maximumRaiseTo: 100,
                pots: [{ amount: 30 }], players: common.players.map(p => ({ ...p, stack: 90, streetBet: 10, committed: 10,
                    cards: p.playerId === player.id ? [13, 14] : [-1, -1] })) } } };
            if (table.game === 'slots') return { slots: { ...common, machine,
                lines: Array.from({ length: 10 }, () => [1, 1, 1, 1, 1]), session: { revision: 1, bet: 20, freeSpins: 0, bonus: false } } };
            const spots = table.game === 'baccarat' ? ['player', 'banker', 'tie'] : ['red', 'black', 'odd', 'even', 'low', 'high'];
            return { house: { ...common, game: table.game, phase: 'betting', spots: spots.map(id => ({ id, label: id, bets: [20, 100] })) } };
        };
        let final;
        try {
            for (let cycle = 0; cycle < 3; cycle++) {
                await engine.enterInstance('lanternhold-casino', 'casino', null, null, { x: 0, y: .5, z: 152 });
                // Same complete catalog, changed ordering: exercise replacement
                // ownership as well as reuse, without inventing fewer stations.
                const currentTables = cycle % 2 ? [...tables].reverse() : tables;
                casino.updateState({ tables: currentTables, floor: 'public', vip: true });
                const guests = [];
                for (const floor of ['public', 'vip']) for (const [index, type] of ['Fighter', 'Rogue', 'Wizard', 'Cleric'].entries()) {
                    const table = tables.find(table => table.floor === floor && table.game === 'poker'), seat = table.seats[index + 1];
                    const guest = new Entity(`lifetime-${floor}-${type}`); guest.meshType = type; guest.gameEngine = engine;
                    await guest.ensureMesh();
                    if (applyProceduralEquipment(guest.mesh, gear).items !== 14) throw Error('Incomplete guest gear');
                    guest.position.set(seat.x, seat.y, seat.z); guest.state = 'SEATED'; guest.resetTransformInterpolation();
                    engine.addEntity(guest); engine.remotePlayers.set(guest.id, guest); guests.push(guest);
                }
                engine.chunkManager.update(player, 0, engine.collisionManager, engine.floatingTextManager, engine);
                for (const floor of ['public', 'vip']) {
                    casino.setFloor({ upstairs: floor === 'vip', x: 0, y: floor === 'vip' ? 8.5 : .5, z: 152 });
                    const focus = new THREE.Vector3(0, floor === 'vip' ? 8 : 0, 152), aspect = innerWidth / innerHeight;
                    render.camera.left = -58 * aspect; render.camera.right = 58 * aspect;
                    render.camera.top = 58; render.camera.bottom = -58; render.camera.zoom = 1;
                    render.camera.position.copy(focus).add(new THREE.Vector3(20, 90, 85)); render.camera.lookAt(focus); render.camera.updateProjectionMatrix();
                    renderFrame();
                    reports.push({ cycle, floor, ...memory('overview'), visibleGuests: guests.filter(guest => guest.mesh.visible).length });
                    for (const game of ['blackjack', 'poker', 'roulette', 'baccarat', 'slots']) {
                        const table = tables.find(table => table.floor === floor && table.game === game), physical = table.seats[0];
                        player.position.set(physical.x, physical.y, physical.z); player.resetTransformInterpolation(); player.state = 'SEATED';
                        const state = { tables: currentTables, floor, vip: true, occupants: [{ playerId: player.id, tableId: table.id, seat: 0 }],
                            yourSeat: { ...physical, exitY: physical.y, tableId: table.id, seat: 0, sessionId: `life-${cycle}-${table.id}` }, ...view(table, cycle) };
                        casino.updateState(state);
                        let slotWork = null;
                        if (game === 'slots') {
                            casino.slots.count.value = '50'; casino.slots.auto.click();
                            const grid = Array.from({ length: 5 }, () => [0, 1, 2]);
                            state.slots = { ...state.slots, session: { ...state.slots.session, revision: 2, last: { landed: grid, payout: 0, freeAwarded: 0,
                                bonusPicked: -1, stages: [{ grid, wins: [], payout: 0 }] } } };
                            casino.updateState(state);
                            slotWork = casino.slots.autoRemaining > 0 && casino.slots.animating && casino.slots.timers.length > 0;
                        }
                        renderFrame();
                        const active = casino.active && !casino.panel.hidden;
                        casino.updateState({ tables: currentTables, floor, vip: true });
                        games.push({ cycle, floor, game, active, slotWork,
                            retired: !casino.active && casino.panel.hidden && ownedIntervals() === 0,
                            slotsRetired: casino.slots.autoRemaining === 0 && !casino.slots.animating && casino.slots.timers.length === 0 && !casino.slots.pending });
                    }
                }
                await engine.enterInstance('', 'overworld', null, null, { x: -1.25, y: .5, z: 200 });
                render.setCameraTarget(player.position); renderFrame();
                reports.push({ cycle, ...memory('town-return'), retiredGuests: guests.every(guest => !guest.isActive && !guest.mesh),
                    poses: casino.poses.size, cutaways: casino.cutawayActors.size, cachedVenueHidden: !casino.furniture.visible });
            }
            const context = render.renderer.getContext(), instances = render.actorInstances; engine.destroy();
            await new Promise(resolve => requestAnimationFrame(resolve));
            final = { contextLost: context.isContextLost(), intervals: ownedIntervals(),
                instancesRetired: !render.actorInstances && instances.disposed && instances.roots.size === 0 &&
                    instances.batches.size === 0 && !instances.group.parent,
                furnitureDetached: !casino.furniture.parent, panelDetached: !casino.panel.isConnected };
        } finally { engine.destroy(); }
        return { reports, games, final };
    }, { quality, tables: catalog });
    await testInfo.attach('full-casino-lifetime', { body: JSON.stringify(result), contentType: 'application/json' });
    console.log('[full-casino-lifetime]', quality, JSON.stringify(result));
    expect(catalog).toHaveLength(92);
    for (const report of result.reports) {
        expect(report.geometries).toBeGreaterThan(0); expect(report.intervals).toBe(0);
        expect(report.seats).toBe(232); expect(report.furnitureRoots).toBe(1);
        expect(report.playerInstanceRegistered).toBe(true);
        expect(report.instanceBatches).toBeGreaterThan(0);
        if (report.label === 'overview') expect(report.visibleGuests).toBe(4);
        else { expect(report.retiredGuests).toBe(true); expect(report.poses).toBe(0); expect(report.cutaways).toBe(0); expect(report.cachedVenueHidden).toBe(true); }
    }
    for (const game of result.games) {
        expect(game.active, `${game.floor}/${game.game}`).toBe(true); expect(game.retired).toBe(true); expect(game.slotsRetired).toBe(true);
        if (game.game === 'slots') expect(game.slotWork).toBe(true);
    }
    for (const [label, floor] of [['overview', 'public'], ['overview', 'vip'], ['town-return', undefined]]) {
        const warm = result.reports.find(row => row.cycle === 1 && row.label === label && row.floor === floor);
        const repeat = result.reports.find(row => row.cycle === 2 && row.label === label && row.floor === floor);
        expect(repeat.geometries, `${label}/${floor} geometry`).toBe(warm.geometries);
        expect(repeat.textures, `${label}/${floor} textures`).toBe(warm.textures);
        expect(repeat.instanceBatches).toBe(warm.instanceBatches);
    }
    expect(result.games).toHaveLength(30); expect(result.final).toEqual({ contextLost: true, intervals: 0, furnitureDetached: true, panelDetached: true, instancesRetired: true });
    expect(failures, failures.join('\n')).toEqual([]);
});
