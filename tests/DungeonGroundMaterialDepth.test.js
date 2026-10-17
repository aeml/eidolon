import { Mesh } from 'three';
import { createProceduralDungeonInteriorKit, DUNGEON_INTERIOR_IDS } from '../src/art/ProceduralDungeonInteriors.js';
import { RenderSystem } from '../src/core/RenderSystem.js';

test.each(DUNGEON_INTERIOR_IDS)('%s floor and inset finishes keep their physical depth', type => {
    const kit = createProceduralDungeonInteriorKit(type, { quality: 'low' });
    const root = kit.createRoomDressing({ x: 0, z: 0, width: 120, height: 120, type: 'start' }, 0, { optimized: false });
    const floor = new Mesh(kit.floorGeometry(120, 120), kit.floorMaterial(120, 120)); root.add(floor);
    try {
        const surfaces = [floor, ...['floor-composition', 'processional-paving', 'outer-ward', 'inner-ward']
            .map(name => root.getObjectByName(`entry_gate:${name}`))];
        for (const surface of surfaces) {
            expect(surface).toBeDefined();
            expect(surface.material.depthTest).toBe(true); expect(surface.material.depthWrite).toBe(true);
            // Positive slope bias moves flush floors behind buried geometry at
            // gameplay zoom. Their modeled height already separates the layers.
            expect(surface.material.polygonOffset).toBe(false);
        }
    } finally { RenderSystem.prototype.disposeObjectResources.call({}, root); }
});
