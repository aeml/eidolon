import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { collectBrowserFailures } from './helpers.js';

const actorName = 'Aurelian Of The Crystal Watch';
const baseline = process.env.EIDOLON_E2E_DESKTOP_ACTION_BASELINE === '1';

for (const [width, height] of [[1280, 720], [1920, 1080]]) {
    test(`${width}x${height}: long desktop action labels stay bounded without losing identity`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        if (baseline) {
            // Exact pre-change dispatch; the actual current text renderer is
            // unchanged. This is a controlled visual comparison, not PvP proof.
            const source = execFileSync('git', ['show', '2505b36918ab0e2cc4b0dc788efd3c65ae27bb62:src/core/GameEngine.js'], { encoding: 'utf8' });
            await page.route('**/src/core/GameEngine.js', route => route.fulfill({ body: source, contentType: 'text/javascript' }));
        }
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async name => {
            const { RenderSystem } = await import('/src/core/RenderSystem.js');
            const { GameEngine } = await import('/src/core/GameEngine.js');
            const { FloatingTextManager } = await import('/src/ui/FloatingTextManager.js');
            const { Cleric } = await import('/src/entities/Cleric.js');
            document.getElementById('start-screen').style.display = 'none';
            const render = new RenderSystem(false), actor = new Cleric('action-label-ally');
            actor.name = name;
            await actor.ensureMesh(); render.entityGroup.add(actor.mesh);
            render.setCameraTarget(actor.position); render.setZoom(15);
            const floating = new FloatingTextManager(render.camera), engine = Object.create(GameEngine.prototype);
            Object.assign(engine, { isMobile: false, player: { id: 'self', position: actor.position },
                floatingTextManager: floating, readabilityFeedbackTimestamps: new Map() });
            engine.showRemoteActionReadability(actor, 'Divine Intervention');
            floating.update(.15); render.render();
            window.__desktopAction = { render, actor, floating };
        }, actorName);
        try {
            const evidence = await page.evaluate(() => {
                const q = window.__desktopAction, el = q.floating.texts[0].el, bounds = el.getBoundingClientRect();
                return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
                    source: el.querySelector('[data-floating-source]')?.textContent,
                    action: el.querySelector('[data-floating-action]')?.textContent,
                    accessible: el.getAttribute('aria-label'), font: getComputedStyle(el).fontSize,
                    pointerEvents: getComputedStyle(el).pointerEvents };
            });
            await testInfo.attach('desktop-action-bounds', { body: JSON.stringify(evidence), contentType: 'application/json' });
            await page.screenshot({ path: testInfo.outputPath(baseline ? 'before.png' : 'after.png') });
            expect(evidence.width).toBeLessThanOrEqual(216);
            expect(evidence.source).toBe(actorName.toUpperCase());
            expect(evidence.action).toBe('DIVINE INTERVENTION');
            expect(evidence.accessible).toBe(`${actorName.toUpperCase()}: DIVINE INTERVENTION`);
            expect(parseFloat(evidence.font)).toBeGreaterThanOrEqual(16);
            expect(evidence.x).toBeGreaterThanOrEqual(11);
            expect(evidence.x + evidence.width).toBeLessThanOrEqual(width - 11);
            expect(evidence.y).toBeGreaterThanOrEqual(11);
            expect(evidence.y + evidence.height).toBeLessThanOrEqual(height - 11);
            expect(evidence.pointerEvents).toBe('none');
        } finally {
            await page.evaluate(() => {
                const q = window.__desktopAction;
                q.floating.update(2); q.actor.dispose(); q.floating.dispose(); q.render.dispose();
            });
        }
        await expect(page.locator('.floating-text--compact-action')).toHaveCount(0);
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
