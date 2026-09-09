import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';
import { createVisualActorClock } from '../visualLifecycleClock.js';

// Prepared visual lifecycle scene using the real class/model/update paths.
// This is not earned combat or a multiplayer respawn acceptance test.
test('Rogue respawn and stealth expiry keep the rendered interaction box invisible', async ({ page, baseURL }) => {
    const failures = collectBrowserFailures(page, baseURL);
    // A self-contained fixture helper, available even when a live deployment
    // does not publish test modules. Never replace the production game clock.
    await page.addInitScript({ content: `window.__createVisualActorClock = (${createVisualActorClock.toString()});` });
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    const rendererName = await page.evaluate(async () => {
        const THREE = await import('three');
        const { Rogue } = await import('/src/entities/Rogue.js');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(false);
        document.body.appendChild(render.renderer.domElement);
        const actor = new Rogue('respawn-render');
        actor.name = 'Respawn appearance';
        await actor.ensureMesh();
        render.scene.add(actor.mesh);
        render.setCameraTarget(actor.position);
        render.setZoom(10);
        const advance = window.__createVisualActorClock(actor, performance.now());
        const panel = document.createElement('div');
        panel.style.cssText = 'position:fixed;top:12px;left:12px;z-index:9999';
        for (const [label, action] of [
            ['Die', () => actor.die()],
            ['Respawn', () => actor.respawn(0, 0)],
            ['Stealth', () => { actor.stealthTimer = .6; }]
        ]) {
            const button = document.createElement('button');
            button.textContent = label;
            button.style.cssText = 'min-height:44px;padding:12px;font-size:16px';
            button.onclick = () => {
                // Charge time before this click to the old state, not to an
                // effect started by the action between slow rendered frames.
                advance(performance.now());
                action();
            };
            panel.appendChild(button);
        }
        document.body.appendChild(panel);
        const qa = { actor, render };
        function frame(now) {
            advance(now);
            actor.render(1);
            render.render();
            qa.frame = requestAnimationFrame(frame);
        }
        window.__respawnAppearance = qa;
        qa.frame = requestAnimationFrame(frame);
        // Keep the fixture's ground separate from the character hitbox.
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x35483c }));
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -.1;
        render.scene.add(ground);
        const gl = render.renderer.getContext();
        const debug = gl.getExtension('WEBGL_debug_renderer_info');
        return debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable';
    });
    console.log('[respawn-appearance-renderer]', rendererName);
    for (let cycle = 0; cycle < 3; cycle++) {
        if (cycle > 0) await page.getByRole('button', { name: 'Stealth', exact: true }).click();
        await page.getByRole('button', { name: 'Die', exact: true }).click();
        await page.getByRole('button', { name: 'Respawn', exact: true }).click();
        await expect.poll(() => page.evaluate(() => {
            const actor = window.__respawnAppearance.actor;
            const box = actor.mesh.getObjectByName('ActorInteractionHitbox');
            return { state: actor.state, opacity: box.material.opacity, colorWrite: box.material.colorWrite };
        })).toEqual({ state: 'IDLE', opacity: 0, colorWrite: false });
    }
    await page.getByRole('button', { name: 'Stealth', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__respawnAppearance.actor.stealthTimer)).toBeLessThanOrEqual(0);
    expect(await page.evaluate(() => window.__respawnAppearance.actor.mesh.getObjectByName('ActorInteractionHitbox').material.opacity)).toBe(0);
    await page.screenshot({ path: test.info().outputPath('rogue-after-respawn.png') });
    await page.evaluate(() => {
        const qa = window.__respawnAppearance;
        cancelAnimationFrame(qa.frame);
        qa.actor.dispose();
        qa.render.dispose();
    });
    expect(failures, failures.join('\n')).toEqual([]);
});
