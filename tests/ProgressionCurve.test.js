import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { Fighter } from '../src/entities/Fighter.js';
import { Rogue } from '../src/entities/Rogue.js';
import { Wizard } from '../src/entities/Wizard.js';
import { Cleric } from '../src/entities/Cleric.js';
import { experienceRequiredForLevel, PROGRESSION_VERSION } from '../src/core/ProgressionCurve.js';

beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test('every candidate client threshold matches the server fixture', () => {
    const fixture = JSON.parse(readFileSync(new URL('../server/internal/game/testdata/progression_v2.json', import.meta.url), 'utf8'));
    expect(fixture.version).toBe(PROGRESSION_VERSION);
    expect(fixture.requirements).toHaveLength(100);
    fixture.requirements.forEach((xp, index) => expect(experienceRequiredForLevel(index + 1)).toBe(xp));
});

test.each([Fighter, Rogue, Wizard, Cleric])('%p applies all earned offline levels, then exact cap overflow', Class => {
    const actor = new Class('offline-progression');
    try {
        const points = actor.statPoints;
        actor.stats.hp = 1;
        expect(actor.gainXp(2000)).toBe(true);
        expect(actor.level).toBe(7);
        expect(actor.xp).toBe(25);
        expect(actor.statPoints).toBe(points + 18);
        expect(actor.stats.hp).toBe(actor.stats.maxHp);

        actor.level = 99;
        actor.xpToNextLevel = experienceRequiredForLevel(99);
        actor.xp = actor.xpToNextLevel - 25;
        actor.gainXp(100);
        expect(actor.level).toBe(100);
        expect(actor.xp).toBe(experienceRequiredForLevel(100));
        expect(actor.resonanceXP).toBe(75);
        actor.stats.hp = 1;
        actor.gainXp(5_000_010);
        expect(actor.level).toBe(100);
        expect(actor.resonanceLevel).toBe(1);
        expect(actor.resonancePoints).toBe(1);
        expect(actor.resonanceXP).toBe(85);
        expect(actor.stats.hp).toBe(1);
        actor.levelUp();
        expect(actor.level).toBe(100);
    } finally { actor.dispose(); }
});

test.each(['isMultiplayer', 'isRemote'])('client-owned XP cannot advance an authoritative actor: %s', flag => {
    const actor = new Wizard('authoritative-progression');
    try {
        actor[flag] = true;
        expect(actor.gainXp(2000)).toBe(false);
        actor.levelUp();
        expect(actor.level).toBe(1);
        expect(actor.xp).toBe(0);
    } finally { actor.dispose(); }
});

test.each([0, -1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('invalid XP %p does not alter offline progression', amount => {
    const actor = new Wizard('invalid-progression');
    try {
        expect(actor.gainXp(amount)).toBe(false);
        expect(actor.level).toBe(1);
        expect(actor.xp).toBe(0);
    } finally { actor.dispose(); }
});
