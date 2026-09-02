import { expect, test } from '@playwright/test';
import { listActorAnimationEntries } from '../../src/entities/actorAnimationManifest.js';
import { listPlayerAbilityPresentationVariants } from '../../src/skills/abilityVisualManifest.js';
import { collectBrowserFailures } from './helpers.js';
import { EQUIPMENT_VISUAL_DESCRIPTORS } from '../../src/art/ProceduralEquipment.js';

const presentationCount = listPlayerAbilityPresentationVariants().length;
const actorEntries = listActorAnimationEntries();
const equipmentFamilyCount = Object.keys(EQUIPMENT_VISUAL_DESCRIPTORS).length;
const proceduralPlayerTypes = Object.freeze(['Fighter', 'Rogue', 'Wizard']);

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
});
