import { readFileSync } from 'node:fs';
import { ELEMENTAL_GUARDIAN_BRIEFINGS, appendElementalRaidBriefing } from '../src/ui/ElementalRaidBriefing.js';
import { CRYSTAL_VIGIL_PREPARATION } from '../src/ui/DungeonPreparation.js';

test.each(Object.keys(ELEMENTAL_GUARDIAN_BRIEFINGS))('%s briefing names the authoritative guardian and separates repair from rewards', element => {
    const source = readFileSync('server/internal/game/dungeon_telegraphs.go', 'utf8');
    const raids = readFileSync('server/internal/game/elemental_raids.go', 'utf8');
    const entry = ELEMENTAL_GUARDIAN_BRIEFINGS[element], subtype = entry.boss.replaceAll(' ', '');
    expect(raids).toContain(`Boss: "${subtype}"`);
    expect(source).toContain(`case "${subtype}":`);
    expect(source).toContain(`Label: "${entry.label}"`);
    expect(source).toContain(entry.hint.replaceAll('’', "'"));
    const parent = document.createElement('section');
    const details = appendElementalRaidBriefing(parent, element);
    expect(details.open).toBe(false);
    expect(details.querySelector('summary').textContent).toBe('Guardian, Vigil and personal rewards');
    expect(details.textContent).toContain(CRYSTAL_VIGIL_PREPARATION[element]);
    expect(details.textContent).toContain('Maelin channels automatically');
    expect(details.textContent).toContain('AND defeat every attacker');
    expect(details.textContent).toContain('click Complete Quest');
    expect(details.textContent).toContain('Each character claims personally');
    expect(details.querySelectorAll('button, input, script')).toHaveLength(0);
});

test.each(['unknown', 'constructor', '__proto__'])('unknown raid %s does not receive invented instructions', element => {
    const parent = document.createElement('section');
    expect(appendElementalRaidBriefing(parent, element)).toBeNull();
    expect(parent.children).toHaveLength(0);
});
