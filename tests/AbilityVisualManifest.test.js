import { readFileSync } from 'node:fs';
import { CONSTANTS } from '../src/core/Constants.js';
import {
    ABILITY_ANIMATION_PROFILES,
    ABILITY_VISUAL_ALIASES,
    PLAYER_ABILITY_VISUALS,
    getAbilityPresentation,
    getAbilityRuneVariants,
    getSkillTreeAbilityNames,
    listPlayerAbilityPresentationVariants,
    listPlayerAbilityPresentations,
    resolveCanonicalAbilityName
} from '../src/skills/abilityVisualManifest.js';

const PLAYER_CLASSES = ['Fighter', 'Rogue', 'Wizard', 'Cleric'];

function readServerAbilityNames() {
    const source = readFileSync('server/internal/game/ability_config.go', 'utf8');
    const found = Object.fromEntries(PLAYER_CLASSES.map((className) => [className, []]));
    let currentClass = null;

    for (const line of source.split('\n')) {
        const classMatch = line.match(/^\s*"(Fighter|Rogue|Wizard|Cleric)":\s*\{$/);
        if (classMatch) {
            currentClass = classMatch[1];
            continue;
        }
        if (currentClass && /^\s*},\s*$/.test(line)) {
            currentClass = null;
            continue;
        }
        if (!currentClass) continue;
        const abilityMatch = line.match(/^\s*"([^"]+)":\s*\{ManaCost:/);
        if (abilityMatch) found[currentClass].push(abilityMatch[1]);
    }
    return found;
}

function readServerAbilitySpecs() {
    const source = readFileSync('server/internal/game/ability_config.go', 'utf8');
    const found = Object.fromEntries(PLAYER_CLASSES.map((className) => [className, {}]));
    let currentClass = null;

    for (const line of source.split('\n')) {
        const classMatch = line.match(/^\s*"(Fighter|Rogue|Wizard|Cleric)":\s*\{$/);
        if (classMatch) {
            currentClass = classMatch[1];
            continue;
        }
        if (currentClass && /^\s*},\s*$/.test(line)) {
            currentClass = null;
            continue;
        }
        if (!currentClass) continue;
        const specMatch = line.match(/^\s*"([^"]+)":\s*\{ManaCost:\s*(\d+),\s*Cooldown:\s*(\d+)\s*\*\s*time\.Second/);
        if (specMatch) {
            found[currentClass][specMatch[1]] = {
                mana: Number(specMatch[2]),
                cooldown: Number(specMatch[3])
            };
        }
    }
    return found;
}

describe('canonical ability visual manifest', () => {
    test.each(PLAYER_CLASSES)('%s skill tree has exact explicit manifest coverage', (className) => {
        const skillTreeNames = getSkillTreeAbilityNames(className).sort();
        const manifestNames = Object.keys(PLAYER_ABILITY_VISUALS[className]).sort();

        expect(skillTreeNames).toEqual(manifestNames);
        expect(skillTreeNames).toHaveLength(13);
    });

    test('all 52 selectable player abilities have local, remote, layered, and animation classification', () => {
        const entries = listPlayerAbilityPresentations();
        expect(entries).toHaveLength(52);

        for (const ability of entries) {
            expect(ability.local).toBe('class-handler');
            expect(ability.remote).toBe('explicit');
            expect(ability.layers.length).toBeGreaterThan(0);
            expect(ABILITY_ANIMATION_PROFILES[ability.animation]).toBeDefined();
            ability.layers.forEach((entry) => {
                expect(typeof entry.type).toBe('string');
                expect(Number.isFinite(entry.color)).toBe(true);
                expect(['source', 'target']).toContain(entry.anchor);
            });
        }
    });

    test('all 52 selectable abilities share client/server mana and cooldown contracts', () => {
        const serverSpecs = readServerAbilitySpecs();
        for (const className of PLAYER_CLASSES) {
            for (const skillName of getSkillTreeAbilityNames(className)) {
                const clientSpec = CONSTANTS.ABILITY_CONFIG[className].skills[skillName];
                expect(clientSpec).toBeDefined();
                expect(serverSpecs[className][skillName]).toEqual({
                    mana: clientSpec.mana,
                    cooldown: clientSpec.cooldown
                });
            }
        }
    });

    test('the deterministic inventory enumerates every base ability and all 60 rune variants', () => {
        const variants = listPlayerAbilityPresentationVariants();
        expect(variants).toHaveLength(112);
        expect(variants.filter((entry) => entry.runeId)).toHaveLength(60);
        expect(new Set(variants.map((entry) =>
            `${entry.className}:${entry.skillName}:${entry.runeId || 'base'}`
        )).size).toBe(112);
    });

    test.each(PLAYER_CLASSES)('%s client ability config cannot add an unclassified skill', (className) => {
        for (const skillName of Object.keys(CONSTANTS.ABILITY_CONFIG[className].skills)) {
            expect(resolveCanonicalAbilityName(className, skillName)).not.toBeNull();
        }
    });

    test('server ability compatibility names all resolve to explicit presentations', () => {
        const serverAbilities = readServerAbilityNames();
        for (const className of PLAYER_CLASSES) {
            expect(serverAbilities[className].length).toBeGreaterThan(0);
            for (const skillName of serverAbilities[className]) {
                const presentation = getAbilityPresentation(className, skillName);
                if (!presentation) {
                    throw new Error(`${className}.${skillName} needs an explicit visual classification`);
                }
                expect(presentation.remote).toBe('explicit');
            }
        }
    });

    test('every compatibility alias resolves to an existing canonical entry', () => {
        for (const [className, aliases] of Object.entries(ABILITY_VISUAL_ALIASES)) {
            for (const [alias, canonical] of Object.entries(aliases)) {
                expect(PLAYER_ABILITY_VISUALS[className][canonical]).toBeDefined();
                expect(getAbilityPresentation(className, alias)).toEqual(expect.objectContaining({
                    className,
                    skillName: alias,
                    canonicalName: canonical,
                    remote: 'explicit'
                }));
            }
        }
    });

    test('every configured rune points at a classified canonical ability', () => {
        for (const className of PLAYER_CLASSES) {
            for (const rune of CONSTANTS.SKILL_RUNES[className]) {
                expect(PLAYER_ABILITY_VISUALS[className][rune.skill]).toBeDefined();
                expect(getAbilityRuneVariants(className, rune.skill)).toEqual(
                    expect.arrayContaining([expect.objectContaining({ id: rune.id })])
                );
            }
        }
    });
});
