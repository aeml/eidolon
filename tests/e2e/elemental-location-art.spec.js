import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';
import { writeFile } from 'node:fs/promises';

for (const realm of ['water', 'fire', 'air']) for (const quality of ['high', 'low']) {
    test(`${realm} location composition gallery ${quality}`, async ({ page }, testInfo) => {
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await openGame(page);
        const result = await page.evaluate(async ({ realm, quality }) => {
            const THREE = await import('three');
            const { createElementalLocations } = await import('/src/art/ProceduralElementalLocations.js');
            const { createWorldPathNetwork } = await import('/src/art/ProceduralWorldPaths.js');
            const { createProceduralTerrainMaterial } = await import('/src/art/ProceduralRealmTerrain.js');
            const { createChronicleSiteModel } = await import('/src/art/ChronicleSiteModels.js');
            const { chronicleInvestigations } = await import('/src/data/chronicleInvestigations.generated.js');
            const data = await import('/src/data/elementalPopulation.js');
            const { RenderSystem } = await import('/src/core/RenderSystem.js');
            const water = realm === 'water', air = realm === 'air';
            const sites = air ? data.AIR_LOCATIONS : water ? data.WATER_LOCATIONS : data.FIRE_LOCATIONS;
            const scene = new THREE.Scene(); scene.background = new THREE.Color(air ? 0x242330 : water ? 0x17252f : 0x281b18);
            scene.add(createElementalLocations(realm, { quality }), createWorldPathNetwork(air ? data.AIR_PATHS : water ? data.WATER_PATHS : data.FIRE_PATHS,
                { name: realm, color: air ? [118, 112, 127] : water ? [126, 142, 143] : [67, 58, 52] }));
            for (const chapter of chronicleInvestigations.filter(c => c.realm === realm)) for (const site of chapter.sites) {
                if (site.kind !== 'inspect') continue;
                const model = createChronicleSiteModel(site, realm); model.mesh.position.set(site.x, 0, site.z); scene.add(model.mesh);
            }
            const ground = new THREE.Mesh(new THREE.PlaneGeometry(2200, 1800), createProceduralTerrainMaterial(realm, { quality }));
            ground.rotation.x = -Math.PI / 2; ground.position.set(air ? 2000 : water ? 0 : -2000, 0, water ? -1400 : 200); scene.add(ground);
            scene.add(new THREE.HemisphereLight(air ? 0xc9c4e5 : water ? 0xbcd8e8 : 0xe5c1a0, 0x242323, 1.7));
            const light = new THREE.DirectionalLight(air ? 0xe3ddf0 : water ? 0xd2e3f0 : 0xf5c493, 2.4); scene.add(light, light.target);
            const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(400, 300); renderer.setPixelRatio(1);
            renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
            const camera = new THREE.OrthographicCamera(-35, 35, 26.25, -26.25, .1, 400);
            const sheet = document.createElement('canvas'); sheet.width = 1600; sheet.height = 660;
            const ctx = sheet.getContext('2d'); ctx.fillStyle = '#10191c'; ctx.fillRect(0, 0, sheet.width, sheet.height);
            const samples = [];
            for (let i = 0; i < sites.length; i++) {
                const site = sites[i], x = site.x + (site.arrivalOffset?.[0] || 0), z = site.z + (site.arrivalOffset?.[1] || 0);
                camera.position.set(x + 55, 65, z + 55); camera.lookAt(x, 0, z);
                light.position.set(x - 35, 65, z + 25); light.target.position.set(x, 0, z); renderer.render(scene, camera);
                samples.push({ id: site.id, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles });
                const cx = i % 4 * 400, cy = Math.floor(i / 4) * 330;
                ctx.drawImage(renderer.domElement, cx, cy); ctx.fillStyle = '#eee4cb'; ctx.font = '16px system-ui';
                ctx.fillText(site.name, cx + 10, cy + 320);
            }
            const image = sheet.toDataURL('image/png');
            RenderSystem.prototype.disposeObjectResources.call({}, scene); renderer.dispose();
            return { image, samples };
        }, { realm, quality });
        expect(result.samples).toHaveLength(8);
        expect(result.samples.every(s => s.calls > 1 && s.triangles > 100)).toBe(true);
        const path = testInfo.outputPath(`${realm}-${quality}.png`);
        await writeFile(path, Buffer.from(result.image.split(',')[1], 'base64'));
        await testInfo.attach('composition-gallery', { path, contentType: 'image/png' });
    });
}
