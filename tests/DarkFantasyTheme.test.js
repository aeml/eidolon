import { readFileSync } from 'node:fs';
import {
    ACTIVE_WORLD_HAZARD_TYPES,
    DARK_FANTASY_HAZARD_THEMES,
    DARK_FANTASY_REGION_THEMES,
    DUNGEON_THEME_KEYS,
    OVERWORLD_THEME_KEYS,
    REGION_THEME_KEYS,
    createRegionLightingPresets,
    createRegionParticleConfigs,
    createOverworldLightingPresets,
    createOverworldParticleConfigs,
    getHazardTheme,
    getRegionTheme
} from '../src/art/darkFantasyTheme.js';

describe('Eidolon dark-fantasy art direction', () => {
    test('every overworld realm, town, and dungeon has a distinct intentional theme', () => {
        const keys = [...OVERWORLD_THEME_KEYS, ...DUNGEON_THEME_KEYS];
        expect(keys).toHaveLength(9);

        const themes = keys.map((key) => DARK_FANTASY_REGION_THEMES[key]);
        expect(new Set(themes.map((theme) => theme.id)).size).toBe(themes.length);
        expect(new Set(themes.map((theme) => theme.name)).size).toBe(themes.length);
        expect(new Set(themes.map((theme) => theme.palette.accent)).size).toBe(themes.length);

        for (const theme of themes) {
            expect(theme.motif.split(',').length).toBeGreaterThanOrEqual(3);
            expect(theme.palette.shadow).toBeLessThan(theme.palette.accent);
            expect(theme.lighting.fogNear).toBeLessThan(theme.lighting.fogFar);
            expect(theme.lighting.exposure).toBeGreaterThan(1);
            expect(theme.particles.life[0]).toBeLessThan(theme.particles.life[1]);
        }
    });

    test('render presets are fresh mutable copies of the immutable art manifest', () => {
        const lightingA = createOverworldLightingPresets();
        const lightingB = createOverworldLightingPresets();
        const particlesA = createOverworldParticleConfigs();
        const particlesB = createOverworldParticleConfigs();

        lightingA.fire.exposure = 99;
        particlesA.water.velY[0] = 99;

        expect(lightingB.fire.exposure).toBe(DARK_FANTASY_REGION_THEMES.fire.lighting.exposure);
        expect(particlesB.water.velY).toEqual(DARK_FANTASY_REGION_THEMES.water.particles.velY);
        expect(getRegionTheme('missing')).toBe(DARK_FANTASY_REGION_THEMES.earth);
    });

    test('full render presets include every dungeon atmosphere as independent mutable state', () => {
        const lightingA = createRegionLightingPresets();
        const lightingB = createRegionLightingPresets();
        const particlesA = createRegionParticleConfigs();
        const particlesB = createRegionParticleConfigs();

        expect(Object.keys(lightingA)).toEqual(REGION_THEME_KEYS);
        expect(Object.keys(particlesA)).toEqual(REGION_THEME_KEYS);
        expect(REGION_THEME_KEYS).toEqual([...OVERWORLD_THEME_KEYS, ...DUNGEON_THEME_KEYS]);
        lightingA.molten_core.fogNear = 999;
        particlesA.abyssal_well.spread[0] = 999;
        expect(lightingB.molten_core.fogNear).toBe(DARK_FANTASY_REGION_THEMES.molten_core.lighting.fogNear);
        expect(particlesB.abyssal_well.spread).toEqual(DARK_FANTASY_REGION_THEMES.abyssal_well.particles.spread);
    });

    test('every server hazard type has a named palette and every active type is explicit', () => {
        const worldSource = readFileSync('server/internal/game/world.go', 'utf8');
        const constantBlock = worldSource.slice(
            worldSource.indexOf('HazardLavaPool'),
            worldSource.indexOf('// Hazard represents')
        );
        const serverTypes = [...constantBlock.matchAll(/HazardType\s*=\s*"([^"]+)"/g)]
            .map((match) => match[1]);

        expect(serverTypes).toEqual(expect.arrayContaining(ACTIVE_WORLD_HAZARD_TYPES));
        for (const hazardType of serverTypes) {
            const theme = getHazardTheme(hazardType);
            expect(theme).toBe(DARK_FANTASY_HAZARD_THEMES[hazardType]);
            expect(theme.name).not.toMatch(/generic/i);
            expect(theme.glyphCount).toBeGreaterThanOrEqual(10);
            expect(theme.pulseRate).toBeGreaterThan(0);
        }
    });
});
