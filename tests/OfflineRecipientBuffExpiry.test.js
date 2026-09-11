import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { Cleric } from '../src/entities/Cleric.js';
import { Fighter } from '../src/entities/Fighter.js';

test.each(['Blessing of Resolve', 'Blessing of Zeal', 'Divine Intervention'].flatMap(skill =>
    [false, true].map(stunned => [skill, stunned])))('paid %s expires while stunned=%s', (skill, stunned) => {
    const source = new Cleric('support-source'), target = new Fighter('support-recipient');
    try {
        source.mesh = new THREE.Group(); target.mesh = new THREE.Group();
        source.stats.mana = 1000; source.unlockedSkills.push(skill);
        target.position.set(0, 0, 1); target.stats.hp = target.stats.maxHp = 10000; target.stats.hpRegen = 0;
        const engine = {isMultiplayer:false, chunkManager:{getActiveEntities:()=>[target]},
            floatingTextManager:{spawn:jest.fn()}, spawnTransientEffect:jest.fn(()=>true), isHostileActorTarget:()=>false};
        source.useAbility(target.position.clone(), engine, skill);
        expect(source.stats.mana).toBeLessThan(1000);
        const timer = skill === 'Blessing of Resolve' ? 'blessingResolveTimer'
            : skill === 'Blessing of Zeal' ? 'blessingZealTimer' : 'divineInterventionTimer';
        const duration = target[timer];
        expect(duration).toBeGreaterThan(0);
        target.stunTimer = stunned ? duration+5 : 0;
        Actor.prototype.update.call(target, duration/2, null, null, engine.chunkManager);
        expect(target[timer]).toBeCloseTo(duration/2, 8);
        Actor.prototype.update.call(target, duration/2, null, null, engine.chunkManager);
        expect(target[timer]).toBe(0);
        if (stunned) expect(target.stunTimer).toBe(5);
        if (skill === 'Blessing of Resolve') {
            expect(target.blessingResolveReduction).toBe(0);
            const before = target.stats.hp;
            target.takeDamage(100, source);
            expect(target.stats.hp).toBe(before-100);
        } else if (skill === 'Blessing of Zeal') {
            expect(target.blessingZealFactor).toBe(0);
        } else {
            expect(target.divineInterventionActive).toBe(false);
            target.takeDamage(target.stats.hp+1, source);
            expect(target.state).toBe('DEAD');
        }
    } finally {source.dispose(); target.dispose();}
});

test.each([
    ['guardianRoarTimer', null], ['lastStandTimer', 'lastStandDamageBoost'],
    ['speedBoostTimer', 'speedBoostFactor'], ['stealthTimer', null],
    ['frozenTimer', null], ['hasteTimer', 'hasteFactor'], ['spellFocusTimer', null],
    ['arcaneShieldTimer', 'shieldHP'], ['swiftBuffTimer', null]
].flatMap(([timer, factor]) => [false, true].map(stunned => [timer, factor, stunned])))(
    'other recipient timer %s clears %s and advances once, stunned=%s', (timer, factor, stunned) => {
    const target = new Actor('recipient-timer', {});
    try {
        target[timer] = 2;
        if (factor) target[factor] = .5;
        if (timer === 'arcaneShieldTimer') target.arcaneShieldActive = true;
        target.stunTimer = stunned ? 10 : 0;
        const position = target.position.clone();
        target.update(1, null, null, null);
        expect(target[timer]).toBe(1);
        if (factor) expect(target[factor]).toBe(.5);
        target.update(1, null, null, null);
        expect(target[timer]).toBe(0);
        if (factor) expect(target[factor]).toBe(0);
        if (timer === 'arcaneShieldTimer') expect(target.arcaneShieldActive).toBe(false);
        target.update(1, null, null, null);
        expect(target[timer]).toBe(0);
        expect(target.position.equals(position)).toBe(true);
    } finally { target.dispose(); }
});

test.each([{isMultiplayer:true}, {isRemote:true}, {gameEngine:{isMultiplayer:true}}])(
    'visual expiry does not clear authoritative rescue or shield state: %j', flags => {
    const target = new Actor('authoritative-recipient', {});
    try {
        Object.assign(target, flags, {stunTimer:5, divineInterventionTimer:1, divineInterventionActive:true,
            arcaneShieldTimer:1, arcaneShieldActive:true, shieldHP:50});
        target.update(1, null, null, null);
        expect(target.divineInterventionTimer).toBe(0);
        expect(target.arcaneShieldTimer).toBe(0);
        expect(target.divineInterventionActive).toBe(true);
        expect(target.arcaneShieldActive).toBe(true);
        expect(target.shieldHP).toBe(50);
    } finally { target.dispose(); }
});
