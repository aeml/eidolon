import { WORLD_LOCATIONS, RESONANCE_PORTAL } from '../data/worldLocations.js';

export const TOWN_SERVICE_POINTS = [
    {
        id: RESONANCE_PORTAL.id, label: 'Fourfold Portal', shortLabel: 'Fourfold Portal',
        x: RESONANCE_PORTAL.x, z: RESONANCE_PORTAL.z, color: '#cfbfff', strokeColor: '#cfbfff',
        ring: true, minScale: 0.75, labelOffsetY: 12
    },
    {
        id: 'quest-giver',
        label: 'Quest Giver',
        shortLabel: 'Quest Giver',
        x: -20,
        z: 200,
        color: '#65baff',
        strokeColor: '#65baff',
        ring: true,
        minScale: 0.75,
        labelOffsetY: -20
    },
    {
        id: 'story-wizard', label: 'Archmage Ilyra · Story', shortLabel: 'Story Wizard',
        color: '#ffd56a', strokeColor: '#ffd56a', ring: true,
        minScale: 0.75, labelOffsetY: 20
    },
    {
        id: 'forge',
        label: 'Forge',
        shortLabel: 'Forge',
        x: -28,
        z: 218,
        color: '#ff9b4a',
        strokeColor: '#ff9b4a',
        ring: true,
        minScale: 0.75,
        labelOffsetY: 26
    },
    {
        id: 'stash',
        label: 'Stash',
        shortLabel: 'Stash',
        x: -28,
        z: 210,
        color: '#8fd3ff',
        strokeColor: null,
        ring: false,
        minScale: 0.75,
        labelOffsetY: 18
    },
    {
        id: 'trading-house',
        label: 'Trading House',
        shortLabel: 'Trading House',
        x: -22,
        z: 185,
        color: '#5ec8ff',
        strokeColor: '#5ec8ff',
        ring: true,
        minScale: 0.75,
        labelOffsetY: -22
    },
    {
        id: 'vendor-repair',
        label: 'Vendor / Repair',
        shortLabel: 'Vendor / Repair',
        x: 22.5,
        z: 200,
        color: '#78e08f',
        strokeColor: null,
        ring: false,
        minScale: 0.75,
        labelOffsetY: -26
    },
    {
        id: 'dungeon-guide',
        label: 'Dungeon Guide',
        shortLabel: 'Dungeon Guide',
        color: '#c88cff',
        strokeColor: '#c88cff',
        ring: true,
        minScale: 0.75,
        labelOffsetY: 28
    }
].map(point => {
    const canonical = WORLD_LOCATIONS.find(location => location.id === point.id);
    return canonical ? { ...point, x: canonical.x, z: canonical.z } : point;
});
