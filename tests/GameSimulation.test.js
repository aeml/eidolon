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

// Mock console.log to reduce noise
const originalLog = console.log;
beforeAll(() => {
    console.log = jest.fn();
});
afterAll(() => {
    console.log = originalLog;
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

    describe('Stats Calculation', () => {
        test('Base stats are stored correctly', () => {
            expect(actor.baseStats.strength).toBe(10);
            expect(actor.baseStats.intelligence).toBe(10);
            expect(actor.baseStats.dexterity).toBe(10);
            expect(actor.baseStats.wisdom).toBe(10);
            expect(actor.baseStats.vitality).toBe(10);
        });

        test('MaxHP is calculated from vitality', () => {
            // HP = vitality * 10 = 10 * 10 = 100
            expect(actor.stats.maxHp).toBe(100);
        });

        test('MaxMana is calculated from intelligence', () => {
            // Mana = intelligence * 10 = 10 * 10 = 100
            expect(actor.stats.maxMana).toBe(100);
        });

        test('Damage is calculated from strength', () => {
            // Damage = strength * 2 = 10 * 2 = 20
            expect(actor.stats.damage).toBe(20);
        });

        test('Speed is calculated from dexterity', () => {
            // Speed = 3 + (dexterity * 0.5) = 3 + 5 = 8
            expect(actor.stats.speed).toBe(8);
        });

        test('HP regen is calculated from vitality', () => {
            // hpRegen = vitality * 0.5 = 5
            expect(actor.stats.hpRegen).toBe(5);
        });

        test('Mana regen is calculated from wisdom', () => {
            // manaRegen = wisdom * 0.5 = 5
            expect(actor.stats.manaRegen).toBe(5);
        });

        test('Cooldown reduction is calculated from intelligence', () => {
            // CDR = min(0.5, intelligence * 0.01) = min(0.5, 0.1) = 0.1
            expect(actor.stats.cooldownReduction).toBe(0.1);
        });
    });

    describe('Actor Equipment', () => {
        test('Equipment slots are initialized as null', () => {
            expect(actor.equipment.head).toBeNull();
            expect(actor.equipment.chest).toBeNull();
            expect(actor.equipment.legs).toBeNull();
            expect(actor.equipment.feet).toBeNull();
            expect(actor.equipment.mainHand).toBeNull();
            expect(actor.equipment.offHand).toBeNull();
        });

        test('Equipment stats affect recalculateStats', () => {
            // Equip a weapon with damage
            actor.equipment.mainHand = {
                stats: { damage: 50 }
            };
            
            actor.recalculateStats();
            
            // Damage = (strength * 2) + weapon damage = 20 + 50 = 70
            expect(actor.stats.damage).toBe(70);
        });

        test('Armor defense stacks correctly', () => {
            actor.equipment.head = { stats: { defense: 5 } };
            actor.equipment.chest = { stats: { defense: 10 } };
            actor.equipment.legs = { stats: { defense: 7 } };
            
            actor.recalculateStats();
            
            expect(actor.stats.defense).toBe(22);
        });

        test('Equipment attribute bonuses apply', () => {
            actor.equipment.ring1 = { stats: { strength: 5, vitality: 5 } };
            
            actor.recalculateStats();
            
            // Base strength + bonus = 10 + 5 = 15
            expect(actor.stats.strength).toBe(15);
            // Damage = strength * 2 = 30
            expect(actor.stats.damage).toBe(30);
            // Vitality: 10 + 5 = 15, HP = 15 * 10 = 150
            expect(actor.stats.vitality).toBe(15);
            expect(actor.stats.maxHp).toBe(150);
        });
    });

    describe('Level System', () => {
        test('Actor starts at level 1', () => {
            expect(actor.level).toBe(1);
        });

        test('XP to next level starts at 100', () => {
            expect(actor.xpToNextLevel).toBe(100);
        });

        test('XP starts at 0', () => {
            expect(actor.xp).toBe(0);
        });

        test('Stat points start at 0', () => {
            expect(actor.statPoints).toBe(0);
        });
    });

    describe('Combat States', () => {
        test('Actor has cooldowns map', () => {
            expect(actor.cooldowns).toBeDefined();
            expect(typeof actor.cooldowns).toBe('object');
        });

        test('Actor has ability cooldown properties', () => {
            expect(actor.abilityCooldown).toBe(0);
            expect(actor.abilityMaxCooldown).toBe(0);
        });

        test('Actor has stunTimer', () => {
            expect(actor.stunTimer).toBe(0);
        });

        test('Actor has frozen timer for CC', () => {
            expect(actor.frozenTimer).toBe(0);
        });

        test('Actor has shield HP for absorption', () => {
            expect(actor.shieldHP).toBe(0);
        });
    });

    describe('Inventory System', () => {
        test('Inventory has 25 slots', () => {
            expect(actor.inventory).toHaveLength(25);
        });

        test('All inventory slots start empty', () => {
            actor.inventory.forEach(slot => {
                expect(slot).toBeNull();
            });
        });
    });

    describe('Hotbar System', () => {
        test('Hotbar has 4 slots', () => {
            expect(actor.hotbar).toHaveLength(4);
        });

        test('All hotbar slots start empty', () => {
            actor.hotbar.forEach(slot => {
                expect(slot).toBeNull();
            });
        });

        test('Unlocked skills starts empty', () => {
            expect(actor.unlockedSkills).toHaveLength(0);
        });
    });

    describe('Buffs and Debuffs', () => {
        test('Guardian Roar buff starts inactive', () => {
            expect(actor.guardianRoarTimer).toBe(0);
            expect(actor.guardianRoarReduction).toBe(0);
        });

        test('Last Stand buff starts inactive', () => {
            expect(actor.lastStandTimer).toBe(0);
            expect(actor.lastStandDamageBoost).toBe(0);
        });

        test('Cleric buffs start inactive', () => {
            expect(actor.blessingResolveTimer).toBe(0);
            expect(actor.blessingZealTimer).toBe(0);
        });

        test('Rogue debuffs start at 0', () => {
            expect(actor.bleedTimer).toBe(0);
            expect(actor.bleedStacks).toBe(0);
            expect(actor.poisonTimer).toBe(0);
            expect(actor.poisonStacks).toBe(0);
        });

        test('Haste buff starts inactive', () => {
            expect(actor.hasteTimer).toBe(0);
            expect(actor.hasteFactor).toBe(0);
        });
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
