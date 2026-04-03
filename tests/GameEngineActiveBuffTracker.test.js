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
            markWeaknessTimer: 5.2,
            markWeaknessFactor: 0.2,
            bleedTimer: 8.0,
            bleedStacks: 2,
            poisonTimer: 6.0,
            poisonStacks: 3,
            rootTimer: 2.2,
            slowTimer: 4.5,
            slowFactor: 0.5,
            spiritsActive: true,
            spiritDuration: 7.9,
            spiritBoosted: true
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
                detail: '2 bleed stacks',
                durationSeconds: 8.0,
                isDebuff: true
            }),
            expect.objectContaining({
                id: 'poison',
                name: 'Poisoned',
                icon: '☠️',
                detail: '3 poison stacks',
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
            bleedTimer: 4,
            bleedStacks: 2
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
});
