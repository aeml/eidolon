import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

const layout = JSON.parse(readFileSync('tests/fixtures/production-dungeon-layouts.json', 'utf8'))
    .find(fixture => fixture.dungeonType === 'verdant_bastion_catacombs').layout;
const tables = JSON.parse(readFileSync('tests/fixtures/casino-browser-catalog.json', 'utf8'));

// Prepared presentation integration, not earned progression, authoritative
// group combat, casino settlement, phone hardware or final actor-art approval.
for (const phone of [false, true]) test(`${phone ? 'phone policy' : 'desktop'}: settings and essential warnings survive the integrated venue route`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: phone ? 390 : 1280, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async ({ phone, layout, tables }) => {
        const { actorRenderingIsOwned } = await import('/tests/e2e/actor-render-ownership.js');
        const THREE = await import('three');
        const { GameEngine } = await import('/src/core/GameEngine.js');
        const { Fighter } = await import('/src/entities/Fighter.js');
        const { Cleric } = await import('/src/entities/Cleric.js');
        const { Rogue } = await import('/src/entities/Rogue.js');
        const { Wizard } = await import('/src/entities/Wizard.js');
        const { CONSTANTS } = await import('/src/core/Constants.js');
        const { BASE_ITEMS, RARITY } = await import('/src/core/ItemSystem.js');
        const { EQUIPMENT_RENDER_SLOTS } = await import('/src/art/ProceduralEquipment.js');
        const { worldAmbienceKey } = await import('/src/audio/WorldAmbience.js');
        document.getElementById('start-screen').style.display = 'none';
        const socket = { readyState: WebSocket.OPEN, send() {}, close() { throw Error('Borrowed socket closed'); } };
        const engine = new GameEngine('Fighter', phone, true, '', '', socket);
        window.game = engine;
        const classes = { Fighter, Cleric, Rogue, Wizard };
        const primaryStats = { Fighter: 'strength', Cleric: 'wisdom', Rogue: 'dexterity', Wizard: 'intelligence' };
        const prepareHero = async (type, id) => {
            const actor = new classes[type](id); actor.gameEngine = engine;
            actor.level = 75; actor.selectedBranch = 'BranchA';
            const branch = CONSTANTS.SKILL_TREES[type].BranchA;
            actor.unlockedSkills = [actor.abilityName, ...[2, 3, 4, 5].map(tier => branch[`Tier${tier}`].name)];
            actor.baseStats[primaryStats[type]] = 120; actor.baseStats.vitality = 90;
            await actor.ensureMesh();
            const { canEquipItem } = await import('/src/core/EquipmentSlots.js');
            const gear = Object.fromEntries(EQUIPMENT_RENDER_SLOTS.map((slot, index) => {
                const candidates = BASE_ITEMS.filter(item => canEquipItem(type, item, slot));
                const armorVariant = type === 'Fighter' ? 1 : type === 'Rogue' ? 0 : 2;
                const base = slot === 'mainHand' ? candidates.find(item => item.scaling === primaryStats[type])
                    : slot === 'offHand' ? candidates[Math.min(type === 'Wizard' || type === 'Cleric' ? 1 : 0, candidates.length - 1)]
                        : candidates[Math.min(armorVariant, candidates.length - 1)];
                return [slot, { ...base, id: `${id}-${slot}`, baseName: base.name, level: 75,
                    rarity: index % 2 ? RARITY.UNCOMMON : RARITY.RARE,
                    stats: { [primaryStats[type]]: 12, vitality: 8, [base.baseStat]: base.baseValue } }];
            }));
            actor.syncEquipmentVisuals(gear); await actor.mesh.userData.equipmentReady;
            if (actor.mesh.userData.equipmentVisualItemCount !== 14 || actor.mesh.userData.equipmentVisualMissing?.length) throw Error(`Incomplete ${type} equipment`);
            actor.recalculateStats(); actor.stats.hp = actor.stats.maxHp; actor.stats.mana = actor.stats.maxMana;
            return actor;
        };
        engine.player = await prepareHero('Fighter', 'presentation-player'); engine.addEntity(engine.player);
        const ui = engine.uiManager;
        engine.uiBindings.bindSessionCallbacks();
        ui.showHUD(); ui.toggleChat(true);
        ui.updateHotbar(engine.player);
        ui.setGraphicsQuality('high'); ui.setBrightnessLevel(65); ui.setUiScale(125);
        ui.setAudioEnabled(false); ui.setMotionPreference('reduced'); ui.setCameraShakeEnabled(false);
        const render = engine.renderSystem, reports = [];
        const frame = () => {
            ui.updatePlayerStats(engine.player);
            const entities = engine.chunkManager.getActiveEntities();
            ui.updateXP(engine.player); engine.minimap.update(engine.player, entities);
            entities.forEach(actor => actor.render(1)); engine.casino.beforeUpdate(.4); engine.casino.render(entities);
            render.setCameraTarget(engine.player.position); render.updateEnvironmentLighting(engine.player.position, 0);
            render.render(); engine.audioManager.ambience.update(worldAmbienceKey(engine));
        };
        const snapshot = label => {
            frame();
            const audio = engine.audioManager.getSettings();
            const row = { label, uiQuality: ui.getGraphicsQuality(), rendererQuality: render.graphicsQuality,
                generatorQuality: engine.activeWorldGenerator.graphicsQuality,
                brightness: render.brightnessLevel, uiBrightness: ui.getBrightnessLevel(), scale: ui.getUiScale(),
                muted: !audio.enabled, motion: document.documentElement.dataset.reducedMotion,
                shake: render.cameraShakeEnabled, shadows: render.renderer.shadowMap.enabled,
                ambience: engine.audioManager.ambience.key, playerRenderOwned: actorRenderingIsOwned(render, engine.player.mesh),
                level: engine.player.level, hotbar: [...engine.player.hotbar],
                staticVisible: render.staticEnvironmentGroup.visible, ...render.renderer.info.memory };
            reports.push(row); return row;
        };
        window.__presentation = {
            engine, reports, snapshot,
            async visit(label) {
                if (label === 'town' || label === 'return') await engine.enterInstance('', 'overworld', null, null, { x: -1.25, y: .5, z: 200 });
                if (label === 'road') await engine.enterInstance('', 'overworld', null, null, { x: 120, y: .5, z: 200 });
                if (label === 'encounter') {
                    await engine.enterInstance('presentation-dungeon', 'verdant_bastion_catacombs', layout);
                    const member = (actor, name, role) => ({ id: actor.id, name, class: actor.meshType, role,
                        level: actor.level, hp: actor.stats.hp, maxHp: actor.stats.maxHp });
                    const members = [member(engine.player, 'Roadward', 'tank')];
                    for (const [index, type] of ['Cleric', 'Rogue', 'Wizard', 'Fighter'].entries()) {
                        const actor = await prepareHero(type, `presentation-${index}`); actor.isRemote = true;
                        actor.position.copy(engine.player.position).add(new THREE.Vector3((index - 1.5) * 2, 0, 3));
                        actor.resetTransformInterpolation(); engine.addEntity(actor); engine.remotePlayers.set(actor.id, actor);
                        members.push(member(actor, type, type === 'Cleric' ? 'healer' : 'damage'));
                    }
                    ui.updateParty({ partyId: 'presentation-party', leaderId: engine.player.id, members });
                    for (const offset of [-5, 5]) engine.handleServerMessage({ type: 'telegraph', payload: {
                        instanceId: engine.currentInstanceId, x: engine.player.position.x + offset, z: engine.player.position.z,
                        radius: 2.5, duration: 3, label: 'ROOT COLLAPSE', theme: 'verdant_bastion_catacombs'
                    } });
                    engine.effects.forEach(effect => effect.update(.25));
                }
                if (label === 'casino' || label === 'vip') {
                    if (label === 'casino') await engine.enterInstance('lanternhold-casino', 'casino', null, null, { x: 0, y: .5, z: 152 });
                    engine.casino.updateState({ tables, floor: label === 'vip' ? 'vip' : 'public', vip: true });
                    engine.casino.setFloor({ upstairs: label === 'vip', x: 0, y: label === 'vip' ? 8.5 : .5, z: 152 });
                }
                return snapshot(label);
            },
            quality(quality) {
                ui.setGraphicsQuality(quality);
                // Preserve existing warnings AND exercise fresh protocol admission
                // at each quality; retention alone cannot prove Low admission.
                engine.handleServerMessage({ type: 'telegraph', payload: {
                    instanceId: engine.currentInstanceId, x: engine.player.position.x, z: engine.player.position.z + 7,
                    radius: 2.5, duration: 3, label: 'ROOT COLLAPSE', theme: 'verdant_bastion_catacombs'
                } });
                engine.effects.at(-1).update(.25);
                return snapshot(`quality-${quality}`);
            },
            warnings() {
                return engine.effects.map(effect => ({ active: effect.isActive, radius: effect.meshes[0].userData.gameplayRadius,
                    attached: effect.meshes.every(mesh => mesh.parent === render.effectGroup && mesh.visible) }));
            },
            close() { engine.destroy(); delete window.game; delete window.__presentation; }
        };
    }, { phone, layout, tables });
    try {
        for (const label of ['town', 'road', 'encounter']) {
            await page.evaluate(label => window.__presentation.visit(label), label);
            await page.screenshot({ path: testInfo.outputPath(`${label}.png`) });
        }
        for (const [index, quality] of ['low', 'medium', 'high'].entries()) {
            await page.evaluate(quality => window.__presentation.quality(quality), quality);
            const warnings = await page.evaluate(() => window.__presentation.warnings());
            expect(warnings).toHaveLength(3 + index);
            for (const warning of warnings) expect(warning).toEqual({ active: true, radius: 2.5, attached: true });
            await page.screenshot({ path: testInfo.outputPath(`warnings-${quality}.png`) });
        }
        await page.evaluate(() => window.__presentation.engine.uiManager.toggleSocial(true));
        if (phone) await page.getByRole('button', { name: 'Party: 5 members', exact: true }).click();
        const roles = await page.locator('.party-member-role').allTextContents();
        expect(roles.filter(role => role.startsWith('tank'))).toHaveLength(1);
        expect(roles.filter(role => role.startsWith('healer'))).toHaveLength(1);
        expect(roles.filter(role => role.startsWith('damage'))).toHaveLength(3);
        await page.screenshot({ path: testInfo.outputPath('social.png') });
        if (phone) await page.getByRole('button', { name: 'Close', exact: true }).click();
        await page.evaluate(() => window.__presentation.engine.uiManager.toggleSocial(false));
        for (const label of ['casino', 'vip', 'return']) {
            await page.evaluate(label => window.__presentation.visit(label), label);
            await page.screenshot({ path: testInfo.outputPath(`${label}.png`) });
        }
        const reports = await page.evaluate(() => window.__presentation.reports);
        await writeFile(testInfo.outputPath('integrated-route.json'), JSON.stringify(reports, null, 2));
        for (const row of reports) {
            expect(row.rendererQuality).toBe(row.uiQuality); expect(row.generatorQuality).toBe(row.uiQuality);
            expect(row.brightness).toBe(65); expect(row.uiBrightness).toBe(65); expect(row.scale).toBe(1.25);
            expect(row.muted).toBe(true); expect(row.motion).toBe('true'); expect(row.shake).toBe(false);
            expect(row.shadows).toBe(!phone && row.uiQuality !== 'low'); expect(row.playerRenderOwned).toBe(true);
            expect(row.level).toBe(75); expect(row.hotbar).toEqual(['Whirlwind', 'Shield Slam', 'Iron Fortress', 'Guardian Roar']);
            expect(row.staticVisible).toBe(!['casino', 'vip'].includes(row.label));
        }
        for (const [label, ambience] of [['town', 'town'], ['road', 'earth'], ['encounter', 'dungeon'], ['casino', 'casino'], ['vip', 'casino_vip'], ['return', 'town']]) {
            expect(reports.find(row => row.label === label).ambience).toBe(ambience);
        }
        expect(failures, failures.join('\n')).toEqual([]);
    } finally { await page.evaluate(() => window.__presentation?.close()); }
});
