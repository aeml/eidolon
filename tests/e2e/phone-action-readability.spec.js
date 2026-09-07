import { devices, expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { collectBrowserFailures } from './helpers.js';

const baseline = process.env.EIDOLON_E2E_ACTION_BASELINE === '1';
const actorName = 'ArchmageAurelianOfTheVeryLongCrystalWatch';
test.use({ hasTouch: true, isMobile: true, userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000 });
for (const [width, height] of [[390, 844], [844, 390], [568, 320]]) {
    test(`${width}x${height}: phone action text preserves attribution within the viewport`, async ({page, baseURL}, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        if (baseline) {
            // Exact preserved pre-change renderer. Same text, colors, actors and camera.
            const before = execFileSync('git', ['show', 'c6145c35dc935ae197ca643ce1a3dfe75416fcd1:src/ui/FloatingTextManager.js'], {encoding: 'utf8'});
            await page.route('**/src/ui/FloatingTextManager.js', route => route.fulfill({body: before, contentType: 'text/javascript'}));
        }
        await page.setViewportSize({width, height});
        await page.goto('/', {waitUntil: 'networkidle'});
        await page.evaluate(async name => {
            const THREE = await import('three');
            const {RenderSystem} = await import('/src/core/RenderSystem.js');
            const {UIManager} = await import('/src/ui/UIManager.js');
            const {GameEngine} = await import('/src/core/GameEngine.js');
            const {FloatingTextManager} = await import('/src/ui/FloatingTextManager.js');
            const {MeshFactory} = await import('/src/utils/MeshFactory.js');
            document.body.classList.add('mobile-mode'); document.getElementById('start-screen').style.display = 'none';
            const render = new RenderSystem(true), ui = new UIManager(true), floating = new FloatingTextManager(render.camera);
            ui.showHUD(); ui.toggleChat(true);
            const mesh = await MeshFactory.createMeshForType('Cleric'); render.entityGroup.add(mesh);
            render.setCameraTarget(mesh.position); render.onWindowResize();
            const engine = Object.create(GameEngine.prototype);
            Object.assign(engine, {isMobile: true, player: {id: 'self'}, floatingTextManager: floating,
                readabilityFeedbackTimestamps: new Map(), canShowThrottledReadabilityEvent: () => true,
                isPlayerClassEntity: () => true, isPositionNearPlayer: () => true});
            const ally = {id: 'ally', name, mesh, position: mesh.position};
            engine.showRemoteSupportStateReadability(ally, 'divine_intervention', true);
            // Controlled animation samples are layout evidence, not live combat.
            floating.update(.05);
            window.__phoneAction = {render, ui, floating, engine, ally};
            const draw = () => {render.render(); window.__phoneAction.frame = requestAnimationFrame(draw);}; draw();
        }, actorName);
        try {
            const measure = () => page.evaluate(() => window.__phoneAction.floating.texts.map(t => {
                const r = t.el.getBoundingClientRect();
                return {x:r.x,y:r.y,width:r.width,height:r.height,font:getComputedStyle(t.el).fontSize,
                    full:t.el.getAttribute('aria-label'),source:t.el.querySelector('[data-floating-source]')?.textContent,
                    action:t.el.querySelector('[data-floating-action]')?.textContent,pointer:getComputedStyle(t.el).pointerEvents};
            }));
            const initial = await measure();
            await testInfo.attach('action-bounds', {body: JSON.stringify(initial), contentType:'application/json'});
            await page.screenshot({path:testInfo.outputPath(baseline ? 'before.png' : 'after.png')});
            expect(initial).toHaveLength(1);
            expect(initial[0].width).toBeLessThanOrEqual(216);
            expect(initial[0].source).toBe(actorName.toUpperCase());
            expect(initial[0].action).toBe('INTERVENTION UP');
            expect(initial[0].full).toContain(actorName.toUpperCase());
            expect(parseFloat(initial[0].font)).toBeGreaterThanOrEqual(16);
            for (const x of [12, width - 12]) {
                await page.evaluate(async ({x,width}) => {
                    const s = window.__phoneAction;
                    // Project a new ground position near each screen edge using the real camera.
                    const THREE = await import('three');
                    const caster = new THREE.Raycaster();
                    caster.setFromCamera(new THREE.Vector2(x / width * 2 - 1, 0), s.render.camera);
                    caster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0), s.ally.position);
                    s.floating.texts[0].position.copy(s.ally.position); s.floating.update(.05);
                }, {x,width});
                const [bounds] = await measure();
                expect(bounds.x).toBeGreaterThanOrEqual(11);
                expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 11);
                expect(bounds.y).toBeGreaterThanOrEqual(11);
                expect(bounds.y + bounds.height).toBeLessThanOrEqual(height - 11);
                expect(bounds.pointer).toBe('none');
            }
            await page.evaluate(() => window.__phoneAction.floating.update(2));
            expect(await measure()).toHaveLength(0);
        } finally {
            await page.evaluate(() => {
                const s = window.__phoneAction; cancelAnimationFrame(s.frame);
                s.floating.dispose?.(); s.ui.social.phoneParty.dispose(); s.ui.characterPreview.dispose(); s.render.dispose();
            });
        }
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
