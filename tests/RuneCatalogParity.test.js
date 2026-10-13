import { readFileSync } from 'node:fs';
import { CONSTANTS } from '../src/core/Constants.js';

test('client rune choices match the authoritative typed catalog exactly', () => {
    const source = readFileSync(new URL('../server/internal/game/runes.go', import.meta.url), 'utf8');
    const text = '"(?:\\\\.|[^"\\\\])*"';
    const rows = [...source.matchAll(new RegExp(`\\{ID: (${text}), Name: (${text}), Skill: (${text}), UnlockLevel: (\\d+), Description: (${text})\\}`, 'g'))];
    const catalog = rows.map(row => ({ id: JSON.parse(row[1]), name: JSON.parse(row[2]), skill: JSON.parse(row[3]),
        unlockLevel: Number(row[4]), description: JSON.parse(row[5]) }));
    const client = ['Fighter', 'Rogue', 'Wizard', 'Cleric'].flatMap(name => CONSTANTS.SKILL_RUNES[name]);
    expect(catalog).toEqual(client);expect(catalog.length).toBeGreaterThan(0);
    expect(new Set(catalog.map(rune=>rune.id)).size).toBe(catalog.length);
});

test.each(['Fighter', 'Rogue', 'Wizard', 'Cleric'])('%s rune choices retain canonical learned skills and three unlock tiers', className => {
    const tree = CONSTANTS.SKILL_TREES[className], names = new Set([tree.Tier1.name]);
    for (const branch of ['A', 'B', 'C']) for (const tier of [2,3,4,5]) names.add(tree[`Branch${branch}`][`Tier${tier}`].name);
    const catalog = CONSTANTS.SKILL_RUNES[className], groups = new Map();
    for (const rune of catalog) {
        expect(names.has(rune.skill)).toBe(true);
        if (!groups.has(rune.skill)) groups.set(rune.skill, []);groups.get(rune.skill).push(rune.unlockLevel);
    }
    for (const levels of groups.values()) expect(levels.sort((a,b)=>a-b)).toEqual([50,70,90]);
});
