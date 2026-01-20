import { jest } from '@jest/globals';
import * as THREE from 'three';
import { CollisionManager } from '../src/core/CollisionManager.js';

describe('CollisionManager', () => {
    let manager;

    beforeEach(() => {
        manager = new CollisionManager();
    });

    describe('Initialization', () => {
        test('Initializes with empty colliders', () => {
            expect(manager.colliders).toHaveLength(0);
        });

        test('Initializes with empty circular colliders', () => {
            expect(manager.circularColliders).toHaveLength(0);
        });

        test('Initializes with empty safe zones', () => {
            expect(manager.safeZones).toHaveLength(0);
        });
    });

    describe('Box Colliders', () => {
        test('addCollider adds to colliders array', () => {
            const box = new THREE.Box3(
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(10, 10, 10)
            );
            
            manager.addCollider(box);
            
            expect(manager.colliders).toHaveLength(1);
            expect(manager.colliders[0]).toBe(box);
        });

        test('Multiple colliders can be added', () => {
            const box1 = new THREE.Box3();
            const box2 = new THREE.Box3();
            
            manager.addCollider(box1);
            manager.addCollider(box2);
            
            expect(manager.colliders).toHaveLength(2);
        });
    });

    describe('Circular Colliders', () => {
        test('addCircularCollider adds to circularColliders', () => {
            manager.addCircularCollider(10, 20, 5);
            
            expect(manager.circularColliders).toHaveLength(1);
            expect(manager.circularColliders[0]).toEqual({
                x: 10,
                z: 20,
                radius: 5
            });
        });

        test('Multiple circular colliders can be added', () => {
            manager.addCircularCollider(0, 0, 5);
            manager.addCircularCollider(10, 10, 3);
            manager.addCircularCollider(20, 20, 7);
            
            expect(manager.circularColliders).toHaveLength(3);
        });
    });

    describe('Safe Zones', () => {
        test('addSafeZone adds to safeZones', () => {
            const zone = new THREE.Box3(
                new THREE.Vector3(-10, -10, -10),
                new THREE.Vector3(10, 10, 10)
            );
            
            manager.addSafeZone(zone);
            
            expect(manager.safeZones).toHaveLength(1);
        });

        test('isPositionSafe returns true when inside safe zone', () => {
            const zone = new THREE.Box3(
                new THREE.Vector3(-10, -10, -10),
                new THREE.Vector3(10, 10, 10)
            );
            manager.addSafeZone(zone);
            
            expect(manager.isPositionSafe(0, 0)).toBe(true);
            expect(manager.isPositionSafe(5, 5)).toBe(true);
            expect(manager.isPositionSafe(-5, -5)).toBe(true);
        });

        test('isPositionSafe returns false when outside safe zone', () => {
            const zone = new THREE.Box3(
                new THREE.Vector3(-10, -10, -10),
                new THREE.Vector3(10, 10, 10)
            );
            manager.addSafeZone(zone);
            
            expect(manager.isPositionSafe(20, 0)).toBe(false);
            expect(manager.isPositionSafe(0, 20)).toBe(false);
            expect(manager.isPositionSafe(-20, -20)).toBe(false);
        });

        test('isPositionSafe works with multiple safe zones', () => {
            const zone1 = new THREE.Box3(
                new THREE.Vector3(-10, -10, -10),
                new THREE.Vector3(0, 10, 0)
            );
            const zone2 = new THREE.Box3(
                new THREE.Vector3(50, -10, 50),
                new THREE.Vector3(60, 10, 60)
            );
            
            manager.addSafeZone(zone1);
            manager.addSafeZone(zone2);
            
            expect(manager.isPositionSafe(-5, -5)).toBe(true);
            expect(manager.isPositionSafe(55, 55)).toBe(true);
            expect(manager.isPositionSafe(25, 25)).toBe(false);
        });
    });

    describe('Clear', () => {
        test('clear removes all colliders', () => {
            manager.addCollider(new THREE.Box3());
            manager.addCircularCollider(0, 0, 5);
            manager.addSafeZone(new THREE.Box3());
            
            expect(manager.colliders.length).toBeGreaterThan(0);
            expect(manager.circularColliders.length).toBeGreaterThan(0);
            expect(manager.safeZones.length).toBeGreaterThan(0);
            
            manager.clear();
            
            expect(manager.colliders).toHaveLength(0);
            expect(manager.circularColliders).toHaveLength(0);
            expect(manager.safeZones).toHaveLength(0);
        });
    });

    describe('Entity Collision', () => {
        test('checkEntityCollision returns null if no chunkManager', () => {
            const entity = { position: new THREE.Vector3(0, 0, 0), radius: 1 };
            
            const result = manager.checkEntityCollision(entity, null);
            
            expect(result).toBeNull();
        });

        test('checkEntityCollision uses entity position', () => {
            const entity = { 
                position: new THREE.Vector3(0, 0, 0), 
                radius: 1,
                state: 'IDLE',
                isActive: true
            };
            
            // Mock chunk manager that returns empty chunks
            const mockChunkManager = {
                getChunkKey: jest.fn().mockReturnValue('0,0'),
                chunks: new Map()
            };
            
            const result = manager.checkEntityCollision(entity, mockChunkManager);
            
            // No collisions when chunks are empty
            expect(mockChunkManager.getChunkKey).toHaveBeenCalledWith(0, 0);
        });

        test('checkEntityCollision uses mesh position when available', () => {
            const entity = { 
                position: new THREE.Vector3(100, 0, 100),
                mesh: { position: new THREE.Vector3(50, 0, 50) },
                radius: 1,
                state: 'IDLE',
                isActive: true
            };
            
            const mockChunkManager = {
                getChunkKey: jest.fn().mockReturnValue('0,0'),
                chunks: new Map()
            };
            
            manager.checkEntityCollision(entity, mockChunkManager);
            
            // Should use mesh position (50, 50), not entity position (100, 100)
            expect(mockChunkManager.getChunkKey).toHaveBeenCalledWith(50, 50);
        });
    });

    describe('Box Collision Detection', () => {
        test('checkCollision returns null when no colliders', () => {
            const currentPos = new THREE.Vector3(0, 0, 0);
            const nextPos = new THREE.Vector3(5, 0, 5);
            
            const result = manager.checkCollision(currentPos, nextPos, 1.0);
            
            expect(result).toBeNull();
        });

        test('checkCollision returns null when movement stays within bounds', () => {
            // Add a collider away from movement path
            const box = new THREE.Box3(
                new THREE.Vector3(100, 0, 100),
                new THREE.Vector3(110, 10, 110)
            );
            manager.addCollider(box);
            
            const currentPos = new THREE.Vector3(0, 0, 0);
            const nextPos = new THREE.Vector3(5, 0, 5);
            
            const result = manager.checkCollision(currentPos, nextPos, 1.0);
            
            expect(result).toBeNull();
        });
    });
});

describe('CollisionManager Integration', () => {
    test('Manager can handle typical game scenario', () => {
        const manager = new CollisionManager();
        
        // Add world bounds as box colliders
        manager.addCollider(new THREE.Box3(
            new THREE.Vector3(-1000, -10, -1000),
            new THREE.Vector3(-900, 100, 1000)
        ));
        
        // Add circular colliders for trees/obstacles
        for (let i = 0; i < 10; i++) {
            manager.addCircularCollider(
                Math.random() * 100,
                Math.random() * 100,
                2 + Math.random() * 3
            );
        }
        
        // Add town safe zone
        manager.addSafeZone(new THREE.Box3(
            new THREE.Vector3(-50, -10, -50),
            new THREE.Vector3(50, 100, 50)
        ));
        
        expect(manager.colliders).toHaveLength(1);
        expect(manager.circularColliders).toHaveLength(10);
        expect(manager.safeZones).toHaveLength(1);
        
        // Town center is safe
        expect(manager.isPositionSafe(0, 0)).toBe(true);
        
        // Far from town is not safe
        expect(manager.isPositionSafe(200, 200)).toBe(false);
    });
});
