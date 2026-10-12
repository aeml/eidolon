import * as THREE from 'three';
import fs from 'node:fs';
import { jest } from '@jest/globals';
import { LANTERNHOLD_HOMES, LANTERNHOLD_RESIDENT_ROUTES } from '../src/data/lanternholdNeighborhood.js';
import { createLanternholdNeighborhood } from '../src/art/LanternholdNeighborhood.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { RenderSystem } from '../src/core/RenderSystem.js';
import { lanternholdGateStoneWeight, extendLanternholdGatePath } from '../src/art/LanternholdGateRoad.js';
import { createEarthPathNetwork } from '../src/art/ProceduralWorldPaths.js';
import { EARTH_PATHS } from '../src/data/worldPopulation.js';
import { ChronicleWitness } from '../src/entities/ChronicleWitness.js';
import { createProceduralTownActor } from '../src/art/ProceduralTownActors.js';
import { Entity } from '../src/entities/Entity.js';

test('fifteen closed dwellings face lanes with matching generated authority and owned resources', () => {
    const content = JSON.parse(fs.readFileSync('server/internal/game/content/lanternhold-neighborhood.json'));
    expect(content).toEqual({ homes: LANTERNHOLD_HOMES, routes: LANTERNHOLD_RESIDENT_ROUTES });
    const first = createLanternholdNeighborhood(), second = createLanternholdNeighborhood();
    expect(first.children).toHaveLength(6); expect(first.userData.walkFootprints).toHaveLength(15);
    let triangles = 0;
    for (const mesh of first.children) {
        expect(mesh.count).toBe(15);
        expect(mesh.geometry.boundingBox).toBeTruthy();
        expect([...mesh.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);
        triangles += mesh.geometry.attributes.position.count / 3 * mesh.count;
        expect(mesh.geometry).not.toBe(second.children.find(other => other.name === mesh.name).geometry);
    }
    expect(triangles).toBeLessThan(30000);
    const disposed = jest.spyOn(first.children[0].geometry, 'dispose');
    RenderSystem.prototype.disposeObjectResources.call({}, first); expect(disposed).toHaveBeenCalledTimes(1);
    RenderSystem.prototype.disposeObjectResources.call({}, second);
});

test('resident loops and all four gate approaches stay clear for a full-sized hero', async () => {
    const scene = new THREE.Group(), collision = new CollisionManager();
    await new WorldGenerator(scene, collision).loadBuildings(0, 200);
    for (const route of LANTERNHOLD_RESIDENT_ROUTES) for (let leg = 0; leg < route.points.length; leg++) {
        const a = route.points[leg], b = route.points[(leg + 1) % route.points.length];
        for (let i = 0; i <= 100; i++) {
            const point = new THREE.Vector3(a[0] + (b[0] - a[0]) * i / 100, 0, a[1] + (b[1] - a[1]) * i / 100);
            expect({ route: route.id, point: point.toArray(), blocked: Boolean(collision.checkCollision(point, 1.3)) })
                .toEqual({ route: route.id, point: point.toArray(), blocked: false });
        }
    }
    for (const home of LANTERNHOLD_HOMES) expect(collision.checkCollision(new THREE.Vector3(home.x, 0, home.z), 1.3)).toBeTruthy();
    for (const [x,z,dx,dz] of [[0,100,0,-1],[0,300,0,1],[-100,200,-1,0],[100,200,1,0]])
        for (let i = -10; i <= 25; i++) expect(collision.checkCollision(new THREE.Vector3(x+dx*i,0,z+dz*i),1.3)).toBeNull();
    RenderSystem.prototype.disposeObjectResources.call({}, scene);
});

test('gate roads have a continuous thirty-two-metre material blend and preserve outdoor trail UVs', () => {
    for (const [x,z,dx,dz] of [[0,100,0,-1],[0,300,0,1],[-100,200,-1,0],[100,200,1,0]]) {
        expect(lanternholdGateStoneWeight(x-dx*12,z-dz*12)).toBe(1);
        expect(lanternholdGateStoneWeight(x+dx*28,z+dz*28)).toBe(0);
        expect(Math.abs(lanternholdGateStoneWeight(x+dx*.001,z+dz*.001)-lanternholdGateStoneWeight(x-dx*.001,z-dz*.001))).toBeLessThan(.001);
    }
    const root = createEarthPathNetwork({ quality:'low' }), material = root.children[0].material;
    const shader = { uniforms:{}, vertexShader:THREE.ShaderLib.standard.vertexShader, fragmentShader:THREE.ShaderLib.standard.fragmentShader };
    material.onBeforeCompile(shader);
    expect(shader.fragmentShader).toContain('gateStoneWeight');
    for (const path of EARTH_PATHS.slice(0,4)) {
        const extended = extendLanternholdGatePath(path), mesh = root.getObjectByName(`world-path:${path.id}`);
        expect(extended.points[1]).toEqual(path.points[0]);
        expect(mesh.geometry.attributes.uv.getY(2)).toBeCloseTo(0);
    }
    const maps = Object.values(material.userData.gateRoadMaps), disposals = maps.map(map => jest.spyOn(map,'dispose'));
    RenderSystem.prototype.disposeObjectResources.call({},root);
    for (const disposed of disposals) expect(disposed).toHaveBeenCalledTimes(1);
});

test('walking witnesses interpolate network transforms and blend their gait back to rest', () => {
    const tags = jest.spyOn(Entity.prototype,'updateNameTag').mockImplementation(()=>{});
    const witness = new ChronicleWitness('chronicle-witness-hessa');
    try {
        witness.setMesh(createProceduralTownActor('QuestNPC'));
        const marks = witness.serviceMarks.map(([mark]) => mark);
        expect(marks.every(mark => !mark.visible)).toBe(true);
        const rig = witness.walkRig.ThighLeft;
        witness.remoteTransformBuffer.sample = jest.fn();
        for (let i=1;i<=90;i++) {
            witness.remoteTransformBuffer.sample.mockReturnValue({position:new THREE.Vector3(i/60, .5, 0),rotation:Math.PI/2,state:'MOVING'});
            witness.capturePreviousTransform(); witness.update(1/60); witness.render(.5);
            expect(witness.mesh.position.x).toBeCloseTo((i-.5)/60);
        }
        expect(witness.walkWeight).toBeGreaterThan(.99); expect(rig.pivot.rotation.x).not.toBe(rig.rest);
        for(let i=0;i<120;i++) witness.update(1/60);
        expect(witness.walkWeight).toBeLessThan(.00001); expect(rig.pivot.rotation.x).toBeCloseTo(rig.rest,4);
        expect(witness.interact({player:{position:new THREE.Vector3(1.5,0,2),state:'IDLE'},uiManager:{quest:{openWitnessConversation:()=>true}}})).toBe(true);
    } finally { witness.dispose(); tags.mockRestore(); }
});
