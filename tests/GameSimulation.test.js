import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Entity } from '../src/entities/Entity.js';
import { Actor } from '../src/entities/Actor.js';
import { MeshFactory } from '../src/utils/MeshFactory.js';
import { CONSTANTS } from '../src/core/Constants.js';

// Mock MeshFactory to avoid loading external assets
MeshFactory.createMeshForType = jest.fn().mockImplementation(async (type) => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = { entityId: 'mock-id' };
    return mesh;
});

MeshFactory.loadModel = jest.fn().mockResolvedValue({
    scene: new THREE.Group(),
    animations: []
});

// Mock config for Actor
const mockActorConfig = {
    STATS: {
        STRENGTH: 10,
        INTELLIGENCE: 10,
        DEXTERITY: 10,
        WISDOM: 10,
        STAMINA: 10
    },
    MANA_STAT: 'INTELLIGENCE'
};

describe('Entity System', () => {
    test('Entity initializes with correct defaults', () => {
        const entity = new Entity('test-entity-1');
        
        expect(entity.id).toBe('test-entity-1');
        expect(entity.isActive).toBe(true);
        expect(entity.position).toBeInstanceOf(THREE.Vector3);
        expect(entity.rotation).toBeInstanceOf(THREE.Quaternion);
    });

    test('Entity generates UUID if no id provided', () => {
        const entity = new Entity();
        
        expect(entity.id).toBeDefined();
        expect(typeof entity.id).toBe('string');
    });

    test('Entity can set scale', () => {
        const entity = new Entity('test-entity');
        entity.mesh = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshBasicMaterial()
        );
        
        entity.setScale(2.0);
        
        expect(entity.scale).toBe(2.0);
    });
});

describe('Actor System', () => {
    let actor;

    beforeEach(() => {
        actor = new Actor('test-actor', mockActorConfig);
        actor.mesh = new THREE.Group();
    });

    test('Actor initializes with base stats', () => {
        expect(actor.stats).toBeDefined();
        expect(actor.stats.hp).toBeGreaterThan(0);
        expect(actor.stats.maxHp).toBeGreaterThan(0);
    });

    test('Actor state defaults to IDLE', () => {
        expect(actor.state).toBe('IDLE');
    });

    test('Actor can change state', () => {
        actor.state = 'MOVING';
        expect(actor.state).toBe('MOVING');
    });

    test('Actor tracks position correctly', () => {
        actor.position.set(10, 0, 20);
        
        expect(actor.position.x).toBe(10);
        expect(actor.position.y).toBe(0);
        expect(actor.position.z).toBe(20);
    });

    test('Actor can calculate distance to target', () => {
        actor.position.set(0, 0, 0);
        actor.targetPosition = new THREE.Vector3(3, 0, 4);
        
        const distance = actor.position.distanceTo(actor.targetPosition);
        expect(distance).toBe(5); // 3-4-5 triangle
    });
});

describe('Constants', () => {
    test('CONSTANTS are defined', () => {
        expect(CONSTANTS).toBeDefined();
        expect(CONSTANTS.SCENE).toBeDefined();
        expect(CONSTANTS.SCENE.BOUNDS).toBeDefined();
    });

    test('CONSTANTS.SCENE.BOUNDS has correct structure', () => {
        expect(typeof CONSTANTS.SCENE.BOUNDS.MIN_X).toBe('number');
        expect(typeof CONSTANTS.SCENE.BOUNDS.MAX_X).toBe('number');
        expect(typeof CONSTANTS.SCENE.BOUNDS.MIN_Z).toBe('number');
        expect(typeof CONSTANTS.SCENE.BOUNDS.MAX_Z).toBe('number');
    });
});

describe('MeshFactory Mocks', () => {
    test('createMeshForType returns a mesh', async () => {
        const mesh = await MeshFactory.createMeshForType('Fighter');
        
        expect(mesh).toBeInstanceOf(THREE.Mesh);
        expect(mesh.userData.entityId).toBe('mock-id');
    });

    test('loadModel returns scene and animations', async () => {
        const result = await MeshFactory.loadModel('test.glb');
        
        expect(result.scene).toBeInstanceOf(THREE.Group);
        expect(result.animations).toEqual([]);
    });
});
