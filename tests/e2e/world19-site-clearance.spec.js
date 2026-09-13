import { expect, test } from '@playwright/test';

// Production world-generator scenery and placements, not an isolated casino
// shell. This is spatial release evidence, not connected movement/combat.
test('1.9 town approaches and event spawn/rune sites clear the generated world scenery', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
        const THREE = await import('three');
        const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
        const { CollisionManager } = await import('/src/core/CollisionManager.js');
        const { createProceduralLanternholdStructure, getLanternholdWalkCollider } = await import('/src/art/ProceduralLanternholdArchitecture.js');
        const { CasinoController } = await import('/src/core/CasinoController.js');
        document.getElementById('start-screen').style.display = 'none';
        document.querySelectorAll('canvas').forEach(canvas => { canvas.hidden = true; });
        const scene = new THREE.Scene(), collision = new CollisionManager();
        const generator = new WorldGenerator(scene, collision);
        await generator.createTown(0, 200, 100);
        await generator.createOverworldStructures();
        // These two buildings are server entities, not static generator props.
        for (const [kind, x, z, rotation] of [['stash', -8, 185, 0], ['trading_house', -22, 185, Math.PI / 4]]) {
            const mesh = createProceduralLanternholdStructure(kind, { optimized: true }); mesh.position.set(x, .5, z); mesh.rotation.y = rotation;
            scene.add(mesh); collision.addOrientedCollider(getLanternholdWalkCollider(mesh));
        }
        const tables = [{ id: 'public-blackjack', game: 'blackjack', x: -4.3, z: 171, seats: [] }, { id: 'public-poker', game: 'poker', x: 4.3, z: 171, seats: [] },
            ...['earth', 'fire', 'water', 'air'].map((theme, i) => ({ id: `public-slots-${theme}`, game: 'slots', x: -6 + 4 * i, z: 164, seats: [] }))];
        const engine = { collisionManager: collision, currentInstanceId: '', network: { send() {} } };
        const controller = new CasinoController(engine); controller.updateState({ tables });
        scene.add(controller.furniture); collision.colliders.push(...controller.furnitureColliders);
        const blocked = [], inspect = (label, x, z, radius = 1.25) => {
            const point = new THREE.Vector3(x, 0, z), corrected = collision.checkCollision(point, radius, point);
            if (corrected && corrected.distanceTo(point) > .01) blocked.push({ label, x, z, correction: corrected.toArray() });
        };
        let samples = 0;
        const routes = [
            [[0, 200], [0, 176.4], [7.5, 176.4]],
            [[0, 200], [-4, 193], [-4, 185]], [[-4, 193], [-14, 193]],
            [[0, 176.4], [0, 167.2], [-6, 167.2]], [[0, 167.2], [6, 167.2]]
        ];
        for (const [index, route] of routes.entries()) for (let i = 1; i < route.length; i++) {
            const a = route[i - 1], b = route[i], steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2);
            for (let j = 0; j <= steps; j++) { inspect(`town-route-${index}`, a[0] + (b[0] - a[0]) * j / steps, a[1] + (b[1] - a[1]) * j / steps); samples++; }
        }
        // PublicEventSites and its exact wave ring/rune placement, reviewed
        // against the server catalog for this release; no earned-clear claim.
        for (const [realm, x, z] of [['earth', -750, 200], ['water', 0, -900], ['fire', -1250, 200], ['air', 1250, 200]]) {
            for (const offset of realm === 'fire' ? [-20, 0, 20] : [-10, 0, 10]) { inspect(`${realm}-ward`, x + offset, z); samples++; }
            for (const count of [6, 8, 10, 12]) for (let i = 0; i < count; i++) {
                const angle = i * Math.PI * 2 / count; inspect(`${realm}-spawn`, x + Math.cos(angle) * 26, z + Math.sin(angle) * 26, 2); samples++;
            }
        }
        scene.background = new THREE.Color(0x17202b); scene.add(new THREE.HemisphereLight(0xffe4bc, 0x394968, 3));
        const sun = new THREE.DirectionalLight(0xffefd7, 3); sun.position.set(-30, 70, 230); scene.add(sun);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: 0x343d3e }));
        ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.05, 200); scene.add(ground);
        const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .1, 500); camera.position.set(35, 48, 232); camera.lookAt(-5, 0, 182);
        const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(innerWidth, innerHeight); renderer.domElement.style.cssText = 'position:fixed;inset:0';
        document.body.append(renderer.domElement); renderer.render(scene, camera);
        window.__world19Clearance = { controller, renderer, scene };
        return { blocked, samples, sceneryColliders: collision.colliders.length, foliageGroups: scene.children.filter(c => c.userData.proceduralFoliage).length };
    });
    await page.screenshot({ path: '/tmp/eidolon-world19-town-20260913.png' });
    console.log('world19-site-clearance', JSON.stringify(result));
    expect(result.samples).toBeGreaterThan(200);
    expect(result.foliageGroups).toBeGreaterThan(0);
    expect(result.blocked, JSON.stringify(result.blocked)).toEqual([]);
});
