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

        test('initializes with no active dungeon walkable geometry', () => {
            expect(manager.isPositionInDungeonWalkableArea(0, 0)).toBe(false);
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
            manager.setDungeonWalkableGeometry([
                { x: 0, z: 0, width: 10, height: 10, kind: 'room' }
            ]);
            
            expect(manager.colliders.length).toBeGreaterThan(0);
            expect(manager.circularColliders.length).toBeGreaterThan(0);
            expect(manager.safeZones.length).toBeGreaterThan(0);
            expect(manager.isPositionInDungeonWalkableArea(0, 0)).toBe(true);
            
            manager.clear();
            
            expect(manager.colliders).toHaveLength(0);
            expect(manager.circularColliders).toHaveLength(0);
            expect(manager.safeZones).toHaveLength(0);
            expect(manager.isPositionInDungeonWalkableArea(0, 0)).toBe(false);
        });
    });

    describe('Dungeon Walkable Geometry', () => {
        test('setDungeonWalkableGeometry activates canonical walk rect containment and clear removes it', () => {
            manager.setDungeonWalkableGeometry([
                { x: 0, z: 0, width: 10, height: 10, kind: 'room' },
                { x: 15, z: 0, width: 10, height: 6, kind: 'corridor' }
            ]);

            expect(manager.isPositionInDungeonWalkableArea(0, 0)).toBe(true);
            expect(manager.isPositionInDungeonWalkableArea(15, 0)).toBe(true);
            expect(manager.isPositionInDungeonWalkableArea(30, 0)).toBe(false);

            manager.clearDungeonWalkableGeometry();

            expect(manager.isPositionInDungeonWalkableArea(0, 0)).toBe(false);
            expect(manager.isPositionInDungeonWalkableArea(15, 0)).toBe(false);
        });

        test('checkCollision clamps local movement to active dungeon walk rects', () => {
            manager.setDungeonWalkableGeometry([
                { x: 0, z: 0, width: 10, height: 10, kind: 'room' }
            ]);

            const result = manager.checkCollision(
                new THREE.Vector3(6, 0, 0),
                1.0,
                new THREE.Vector3(0, 0, 0)
            );

            expect(result).not.toBeNull();
            expect(result.x).toBeCloseTo(4);
            expect(result.z).toBeCloseTo(0);
        });

        test('checkCollision does not apply dungeon containment when inactive', () => {
            const result = manager.checkCollision(
                new THREE.Vector3(6, 0, 0),
                1.0,
                new THREE.Vector3(0, 0, 0)
            );

            expect(result).toBeNull();
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

        test('checkEntityCollision ignores lagging render meshes and uses logical position', () => {
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
            
            // Render interpolation deliberately leaves the mesh behind the
            // logical transform; collision must never feed that lag back in.
            expect(mockChunkManager.getChunkKey).toHaveBeenCalledWith(100, 100);
        });
    });

    describe('Box Collision Detection', () => {
        test('checkCollision returns null when no colliders', () => {
            const nextPos = new THREE.Vector3(5, 0, 5);
            
            const result = manager.checkCollision(nextPos, 1.0, new THREE.Vector3(0, 0, 0));
            
            expect(result).toBeNull();
        });

        test('checkCollision returns null when movement stays within bounds', () => {
            // Add a collider away from movement path
            const box = new THREE.Box3(
                new THREE.Vector3(100, 0, 100),
                new THREE.Vector3(110, 10, 110)
            );
            manager.addCollider(box);
            
            const nextPos = new THREE.Vector3(5, 0, 5);
            
            const result = manager.checkCollision(nextPos, 1.0, new THREE.Vector3(0, 0, 0));
            
            expect(result).toBeNull();
        });
    });
});

describe('CollisionManager Integration', () => {
    test('Manager can handle typical game scenario', () => {
        const manager = new CollisionManager();
        const obstacleSeed = [
            [12, 18, 2.5],
            [24, 36, 3.2],
            [38, 14, 4.1],
            [49, 52, 2.8],
            [63, 21, 3.6],
            [71, 47, 4.4],
            [82, 33, 2.9],
            [15, 74, 3.7],
            [56, 68, 2.4],
            [91, 11, 4.8],
        ];
        
        // Add world bounds as box colliders
        manager.addCollider(new THREE.Box3(
            new THREE.Vector3(-1000, -10, -1000),
            new THREE.Vector3(-900, 100, 1000)
        ));
        
        // Add circular colliders for trees/obstacles
        obstacleSeed.forEach(([x, z, radius]) => {
            manager.addCircularCollider(x, z, radius);
        });
        
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
