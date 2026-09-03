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

        await page.locator('#gallery-class').selectOption('Cleric');
        await waitForActor(page, 'Cleric');
        await page.locator('#gallery-ability').selectOption('Spirit Guardians');
        await page.locator('#gallery-persist').click();
        await expect.poll(async () => (await galleryMetrics(page)).spiritGuardians).toBe(6);
        let metrics = await galleryMetrics(page);
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
                expect(snapshot.currentAnimation).toBe(state);
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

    test('renders every active regional hazard with its exact authoritative footprint', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        const response = await page.goto('/repro.html?hazards=1&instances=1', { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);

        await expect.poll(() => page.evaluate(() => window.__eidolonHazardGallery?.ready || false)).toBe(true);
        const renderer = await hardwareRenderer(page);
        expect(renderer).not.toBeNull();
        expect(`${renderer.vendor} ${renderer.renderer}`).not.toMatch(/swiftshader|llvmpipe|software/i);

        const metrics = await page.evaluate(() => window.__eidolonHazardGallery);
        expect(metrics.hazards.map((hazard) => hazard.type)).toEqual([
            'lava_pool',
            'sandstorm',
            'lightning_zone',
            'wind_gust'
        ]);
        for (const hazard of metrics.hazards) {
            expect(hazard.boundaryRadius).toBeCloseTo(hazard.radius, 5);
            expect(hazard.themeName).toBeTruthy();
            expect(hazard.meshCount).toBeGreaterThan(1);
            expect(hazard.finite).toBe(true);
        }

        await page.screenshot({
            path: testInfo.outputPath('dark-fantasy-world-hazards.png'),
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
