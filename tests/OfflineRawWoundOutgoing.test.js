import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { Rogue } from '../src/entities/Rogue.js';
import { Imp } from '../src/entities/Imp.js';

afterEach(() => jest.restoreAllMocks());

function paidWound(delivery, configure, check) {
    const source = new Rogue('raw-source'), target = new Imp('raw-target');
    const projectiles = [], scheduled = [];
    try {
        source.mesh = new THREE.Group(); target.mesh = new THREE.Group();
        source.stats.dexterity = 180; source.stats.damage = 100;
        source.stats.mana = 1000; source.stats.critChanceBonus = 0;
        target.position.set(0, 0, 6);
        target.stats.hp = target.stats.maxHp = 10000; target.stats.hpRegen = 0;
        source.unlockedSkills.push('Shadow Lunge', 'Poison Coating', 'Piercing Throw');
        source.scheduleTask = callback => { scheduled.push(callback); return scheduled.length; };
        const engine = { isMultiplayer: false, chunkManager: { getActiveEntities: () => [target] },
            floatingTextManager: { spawn: jest.fn() }, spawnTransientEffect: jest.fn(() => true),
            addEntity: entity => projectiles.push(entity), isHostileActorTarget: entity => entity === target };
        configure(source, target);
        const skill = delivery === 'lunge' ? 'Shadow Lunge' : 'Poison Coating';
        source.useAbility(target.position.clone(), engine, skill);
        expect(source.stats.mana).toBeLessThan(1000);
        if (delivery === 'basic') {
            expect(source.attack(target)).toBe(true); scheduled[0]();
        } else if (delivery === 'projectile') {
            const mana = source.stats.mana;
            const beforeHit = target.stats.hp;
            source.useAbility(target.position.clone(), engine, 'Piercing Throw');
            expect(source.stats.mana).toBeLessThan(mana);
            for (let step = 0; step < 120 && target.stats.hp === beforeHit; step++) {
                for (const projectile of projectiles) if (projectile.isActive) {
                    projectile.update(.02, null, null, engine.chunkManager, engine.floatingTextManager, engine);
                    if (target.stats.hp < beforeHit) break;
                }
            }
            expect(target.stats.hp).toBeLessThan(beforeHit);
        }
        check(source, target, delivery === 'lunge' ? 'bleed' : 'poison', engine);
    } finally {
        for (const projectile of projectiles) projectile.dispose();
        source.dispose(); target.dispose();
    }
}

test.each(['lunge', 'basic', 'projectile'])('paid %s rolls its matching raw-wound Technique once', delivery => {
    jest.spyOn(Math, 'random').mockReturnValue(.6);
    for (const build of ['baseline', 'trained', 'unrelated']) {
        paidWound(delivery, source => {
            source.stats.critChanceBonus = .55;
            const talent = delivery === 'lunge' ? 'ROG_08' : 'ROG_22';
            source.talentRanks = build === 'baseline' ? {} : { [build === 'trained' ? talent : 'ROG_10']: 5 };
        }, (source, target, kind, engine) => {
            const expected = (delivery === 'lunge' ? 100 : 98)*(build === 'trained' ? 2 : 1);
            expect(target[`${kind}TickDamage`]).toBe(expected);
            const hp = target.stats.hp;
            source.stats.critChanceBonus = 1; source.stats.poisonDamageBonus = 10;
            Actor.prototype.update.call(target, 1, null, null, engine.chunkManager);
            expect(target.stats.hp).toBe(hp-expected);
        });
    }
});

test.each(['basic', 'projectile'])('paid %s coating snapshots poison equipment bonus once', delivery => {
    jest.spyOn(Math, 'random').mockReturnValue(.6);
    paidWound(delivery, source => { source.stats.poisonDamageBonus = .5; }, (source, target, kind, engine) => {
        expect(target.poisonTickDamage).toBe(147);
        const hp = target.stats.hp;
        source.stats.poisonDamageBonus = 10; source.stats.critChanceBonus = 1;
        Actor.prototype.update.call(target, 1, null, null, engine.chunkManager);
        expect(target.stats.hp).toBe(hp-147);
    });
});

test('paid coating composes Mastery, generic damage, Technique and poison equipment once', () => {
    jest.spyOn(Math, 'random').mockReturnValue(.6);
    paidWound('projectile', source => {
        source.talentRanks = { ROG_21: 5, ROG_38: 5, ROG_22: 5 };
        source.stats.critChanceBonus = .55; source.stats.poisonDamageBonus = .5;
    }, (source, target) => { expect(target.poisonTickDamage).toBe(381); });
});

test.each(['lunge', 'basic', 'projectile'])('paid %s snapshots outgoing unique and set effects', delivery => {
    for (const effect of ['lucky', 'executioner', 'fortress-set']) {
        jest.spyOn(Math, 'random').mockReturnValue(.05);
        paidWound(delivery, (source, target) => {
            if (effect === 'lucky') source.hasLuckyEffect = true;
            if (effect === 'executioner') {
                source.hasExecutionerEffect = true; target.stats.hp = target.stats.maxHp/4;
            }
            if (effect === 'fortress-set') {
                source.ironFortressTimer = 60;
                source.activeSetBonuses = { fortress: { specials: { ironFortressDamage: 100 } } };
            }
        }, (source, target, kind, engine) => {
            const base = delivery === 'lunge' ? 100 : 98;
            const expected = effect === 'executioner' ? Math.floor(base*1.25) : base*2;
            expect(target[`${kind}TickDamage`]).toBe(expected);
            const hp = target.stats.hp;
            source.hasLuckyEffect = source.hasExecutionerEffect = false;
            source.ironFortressTimer = 0;
            Actor.prototype.update.call(target, 1, null, null, engine.chunkManager);
            expect(target.stats.hp).toBe(hp-expected);
        });
        jest.restoreAllMocks();
    }
});
