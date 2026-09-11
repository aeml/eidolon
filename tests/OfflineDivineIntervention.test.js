import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Cleric } from '../src/entities/Cleric.js';
import { Fighter } from '../src/entities/Fighter.js';
import { Imp } from '../src/entities/Imp.js';
import { Actor } from '../src/entities/Actor.js';

function fixture(rune = '') {
    const caster = new Cleric('divine-caster'), ally = new Fighter('divine-ally'), other = new Fighter('divine-other'), enemy = new Imp('divine-enemy');
    const actors = [caster, ally, other, enemy];
    for (const actor of actors) {
        actor.mesh = new THREE.Group(); actor.stats.hp = 100; actor.stats.maxHp = 1000; actor.stats.hpRegen = 0;
    }
    caster.stats.mana = 1000; caster.unlockedSkills.push('Divine Intervention');
    caster.skillRunes = {'Divine Intervention':rune};
    ally.position.set(0, 0, 4); other.position.set(0, 0, 2); enemy.position.set(0, 0, 6);
    const engine = {isMultiplayer:false, chunkManager:{getActiveEntities:()=>[ally, other, enemy]},
        isHostileActorTarget:actor=>actor === enemy, spawnTransientEffect:jest.fn(()=>true), floatingTextManager:{spawn:jest.fn()}};
    return {caster, ally, other, enemy, engine, cast:()=>caster.useAbility(ally.position.clone(), engine, 'Divine Intervention'),
        dispose:()=>actors.forEach(actor=>actor.dispose())};
}

test.each([[{}, 600], [{CLR_09:5}, 700]])('paid Divine heals half max health with training %j', (ranks, hp) => {
    const f = fixture();
    try {
        f.caster.talentRanks = ranks; f.cast();
        expect(f.caster.stats.mana).toBe(940);
        expect(f.ally.stats.hp).toBe(hp);
        expect(f.ally.divineInterventionTimer).toBe(10);
        expect(f.ally.divineInterventionActive).toBe(true);
        expect(f.enemy.stats.hp).toBe(100);
    } finally { f.dispose(); }
});

test.each(['enemy', 'distant', 'remote', 'engine-authoritative', 'dead', 'inactive', 'wall'])('invalid %s target falls back to self', reason => {
    const f = fixture();
    try {
        f.other.position.set(0,0,100);
        if (reason === 'enemy') f.engine.isHostileActorTarget = actor=>actor !== f.caster;
        if (reason === 'distant') f.ally.position.set(0,0,50);
        if (reason === 'remote') f.ally.isRemote = true;
        if (reason === 'engine-authoritative') f.ally.gameEngine = {isMultiplayer:true};
        if (reason === 'dead') f.ally.state = 'DEAD';
        if (reason === 'inactive') f.ally.isActive = false;
        if (reason === 'wall') {
            f.caster.position.set(50009,0,50000); f.ally.position.set(50011,0,50000);
            f.engine.currentInstanceId = 'dungeon_divine';
            f.engine.currentDungeonLayout = {walkRects:[{x:50000,z:50000,width:20,height:20},{x:50020.5,z:50000,width:20,height:20}]};
        }
        f.cast();
        expect(f.caster.stats.hp).toBe(600);
        expect(f.caster.divineInterventionActive).toBe(true);
        expect(f.ally.stats.hp).toBe(100);
        expect(f.ally.divineInterventionActive).not.toBe(true);
    } finally { f.dispose(); }
});

test('Miracle protects and heals exactly two distinct friendly recipients', () => {
    const f = fixture('divineintervention_miracle');
    try {
        f.cast();
        expect(f.ally.stats.hp).toBe(600);
        // The caster is the closest additional friendly actor, as on the server.
        expect(f.caster.stats.hp).toBe(600);
        expect(f.ally.divineInterventionActive).toBe(true);
        expect(f.caster.divineInterventionActive).toBe(true);
        expect(f.other.stats.hp).toBe(100); expect(f.enemy.stats.hp).toBe(100);
    } finally { f.dispose(); }
});

test.each([['', false, 91.8], ['divineintervention_quick', false, 45.9], ['', true, 45.9], ['divineintervention_quick', true, 22.95]])(
    'paid cooldown composes rune=%s set=%s', (rune, set, expected) => {
    const f = fixture(rune);
    try {
        f.caster.talentRanks = {CLR_10:5}; f.caster.stats.cooldownReduction = .1;
        if (set) f.caster.activeSetBonuses = {divine:{specials:{divineInterventionCD:60}}};
        f.cast(); expect(f.caster.cooldowns['Divine Intervention']).toBeCloseTo(expected, 8);
    } finally { f.dispose(); }
});

test('Guardian halves hits only during its trained protection window; rescue is single-use', () => {
    const f = fixture('divineintervention_guardian');
    try {
        f.caster.talentRanks = {CLR_10:5}; f.cast();
        expect(f.ally.divineInterventionGuardianTimer).toBeCloseTo(5.5);
        expect(f.ally.divineInterventionTimer).toBeCloseTo(11);
        f.ally.takeDamage(101, f.enemy); expect(f.ally.stats.hp).toBe(550);
        f.ally.stunTimer = 20;
        Actor.prototype.update.call(f.ally, 5.5, null, null, f.engine.chunkManager);
        expect(f.ally.divineInterventionGuardianTimer).toBe(0);
        expect(f.ally.divineInterventionTimer).toBeCloseTo(5.5);
        f.ally.takeDamage(101, f.enemy); expect(f.ally.stats.hp).toBe(449);
        f.ally.takeDamage(1000, f.enemy); expect(f.ally.stats.hp).toBe(300);
        expect(f.ally.divineInterventionActive).toBe(false);
        f.ally.takeDamage(1000, f.enemy); expect(f.ally.state).toBe('DEAD');
    } finally { f.dispose(); }
});

test.each([['poison',460], ['clamp',1000]])('trained healing respects %s receiving limits', (mode, hp) => {
    const f = fixture();
    try {
        f.caster.talentRanks = {CLR_09:5}; f.caster.stats.healingDoneBonus = .2;
        if (mode === 'poison') f.ally.poisonTimer = 10;
        else f.ally.stats.hp = 990;
        // 500 * 1.2 equipment * 1.2 Mastery = 720, then poison or missing-health cap.
        f.cast(); expect(f.ally.stats.hp).toBe(hp);
    } finally { f.dispose(); }
});

test.each(['locked','mana','cooldown','dead','stunned'])('rejected %s cast has no healing/protection or payment', reason => {
    const f = fixture('divineintervention_guardian');
    try {
        if (reason === 'locked') f.caster.unlockedSkills = [];
        if (reason === 'mana') f.caster.stats.mana = 59;
        if (reason === 'cooldown') f.caster.cooldowns['Divine Intervention'] = 1;
        if (reason === 'dead') f.caster.state = 'DEAD';
        if (reason === 'stunned') f.caster.stunTimer = 1;
        const mana = f.caster.stats.mana;
        f.cast(); expect(f.caster.stats.mana).toBe(mana);
        expect(f.ally.stats.hp).toBe(100);
        expect(f.ally.divineInterventionTimer).toBe(0);
        expect(f.ally.divineInterventionGuardianTimer).toBe(0);
    } finally { f.dispose(); }
});

test.each(['multiplayer','remote','engine'])('authoritative %s cast does not apply local healing or protection', mode => {
    const f = fixture('divineintervention_guardian');
    try {
        if (mode === 'multiplayer') f.caster.isMultiplayer = true;
        if (mode === 'remote') f.caster.isRemote = true;
        if (mode === 'engine') f.engine.isMultiplayer = true;
        f.cast();
        expect(f.ally.stats.hp).toBe(100);
        expect(f.ally.divineInterventionTimer).toBe(0);
        expect(f.ally.divineInterventionGuardianTimer).toBe(0);
    } finally { f.dispose(); }
});

test('Miracle self-cast selects only the nearest eligible additional ally', () => {
    const f = fixture('divineintervention_miracle');
    try {
        f.enemy.position.set(0,0,.1);
        f.caster.useAbility(f.caster.position.clone(), f.engine, 'Divine Intervention');
        expect(f.caster.stats.hp).toBe(600); expect(f.other.stats.hp).toBe(600);
        expect(f.ally.stats.hp).toBe(100); expect(f.enemy.stats.hp).toBe(100);
        expect(f.other.divineInterventionTimer).toBe(f.caster.divineInterventionTimer);
    } finally { f.dispose(); }
});

test('expired Guardian and rescue cannot alter an authoritative recipient health snapshot', () => {
    const f = fixture('divineintervention_guardian');
    try {
        f.cast(); f.ally.gameEngine = {isMultiplayer:true};
        const hp = f.ally.stats.hp;
        f.ally.takeDamage(2000, f.enemy); expect(f.ally.stats.hp).toBe(hp);
    } finally { f.dispose(); }
});
