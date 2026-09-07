import { jest } from '@jest/globals';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { Wizard } from '../src/entities/Wizard.js';

const cases = JSON.parse(readFileSync('server/internal/game/testdata/arcane_shield_training.json', 'utf8'));

function fixture(entry = {}) {
    const owner = new Wizard('shield-owner');
    owner.mesh = new THREE.Group();
    Object.assign(owner.stats, { intelligence: 10, hp: 1000, maxHp: 1000, mana: 1000, maxMana: 1000,
        cooldownReduction: .1, hpRegen: 0, manaRegen: 0 });
    owner.talentRanks = { ...entry.ranks };
    owner.skillRunes = { 'Arcane Shield': entry.rune || '' };
    owner.unlockedSkills = ['Arcane Shield'];
    owner.spellFocusActive = Boolean(entry.focus); owner.spellFocusMultiplier = 2.5;
    const engine = { spawnTransientEffect: jest.fn(() => true), floatingTextManager: { spawn: jest.fn() } };
    return { owner, engine, cast: () => owner.useAbility(owner.position.clone(), engine, 'Arcane Shield') };
}

test.each(cases)('paid offline shield matches server capacity, duration and impact: $name', entry => {
    const f = fixture(entry);
    try {
        f.cast();
        expect(f.owner.stats.mana).toBe(960);
        expect(f.owner.cooldowns['Arcane Shield']).toBeCloseTo(27);
        expect(f.owner.shieldHP).toBe(entry.capacity);
        expect(f.owner.arcaneShieldTimer).toBeCloseTo(entry.duration);
        expect(f.owner.spellFocusActive).toBe(Boolean(entry.focus));
        expect(f.owner.talentRanks).toEqual(entry.ranks);
        f.owner.talentRanks = {};
        f.owner.takeDamage(200);
        expect(f.owner.stats.hp).toBe(1000 - (200 - entry.capacity));
        expect(f.owner.arcaneShieldActive).toBe(false);
        expect(f.owner.shieldHP).toBe(0);
    } finally { f.owner.dispose(); }
});

test.each(['locked', 'mana'])('%s shield attempts do not create absorption or spend resources', reason => {
    const f = fixture();
    try {
        if (reason === 'locked') f.owner.unlockedSkills = [];
        else f.owner.stats.mana = 39;
        const mana = f.owner.stats.mana;
        f.cast();
        expect(f.owner.stats.mana).toBe(mana);
        expect(f.owner.cooldowns['Arcane Shield'] || 0).toBe(0);
        expect(f.owner.shieldHP).toBe(0);
    } finally { f.owner.dispose(); }
});

test('expiry removes unused offline absorption before the next hit', () => {
    const f = fixture();
    try {
        f.cast();
        f.owner.update(20.1, null, f.owner, []);
        expect(f.owner.arcaneShieldActive).toBe(false);
        expect(f.owner.shieldHP).toBe(0);
        f.owner.takeDamage(200);
        expect(f.owner.stats.hp).toBe(800);
    } finally { f.owner.dispose(); }
});

test.each(['multiplayer', 'remote', 'engine'])('offline shielding cannot duplicate %s authority', authority => {
    const f = fixture();
    try {
        if (authority === 'multiplayer') f.owner.isMultiplayer = true;
        if (authority === 'remote') f.owner.isRemote = true;
        if (authority === 'engine') f.engine.isMultiplayer = true;
        f.cast();
        expect(f.owner.shieldHP).toBe(0);
    } finally { f.owner.dispose(); }
});
