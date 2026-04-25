import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/proto/state_pb.js', () => {
    const mock = {
        eidolon: {
            state: {
                StateEnvelope: {
                    decode: jest.fn()
                }
            }
        }
    };
    return { default: mock, ...mock };
});

const { GameEngine } = await import('../src/core/GameEngine.js');

describe('GameEngine active buff tracker', () => {
    test('upserts actor-derived combat buffs with readable icons and details', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.activeBuffs = [];
        engine.upsertActiveBuff = GameEngine.prototype.upsertActiveBuff;
        engine.syncTrackedActorBuffs = GameEngine.prototype.syncTrackedActorBuffs;
        engine.getActiveBuffs = GameEngine.prototype.getActiveBuffs;

        const actor = {
            guardianRoarTimer: 9.5,
            guardianRoarReduction: 0.3,
            blessingResolveTimer: 6.2,
            blessingResolveReduction: 0.25,
            blessingZealTimer: 11.4,
            blessingZealFactor: 0.35,
            hasteTimer: 10.0,
            hasteFactor: 0.5,
            shieldHP: 420,
            speedBoostTimer: 2.7,
            speedBoostFactor: 1.0,
            lastStandTimer: 4.8,
            lastStandDamageBoost: 0.45,
            swiftBuffTimer: 3.0,
            weakPointMarkTimer: 4.1,
            markWeaknessTimer: 5.2,
            markWeaknessFactor: 0.2,
            bleedTimer: 8.0,
            bleedStacks: 2,
            bleedTickDamage: 14,
            poisonTimer: 6.0,
            poisonStacks: 3,
            poisonTickDamage: 11,
            rootTimer: 2.2,
            slowTimer: 4.5,
            slowFactor: 0.5,
            spiritsActive: true,
            spiritDuration: 7.9,
            spiritBoosted: true,
            arcaneShieldActive: true
        };

        engine.syncTrackedActorBuffs(actor);

        expect(engine.getActiveBuffs()).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'guardian_roar',
                name: 'Guardian Roar',
                icon: '🛡️',
                detail: '30% damage reduction',
                durationSeconds: 9.5,
                isDebuff: false
            }),
            expect.objectContaining({
                id: 'blessing_resolve',
                name: 'Blessing of Resolve',
                icon: '✝️',
                detail: '25% damage reduction',
                durationSeconds: 6.2,
                isDebuff: false
            }),
            expect.objectContaining({
                id: 'time_warp',
                name: 'Time Warp',
                icon: '⏩',
                detail: '+50% haste',
                durationSeconds: 10,
                isDebuff: false
            }),
            expect.objectContaining({
                id: 'arcane_shield',
                name: 'Arcane Shield',
                icon: '🔷',
                detail: '420 shield remaining',
                isDebuff: false
            }),
            expect.objectContaining({
                id: 'vanish',
                name: 'Vanish',
                icon: '💨',
                detail: '+100% speed',
                durationSeconds: 2.7,
                isDebuff: false
            }),
            expect.objectContaining({
                id: 'spirit_guardians',
                name: 'Spirit Guardians',
                icon: '👻',
                detail: 'Boosted guardians active',
                durationSeconds: 7.9,
                isDebuff: false
            }),
            expect.objectContaining({
                id: 'blessing_zeal',
                name: 'Blessing of Zeal',
                icon: '✨',
                detail: '+35% damage and healing',
                durationSeconds: 11.4,
                isDebuff: false
            }),
            expect.objectContaining({
                id: 'last_stand',
                name: 'Last Stand',
                icon: '🔥',
                detail: '+45% damage',
                durationSeconds: 4.8,
                isDebuff: false
            }),
            expect.objectContaining({
                id: 'swift',
                name: 'Swift',
                icon: '⚡',
                detail: '+20% move speed',
                durationSeconds: 3.0,
                isDebuff: false
            }),
            expect.objectContaining({
                id: 'weak_point',
                name: 'Weak Point',
                icon: '🎯',
                detail: 'Vulnerable to piercing throw',
                durationSeconds: 4.1,
                isDebuff: true
            }),
            expect.objectContaining({
                id: 'mark_weakness',
                name: 'Marked',
                icon: '🎯',
                detail: '+20% damage taken',
                durationSeconds: 5.2,
                isDebuff: true
            }),
            expect.objectContaining({
                id: 'bleed',
                name: 'Bleeding',
                icon: '🩸',
                detail: '14 bleed per tick',
                durationSeconds: 8.0,
                isDebuff: true
            }),
            expect.objectContaining({
                id: 'poison',
                name: 'Poisoned',
                icon: '☠️',
                detail: '11 poison per tick',
                durationSeconds: 6.0,
                isDebuff: true
            }),
            expect.objectContaining({
                id: 'root',
                name: 'Rooted',
                icon: '🪤',
                detail: 'Movement locked',
                durationSeconds: 2.2,
                isDebuff: true
            }),
            expect.objectContaining({
                id: 'slow',
                name: 'Slowed',
                icon: '🐢',
                detail: '50% slow',
                durationSeconds: 4.5,
                isDebuff: true
            })
        ]));
    });

    test('derives combat buffs from the current player when active buffs are requested', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.activeBuffs = [];
        engine.player = {
            guardianRoarTimer: 8,
            guardianRoarReduction: 0.3,
            hasteTimer: 5,
            hasteFactor: 0.5,
            blessingZealTimer: 9,
            blessingZealFactor: 0.25,
            weakPointMarkTimer: 3,
            bleedTimer: 4,
            bleedStacks: 2,
            bleedTickDamage: 12
        };
        engine.upsertActiveBuff = GameEngine.prototype.upsertActiveBuff;
        engine.removeActiveBuff = GameEngine.prototype.removeActiveBuff;
        engine.syncTrackedActorBuffs = GameEngine.prototype.syncTrackedActorBuffs;
        engine.getActiveBuffs = GameEngine.prototype.getActiveBuffs;

        const buffs = engine.getActiveBuffs();

        expect(buffs).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'guardian_roar', name: 'Guardian Roar' }),
            expect.objectContaining({ id: 'time_warp', name: 'Time Warp' }),
            expect.objectContaining({ id: 'blessing_zeal', name: 'Blessing of Zeal' }),
            expect.objectContaining({ id: 'bleed', name: 'Bleeding' })
        ]));
    });

    test('removes tracked buffs when actor timers expire', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.activeBuffs = [
            { id: 'guardian_roar', name: 'Guardian Roar', remainingSeconds: 4 },
            { id: 'arcane_shield', name: 'Arcane Shield', remainingSeconds: 4 }
        ];
        engine.upsertActiveBuff = GameEngine.prototype.upsertActiveBuff;
        engine.removeActiveBuff = GameEngine.prototype.removeActiveBuff;
        engine.syncTrackedActorBuffs = GameEngine.prototype.syncTrackedActorBuffs;
        engine.getActiveBuffs = GameEngine.prototype.getActiveBuffs;

        engine.syncTrackedActorBuffs({
            guardianRoarTimer: 0,
            guardianRoarReduction: 0,
            shieldHP: 0
        });

        expect(engine.getActiveBuffs().some((buff) => buff.id === 'guardian_roar')).toBe(false);
        expect(engine.getActiveBuffs().some((buff) => buff.id === 'arcane_shield')).toBe(false);
    });

    test('local authoritative support sync clears wizard buff state through the shared helper', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.syncRemoteSupportEffects = GameEngine.prototype.syncRemoteSupportEffects;
        engine.syncPlayerSupportEffects = GameEngine.prototype.syncPlayerSupportEffects;
        engine.showRemoteSupportStateReadability = jest.fn();
        engine.player = {
            hasteTimer: 8,
            hasteFactor: 0.5,
            spellFocusActive: true,
            spellFocusMultiplier: 2.5,
            arcaneShieldActive: true,
            shieldHP: 120
        };

        engine.syncPlayerSupportEffects(engine.player, {
            timeWarpActive: false,
            spellFocusActive: false,
            arcaneShieldActive: false,
            arcaneShieldHp: 0
        });

        expect(engine.player.hasteTimer).toBe(0);
        expect(engine.player.hasteFactor).toBe(0);
        expect(engine.player.spellFocusActive).toBe(false);
        expect(engine.player.spellFocusMultiplier).toBe(1.0);
        expect(engine.player.arcaneShieldActive).toBe(false);
        expect(engine.player.shieldHP).toBe(0);
    });

    test('shared support sync clears spirit guardians without dropping unrelated cleric buffs', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.syncRemoteSupportEffects = GameEngine.prototype.syncRemoteSupportEffects;
        engine.syncPlayerSupportEffects = GameEngine.prototype.syncPlayerSupportEffects;
        engine.showRemoteSupportStateReadability = jest.fn();

        const player = {
            spiritsActive: true,
            spiritDuration: 8,
            guardianEmbraceActive: true,
            guardianEmbraceTimer: 6,
            seraphActive: true,
            clearSpiritMeshes: jest.fn(function clearSpiritMeshes() {
                this.spirits = [];
            })
        };

        engine.syncPlayerSupportEffects(player, {
            spiritsActive: false
        });

        expect(player.spiritsActive).toBe(false);
        expect(player.spiritDuration).toBe(0);
        expect(player.clearSpiritMeshes).toHaveBeenCalled();
        expect(player.guardianEmbraceActive).toBe(true);
        expect(player.guardianEmbraceTimer).toBe(6);
        expect(player.seraphActive).toBe(true);
    });

    test('shared support sync applies boosted spirit guardians metadata from authoritative payloads', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.syncRemoteSupportEffects = GameEngine.prototype.syncRemoteSupportEffects;
        engine.syncPlayerSupportEffects = GameEngine.prototype.syncPlayerSupportEffects;
        engine.showRemoteSupportStateReadability = jest.fn();

        const player = {
            spiritsActive: false,
            spiritBoosted: false,
            spiritDuration: 0,
            createSpirits: jest.fn()
        };

        engine.syncPlayerSupportEffects(player, {
            spiritsActive: true,
            spiritsBoosted: true
        });

        expect(player.spiritsActive).toBe(true);
        expect(player.spiritBoosted).toBe(true);
        expect(player.spiritDuration).toBe(10);
        expect(player.createSpirits).toHaveBeenCalled();
    });

    test('shared support sync applies authoritative spirit duration detail', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.syncRemoteSupportEffects = GameEngine.prototype.syncRemoteSupportEffects;
        engine.syncPlayerSupportEffects = GameEngine.prototype.syncPlayerSupportEffects;
        engine.showRemoteSupportStateReadability = jest.fn();

        const player = {
            spiritsActive: false,
            spiritBoosted: false,
            spiritDuration: 0,
            createSpirits: jest.fn()
        };

        engine.syncPlayerSupportEffects(player, {
            spiritsActive: true,
            spiritDuration: 6.5
        });

        expect(player.spiritsActive).toBe(true);
        expect(player.spiritDuration).toBe(6.5);
        expect(player.createSpirits).toHaveBeenCalled();
    });

    test('shared support sync applies authoritative blessing resolve duration detail', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.syncRemoteSupportEffects = GameEngine.prototype.syncRemoteSupportEffects;
        engine.syncPlayerSupportEffects = GameEngine.prototype.syncPlayerSupportEffects;
        engine.showRemoteSupportStateReadability = jest.fn();

        const player = {
            blessingResolveActive: false,
            blessingResolveTimer: 0,
            blessingResolveReduction: 0.25
        };

        engine.syncPlayerSupportEffects(player, {
            blessingResolveActive: true,
            blessingResolveDuration: 12.5
        });

        expect(player.blessingResolveActive).toBe(true);
        expect(player.blessingResolveTimer).toBe(12.5);
        expect(player.blessingResolveReduction).toBe(0.25);
    });

    test('authoritative self status clears remove tracked debuffs without inventing new durations', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.syncPlayerStatusClears = GameEngine.prototype.syncPlayerStatusClears;

        const player = {
            stunTimer: 2,
            slowTimer: 4,
            slowFactor: 0.5,
            rootTimer: 3,
            weakPointMarkTimer: 4,
            markWeaknessTimer: 5,
            markWeaknessFactor: 0.2,
            bleedTimer: 6,
            bleedStacks: 2,
            bleedTickDamage: 14,
            poisonTimer: 5,
            poisonStacks: 3,
            poisonTickDamage: 11
        };

        engine.syncPlayerStatusClears(player, {
            stunned: false,
            slowed: false,
            rooted: false,
            weakPointMarked: false,
            markWeakness: false,
            bleeding: false,
            poisoned: false
        });

        expect(player.stunTimer).toBe(0);
        expect(player.slowTimer).toBe(0);
        expect(player.slowFactor).toBe(0);
        expect(player.rootTimer).toBe(0);
        expect(player.weakPointMarkTimer).toBe(0);
        expect(player.markWeaknessTimer).toBe(0);
        expect(player.markWeaknessFactor).toBe(0);
        expect(player.bleedTimer).toBe(0);
        expect(player.bleedStacks).toBe(0);
        expect(player.bleedTickDamage).toBe(0);
        expect(player.poisonTimer).toBe(0);
        expect(player.poisonStacks).toBe(0);
        expect(player.poisonTickDamage).toBe(0);
    });

    test('authoritative self status details apply replicated slow factor', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.syncPlayerStatusDetails = GameEngine.prototype.syncPlayerStatusDetails;

        const player = {
            slowTimer: 0,
            slowFactor: 0
        };

        engine.syncPlayerStatusDetails(player, {
            slowed: true,
            slowFactor: 0.35
        });

        expect(player.slowFactor).toBe(0.35);
        expect(player.slowTimer).toBe(0.1);
    });

    test('authoritative self status details apply replicated weak point state', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.syncPlayerStatusDetails = GameEngine.prototype.syncPlayerStatusDetails;

        const player = {
            weakPointMarkTimer: 0
        };

        engine.syncPlayerStatusDetails(player, {
            weakPointMarked: true
        });

        expect(player.weakPointMarkTimer).toBe(0.1);
    });

    test('authoritative self status details apply replicated weak point duration', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.syncPlayerStatusDetails = GameEngine.prototype.syncPlayerStatusDetails;

        const player = {
            weakPointMarkTimer: 0
        };

        engine.syncPlayerStatusDetails(player, {
            weakPointMarked: true,
            weakPointDuration: 4.25
        });

        expect(player.weakPointMarkTimer).toBe(4.25);
    });

    test('authoritative self status details apply replicated mark weakness state', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.syncPlayerStatusDetails = GameEngine.prototype.syncPlayerStatusDetails;

        const player = {
            markWeaknessTimer: 0,
            markWeaknessFactor: 0
        };

        engine.syncPlayerStatusDetails(player, {
            markWeakness: true
        });

        expect(player.markWeaknessTimer).toBe(0.1);
        expect(player.markWeaknessFactor).toBe(0);
    });

    test('authoritative self status details apply replicated mark weakness duration', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.syncPlayerStatusDetails = GameEngine.prototype.syncPlayerStatusDetails;

        const player = {
            markWeaknessTimer: 0,
            markWeaknessFactor: 0
        };

        engine.syncPlayerStatusDetails(player, {
            markWeakness: true,
            markWeaknessDuration: 4.25
        });

        expect(player.markWeaknessTimer).toBe(4.25);
        expect(player.markWeaknessFactor).toBe(0);
    });

    test('mark weakness buff detail falls back to a truthful generic label without authoritative factor data', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.activeBuffs = [];
        engine.upsertActiveBuff = GameEngine.prototype.upsertActiveBuff;
        engine.syncTrackedActorBuffs = GameEngine.prototype.syncTrackedActorBuffs;
        engine.getActiveBuffs = GameEngine.prototype.getActiveBuffs;

        engine.syncTrackedActorBuffs({
            markWeaknessTimer: 0.1,
            markWeaknessFactor: 0
        });

        expect(engine.getActiveBuffs()).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'mark_weakness',
                detail: 'Damage taken increased',
                durationSeconds: 0.1,
                isDebuff: true
            })
        ]));
    });

    test('authoritative self status details apply replicated slow duration', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.syncPlayerStatusDetails = GameEngine.prototype.syncPlayerStatusDetails;

        const player = {
            slowTimer: 0,
            slowFactor: 0.35
        };

        engine.syncPlayerStatusDetails(player, {
            slowed: true,
            slowDuration: 2.75
        });

        expect(player.slowTimer).toBe(2.75);
        expect(player.slowFactor).toBe(0.35);
    });

    test('authoritative self status details apply replicated root duration', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.syncPlayerStatusDetails = GameEngine.prototype.syncPlayerStatusDetails;

        const player = {
            rootTimer: 0
        };

        engine.syncPlayerStatusDetails(player, {
            rooted: true,
            rootDuration: 2.5
        });

        expect(player.rootTimer).toBe(2.5);
    });

    test('authoritative self status details apply replicated stun duration', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.syncPlayerStatusDetails = GameEngine.prototype.syncPlayerStatusDetails;

        const player = {
            stunTimer: 0
        };

        engine.syncPlayerStatusDetails(player, {
            stunned: true,
            stunDuration: 1.75
        });

        expect(player.stunTimer).toBe(1.75);
    });

    test('authoritative self status details apply replicated bleed duration', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.syncPlayerStatusDetails = GameEngine.prototype.syncPlayerStatusDetails;

        const player = {
            bleedTimer: 0,
            bleedStacks: 2
        };

        engine.syncPlayerStatusDetails(player, {
            bleeding: true,
            bleedDuration: 3.25
        });

        expect(player.bleedTimer).toBe(3.25);
        expect(player.bleedStacks).toBe(2);
    });

    test('authoritative self status details apply replicated bleed damage', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.syncPlayerStatusDetails = GameEngine.prototype.syncPlayerStatusDetails;

        const player = {
            bleedTickDamage: 0,
            bleedStacks: 2
        };

        engine.syncPlayerStatusDetails(player, {
            bleeding: true,
            bleedDamage: 14
        });

        expect(player.bleedTickDamage).toBe(14);
        expect(player.bleedStacks).toBe(2);
    });

    test('authoritative self status details apply replicated poison duration', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.syncPlayerStatusDetails = GameEngine.prototype.syncPlayerStatusDetails;

        const player = {
            poisonTimer: 0,
            poisonStacks: 3
        };

        engine.syncPlayerStatusDetails(player, {
            poisoned: true,
            poisonDuration: 4.5
        });

        expect(player.poisonTimer).toBe(4.5);
        expect(player.poisonStacks).toBe(3);
    });

    test('authoritative self status details apply replicated poison damage', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.syncPlayerStatusDetails = GameEngine.prototype.syncPlayerStatusDetails;

        const player = {
            poisonTickDamage: 0,
            poisonStacks: 3
        };

        engine.syncPlayerStatusDetails(player, {
            poisoned: true,
            poisonDamage: 11
        });

        expect(player.poisonTickDamage).toBe(11);
        expect(player.poisonStacks).toBe(3);
    });
});
