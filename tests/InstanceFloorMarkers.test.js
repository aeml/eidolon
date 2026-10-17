import { Group, Raycaster, Texture, Vector3 } from 'three';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { createProceduralDungeonInteriorKit } from '../src/art/ProceduralDungeonInteriors.js';
import { Entity } from '../src/entities/Entity.js';
import { RenderSystem } from '../src/core/RenderSystem.js';

for (const procedural of [false, true]) for (const kind of ['union', 'room', 'corner', 'corridor']) {
    test(`${procedural ? 'procedural' : 'legacy'} ${kind} floor preserves an ordinary party ring at server Y0`, () => {
        const scene = new Group(), generator = new WorldGenerator(scene, { addCollider() {} });
        generator.floorTexture = new Texture(); generator.wallTexture = new Texture();
        if (procedural) generator.dungeonInteriorKit = createProceduralDungeonInteriorKit('verdant_bastion_catacombs', { quality: 'low' });
        if (kind === 'union') generator.createCanonicalLayoutDungeon({
            rooms: [{ x: 20000, z: 20000, width: 40, height: 40 }],
            walkRects: [{ x: 20000, z: 20000, width: 40, height: 40 }]
        });
        else if (kind === 'room') generator.createRoom(20000, 20000, 40, 0xffffff);
        else if (kind === 'corner') generator.createCorner(20000, 20000, 20);
        else generator.createCorridor(19990, 20000, 20010, 20000, 6);
        const actor = new Entity('instance-floor-marker'); actor.mesh = new Group();
        actor.mesh.position.set(20000, 0, 20000); actor.mesh.userData.bounds = { radius: 1.25 };
        actor.setPartyHighlight(true);
        try {
            const floors = scene.children.filter(part => /Floor$/.test(part.name));
            expect(floors).toHaveLength(1);
            scene.updateMatrixWorld(true); actor.mesh.updateMatrixWorld(true);
            const marker = actor.mesh.getObjectByName('PartyRing');
            const target = new Vector3(20001.1, .05, 20000), camera = target.clone().add(new Vector3(100, 100, 100));
            expect(marker.material.depthTest).toBe(true);
            const hits = new Raycaster(camera, target.clone().sub(camera).normalize()).intersectObjects([...floors, marker]);
            expect(hits[0]?.object.name).toBe('PartyRing'); expect(floors[0].position.y).toBe(0);
        } finally {
            actor.setPartyHighlight(false); RenderSystem.prototype.disposeObjectResources.call({}, scene);
            generator.floorTexture.dispose(); generator.wallTexture.dispose();
        }
    });
}
