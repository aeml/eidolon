import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';
import { writeFile } from 'node:fs/promises';

for (const quality of ['high', 'low']) test(`Earth authored scenery renders at ${quality} quality`, async ({ page }, testInfo) => {
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await openGame(page);
    const result = await page.evaluate(async quality => {
        const THREE = await import('/vendor/three/build/three.module.js');
        const { createEarthLocations } = await import('/src/art/ProceduralEarthLocations.js');
        const { createEarthPathNetwork } = await import('/src/art/ProceduralWorldPaths.js');
        const { createProceduralTerrainMaterial } = await import('/src/art/ProceduralRealmTerrain.js');
        const { createChronicleSiteModel } = await import('/src/art/ChronicleSiteModels.js');
        const { chronicleInvestigations } = await import('/src/data/chronicleInvestigations.generated.js');
        const { EARTH_LOCATIONS } = await import('/src/data/worldPopulation.js');
        const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1b2428);
        scene.add(createEarthLocations({ quality }), createEarthPathNetwork());
        // Existing mandatory investigation objects remain in their real places.
        for (const chapter of chronicleInvestigations.filter(c => c.realm === 'earth')) for (const site of chapter.sites) {
            if (site.kind !== 'inspect') continue;
            const model = createChronicleSiteModel(site, 'earth');
            model.mesh.position.set(site.x, 0, site.z); scene.add(model.mesh);
        }
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(2200, 1800), createProceduralTerrainMaterial('earth', { quality }));
        ground.rotation.x = -Math.PI / 2; ground.position.z = 200; ground.receiveShadow = true; scene.add(ground);
        scene.add(new THREE.HemisphereLight(0xc7d4dc, 0x302c22, 1.7));
        const light = new THREE.DirectionalLight(0xf9d6a8, 2.4); scene.add(light, light.target);
        const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(400, 300); renderer.setPixelRatio(1);
        renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
        const camera = new THREE.OrthographicCamera(-35, 35, 26.25, -26.25, .1, 400);
        const sheet = document.createElement('canvas'); sheet.width = 1600; sheet.height = 660;
        const ctx = sheet.getContext('2d'); ctx.fillStyle = '#10191c'; ctx.fillRect(0, 0, sheet.width, sheet.height);
        const samples = [];
        for (let i = 0; i < EARTH_LOCATIONS.length; i++) {
            const site = EARTH_LOCATIONS[i], x = site.x + (site.arrivalOffset?.[0] || 0), z = site.z;
            camera.position.set(x + 55, 65, z + 55); camera.lookAt(x, 0, z);
            light.position.set(x - 35, 65, z + 25); light.target.position.set(x, 0, z);
            renderer.render(scene, camera);
            samples.push({ id: site.id, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles });
            const cx = i % 4 * 400, cy = Math.floor(i / 4) * 330;
            ctx.drawImage(renderer.domElement, cx, cy); ctx.fillStyle = '#eee4cb'; ctx.font = '16px system-ui';
            ctx.fillText(site.name, cx + 10, cy + 320);
        }
        const image = sheet.toDataURL('image/png');
        renderer.dispose();
        return { image, samples };
    }, quality);
    expect(result.samples).toHaveLength(8);
    expect(result.samples.every(s => s.calls > 1 && s.calls < 60 && s.triangles > 100)).toBe(true);
    const path = testInfo.outputPath(`earth-locations-${quality}.png`);
    await writeFile(path, Buffer.from(result.image.split(',')[1], 'base64'));
    await testInfo.attach(`earth-locations-${quality}.png`, { path, contentType: 'image/png' });
});
