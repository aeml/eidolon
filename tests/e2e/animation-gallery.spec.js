import { expect, test } from '@playwright/test';
import { listActorAnimationEntries } from '../../src/entities/actorAnimationManifest.js';
import { listPlayerAbilityPresentationVariants } from '../../src/skills/abilityVisualManifest.js';
import { collectBrowserFailures } from './helpers.js';

const presentationCount = listPlayerAbilityPresentationVariants().length;
const actorEntries = listActorAnimationEntries();

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

        for (const [runeId, expectedRadius, expectedColor] of [
            ['spirits_expanded', 4.2, 0xffd75a],
            ['spirits_vengeful', 2.8, 0xffb52e],
            ['spirits_sanctuary', 2.8, 0xbfffd8]
        ]) {
            await page.locator('#gallery-rune').selectOption(runeId);
            await page.locator('#gallery-persist').click();
            await expect.poll(async () => {
                const snapshot = await galleryMetrics(page);
                return snapshot.spiritVariants.length === 2 && snapshot.spiritVariants.every((variant) =>
                    variant.runeId === runeId && variant.orbitRadius === expectedRadius && variant.color === expectedColor
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
});
