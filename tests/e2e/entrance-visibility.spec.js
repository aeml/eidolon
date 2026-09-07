import { expect, test } from '@playwright/test';
import { collectBrowserFailures, openGame } from './helpers.js';

const cases = ['verdant_bastion_catacombs', 'molten_core', 'tempest_spire', 'abyssal_well']
    .flatMap(type => ['high', 'low'].map(quality => ({ type, quality, width: 1280, height: 720 })));
cases.push({ type: 'verdant_bastion_catacombs', quality: 'high', width: 390, height: 844 },
    { type: 'verdant_bastion_catacombs', quality: 'low', width: 844, height: 390 });

for (const config of cases) {
    test(`${config.type} ${config.quality} ${config.width}: an occluded Wizard becomes visible without moving camera or landmark`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width: config.width, height: config.height });
        await openGame(page);
        await page.evaluate(async config => {
            const THREE = await import('three');
            const { RenderSystem } = await import('/src/core/RenderSystem.js');
            const { Wizard } = await import('/src/entities/Wizard.js');
            const { createProceduralDungeonEntrance } = await import('/src/art/ProceduralDungeonEntrances.js');
            document.getElementById('start-screen').style.display = 'none';
            const render = new RenderSystem(config.width < 900);
            document.body.appendChild(render.renderer.domElement);
            render.setGraphicsQuality(config.quality);
            const root = createProceduralDungeonEntrance(config.type);
            render.addToEnvironment(root);
            const hero = new Wizard('visibility-wizard');
            hero.position.set(...(config.type === 'verdant_bastion_catacombs' ? [-36, 0, -30] : [-10, 0, -10]));
            await hero.ensureMesh();
            hero.mesh.position.copy(hero.position); render.add(hero.mesh);
            const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300),
                new THREE.MeshStandardMaterial({ color: 0x4a4540, roughness: 1 }));
            ground.rotation.x = -Math.PI / 2; ground.position.y = -.03;
            render.addToEnvironment(ground);
            render.setZoom(20); render.setCameraTarget(hero.position);
            // A prepared visual component scene, not earned movement. The
            // production render controller and real meshes perform the reveal.
            const qa = { render, hero, root, originals: root.children.map(part => part.material) };
            qa.capture = () => {
                const target = new THREE.WebGLRenderTarget(256, 256);
                const previous = render.renderer.getRenderTarget();
                const pixels = new Uint8Array(256 * 256 * 4);
                render.renderer.setRenderTarget(target);
                render.renderer.render(render.scene, render.camera);
                render.renderer.readRenderTargetPixels(target, 0, 0, 256, 256, pixels);
                render.renderer.setRenderTarget(previous); target.dispose();
                return pixels;
            };
            qa.visiblePixels = () => {
                const target = new THREE.WebGLRenderTarget(256, 256);
                const previous = render.renderer.getRenderTarget();
                const withHero = new Uint8Array(256 * 256 * 4), withoutHero = new Uint8Array(withHero.length);
                const shadows = [];
                hero.mesh.traverse(part => { if (part.isMesh) { shadows.push([part, part.castShadow]); part.castShadow = false; } });
                render.renderer.setRenderTarget(target);
                render.renderer.render(render.scene, render.camera);
                render.renderer.readRenderTargetPixels(target, 0, 0, 256, 256, withHero);
                hero.mesh.visible = false;
                render.renderer.render(render.scene, render.camera);
                render.renderer.readRenderTargetPixels(target, 0, 0, 256, 256, withoutHero);
                hero.mesh.visible = true;
                for (const [part, shadow] of shadows) part.castShadow = shadow;
                render.renderer.setRenderTarget(previous); target.dispose();
                let count = 0;
                for (let i = 0; i < withHero.length; i += 4) {
                    if (Math.abs(withHero[i] - withoutHero[i]) + Math.abs(withHero[i + 1] - withoutHero[i + 1]) +
                        Math.abs(withHero[i + 2] - withoutHero[i + 2]) > 30) count++;
                }
                return count;
            };
            qa.originalCamera = render.camera.matrixWorld.toArray();
            qa.originalBounds = root.userData.gameplayBounds.slice();
            function frame() { render.render(); qa.frame = requestAnimationFrame(frame); }
            window.__visibilityQA = qa; frame();
        }, config);
        const before = await page.evaluate(() => {
            const q = window.__visibilityQA;
            q.beforeFrame = q.capture();
            return q.visiblePixels();
        });
        await page.screenshot({ path: testInfo.outputPath('entrance-before.png') });
        await page.evaluate(() => {
            const q = window.__visibilityQA;
            q.render.setSceneryFocus(q.hero.position);
        });
        await expect.poll(() => page.evaluate(() => {
            const q = window.__visibilityQA;
            return q.render.sceneryVisibility.entries.get(q.root)?.opacity ?? 1;
        })).toBeLessThan(.005);
        const after = await page.evaluate(() => window.__visibilityQA.visiblePixels());
        const unobstructed = await page.evaluate(() => {
            const q = window.__visibilityQA;
            // Hide only camera color/depth writes, retaining the landmark's
            // physical shadows so the reference uses the same illumination.
            const materials = [...new Set(q.root.children.map(part => part.material))];
            const state = materials.map(material => [material, material.colorWrite, material.depthWrite]);
            for (const material of materials) { material.colorWrite = false; material.depthWrite = false; }
            const count = q.visiblePixels();
            for (const [material, colorWrite, depthWrite] of state) { material.colorWrite = colorWrite; material.depthWrite = depthWrite; }
            return count;
        });
        // A fixed count at 256px penalizes different projection/lighting even
        // when every visible hero pixel has returned. Require most of this
        // exact model's unobstructed reference, not an arbitrary pixel total.
        console.log(`[scenery-pixels] ${JSON.stringify({ ...config, before, after, unobstructed })}`);
        expect(unobstructed, 'reference must contain a visibly rendered hero').toBeGreaterThan(5);
        expect(before, 'fixture must initially obscure the actual hero').toBeLessThan(unobstructed * .25);
        expect(after, 'the reveal must recover at least 80% of the unobstructed hero pixels').toBeGreaterThanOrEqual(unobstructed * .8);
        const changedOutside = await page.evaluate(async () => {
            const THREE = await import('three');
            const q = window.__visibilityQA, camera = q.render.camera;
            const center = q.hero.position.clone().add(new THREE.Vector3(0, 1.5, 0)).project(camera);
            const cx = (center.x + 1) * 128, cy = (center.y + 1) * 128;
            const rx = 256 * 4.7 / (camera.right - camera.left), ry = 256 * 4.7 / (camera.top - camera.bottom);
            const after = q.capture(); let count = 0;
            for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
                if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) continue;
                const i = (y * 256 + x) * 4;
                if (Math.abs(after[i] - q.beforeFrame[i]) + Math.abs(after[i + 1] - q.beforeFrame[i + 1]) +
                    Math.abs(after[i + 2] - q.beforeFrame[i + 2]) > 3) count++;
            }
            return count;
        });
        expect(changedOutside, 'architecture outside the cutaway must retain its original depth ordering and shadows').toBe(0);
        await page.screenshot({ path: testInfo.outputPath('entrance-revealed.png') });
        expect(await page.evaluate(() => {
            const q = window.__visibilityQA;
            return JSON.stringify(q.render.camera.matrixWorld.toArray()) === JSON.stringify(q.originalCamera) &&
                JSON.stringify(q.root.userData.gameplayBounds) === JSON.stringify(q.originalBounds);
        })).toBe(true);
        await page.evaluate(() => window.__visibilityQA.render.setSceneryFocus(null));
        await expect.poll(() => page.evaluate(() => {
            const q = window.__visibilityQA;
            return q.root.children.every((part, i) => part.material === q.originals[i]);
        })).toBe(true);
        console.log(`[scenery-visibility] ${config.type}/${config.quality}/${config.width}: hero pixels ${before} -> ${after}`);
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
