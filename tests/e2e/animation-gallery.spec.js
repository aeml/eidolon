import { expect, test } from '@playwright/test';
import { listActorAnimationEntries } from '../../src/entities/actorAnimationManifest.js';
import { listPlayerAbilityPresentationVariants } from '../../src/skills/abilityVisualManifest.js';
import { collectBrowserFailures } from './helpers.js';
import { EQUIPMENT_VISUAL_DESCRIPTORS } from '../../src/art/ProceduralEquipment.js';
import { PROCEDURAL_FOLIAGE_RECIPES } from '../../src/art/ProceduralRealmFoliage.js';
import {
    LANTERNHOLD_STRUCTURE_DEFINITIONS,
    LANTERNHOLD_STRUCTURE_IDS
} from '../../src/art/ProceduralLanternholdArchitecture.js';
import {
    DUNGEON_ENTRANCE_DEFINITIONS,
    DUNGEON_ENTRANCE_IDS
} from '../../src/art/ProceduralDungeonEntrances.js';
import {
    DUNGEON_INTERIOR_DEFINITIONS,
    DUNGEON_INTERIOR_IDS,
    DUNGEON_ROOM_IDENTITY_IDS
} from '../../src/art/ProceduralDungeonInteriors.js';
import { PROCEDURAL_STATUS_EFFECT_DEFINITIONS } from '../../src/art/ProceduralStatusEffects.js';
import {
    PROCEDURAL_ABILITY_ICON_DEFINITIONS,
    PROCEDURAL_ITEM_ICON_DEFINITIONS
} from '../../src/art/ProceduralIcons.js';
import { PROCEDURAL_LOOT_IDENTITIES } from '../../src/art/ProceduralLoot.js';
import { PROCEDURAL_TERRAIN_DEFINITIONS } from '../../src/art/ProceduralRealmTerrain.js';

const presentationCount = listPlayerAbilityPresentationVariants().length;
const actorEntries = listActorAnimationEntries();
const equipmentFamilyCount = Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS).length;
const proceduralPlayerTypes = Object.freeze(['Fighter', 'Rogue', 'Wizard', 'Cleric']);
const proceduralTownActorTypes = Object.freeze([
    ['DwarfSalesman', 'Lanternhold ironmonger'],
    ['QuestNPC', 'Lanternhold oathscribe'],
    ['DungeonNPC', 'Lanternhold waywarden'],
    ['RespecNPC', 'Lanternhold ash confessor']
]);
const proceduralSummonTypes = Object.freeze([
    ['AvengingSeraph', 'Lanternhold reliquary seraph']
]);
const proceduralRegionalEnemyTypes = Object.freeze([
    ['Skeleton', 'Gloamwood ossuary pilgrim'],
    ['DemonOrc', 'Cinder Wastes kiln-warrior'],
    ['Imp', 'Cinder Wastes ember-scavenger'],
    ['Construct', 'Gloamwood grave-reliquary construct'],
    ['InfernoTitan', 'Cinder Wastes crucible titan'],
    ['MountainTroll', 'Moonfrost rimeback troll'],
    ['AquaGolem', 'Moonfrost drowned-cairn golem'],
    ['Siren', 'Moonfrost choir siren'],
    ['FrostGuardian', 'Moonfrost glacial bell guardian'],
    ['RootboundWarden', 'Thorncrypt root-gate warden'],
    ['BriarMatron', 'Thorncrypt briar-crown matron'],
    ['RustboundColossus', 'Thorncrypt rust-reliquary colossus'],
    ['HollowSentinel', 'Thorncrypt hollow-vigil sentinel'],
    ['Cindermaw', 'Furnace Below cinder-hound'],
    ['ScorchedTwins', 'Furnace Below twin-flame covenant'],
    ['ForgemasterPyrax', 'Furnace Below oath-anvil forgemaster'],
    ['ObsidianGuardian', 'Furnace Below black-glass bulwark'],
    ['LordInfernax', 'Furnace Below crowned furnace-lord'],
    ['Windshear', 'Shattered Aerie wind-razor revenant'],
    ['Stormcallers', 'Shattered Aerie divided storm-oracle'],
    ['RocMatriarch', 'Shattered Aerie thunder-roc matriarch'],
    ['ThunderlordKaelix', 'Shattered Aerie storm-bell thunderlord'],
    ['Zephyrion', 'Shattered Aerie eternal-gale sovereign'],
    ['TiderendLeviathan', 'Drowned Sanctum tide-rend leviathan'],
    ['DrownedChoir', 'Drowned Sanctum many-voiced reliquary'],
    ['AbyssalGoliath', 'Drowned Sanctum anchor-cairn goliath'],
    ['MaelstromWarden', 'Drowned Sanctum maelstrom bulwark'],
    ['Thalorath', 'Drowned Sanctum moonless tide-king'],
    ['SandstormDjinn', 'Cinder Wastes ash-dune djinn'],
    ['MagmaGolem', 'Cinder Wastes fault-heart golem'],
    ['ScorchedWraith', 'Cinder Wastes cinder-shroud wraith'],
    ['InfernalBehemoth', 'Cinder Wastes horned kiln-behemoth'],
    ['PhoenixSentinel', 'Cinder Wastes oathflame phoenix'],
    ['StormHarpy', 'Stormcrown gale-talon harpy'],
    ['CloudElemental', 'Stormcrown captive-cloud elemental'],
    ['ThunderRoc', 'Stormcrown conductor roc'],
    ['TempestGiant', 'Stormcrown thunder-cairn giant'],
    ['CycloneAvatar', 'Stormcrown hollow-cyclone avatar']
]);
const proceduralMoltenBossTypes = new Set([
    'Cindermaw', 'ScorchedTwins', 'ForgemasterPyrax', 'ObsidianGuardian', 'LordInfernax'
]);
const proceduralTempestBossTypes = new Set([
    'Windshear', 'Stormcallers', 'RocMatriarch', 'ThunderlordKaelix', 'Zephyrion'
]);
const proceduralAbyssalBossTypes = new Set([
    'TiderendLeviathan', 'DrownedChoir', 'AbyssalGoliath', 'MaelstromWarden', 'Thalorath'
]);
const proceduralCinderEnemyTypes = new Set([
    'SandstormDjinn', 'MagmaGolem', 'ScorchedWraith', 'InfernalBehemoth', 'PhoenixSentinel'
]);
const proceduralStormcrownEnemyTypes = new Set([
    'StormHarpy', 'CloudElemental', 'ThunderRoc', 'TempestGiant', 'CycloneAvatar'
]);

test.use({ trace: 'off', video: 'off' });

async function galleryMetrics(page) {
    return page.evaluate(() => ({ ...window.__eidolonAnimationGallery }));
}

async function waitForActor(page, actorType) {
    await expect.poll(async () => {
        const metrics = await galleryMetrics(page);
        return metrics.ready && metrics.actorType === actorType && !metrics.error;
    }, { timeout: 90_000 }).toBe(true);
}

async function hardwareRenderer(page) {
    return page.locator('canvas').last().evaluate((canvas) => {
        const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!context) return null;
        const info = context.getExtension('WEBGL_debug_renderer_info');
        return {
            vendor: info ? context.getParameter(info.UNMASKED_VENDOR_WEBGL) : context.getParameter(context.VENDOR),
            renderer: info ? context.getParameter(info.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER)
        };
    });
}

test.describe('deterministic production animation gallery', () => {
    test.describe.configure({ timeout: 1_200_000 });

    test('renders every attachment-ready procedural class in every state and quality tier', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        const response = await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);

        const renderer = await hardwareRenderer(page);
        expect(renderer).not.toBeNull();
        expect(`${renderer.vendor} ${renderer.renderer}`).not.toMatch(/swiftshader|llvmpipe|software/i);

        for (const actorType of proceduralPlayerTypes) {
            await page.locator('#gallery-actor').selectOption(actorType);
            await waitForActor(page, actorType);
            let metrics = await galleryMetrics(page);
            expect(metrics.proceduralHumanoid).toBe(true);
            expect(metrics.proceduralClass).toBe(actorType);
            expect(metrics.equipmentAnchorCount).toBe(18);
            expect(metrics.actorVisibleMeshes).toBeGreaterThanOrEqual(40);

            for (const state of ['Idle', 'Walk', 'Run', 'Attack', 'Death']) {
                await page.locator('#gallery-state').selectOption(state);
                await page.locator('#gallery-play-state').click();
                await expect.poll(async () => (await galleryMetrics(page)).phase).toBe(`state:${state.toLowerCase()}`);
                metrics = await galleryMetrics(page);
                expect(metrics.currentAnimation).toBe(state);
                expect(metrics.nonFiniteTransforms).toBe(0);
            }

            for (const quality of ['high', 'low']) {
                await page.locator('#gallery-quality').selectOption(quality);
                await page.locator('#gallery-state').selectOption('Idle');
                await page.locator('#gallery-play-state').click();
                await expect.poll(async () => (await galleryMetrics(page)).quality).toBe(quality);
                await page.screenshot({
                    path: testInfo.outputPath(`procedural-${actorType.toLowerCase()}-${quality}.png`),
                    animations: 'allow'
                });
            }
        }

        expect(failures, failures.join('\n')).toEqual([]);
        testInfo.annotations.push({
            type: 'renderer',
            description: `${renderer.vendor} · ${renderer.renderer}`
        });
    });

    test('renders every equipment family on local and replicated procedural classes in hardware Chrome', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        const response = await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);
        await waitForActor(page, 'Cleric');

        const renderer = await hardwareRenderer(page);
        expect(renderer).not.toBeNull();
        expect(`${renderer.vendor} ${renderer.renderer}`).not.toMatch(/swiftshader|llvmpipe|software/i);

        await page.locator('#gallery-actor').selectOption('Fighter');
        await waitForActor(page, 'Fighter');
        await page.locator('#gallery-run-equipment').click();
        await expect.poll(async () => {
            const metrics = await galleryMetrics(page);
            return metrics.equipmentAuditRunning ? -1 : metrics.equipmentAuditCompleted;
        }, { timeout: 120_000 }).toBe(equipmentFamilyCount);

        let metrics = await galleryMetrics(page);
        expect(metrics.actorType).toBe('Fighter');
        expect(metrics.proceduralHumanoid).toBe(true);
        expect(metrics.equipmentAuditPassed).toBe(equipmentFamilyCount);
        expect(metrics.phase).toBe('equipment:full-loadout');
        expect(metrics.equipmentLocalItems).toBe(14);
        expect(metrics.equipmentRemoteItems).toBe(14);
        expect(metrics.equipmentLocalParts).toBeGreaterThanOrEqual(45);
        expect(metrics.equipmentRemoteParts).toBe(metrics.equipmentLocalParts);
        expect(metrics.equipmentLocalSetRegions).toBe(10);
        expect(metrics.equipmentRemoteSetRegions).toBe(10);
        expect(metrics.equipmentLocalUniqueRegions).toBe(18);
        expect(metrics.equipmentRemoteUniqueRegions).toBe(18);
        expect(metrics.nonFiniteTransforms).toBe(0);

        for (const quality of ['high', 'low']) {
            await page.locator('#gallery-quality').selectOption(quality);
            await page.locator('#gallery-equip-all').click();
            await expect.poll(async () => (await galleryMetrics(page)).quality).toBe(quality);
            metrics = await galleryMetrics(page);
            expect(metrics.equipmentLocalItems).toBe(14);
            expect(metrics.equipmentRemoteItems).toBe(14);
            expect(metrics.nonFiniteTransforms).toBe(0);
            await page.screenshot({
                path: testInfo.outputPath(`procedural-fighter-equipment-${quality}.png`),
                animations: 'allow'
            });
        }

        for (const actorType of proceduralPlayerTypes.slice(1)) {
            await page.locator('#gallery-actor').selectOption(actorType);
            await waitForActor(page, actorType);
            await page.locator('#gallery-run-equipment').click();
            await expect.poll(async () => {
                const snapshot = await galleryMetrics(page);
                return snapshot.equipmentAuditRunning ? -1 : snapshot.equipmentAuditCompleted;
            }, { timeout: 120_000 }).toBe(equipmentFamilyCount);
            metrics = await galleryMetrics(page);
            expect(metrics.equipmentAuditPassed).toBe(equipmentFamilyCount);
            expect(metrics.proceduralClass).toBe(actorType);
            for (const quality of ['high', 'low']) {
                await page.locator('#gallery-quality').selectOption(quality);
                await page.locator('#gallery-equip-all').click();
                await expect.poll(async () => (await galleryMetrics(page)).phase).toBe('equipment:full-loadout');
                metrics = await galleryMetrics(page);
                expect(metrics.proceduralClass).toBe(actorType);
                expect(metrics.quality).toBe(quality);
                expect(metrics.equipmentLocalItems).toBe(14);
                expect(metrics.equipmentRemoteItems).toBe(14);
                expect(metrics.equipmentLocalParts).toBeGreaterThanOrEqual(45);
                expect(metrics.equipmentRemoteParts).toBe(metrics.equipmentLocalParts);
                expect(metrics.nonFiniteTransforms).toBe(0);
                await page.screenshot({
                    path: testInfo.outputPath(`procedural-${actorType.toLowerCase()}-equipment-${quality}.png`),
                    animations: 'allow'
                });
            }
        }

        expect(failures, failures.join('\n')).toEqual([]);
        testInfo.annotations.push({
            type: 'renderer',
            description: `${renderer.vendor} · ${renderer.renderer}`
        });
    });

    test('renders every procedural Lanternhold service with a distinct animated identity', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        const response = await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);

        const renderer = await hardwareRenderer(page);
        expect(renderer).not.toBeNull();
        expect(`${renderer.vendor} ${renderer.renderer}`).not.toMatch(/swiftshader|llvmpipe|software/i);

        for (const [actorType, artStyle] of proceduralTownActorTypes) {
            await page.locator('#gallery-actor').selectOption(actorType);
            await waitForActor(page, actorType);
            await page.locator('#gallery-state').selectOption('Idle');
            await page.locator('#gallery-play-state').click();
            await expect.poll(async () => (await galleryMetrics(page)).phase).toBe('state:idle');
            let metrics = await galleryMetrics(page);
            expect(metrics.proceduralTownActor).toBe(true);
            expect(metrics.proceduralActorType).toBe(actorType);
            expect(metrics.actorArtStyle).toBe(artStyle);
            expect(metrics.currentAnimation).toBe('Idle');
            expect(metrics.actorVisibleMeshes).toBeGreaterThanOrEqual(40);
            expect(metrics.nonFiniteTransforms).toBe(0);

            for (const quality of ['high', 'low']) {
                await page.locator('#gallery-quality').selectOption(quality);
                await expect.poll(async () => (await galleryMetrics(page)).quality).toBe(quality);
                metrics = await galleryMetrics(page);
                expect(metrics.proceduralActorType).toBe(actorType);
                expect(metrics.nonFiniteTransforms).toBe(0);
                await page.screenshot({
                    path: testInfo.outputPath(`procedural-town-${actorType.toLowerCase()}-${quality}.png`),
                    animations: 'allow'
                });
            }
        }

        expect(failures, failures.join('\n')).toEqual([]);
        testInfo.annotations.push({
            type: 'renderer',
            description: `${renderer.vendor} · ${renderer.renderer}`
        });
    });

    test('renders every procedural summon state and quality tier in hardware Chrome', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        const response = await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);

        const renderer = await hardwareRenderer(page);
        expect(renderer).not.toBeNull();
        expect(`${renderer.vendor} ${renderer.renderer}`).not.toMatch(/swiftshader|llvmpipe|software/i);

        for (const [actorType, artStyle] of proceduralSummonTypes) {
            await page.locator('#gallery-actor').selectOption(actorType);
            await waitForActor(page, actorType);
            let metrics = await galleryMetrics(page);
            expect(metrics.proceduralSummon).toBe(true);
            expect(metrics.proceduralActorType).toBe(actorType);
            expect(metrics.actorArtStyle).toBe(artStyle);
            expect(metrics.actorVisibleMeshes).toBeGreaterThanOrEqual(65);

            for (const state of ['Idle', 'Walk', 'Run', 'Attack', 'Death']) {
                await page.locator('#gallery-state').selectOption(state);
                await page.locator('#gallery-play-state').click();
                await expect.poll(async () => (await galleryMetrics(page)).phase).toBe(`state:${state.toLowerCase()}`);
                metrics = await galleryMetrics(page);
                expect(metrics.currentAnimation).toBe(state);
                expect(metrics.nonFiniteTransforms).toBe(0);
            }

            for (const quality of ['high', 'low']) {
                await page.locator('#gallery-quality').selectOption(quality);
                await page.locator('#gallery-state').selectOption('Idle');
                await page.locator('#gallery-play-state').click();
                await expect.poll(async () => (await galleryMetrics(page)).quality).toBe(quality);
                metrics = await galleryMetrics(page);
                expect(metrics.proceduralSummon).toBe(true);
                expect(metrics.nonFiniteTransforms).toBe(0);
                await page.screenshot({
                    path: testInfo.outputPath(`procedural-summon-${actorType.toLowerCase()}-${quality}.png`),
                    animations: 'allow'
                });
            }
        }

        expect(failures, failures.join('\n')).toEqual([]);
        testInfo.annotations.push({
            type: 'renderer',
            description: `${renderer.vendor} · ${renderer.renderer}`
        });
    });

    test('renders each migrated regional enemy silhouette, state, and quality tier in hardware Chrome', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        const response = await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);

        const renderer = await hardwareRenderer(page);
        expect(renderer).not.toBeNull();
        expect(`${renderer.vendor} ${renderer.renderer}`).not.toMatch(/swiftshader|llvmpipe|software/i);

        for (const [actorType, artStyle] of proceduralRegionalEnemyTypes) {
            await page.locator('#gallery-actor').selectOption(actorType);
            await waitForActor(page, actorType);
            let metrics = await galleryMetrics(page);
            expect(metrics.proceduralEnemyFamily).toBe(true);
            expect(metrics.proceduralActorType).toBe(actorType);
            expect(metrics.actorArtStyle).toBe(artStyle);
            expect(metrics.actorVisibleMeshes).toBeGreaterThanOrEqual(45);
            if (proceduralMoltenBossTypes.has(actorType)) {
                expect(metrics.proceduralBossFamily).toBe('molten-core');
            }
            if (proceduralTempestBossTypes.has(actorType)) {
                expect(metrics.proceduralBossFamily).toBe('tempest-spire');
            }
            if (proceduralAbyssalBossTypes.has(actorType)) {
                expect(metrics.proceduralBossFamily).toBe('abyssal-well');
            }
            if (proceduralCinderEnemyTypes.has(actorType)) {
                expect(metrics.proceduralOverworldFamily).toBe('cinder-wastes');
            }
            if (proceduralStormcrownEnemyTypes.has(actorType)) {
                expect(metrics.proceduralOverworldFamily).toBe('stormcrown-reach');
            }

            for (const state of ['Idle', 'Walk', 'Run', 'Attack', 'Death']) {
                await page.locator('#gallery-state').selectOption(state);
                await page.locator('#gallery-play-state').click();
                await expect.poll(async () => (await galleryMetrics(page)).phase).toBe(`state:${state.toLowerCase()}`);
                metrics = await galleryMetrics(page);
                expect(metrics.currentAnimation).toBe(state);
                expect(metrics.nonFiniteTransforms).toBe(0);
            }

            for (const quality of ['high', 'low']) {
                await page.locator('#gallery-quality').selectOption(quality);
                await page.locator('#gallery-state').selectOption('Idle');
                await page.locator('#gallery-play-state').click();
                await expect.poll(async () => (await galleryMetrics(page)).quality).toBe(quality);
                metrics = await galleryMetrics(page);
                expect(metrics.proceduralEnemyFamily).toBe(true);
                expect(metrics.nonFiniteTransforms).toBe(0);
                await page.screenshot({
                    path: testInfo.outputPath(`procedural-regional-enemy-${actorType.toLowerCase()}-${quality}.png`),
                    animations: 'allow'
                });
            }
        }

        expect(failures, failures.join('\n')).toEqual([]);
        testInfo.annotations.push({
            type: 'renderer',
            description: `${renderer.vendor} · ${renderer.renderer}`
        });
    });

    test('renders all abilities, actor states, persistent effects, and cleanup in hardware Chrome', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        const response = await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);
        await expect(page.locator('#animation-gallery')).toBeVisible();
        await waitForActor(page, 'Cleric');

        const renderer = await hardwareRenderer(page);
        expect(renderer).not.toBeNull();
        expect(`${renderer.vendor} ${renderer.renderer}`).not.toMatch(/swiftshader|llvmpipe|software/i);

        await page.locator('#gallery-class').selectOption('Fighter');
        await waitForActor(page, 'Fighter');
        await page.locator('#gallery-ability').selectOption('Shield Slam');
        await page.locator('#gallery-cast').click();
        await expect.poll(async () => (await galleryMetrics(page)).lastAbilityCastVisuals.length).toBe(4);
        let metrics = await galleryMetrics(page);
        const shieldSlamCones = metrics.lastAbilityCastVisuals.filter((castVisual) => castVisual.type === 'cone');
        expect(shieldSlamCones).toHaveLength(2);
        expect(shieldSlamCones.every((castVisual) =>
            castVisual.abilityName === 'Shield Slam' &&
            castVisual.gameplayRadius === 4 &&
            castVisual.gameplayArc === Math.PI / 2 &&
            castVisual.boundaryParts === 3 &&
            castVisual.hasExactBoundary
        )).toBe(true);
        await page.locator('#animation-gallery').evaluate((panel) => { panel.style.visibility = 'hidden'; });
        await page.screenshot({
            path: testInfo.outputPath('procedural-shield-slam-exact-cone.png'),
            animations: 'allow'
        });
        await page.locator('#animation-gallery').evaluate((panel) => { panel.style.visibility = ''; });

        await page.locator('#gallery-class').selectOption('Wizard');
        await waitForActor(page, 'Wizard');
        expect(await page.evaluate(() =>
            window.__eidolonAnimationGalleryController.presentCompatibilityAbility('Frost Nova')
        )).toBe(true);
        await expect.poll(async () => (await galleryMetrics(page)).lastAbilityCastVisuals.length).toBe(4);
        metrics = await galleryMetrics(page);
        expect(metrics.lastAbilityCastVisuals.every((castVisual) =>
            castVisual.abilityName === 'Flame Whip' &&
            castVisual.requestedAbilityName === 'Frost Nova' &&
            castVisual.motif === 'rimeglass-nova' &&
            castVisual.artStyle === 'rimeglass nova and winter-chain release'
        )).toBe(true);
        expect(metrics.lastAbilityCastVisuals.filter((castVisual) => castVisual.gameplayRadius === 8))
            .toHaveLength(2);
        await page.locator('#animation-gallery').evaluate((panel) => { panel.style.visibility = 'hidden'; });
        await page.screenshot({
            path: testInfo.outputPath('procedural-frost-nova-rimeglass.png'),
            animations: 'allow'
        });
        await page.locator('#animation-gallery').evaluate((panel) => { panel.style.visibility = ''; });

        await page.locator('#gallery-class').selectOption('Cleric');
        await waitForActor(page, 'Cleric');
        await page.locator('#gallery-ability').selectOption('Spirit Guardians');
        await page.locator('#gallery-persist').click();
        await expect.poll(async () => (await galleryMetrics(page)).spiritGuardians).toBe(6);
        metrics = await galleryMetrics(page);
        expect(metrics.effectVisibleMeshes).toBeGreaterThan(0);
        expect(metrics.nonFiniteTransforms).toBe(0);
        await page.screenshot({
            path: testInfo.outputPath('spirit-guardians-high.png'),
            animations: 'allow'
        });

        await page.locator('#gallery-quality').selectOption('low');
        await page.locator('#gallery-persist').click();
        await expect.poll(async () => (await galleryMetrics(page)).quality).toBe('low');
        expect((await galleryMetrics(page)).spiritGuardians).toBe(6);
        await page.screenshot({
            path: testInfo.outputPath('spirit-guardians-low.png'),
            animations: 'allow'
        });

        for (const [runeId, expectedEffectRadius, expectedOrbitRadius, expectedColor] of [
            ['spirits_expanded', 24, 18, 0xffd75a],
            ['spirits_vengeful', 16, 12, 0xffb52e],
            ['spirits_sanctuary', 16, 12, 0xbfffd8]
        ]) {
            await page.locator('#gallery-rune').selectOption(runeId);
            await page.locator('#gallery-persist').click();
            await expect.poll(async () => {
                const snapshot = await galleryMetrics(page);
                return snapshot.spiritVariants.length === 2 && snapshot.spiritVariants.every((variant) =>
                    variant.runeId === runeId &&
                    variant.effectRadius === expectedEffectRadius &&
                    variant.orbitRadius === expectedOrbitRadius &&
                    variant.color === expectedColor
                );
            }).toBe(true);
        }

        await page.locator('#gallery-rune').selectOption('');
        await page.locator('#gallery-ability').selectOption('Spirit Guardians Boost');
        await page.locator('#gallery-persist').click();
        await expect.poll(async () => (await galleryMetrics(page)).spiritGuardians).toBe(10);

        await page.locator('#gallery-cleanup').click();
        await expect.poll(async () => {
            const snapshot = await galleryMetrics(page);
            return snapshot.activeTransientEffects + snapshot.persistentEntities +
                snapshot.attachedEffects + snapshot.spiritGuardians;
        }).toBe(0);

        for (const expected of [
            { className: 'Wizard', ability: 'Inferno Cataclysm', type: 'ZoneDamage', family: 'wizard', role: 'zone', radius: 12 },
            { className: 'Cleric', ability: 'Consecrated Ground', type: 'ZoneHoly', family: 'cleric', role: 'zone', radius: 5 },
            { className: 'Rogue', ability: 'Tripwire', type: 'Tripwire', family: 'rogue', role: 'trap', radius: 1.5 }
        ]) {
            await page.locator('#gallery-class').selectOption(expected.className);
            await waitForActor(page, expected.className);
            await page.locator('#gallery-ability').selectOption(expected.ability);
            await page.locator('#gallery-persist').click();
            await expect.poll(async () => {
                const snapshot = await galleryMetrics(page);
                return snapshot.proceduralProjectileVisuals?.[0] || null;
            }).toEqual(expect.objectContaining({
                type: expected.type,
                family: expected.family,
                role: expected.role,
                gameplayRadius: expected.radius
            }));
        }

        await page.locator('#gallery-quality').selectOption('high');
        for (const expected of [
            { className: 'Wizard', ability: 'Gravity Well', runeId: '', type: 'GravityWell', family: 'wizard', radius: 8 },
            { className: 'Wizard', ability: 'Gravity Well', runeId: 'gravitywell_expanded', type: 'GravityWell', family: 'wizard', radius: 12 },
            { className: 'Rogue', ability: 'Smoke Bomb', runeId: '', type: 'SmokeBomb', family: 'rogue', radius: 5 }
        ]) {
            await page.locator('#gallery-class').selectOption(expected.className);
            await waitForActor(page, expected.className);
            await page.locator('#gallery-ability').selectOption(expected.ability);
            await page.locator('#gallery-rune').selectOption(expected.runeId);
            await page.locator('#gallery-persist').click();
            await expect.poll(async () => {
                const snapshot = await galleryMetrics(page);
                return snapshot.proceduralAreaFields?.[0] || null;
            }).toEqual(expect.objectContaining({
                type: expected.type,
                family: expected.family,
                gameplayRadius: expected.radius
            }));
            const fieldMetrics = await galleryMetrics(page);
            expect(fieldMetrics.proceduralAreaFields[0].artStyle.length).toBeGreaterThan(8);
            expect(fieldMetrics.nonFiniteTransforms).toBe(0);
            await page.evaluate(() => {
                const controller = window.__eidolonAnimationGalleryController;
                [controller.actor, controller.remoteActor, controller.targetActor].forEach((actor) => {
                    if (actor?.mesh) actor.mesh.visible = false;
                });
            });
            await page.locator('#animation-gallery').evaluate((panel) => {
                panel.style.visibility = 'hidden';
            });
            await page.screenshot({
                path: testInfo.outputPath(`procedural-${expected.type.toLowerCase()}-${expected.radius}.png`),
                animations: 'allow'
            });
            await page.locator('#animation-gallery').evaluate((panel) => {
                panel.style.visibility = '';
            });
            await page.evaluate(() => {
                const controller = window.__eidolonAnimationGalleryController;
                [controller.actor, controller.remoteActor, controller.targetActor].forEach((actor) => {
                    if (actor?.mesh) actor.mesh.visible = true;
                });
            });
        }

        for (const [role, expectedCount] of [['projectile', 7], ['trap', 3], ['zone', 3]]) {
            await page.evaluate((galleryRole) => {
                window.__eidolonAnimationGalleryController.presentProjectileGallery(galleryRole);
            }, role);
            await expect.poll(async () => {
                const snapshot = await galleryMetrics(page);
                return snapshot.phase === `projectiles:${role}`
                    ? snapshot.proceduralProjectileVisuals.length
                    : -1;
            }).toBe(expectedCount);
            const projectileMetrics = await galleryMetrics(page);
            expect(projectileMetrics.proceduralProjectileVisuals.every((entry) =>
                entry.role === role && entry.artStyle.length > 8 && entry.gameplayRadius > 0
            )).toBe(true);
            expect(projectileMetrics.nonFiniteTransforms).toBe(0);
            await page.locator('#animation-gallery').evaluate((panel) => {
                panel.style.visibility = 'hidden';
            });
            await page.screenshot({
                path: testInfo.outputPath(`procedural-${role}-gallery.png`),
                animations: 'allow'
            });
            await page.locator('#animation-gallery').evaluate((panel) => {
                panel.style.visibility = '';
            });
        }

        for (const [kind, expectedCount] of [['direct', 7], ['aoe', 3]]) {
            await page.evaluate((galleryKind) => {
                window.__eidolonAnimationGalleryController.presentProjectileImpactGallery(galleryKind);
            }, kind);
            await expect.poll(async () => {
                const snapshot = await galleryMetrics(page);
                return snapshot.phase === `projectile-impacts:${kind}`
                    ? snapshot.proceduralProjectileImpacts.length
                    : -1;
            }).toBe(expectedCount);
            const impactMetrics = await galleryMetrics(page);
            expect(impactMetrics.proceduralProjectileImpacts.every((entry) =>
                entry.artStyle.length > 16 && entry.motif.length > 8 && entry.visibleParts >= 8 && entry.hasExactBoundary
            )).toBe(true);
            expect(impactMetrics.nonFiniteTransforms).toBe(0);
            expect(impactMetrics.proceduralProjectileImpactCache.geometries).toBeGreaterThan(5);
            expect(impactMetrics.proceduralProjectileImpactCache.materials).toBeGreaterThan(0);
            await page.locator('#animation-gallery').evaluate((panel) => {
                panel.style.visibility = 'hidden';
            });
            await page.screenshot({
                path: testInfo.outputPath(`procedural-projectile-impact-${kind}-gallery.png`),
                animations: 'allow'
            });
            await page.locator('#animation-gallery').evaluate((panel) => {
                panel.style.visibility = '';
            });
        }

        for (const [kind, expectedCount] of [['damage', 12], ['restoration', 4]]) {
            await page.evaluate((galleryKind) => {
                window.__eidolonAnimationGalleryController.presentCombatFeedbackGallery(galleryKind);
            }, kind);
            await expect.poll(async () => {
                const snapshot = await galleryMetrics(page);
                return snapshot.phase === `combat-feedback:${kind}`
                    ? snapshot.proceduralCombatFeedback.length
                    : -1;
            }).toBe(expectedCount);
            const feedbackMetrics = await galleryMetrics(page);
            expect(feedbackMetrics.proceduralCombatFeedback.every((entry) =>
                entry.artStyle.length > 16 && entry.motif.length > 8 && entry.visibleParts >= 6
            )).toBe(true);
            expect(new Set(feedbackMetrics.proceduralCombatFeedback.map((entry) => entry.motif)).size).toBe(expectedCount);
            expect(feedbackMetrics.nonFiniteTransforms).toBe(0);
            expect(feedbackMetrics.proceduralCombatFeedbackCache.geometries).toBeGreaterThan(5);
            expect(feedbackMetrics.proceduralCombatFeedbackCache.materials).toBeGreaterThan(0);
            await page.locator('#animation-gallery').evaluate((panel) => {
                panel.style.visibility = 'hidden';
            });
            await page.screenshot({
                path: testInfo.outputPath(`procedural-combat-feedback-${kind}-gallery.png`),
                animations: 'allow'
            });
            await page.locator('#animation-gallery').evaluate((panel) => {
                panel.style.visibility = '';
            });
        }

        for (const quality of ['high', 'low']) {
            await page.locator('#gallery-quality').selectOption(quality);
            await page.locator('#gallery-run-all').click();
            await expect.poll(async () => {
                const snapshot = await galleryMetrics(page);
                return snapshot.auditRunning ? -1 : snapshot.auditCompleted;
            }, { timeout: 240_000 }).toBe(presentationCount);
            metrics = await galleryMetrics(page);
            expect(metrics.auditPassed).toBe(presentationCount);
            expect(metrics.nonFiniteTransforms).toBe(0);
            expect(metrics.proceduralAbilityCastCache.geometries).toBeGreaterThan(10);
            expect(metrics.proceduralAbilityCastCache.materials).toBeGreaterThan(200);
        }

        for (const entry of actorEntries) {
            await page.locator('#gallery-actor').selectOption(entry.type);
            await waitForActor(page, entry.type);
            for (const state of entry.states) {
                await page.locator('#gallery-state').selectOption(state);
                await page.locator('#gallery-play-state').click();
                await expect.poll(async () => (await galleryMetrics(page)).phase).toBe(`state:${state.toLowerCase()}`);
                const snapshot = await galleryMetrics(page);
                expect(snapshot.actorVisibleMeshes, `${entry.type}/${state} has no visible mesh`).toBeGreaterThan(0);
                expect(snapshot.clipNames, `${entry.type}/${state} has no declared clip`).toContain(state);
                expect(snapshot.lastStatePlayback).toEqual(expect.objectContaining({
                    actorType: entry.type,
                    state,
                    played: true,
                    startedAnimation: state
                }));
                if (state === 'Attack') expect(['Attack', 'Idle']).toContain(snapshot.currentAnimation);
                else expect(snapshot.currentAnimation).toBe(state);
                expect(snapshot.nonFiniteTransforms).toBe(0);
            }
            if (entry.jump !== 'not-used') {
                await page.locator('#gallery-state').selectOption('Jump');
                await page.locator('#gallery-play-state').click();
                await expect.poll(async () => (await galleryMetrics(page)).phase).toBe('state:jump');
                const jump = await galleryMetrics(page);
                expect(jump.currentAnimation).toMatch(/^(Jump|Run|Walk)$/);
                expect(jump.nonFiniteTransforms).toBe(0);
            }
        }

        await page.locator('#gallery-cleanup').click();
        metrics = await galleryMetrics(page);
        expect(metrics.nonFiniteTransforms).toBe(0);
        expect(failures, failures.join('\n')).toEqual([]);
        testInfo.annotations.push({
            type: 'renderer',
            description: `${renderer.vendor} · ${renderer.renderer}`
        });
    });

    test('renders the complete procedural ability and item reliquary in hardware Chrome', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        const response = await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);
        await expect(page.locator('#animation-gallery')).toBeVisible();

        const renderer = await hardwareRenderer(page);
        expect(renderer).not.toBeNull();
        expect(`${renderer.vendor} ${renderer.renderer}`).not.toMatch(/swiftshader|llvmpipe|software/i);

        const iconGalleryCounts = {
            abilities: Object.keys(PROCEDURAL_ABILITY_ICON_DEFINITIONS).length,
            items: Object.keys(PROCEDURAL_ITEM_ICON_DEFINITIONS.equipment).length
                + Object.keys(PROCEDURAL_ITEM_ICON_DEFINITIONS.currency).length,
            gems: Object.keys(PROCEDURAL_ITEM_ICON_DEFINITIONS.gems).length
        };
        for (const [kind, expectedCount] of Object.entries(iconGalleryCounts)) {
            await page.evaluate((galleryKind) => {
                window.__eidolonAnimationGalleryController.presentProceduralIconGallery(galleryKind);
            }, kind);
            await expect.poll(async () => {
                const snapshot = await galleryMetrics(page);
                return snapshot.phase === `procedural-icons:${kind}`
                    ? snapshot.proceduralIcons.length
                    : -1;
            }).toBe(expectedCount);
            const iconMetrics = await galleryMetrics(page);
            expect(iconMetrics.proceduralIcons.every((entry) => entry.procedural && entry.motif)).toBe(true);
            expect(new Set(iconMetrics.proceduralIcons.map((entry) => entry.key)).size).toBe(expectedCount);
            expect(iconMetrics.proceduralIconCache.icons).toBeGreaterThanOrEqual(expectedCount);
            expect(iconMetrics.proceduralIconCache.items)
                .toBeLessThanOrEqual(iconMetrics.proceduralIconCache.itemLimit);
            await expect.poll(() => page.locator('#procedural-icon-gallery-overlay img').evaluateAll((images) =>
                images.every((entry) => entry.complete && entry.naturalWidth > 0 && entry.naturalHeight > 0)
            )).toBe(true);
            await page.screenshot({
                path: testInfo.outputPath(`procedural-${kind}-icon-gallery.png`),
                animations: 'disabled'
            });
        }

        expect(failures, failures.join('\n')).toEqual([]);
        testInfo.annotations.push({
            type: 'renderer',
            description: `${renderer.vendor} · ${renderer.renderer}`
        });
    });

    test('renders every exact procedural world-loot form at High and Low quality', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        const response = await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);
        await expect(page.locator('#animation-gallery')).toBeVisible();

        const renderer = await hardwareRenderer(page);
        expect(renderer).not.toBeNull();
        expect(`${renderer.vendor} ${renderer.renderer}`).not.toMatch(/swiftshader|llvmpipe|software/i);

        const expected = {
            equipment: PROCEDURAL_LOOT_IDENTITIES.equipment,
            relics: [...PROCEDURAL_LOOT_IDENTITIES.gems, ...PROCEDURAL_LOOT_IDENTITIES.currency]
        };
        for (const quality of ['high', 'low']) {
            await page.locator('#gallery-quality').selectOption(quality);
            await expect.poll(async () => (await galleryMetrics(page)).quality).toBe(quality);
            for (const [kind, identities] of Object.entries(expected)) {
                await page.evaluate((galleryKind) => {
                    window.__eidolonAnimationGalleryController.presentProceduralLootGallery(galleryKind);
                }, kind);
                await expect.poll(async () => {
                    const snapshot = await galleryMetrics(page);
                    return snapshot.phase === `procedural-loot:${kind}`
                        ? snapshot.proceduralLoot.length
                        : -1;
                }).toBe(identities.length);
                const metrics = await galleryMetrics(page);
                expect(metrics.proceduralLoot.map((entry) => entry.identity)).toEqual(identities);
                expect(new Set(metrics.proceduralLoot.map((entry) => entry.identity)).size).toBe(identities.length);
                expect(metrics.proceduralLoot.every((entry) =>
                    entry.quality === quality && entry.family && entry.motif && entry.artStyle.length > 16
                    && entry.visibleParts >= 5
                    && entry.finite && entry.hasHitbox && entry.hasLabel
                )).toBe(true);
                expect(metrics.proceduralLootCache.geometries).toBeGreaterThanOrEqual(4);
                expect(metrics.proceduralLootCache.materials).toBeGreaterThanOrEqual(7);
                await page.locator('#animation-gallery').evaluate((panel) => {
                    panel.style.visibility = 'hidden';
                });
                await page.screenshot({
                    path: testInfo.outputPath(`procedural-world-loot-${kind}-${quality}.png`),
                    animations: 'allow'
                });
                await page.locator('#animation-gallery').evaluate((panel) => {
                    panel.style.visibility = '';
                });
            }
        }

        expect(failures, failures.join('\n')).toEqual([]);
        testInfo.annotations.push({
            type: 'renderer',
            description: `${renderer.vendor} · ${renderer.renderer}`
        });
    });

    test('renders every attached buff and debuff relic on local and remote actors in hardware Chrome', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        const response = await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);
        await expect(page.locator('#animation-gallery')).toBeVisible();
        await waitForActor(page, 'Cleric');
        await page.locator('#gallery-remote').check();

        const renderer = await hardwareRenderer(page);
        expect(renderer).not.toBeNull();
        expect(`${renderer.vendor} ${renderer.renderer}`).not.toMatch(/swiftshader|llvmpipe|software/i);

        const classForFamily = {
            fighter: 'Fighter',
            rogue: 'Rogue',
            wizard: 'Wizard',
            cleric: 'Cleric',
            relic: 'Fighter',
            control: 'Fighter',
            affliction: 'Fighter'
        };
        const statusEntries = Object.entries(PROCEDURAL_STATUS_EFFECT_DEFINITIONS)
            .sort(([, left], [, right]) => left.family.localeCompare(right.family));
        const seenMotifs = new Set();
        const seenArtStyles = new Set();
        const screenshotStatuses = new Set([
            'iron_fortress', 'stealth', 'spell_focus', 'divine_intervention',
            'swift', 'frozen', 'poisoned'
        ]);
        let currentClass = '';

        for (const quality of ['high', 'low']) {
            await page.locator('#gallery-quality').selectOption(quality);
            for (const [statusKey, definition] of statusEntries) {
                const className = classForFamily[definition.family];
                if (className !== currentClass) {
                    await page.locator('#gallery-class').selectOption(className);
                    await waitForActor(page, className);
                    currentClass = className;
                }
                const ownerRole = quality === 'high' ? 'local' : 'remote';
                const presented = await page.evaluate(({ key, role }) =>
                    window.__eidolonAnimationGalleryController.presentStatus(key, role),
                { key: statusKey, role: ownerRole });
                expect(presented, `${statusKey}/${quality} did not present`).toBe(true);
                await expect.poll(async () => (await galleryMetrics(page)).phase)
                    .toBe(`status:${statusKey}`);
                const metrics = await galleryMetrics(page);
                expect(metrics.attachedEffects, `${statusKey}/${quality} leaked another status`).toBe(1);
                expect(metrics.proceduralStatusVisuals).toEqual([
                    expect.objectContaining({
                        statusKey,
                        family: definition.family,
                        polarity: definition.polarity,
                        motif: definition.motif,
                        artStyle: definition.artStyle,
                        quality,
                        visibleParts: expect.any(Number)
                    })
                ]);
                expect(metrics.proceduralStatusVisuals[0].visibleParts)
                    .toBeGreaterThanOrEqual(quality === 'high' ? 5 : 3);
                expect(metrics.nonFiniteTransforms).toBe(0);
                seenMotifs.add(metrics.proceduralStatusVisuals[0].motif);
                seenArtStyles.add(metrics.proceduralStatusVisuals[0].artStyle);

                if (quality === 'high' && screenshotStatuses.has(statusKey)) {
                    await page.locator('#animation-gallery').evaluate((panel) => {
                        panel.style.visibility = 'hidden';
                    });
                    await page.screenshot({
                        path: testInfo.outputPath(`procedural-status-${statusKey}.png`),
                        animations: 'allow'
                    });
                    await page.locator('#animation-gallery').evaluate((panel) => {
                        panel.style.visibility = '';
                    });
                }
            }
        }

        const metrics = await galleryMetrics(page);
        expect(seenMotifs.size).toBe(statusEntries.length);
        expect(seenArtStyles.size).toBe(statusEntries.length);
        expect(metrics.proceduralStatusCache.geometries).toBeGreaterThan(8);
        expect(metrics.proceduralStatusCache.materials).toBeGreaterThan(20);
        await page.locator('#gallery-cleanup').click();
        await expect.poll(async () => (await galleryMetrics(page)).attachedEffects).toBe(0);
        expect(failures, failures.join('\n')).toEqual([]);
        testInfo.annotations.push({
            type: 'renderer',
            description: `${renderer.vendor} · ${renderer.renderer}`
        });
    });

    test('renders every active regional hazard with its exact authoritative footprint', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        const response = await page.goto('/repro.html?hazards=1&instances=1', { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);

        await expect.poll(() => page.evaluate(() => window.__eidolonHazardGallery?.ready || false)).toBe(true);
        const renderer = await hardwareRenderer(page);
        expect(renderer).not.toBeNull();
        expect(`${renderer.vendor} ${renderer.renderer}`).not.toMatch(/swiftshader|llvmpipe|software/i);

        const highMetrics = await page.evaluate(() => window.__eidolonHazardGallery);
        expect(highMetrics.quality).toBe('high');
        expect(highMetrics.hazards).toHaveLength(65);
        expect(Object.fromEntries(['earth', 'water', 'fire', 'air'].map((realm) => [
            realm,
            highMetrics.hazards.filter((hazard) => hazard.realm === realm).length
        ]))).toEqual({ earth: 12, water: 15, fire: 19, air: 19 });
        expect(Object.fromEntries(['sandstorm', 'lightning_zone', 'lava_pool', 'wind_gust'].map((type) => [
            type,
            highMetrics.hazards.filter((hazard) => hazard.type === type).length
        ]))).toEqual({ sandstorm: 12, lightning_zone: 15, lava_pool: 19, wind_gust: 19 });
        for (const hazard of highMetrics.hazards) {
            expect(hazard.boundaryRadius).toBeCloseTo(hazard.radius, 5);
            expect(hazard.themeName).toBeTruthy();
            expect(hazard.meshCount).toBeGreaterThan(1);
            expect(hazard.particleCount).toBeGreaterThan(0);
            expect(hazard.quality).toBe('high');
            expect(hazard.finite).toBe(true);
        }
        expect(highMetrics.attachedMeshCount).toBe(
            highMetrics.hazards.reduce((sum, hazard) => sum + hazard.meshCount, 0)
        );

        await page.screenshot({
            path: testInfo.outputPath('dark-fantasy-world-hazards-high.png'),
            animations: 'allow'
        });

        await page.evaluate(() => window.__eidolonSetHazardQuality('low'));
        await expect.poll(() => page.evaluate(() => window.__eidolonHazardGallery?.quality)).toBe('low');
        const lowMetrics = await page.evaluate(() => window.__eidolonHazardGallery);
        expect(lowMetrics.generation).toBe(highMetrics.generation + 1);
        expect(lowMetrics.hazards).toHaveLength(65);
        expect(lowMetrics.hazards.map((hazard) => hazard.id)).toEqual(
            highMetrics.hazards.map((hazard) => hazard.id)
        );
        expect(lowMetrics.hazards.map((hazard) => hazard.authoritativePosition)).toEqual(
            highMetrics.hazards.map((hazard) => hazard.authoritativePosition)
        );
        for (const hazard of lowMetrics.hazards) {
            expect(hazard.boundaryRadius).toBeCloseTo(hazard.radius, 5);
            expect(hazard.quality).toBe('low');
            expect(hazard.finite).toBe(true);
        }
        expect(lowMetrics.attachedMeshCount).toBe(
            lowMetrics.hazards.reduce((sum, hazard) => sum + hazard.meshCount, 0)
        );
        expect(lowMetrics.hazards.reduce((sum, hazard) => sum + hazard.particleCount, 0))
            .toBeLessThan(highMetrics.hazards.reduce((sum, hazard) => sum + hazard.particleCount, 0));
        expect(lowMetrics.hazards.reduce((sum, hazard) => sum + hazard.boundaryVertices, 0))
            .toBeLessThan(highMetrics.hazards.reduce((sum, hazard) => sum + hazard.boundaryVertices, 0));

        await page.screenshot({
            path: testInfo.outputPath('dark-fantasy-world-hazards-low.png'),
            animations: 'allow'
        });
        expect(failures, failures.join('\n')).toEqual([]);
    });

    test('renders every procedural realm foliage family in hardware Chrome', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        const response = await page.goto('/repro.html?foliage=1&instances=1', { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);

        await expect.poll(() => page.evaluate(() => window.__eidolonFoliageGallery?.ready || false)).toBe(true);
        const renderer = await hardwareRenderer(page);
        expect(renderer).not.toBeNull();
        expect(`${renderer.vendor} ${renderer.renderer}`).not.toMatch(/swiftshader|llvmpipe|software/i);

        const metrics = await page.evaluate(() => window.__eidolonFoliageGallery);
        expect(metrics.foliage.map((entry) => entry.id)).toEqual(
            PROCEDURAL_FOLIAGE_RECIPES.map((recipe) => recipe.id)
        );
        expect(new Set(metrics.foliage.map((entry) => entry.region))).toEqual(
            new Set(['earth', 'water', 'fire', 'air'])
        );
        for (const entry of metrics.foliage) {
            expect(entry.theme).toBeTruthy();
            expect(entry.meshCount).toBeGreaterThanOrEqual(4);
            expect(entry.height).toBeGreaterThan(2);
            expect(entry.finite).toBe(true);
        }
        expect(metrics.cache).toEqual({ geometries: 10, materials: 28, archetypes: 9 });

        await page.screenshot({
            path: testInfo.outputPath('dark-fantasy-realm-foliage.png'),
            animations: 'allow',
            fullPage: true
        });
        expect(failures, failures.join('\n')).toEqual([]);
    });

    test('renders every code-generated realm surface at High and Low quality without raster requests', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        const authoredRasterRequests = [];
        page.on('request', (request) => {
            if (/\/assets\/(?:backgrounds\/[^?]+|favicon)\.png(?:\?|$)/i.test(request.url())) {
                authoredRasterRequests.push(request.url());
            }
        });
        const response = await page.goto('/repro.html?terrain=1&instances=1', { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);

        await expect.poll(() => page.evaluate(() => window.__eidolonTerrainGallery?.ready || false)).toBe(true);
        const renderer = await hardwareRenderer(page);
        expect(renderer).not.toBeNull();
        expect(`${renderer.vendor} ${renderer.renderer}`).not.toMatch(/swiftshader|llvmpipe|software/i);

        const expectedKeys = ['earth', 'town', 'water', 'fire', 'air', 'ocean'];
        for (const quality of ['high', 'low']) {
            await page.evaluate((value) => window.__eidolonSetTerrainQuality(value), quality);
            await expect.poll(() => page.evaluate(() => window.__eidolonTerrainGallery.quality)).toBe(quality);
            const metrics = await page.evaluate(() => window.__eidolonTerrainGallery);
            expect(metrics.terrain.map((entry) => entry.key)).toEqual(expectedKeys);
            expect(new Set(metrics.terrain.map((entry) => entry.signature)).size).toBe(expectedKeys.length);
            expect(metrics.terrain.every((entry) => (
                entry.id === PROCEDURAL_TERRAIN_DEFINITIONS[entry.key].id
                && entry.motif === PROCEDURAL_TERRAIN_DEFINITIONS[entry.key].motif
                && entry.quality === quality
                && entry.resolution === (quality === 'low' ? 128 : 256)
                && entry.codeGenerated
                && entry.visibleParts === 7
                && entry.finite
                && entry.material === 'MeshStandardMaterial'
                && entry.dataTexture
            ))).toBe(true);
            await page.screenshot({
                path: testInfo.outputPath(`procedural-realm-terrain-${quality}.png`),
                animations: 'disabled',
                fullPage: true
            });
        }

        expect(authoredRasterRequests).toEqual([]);
        expect(failures, failures.join('\n')).toEqual([]);
        testInfo.annotations.push({
            type: 'renderer',
            description: `${renderer.vendor} · ${renderer.renderer}`
        });
    });

    test('renders every collision-faithful Lanternhold structure at High and Low quality', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        const authoredModelRequests = [];
        page.on('request', (request) => {
            if (/\.glb(?:\?|$)/i.test(request.url())) authoredModelRequests.push(request.url());
        });
        const response = await page.goto('/repro.html?architecture=1&instances=1', { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);

        await expect.poll(() => page.evaluate(() => window.__eidolonArchitectureGallery?.ready || false)).toBe(true);
        const renderer = await hardwareRenderer(page);
        expect(renderer).not.toBeNull();
        expect(`${renderer.vendor} ${renderer.renderer}`).not.toMatch(/swiftshader|llvmpipe|software/i);

        let metrics = await page.evaluate(() => window.__eidolonArchitectureGallery);
        expect(metrics.structures.map((entry) => entry.id)).toEqual(LANTERNHOLD_STRUCTURE_IDS);
        expect(metrics.cache).toEqual({ geometries: 10, materials: 15, structures: 7 });
        for (const entry of metrics.structures) {
            expect(entry.artStyle).toBe(LANTERNHOLD_STRUCTURE_DEFINITIONS[entry.id].artStyle);
            expect(entry.role).toBeTruthy();
            expect(entry.meshCount).toBeGreaterThanOrEqual(entry.id === 'camp' ? 13 : 11);
            expect(entry.finite).toBe(true);
            entry.expectedSize.forEach((value, index) => expect(entry.size[index]).toBeCloseTo(value, 4));
        }
        expect(authoredModelRequests).toEqual([]);

        for (const quality of ['high', 'low']) {
            await page.evaluate((value) => window.__eidolonSetArchitectureQuality(value), quality);
            await expect.poll(() => page.evaluate(() => window.__eidolonArchitectureGallery.quality)).toBe(quality);
            metrics = await page.evaluate(() => window.__eidolonArchitectureGallery);
            expect(metrics.structures.every((entry) => entry.finite)).toBe(true);
            await page.screenshot({
                path: testInfo.outputPath(`procedural-lanternhold-architecture-${quality}.png`),
                animations: 'allow',
                fullPage: true
            });
        }

        expect(failures, failures.join('\n')).toEqual([]);
        testInfo.annotations.push({
            type: 'renderer',
            description: `${renderer.vendor} · ${renderer.renderer}`
        });
    });

    test('renders every exact-footprint procedural dungeon entrance at High and Low quality', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        const authoredModelRequests = [];
        page.on('request', (request) => {
            if (/\.glb(?:\?|$)/i.test(request.url())) authoredModelRequests.push(request.url());
        });
        const response = await page.goto('/repro.html?entrances=1&instances=1', { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);

        await expect.poll(() => page.evaluate(() => window.__eidolonEntranceGallery?.ready || false)).toBe(true);
        const renderer = await hardwareRenderer(page);
        expect(renderer).not.toBeNull();
        expect(`${renderer.vendor} ${renderer.renderer}`).not.toMatch(/swiftshader|llvmpipe|software/i);

        let metrics = await page.evaluate(() => window.__eidolonEntranceGallery);
        expect(metrics.entrances.map((entry) => entry.dungeonType)).toEqual(DUNGEON_ENTRANCE_IDS);
        expect(metrics.cache).toEqual({ geometries: 11, materials: 25, entrances: 4 });
        expect(new Set(metrics.entrances.map((entry) => entry.artStyle)).size).toBe(4);
        for (const entry of metrics.entrances) {
            const definition = DUNGEON_ENTRANCE_DEFINITIONS[entry.dungeonType];
            expect(entry.label).toBe(definition.label);
            expect(entry.artStyle).toBe(definition.artStyle);
            expect(entry.meshCount).toBeGreaterThanOrEqual(24);
            expect(entry.portalSurfaceCount).toBeGreaterThanOrEqual(3);
            expect(entry.interactionRadius).toBeCloseTo(definition.interactionRadius, 8);
            expect(entry.finite).toBe(true);
            entry.expectedSize.forEach((value, index) => expect(entry.size[index]).toBeCloseTo(value, 5));
        }
        expect(authoredModelRequests).toEqual([]);

        for (const quality of ['high', 'low']) {
            await page.evaluate((value) => window.__eidolonSetEntranceQuality(value), quality);
            await expect.poll(() => page.evaluate(() => window.__eidolonEntranceGallery.quality)).toBe(quality);
            metrics = await page.evaluate(() => window.__eidolonEntranceGallery);
            expect(metrics.entrances.every((entry) => entry.finite)).toBe(true);
            await page.screenshot({
                path: testInfo.outputPath(`procedural-dungeon-entrances-${quality}.png`),
                animations: 'allow',
                fullPage: true
            });
        }

        expect(failures, failures.join('\n')).toEqual([]);
        testInfo.annotations.push({
            type: 'renderer',
            description: `${renderer.vendor} · ${renderer.renderer}`
        });
    });

    test('renders every procedural dungeon surface and room identity at High and Low quality', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        const authoredDungeonTextureRequests = [];
        page.on('request', (request) => {
            if (/cobblestone(?:_walls)?\.png(?:\?|$)/i.test(request.url())) {
                authoredDungeonTextureRequests.push(request.url());
            }
        });
        const response = await page.goto('/repro.html?interiors=1&instances=1', { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);

        await expect.poll(() => page.evaluate(() => window.__eidolonInteriorGallery?.ready || false)).toBe(true);
        const renderer = await hardwareRenderer(page);
        expect(renderer).not.toBeNull();
        expect(`${renderer.vendor} ${renderer.renderer}`).not.toMatch(/swiftshader|llvmpipe|software/i);

        let metrics = await page.evaluate(() => window.__eidolonInteriorGallery);
        expect(metrics.interiors.map((entry) => entry.dungeonType)).toEqual(DUNGEON_INTERIOR_IDS);
        expect(new Set(metrics.interiors.map((entry) => entry.artStyle)).size).toBe(4);
        expect(new Set(metrics.interiors.map((entry) => entry.surfaceLanguage)).size).toBe(4);
        for (const entry of metrics.interiors) {
            expect(entry.artStyle).toBe(DUNGEON_INTERIOR_DEFINITIONS[entry.dungeonType].artStyle);
            expect(entry.surfaceCount).toBe(3);
            expect(entry.detailCount).toBeGreaterThanOrEqual(60);
            expect(entry.roomIdentities).toEqual(DUNGEON_ROOM_IDENTITY_IDS);
            expect(entry.roomStates).toEqual(expect.arrayContaining([
                'exit_ready',
                'cleared',
                'objective',
                'current',
                'dormant'
            ]));
            expect(entry.cache).toEqual({
                surfaceTextures: 4,
                surfaceMaterials: 3,
                surfaceGeometries: 3,
                detailGeometries: 8,
                detailMaterials: 5
            });
            expect(entry.finite).toBe(true);
        }
        expect(authoredDungeonTextureRequests).toEqual([]);

        for (const quality of ['high', 'low']) {
            await page.evaluate((value) => window.__eidolonSetInteriorQuality(value), quality);
            await expect.poll(() => page.evaluate(() => window.__eidolonInteriorGallery.quality)).toBe(quality);
            metrics = await page.evaluate(() => window.__eidolonInteriorGallery);
            expect(metrics.interiors.every((entry) => entry.finite)).toBe(true);
            await page.screenshot({
                path: testInfo.outputPath(`procedural-dungeon-interiors-${quality}.png`),
                animations: 'allow',
                fullPage: true
            });
        }

        expect(failures, failures.join('\n')).toEqual([]);
        testInfo.annotations.push({
            type: 'renderer',
            description: `${renderer.vendor} · ${renderer.renderer}`
        });
    });

    test('renders every authoritative dungeon boss danger field with regional visual language', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        const response = await page.goto('/repro.html?encounters=1&instances=1', { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);

        await expect.poll(() => page.evaluate(() => window.__eidolonEncounterGallery?.ready || false)).toBe(true);
        const metrics = await page.evaluate(() => window.__eidolonEncounterGallery);
        expect(metrics.encounters.map((entry) => entry.theme)).toEqual(DUNGEON_INTERIOR_IDS);
        expect(metrics.encounters.map((entry) => entry.attack)).toEqual([
            'root_quake',
            'furnace_rupture',
            'stormbreak',
            'undertow_crush'
        ]);
        expect(metrics.encounters.every((entry) => entry.radius === 11)).toBe(true);
        expect(metrics.encounters.every((entry) => entry.motifParts >= 3)).toBe(true);
        expect(metrics.encounters.every((entry) => entry.finite)).toBe(true);

        await page.screenshot({
            path: testInfo.outputPath('procedural-dungeon-encounter-telegraphs.png'),
            animations: 'allow',
            fullPage: true
        });
        expect(failures, failures.join('\n')).toEqual([]);
    });
});
