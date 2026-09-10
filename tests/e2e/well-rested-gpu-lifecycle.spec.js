import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';
import { observeWebGLBuffers } from '../observeWebGLBuffers.js';
import { compareAuraPixels } from '../auraPixelComparison.js';

// Prepared real actors and renderer, not earned buffs or server transitions.
// gl.isBuffer verifies actual retired allocations, not just dispose events.
test('rendered aura lifecycle releases owned GPU buffers and preserves a neighboring actor', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.addInitScript({ content: `window.__observeBuffers = (${observeWebGLBuffers.toString()});
        window.__compareAuraPixels = (${compareAuraPixels.toString()});` });
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    const renderer = await page.evaluate(async () => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { Fighter } = await import('/src/entities/Fighter.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(false);
        document.body.appendChild(render.renderer.domElement);
        const gl = render.renderer.getContext(), observer = window.__observeBuffers(gl);
        const groups = [render.effectGroup, new THREE.Group()];
        render.scene.add(groups[1]);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x29352d }));
        ground.rotation.x = -Math.PI / 2; ground.position.y = -.05; render.scene.add(ground);
        render.setCameraTarget(new THREE.Vector3()); render.setZoom(11);
        const target = new THREE.WebGLRenderTarget(384, 384);
        const actors = [];
        const qa = window.__auraLifecycle = { render, observer, actors, target, ground, seen: new Map() };
        for (const [index, id] of ['transition-owner', 'unchanged-neighbor'].entries()) {
            const actor = new Fighter(id); actors.push(actor);
            await actor.ensureMesh();
            actor.position.set(index ? 2.5 : -2.5, 0, 0); actor.mesh.position.copy(actor.position);
            render.scene.add(actor.mesh);
            actor.wellRestedSeconds = 30;
            actor.gameEngine = { renderSystem: { effectGroup: groups[0], graphicsQuality: 'high' } };
            actor.syncAttachedStatusEffects(1.8);
        }
        const [actor, neighbor] = actors;
        const neighborEffect = neighbor.attachedStatusEffects.get('well_rested');
        const neighborParts = neighborEffect.group.children.filter(part => part.isInstancedMesh);
        const neighborMatrices = neighborParts.map(part => Array.from(part.instanceMatrix.array));
        qa.capture = () => {
            const previous = render.renderer.getRenderTarget();
            const pixels = new Uint8Array(384 * 384 * 4);
            try {
                render.renderer.setRenderTarget(target); render.renderer.render(render.scene, render.camera);
                render.renderer.readRenderTargetPixels(target, 0, 0, 384, 384, pixels);
            } finally { render.renderer.setRenderTarget(previous); }
            return pixels;
        };
        qa.step = change => {
            if (change.quality) actor.gameEngine.renderSystem.graphicsQuality = change.quality;
            if (change.group !== undefined) actor.gameEngine.renderSystem.effectGroup = groups[change.group];
            if (change.clearScene) actor.gameEngine.renderSystem.effectGroup.clear();
            if (change.field) actor[change.field] = change.value;
            actor.syncAttachedStatusEffects(.1);
            // Scene clear also removes the neighbor's group; its real update must reattach it.
            neighbor.syncAttachedStatusEffects(0);
            const current = actor.attachedStatusEffects.get('well_rested');
            const withAura = qa.capture();
            for (const owner of actors) {
                const effect = owner.attachedStatusEffects.get('well_rested');
                if (effect && !qa.seen.has(effect)) {
                    const parts = effect.group.children.filter(part => part.isInstancedMesh);
                    qa.seen.set(effect, parts.flatMap(part => [part.instanceMatrix, part.instanceColor]
                        .filter(Boolean).map(attribute => observer.bufferFor(attribute.array))));
                }
            }
            let signal = 0;
            if (current) {
                current.group.visible = false;
                try {
                    const without = qa.capture();
                    signal = window.__compareAuraPixels(withAura, withAura, without).referenceSignal;
                } finally { current.group.visible = true; }
            }
            render.renderer.render(render.scene, render.camera);
            const live = [current, neighborEffect];
            const retired = [...qa.seen].filter(([effect]) => !live.includes(effect));
            return {
                visible: Boolean(current), signal, bank: actor.wellRestedSeconds,
                quality: current?.quality || null,
                sparks: current?.group.children.filter(part => part.isInstancedMesh).reduce((sum, part) => sum + part.count, 0) || 0,
                ownerGroups: groups.flatMap(group => group.children).filter(child => child.userData.ownerId === actor.id && child.userData.statusKey === 'well_rested').length,
                positionMatches: !current || current.group.position.equals(actor.mesh.position),
                parentMatches: !current || current.group.parent === actor.gameEngine.renderSystem.effectGroup,
                bufferCounts: [...qa.seen.values()].map(buffers => buffers.length),
                allObserved: [...qa.seen.values()].every(buffers => buffers.every(Boolean)),
                liveBuffersValid: live.filter(Boolean).every(effect => qa.seen.get(effect).every(buffer => gl.isBuffer(buffer))),
                retiredEffects: retired.length,
                retiredBuffersDeleted: retired.every(([, buffers]) => buffers.every(buffer => !gl.isBuffer(buffer))),
                neighborUnchanged: neighbor.attachedStatusEffects.get('well_rested') === neighborEffect &&
                    neighborEffect.group.parent === groups[0] && neighborParts.every((part, index) =>
                    neighborMatrices[index].every((value, slot) => value === part.instanceMatrix.array[slot])),
                sharedGeometryLive: neighborParts.every(part => gl.isBuffer(observer.bufferFor(part.geometry.attributes.position.array))),
                glError: gl.getError()
            };
        };
        qa.dispose = () => {
            actors.forEach(owner => owner.dispose());
            const allDeleted = [...qa.seen.values()].every(buffers => buffers.every(buffer => buffer && !gl.isBuffer(buffer)));
            observer.restore(); target.dispose(); ground.geometry.dispose(); ground.material.dispose(); render.dispose();
            return allDeleted;
        };
        const debug = gl.getExtension('WEBGL_debug_renderer_info');
        return debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    });
    const evidence = [];
    const check = async (label, change, visible = true, quality = 'high') => {
        const result = await page.evaluate(change => window.__auraLifecycle.step(change), change);
        evidence.push({ label, ...result });
        expect(result, label).toMatchObject({ visible, bank: change.field === 'wellRestedSeconds' ? change.value : 30,
            quality: visible ? quality : null, sparks: visible ? quality === 'high' ? 16 : 8 : 0,
            ownerGroups: visible ? 1 : 0, positionMatches: true, parentMatches: true, allObserved: true,
            liveBuffersValid: true, retiredBuffersDeleted: true, neighborUnchanged: true, sharedGeometryLive: true, glError: 0 });
        expect(result.bufferCounts.every(count => count === 3)).toBe(true);
        if (visible) expect(result.signal, `${label}: the aura must really render`).toBeGreaterThan(100);
        return result;
    };
    try {
        expect(renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
        await check('initial', {});
        for (let cycle = 0; cycle < 3; cycle++) {
            for (const quality of ['low', 'high']) await check(`${cycle}-${quality}`, { quality }, true, quality);
            for (const group of [1, 0]) await check(`${cycle}-group-${group}`, { group });
            await check(`${cycle}-cleared-scene`, { clearScene: true });
            for (const [field, value, restored] of [['stealthTimer', 2, 0], ['state', 'DEAD', 'IDLE'],
                ['isActive', false, true], ['wellRestedSeconds', 0, 30]]) {
                await check(`${cycle}-${field}-hidden`, { field, value }, false);
                if (cycle === 0) await page.screenshot({ path: testInfo.outputPath(`aura-hidden-${field}.png`) });
                await check(`${cycle}-${field}-restored`, { field, value: restored });
            }
            await page.screenshot({ path: testInfo.outputPath(`aura-restored-cycle-${cycle}.png`) });
        }
        expect(evidence.at(-1).retiredEffects).toBe(24);
        await testInfo.attach('aura-gpu-lifecycle', { body: JSON.stringify({ renderer, evidence }, null, 2), contentType: 'application/json' });
        console.log('[aura-gpu-lifecycle]', JSON.stringify({ renderer, snapshots: evidence.length,
            retiredEffects: evidence.at(-1).retiredEffects, allBuffersObservedAndReleased: true }));
    } finally {
        expect(await page.evaluate(() => window.__auraLifecycle.dispose()), 'all owned aura allocations must be deleted on final cleanup').toBe(true);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
