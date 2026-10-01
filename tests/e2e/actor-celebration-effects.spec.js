import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

// Native 3D presentation fixture, not an earned level/buff or physical phone.
test('level-up resonance and sanctuary light remain readable at gameplay scale', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route('**/src/main.js', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.route('**/src/analytics/game.js', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const THREE = await import('three');
        const { Fighter } = await import('/src/entities/Fighter.js');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { LevelUpEffect } = await import('/src/ui/LevelUpEffect.js');
        const { createProceduralStatusEffect, updateProceduralStatusEffect, releaseProceduralStatusEffect } = await import('/src/art/ProceduralStatusEffects.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(false);
        Object.assign(render.renderer.domElement.style, { position: 'fixed', inset: '0', zIndex: '10000' });
        document.body.appendChild(render.renderer.domElement);
        render.scene.background = new THREE.Color('#141b20');
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#334238', roughness: .94 }));
        ground.rotation.x = -Math.PI / 2; ground.position.y = -.05; ground.receiveShadow = true; render.scene.add(ground);
        const hero = new Fighter('effect-presentation');
        hero.gameEngine = { renderSystem: render }; await hero.ensureMesh(); hero.render(1); render.scene.add(hero.mesh);
        hero.syncEquipmentVisuals(Object.fromEntries([['chest', 'Plate Mail'], ['legs', 'Plate Greaves'], ['feet', 'Iron Boots'],
            ['mainHand', 'Iron Sword'], ['offHand', 'Wooden Shield']].map(([slot, name]) => [slot, { id: `effect-${slot}`, slot, name, baseName: name, rarity: 'Rare', potency: 3 }])));
        render.scene.add(new THREE.HemisphereLight('#d4e3e9', '#272b23', 2));
        const key = new THREE.DirectionalLight('#ffe6c1', 2); key.position.set(-5, 10, 6); render.scene.add(key);
        render.setCameraTarget(hero.position); render.setZoom(7);
        const qa = window.__actorEffects = { render, hero, ground, effects: [], roots: [], LevelUpEffect, createProceduralStatusEffect, updateProceduralStatusEffect, releaseProceduralStatusEffect };
        qa.clear = () => { qa.effects.forEach(effect => effect.dispose()); qa.roots.forEach(releaseProceduralStatusEffect); qa.effects = []; qa.roots = []; };
        qa.sample = (quality, seconds, reduced = false) => {
            qa.clear(); render.setGraphicsQuality(quality);
            const aura = createProceduralStatusEffect('well_rested', { quality });
            updateProceduralStatusEffect(aura, seconds, seconds); render.effectGroup.add(aura); qa.roots.push(aura);
            const effect = new LevelUpEffect(render.effectGroup, hero.position, { owner: hero, quality, reducedMotion: reduced });
            effect.update(seconds); qa.effects.push(effect);
            hero.mesh.userData.updateEquipmentPose?.(); render.renderer.render(render.scene, render.camera);
            return { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                active: effect.isActive, objects: effect.meshes.length, sparks: effect.particles.geometry.attributes.position.count,
                viewportHeight: effect.particles.material.uniforms.uViewportHeight.value,
                drawingBufferHeight: render.renderer.domElement.height,
                ownerPosition: hero.position.toArray() };
        };
    });
    for (const [quality, seconds, reduced] of [['high', .35, false], ['high', 1.15, false], ['low', 1.15, false], ['low', 1.15, true]]) {
        const sample = await page.evaluate(({ quality, seconds, reduced }) => window.__actorEffects.sample(quality, seconds, reduced), { quality, seconds, reduced });
        expect(sample.active).toBe(true); expect(sample.objects).toBe(4); expect(sample.sparks).toBe(quality === 'low' ? 48 : 96);
        expect(sample.viewportHeight).toBeGreaterThan(1); expect(sample.viewportHeight).toBe(sample.drawingBufferHeight);
        expect(sample.ownerPosition).toEqual([0, 0, 0]); expect(failures, failures.join('\n')).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath(`resonance-${quality}-${seconds}${reduced ? '-reduced' : ''}.png`) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { const qa = window.__actorEffects; qa.render.isMobile = true; qa.render.onWindowResize(); qa.sample('low', .65); });
    await page.screenshot({ path: testInfo.outputPath('resonance-phone-size-low.png') });
    await page.evaluate(() => {
        const qa = window.__actorEffects;
        qa.effects.forEach(effect => effect.update(3));
        if (qa.effects.some(effect => effect.isActive || effect.group.parent)) throw new Error('Completed level-up effect remained in scene');
        qa.clear(); qa.hero.dispose(); qa.ground.geometry.dispose(); qa.ground.material.dispose(); qa.render.dispose();
    });
    expect(failures, failures.join('\n')).toEqual([]);
});
