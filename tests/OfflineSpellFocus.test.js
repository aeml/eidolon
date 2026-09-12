import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Wizard } from '../src/entities/Wizard.js';
import { Actor } from '../src/entities/Actor.js';

function fixture() {
    const wizard = new Wizard('focus-wizard');
    wizard.mesh = new THREE.Group(); wizard.level = 100; wizard.recalculateStats();
    wizard.stats.hp = wizard.stats.maxHp; wizard.stats.mana = wizard.stats.maxMana;
    wizard.unlockedSkills.push('Spell Focus', 'Teleport', 'Arcane Shield', 'Time Warp', 'Dragonfire Lance');
    const engine = { isMultiplayer: false, currentInstanceId: '',
        chunkManager: { getActiveEntities: () => [] }, floatingTextManager: { spawn: jest.fn() },
        spawnTransientEffect: jest.fn(() => true), addEntity: jest.fn() };
    return { wizard, engine, cast: (skill = 'Spell Focus') => wizard.useAbility(new THREE.Vector3(5, 0, 0), engine, skill),
        dispose: () => { for (const [entity] of engine.addEntity.mock.calls) entity.dispose?.(); wizard.dispose(); } };
}

test.each([[0, 2.5], [1, 2.6], [5, 3], [99, 3], [-1, 2.5], [Infinity, 2.5]])(
    'Focus Mastery rank %s snapshots its multiplier %s for exactly one paid spell', (rank, multiplier) => {
        const f = fixture();
        try {
            f.wizard.talentRanks = { WIZ_15: rank };
            f.cast();
            expect(f.wizard.spellFocusMultiplier).toBeCloseTo(multiplier);
            f.wizard.talentRanks = { WIZ_15: rank > 0 ? 0 : 5 };
            f.cast('Teleport');
            expect(f.wizard.spellFocusMultiplier).toBeCloseTo(multiplier);
            const base = 20 + f.wizard.stats.intelligence * 2;
            f.cast('Fireball');
            expect(f.engine.addEntity.mock.calls.at(-1)[0].damage).toBeCloseTo(base * multiplier);
            expect(f.wizard.spellFocusActive).toBe(false);
            expect(f.wizard.spellFocusMultiplier).toBe(1);
            f.wizard.cooldowns.Fireball = 0;
            f.cast('Fireball');
            expect(f.engine.addEntity.mock.calls.at(-1)[0].damage).toBe(base);
        } finally { f.dispose(); }
    }
);

test('unaffordable next spell preserves the trained Focus charge and its timer', () => {
    const f = fixture();
    try {
        f.wizard.talentRanks = { WIZ_15: 5 };
        f.cast();
        f.wizard.stats.mana = 0;
        f.cast('Dragonfire Lance');
        expect(f.wizard.spellFocusActive).toBe(true);
        expect(f.wizard.spellFocusMultiplier).toBe(3);
        expect(f.wizard.spellFocusTimer).toBe(15);
        expect(f.engine.addEntity).not.toHaveBeenCalled();
    } finally { f.dispose(); }
});

test.each([[0, 15], [5, 18], [99, 18], [-1, 15], [Infinity, 15]])(
    'paid Spell Focus snapshots duration rank %s and canonical cooldown', (rank, duration) => {
        const f = fixture();
        try {
            f.wizard.talentRanks = { WIZ_34: rank };
            const mana = f.wizard.stats.mana, cooldown = 45 * (1 - f.wizard.stats.cooldownReduction);
            f.cast();
            expect(f.wizard.stats.mana).toBe(mana - 30);
            expect(f.wizard.cooldowns['Spell Focus']).toBeCloseTo(cooldown);
            expect(f.wizard.spellFocusTimer).toBeCloseTo(duration);
            expect(f.wizard.spellFocusMultiplier).toBe(2.5);
            f.wizard.talentRanks = {};
            expect(f.wizard.spellFocusTimer).toBeCloseTo(duration);
        } finally { f.dispose(); }
    });

test.each(['Spell Focus', 'Teleport', 'Arcane Shield', 'Time Warp'])('%s does not consume an active next-damage charge', skill => {
    const f = fixture();
    try {
        f.wizard.spellFocusActive = true; f.wizard.spellFocusTimer = 12; f.wizard.spellFocusMultiplier = 2.5;
        f.cast(skill);
        expect(f.wizard.spellFocusActive).toBe(true);
        expect(f.wizard.spellFocusTimer).toBe(skill === 'Spell Focus' ? 15 : 12);
        expect(f.engine.floatingTextManager.spawn.mock.calls.some(([text]) => text === 'FOCUSED!')).toBe(false);
    } finally { f.dispose(); }
});

test.each(['locked', 'mana', 'cooldown', 'dead', 'stunned'])('rejected %s focus preserves resources and charge', mode => {
    const f = fixture();
    try {
        if (mode === 'locked') f.wizard.unlockedSkills = [];
        if (mode === 'mana') f.wizard.stats.mana = 29;
        if (mode === 'cooldown') f.wizard.cooldowns['Spell Focus'] = 1;
        if (mode === 'dead') f.wizard.state = 'DEAD';
        if (mode === 'stunned') f.wizard.stunTimer = 1;
        const mana = f.wizard.stats.mana;
        f.cast();
        expect(f.wizard.stats.mana).toBe(mana);
        expect(f.wizard.spellFocusActive).toBe(false);
        expect(f.engine.spawnTransientEffect).not.toHaveBeenCalled();
    } finally { f.dispose(); }
});

test.each(['Fireball', 'Dragonfire Lance'])('focus boosts exactly one paid %s projectile', skill => {
    const f = fixture();
    try {
        const base = skill === 'Fireball' ? 20 + f.wizard.stats.intelligence * 2 : 100 + f.wizard.stats.intelligence * 5;
        f.cast(); f.cast(skill);
        expect(f.engine.addEntity.mock.calls.at(-1)[0].damage).toBe(base * 2.5);
        expect(f.wizard.spellFocusActive).toBe(false);
        expect(f.wizard.spellFocusTimer).toBe(0);
        f.wizard.cooldowns[skill] = 0;
        f.cast(skill);
        expect(f.engine.addEntity.mock.calls.at(-1)[0].damage).toBe(base);
    } finally { f.dispose(); }
});

test('Technique and mana training survive the committed Focus handler', () => {
    const f = fixture();
    try {
        f.wizard.talentRanks = { WIZ_16: 5, WIZ_27: 5 };
        const mana = f.wizard.stats.mana;
        f.cast();
        expect(f.wizard.stats.mana).toBe(mana - 21);
        expect(f.wizard.cooldowns['Spell Focus']).toBeCloseTo(45 * .85 * (1 - f.wizard.stats.cooldownReduction));
    } finally { f.dispose(); }
});

test.each(['Flame Whip', 'Dragonfire Lance', 'unrecognized skill'])('locked %s cannot spend or consume an existing charge', skill => {
    const f = fixture();
    try {
        f.cast(); f.wizard.unlockedSkills = ['Fireball'];
        const mana = f.wizard.stats.mana;
        f.cast(skill);
        expect(f.wizard.stats.mana).toBe(mana);
        expect(f.wizard.spellFocusActive).toBe(true);
        expect(f.wizard.spellFocusTimer).toBe(15);
        expect(f.engine.addEntity).not.toHaveBeenCalled();
    } finally { f.dispose(); }
});

test.each(['mana', 'cooldown'])('a %s-rejected damage cast preserves its next-spell charge', mode => {
    const f = fixture();
    try {
        f.cast();
        if (mode === 'mana') f.wizard.stats.mana = 29;
        else f.wizard.cooldowns.Fireball = 1;
        const mana = f.wizard.stats.mana;
        f.cast('Fireball');
        expect(f.wizard.stats.mana).toBe(mana);
        expect(f.wizard.spellFocusActive).toBe(true);
        expect(f.wizard.spellFocusTimer).toBe(15);
        expect(f.engine.addEntity).not.toHaveBeenCalled();
    } finally { f.dispose(); }
});

test.each(['multiplayer', 'remote', 'engine', 'owner-engine'])('server-owned %s cast cannot grant a local Focus charge', mode => {
    const f = fixture();
    try {
        if (mode === 'multiplayer') f.wizard.isMultiplayer = true;
        if (mode === 'remote') f.wizard.isRemote = true;
        if (mode === 'engine') f.engine.isMultiplayer = true;
        if (mode === 'owner-engine') f.wizard.gameEngine = { isMultiplayer: true };
        f.cast();
        expect(f.wizard.spellFocusActive).toBe(false);
        expect(f.wizard.spellFocusTimer).toBe(0);
        // Actor's ordinary predicted cast presentation is allowed; it must
        // not grant the gameplay buff or emit the offline activation message.
        expect(f.engine.floatingTextManager.spawn).not.toHaveBeenCalled();
        expect(f.engine.spawnTransientEffect.mock.calls.length).toBe(mode === 'remote' ? 0 : 2);
    } finally { f.dispose(); }
});

test.each([false, true])('offline expiry removes damage charge even while stunned=%s', stunned => {
    const f = fixture();
    try {
        f.cast();
        if (stunned) f.wizard.stunTimer = 30;
        Actor.prototype.update.call(f.wizard, 16, null, null, []);
        expect(f.wizard.spellFocusTimer).toBe(0);
        expect(f.wizard.spellFocusActive).toBe(false);
        expect(f.wizard.spellFocusMultiplier).toBe(1);
        f.wizard.stunTimer = 0; f.cast('Fireball');
        expect(f.engine.addEntity.mock.calls.at(-1)[0].damage).toBe(20 + f.wizard.stats.intelligence * 2);
    } finally { f.dispose(); }
});

test.each(['multiplayer', 'remote', 'engine'])('replica %s timer does not clear authoritative charge state', mode => {
    const f = fixture();
    try {
        f.wizard.spellFocusActive = true; f.wizard.spellFocusTimer = 1; f.wizard.spellFocusMultiplier = 2.5;
        if (mode === 'multiplayer') f.wizard.isMultiplayer = true;
        if (mode === 'remote') f.wizard.isRemote = true;
        if (mode === 'engine') f.wizard.gameEngine = { isMultiplayer: true };
        Actor.prototype.update.call(f.wizard, 2, null, null, []);
        expect(f.wizard.spellFocusTimer).toBe(0);
        expect(f.wizard.spellFocusActive).toBe(true);
    } finally { f.dispose(); }
});
