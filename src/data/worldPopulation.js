import { chronicleInvestigations } from './chronicleInvestigations.generated.js';
import { DUNGEON_ENTRANCE_DEFINITIONS } from './dungeonEntrances.js';

const freeze = value => {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
};
const investigation = id => {
    const site = chronicleInvestigations.flatMap(chapter => chapter.sites).find(site => site.id === id);
    if (!site) throw new Error(`Missing population anchor: ${id}`);
    return { x: site.x, z: site.z, source: { kind: 'investigation', id } };
};
const entrance = id => {
    const entry = DUNGEON_ENTRANCE_DEFINITIONS[id];
    if (!entry) throw new Error(`Missing population entrance: ${id}`);
    return { x: entry.position[0], z: entry.position[2], source: { kind: 'entrance', id } };
};

// One composition per place, not one POI per prop. Existing investigations and
// dungeon entrances retain their actual anchors and all progression authority.
// Public optional readings grant neither rewards nor a saved discovery marker.
export const EARTH_LOCATIONS = freeze([
    { id: 'keepers-empty-house', name: 'The Keeper’s Empty House', role: 'story', recipe: 'evacuated-garden',
        ...investigation('mara_diary'), radius: 18, visibility: 'quest',
        purpose: 'An abandoned keeper’s home. The diary inside belongs to Ilyra’s investigation.' },
    { id: 'returning-scar', name: 'The Returning Scar', role: 'story', recipe: 'wounded-grove',
        ...investigation('marked_stone'), radius: 22, visibility: 'quest',
        purpose: 'A broken grove boundary surrounding the three traces in Ilyra’s investigation.' },
    { id: 'verdant-approach', name: 'Verdant Bastion Approach', role: 'landmark', recipe: 'grave-road',
        ...entrance('verdant_bastion_catacombs'), radius: 64, visibility: 'public',
        purpose: 'The old grave road leads to the Bastion. Gather your party outside its gate.' },
    { id: 'first-grove-arch', name: 'First Grove Arch', role: 'landmark', recipe: 'root-arch',
        x: 0, z: -260, radius: 24, visibility: 'public',
        purpose: 'Living roots hold an ancient stone arch above the northern trail toward the Water Realm.' },
    { id: 'pilgrim-rest', name: 'Pilgrim Rest', role: 'camp', recipe: 'pilgrim-camp',
        x: -180, z: 430, radius: 22, visibility: 'public',
        purpose: 'An abandoned communal camp. Its cold hearth offers no safe-zone protection.' },
    { id: 'foresters-yard', name: 'Foresters’ Yard', role: 'camp', recipe: 'timber-yard',
        x: -480, z: 530, radius: 26, visibility: 'public',
        purpose: 'A deserted timber yard with an open, roofless workshop. This is combat territory.' },
    { id: 'bellkeepers-cairn', name: 'Bellkeeper’s Cairn', role: 'lore', recipe: 'bell-cairn',
        x: -320, z: -180, radius: 14, visibility: 'public', readingOffset: [0, -6],
        purpose: 'Read a surviving bellkeeper’s record. Optional lore; no quest or reward required.',
        reading: { title: 'The Bell That Meant Shelter',
            introduction: 'A slate lies beneath the cracked bell. Someone has rubbed ash into the letters so they remain legible.',
            paragraphs: [
                'Three strokes for a lost traveler. Five for a fire among the roots. One long toll when the grove itself asks for help. We were taught to answer the bell before asking whose hands had rung it.',
                'Yesterday the sound came back from the trees without an echo. A voice beneath it asked us to name the deserving. Old Bera rang again until her palms bled. Shelter is not a prize, she said. Orun never made us earn the shade.',
                'We have taken the children south to Lanternhold. If the bell speaks with a voice instead of a note, do not answer its question. Ring for whoever is still outside.'
            ] } },
    { id: 'unbound-milestone', name: 'The Unbound Milestone', role: 'lore', recipe: 'oath-stone',
        x: 520, z: 440, radius: 14, visibility: 'public', readingOffset: [8, -3],
        purpose: 'Read the travelers’ oath cut into this roadside stone. Optional lore; no saved discovery claim.',
        reading: { title: 'A Promise Without a Master',
            introduction: 'Dozens of names surround an older inscription. No crest claims the stone; even the smallest names have been cut at the same depth.',
            paragraphs: [
                '“What sheltered me shall shelter the stranger after me.” Beneath the promise are carters, charcoal burners, two names marked only with a handprint, and a mason who could not finish the final letter.',
                'A later hand tried to replace stranger with obedient. The new letters were carefully chiseled out again. The damage is still visible. Nobody smoothed it away.',
                'At the foot of the stone, a fresh line reads: We keep the scar so our children know the promise was defended. The grove belongs to those who need its shelter, not to whoever learns to command its roots.'
            ] } }
]);

export const WORLD_READINGS = freeze(EARTH_LOCATIONS.filter(site => site.reading).map(site => ({
    id: `world-reading-${site.id}`, locationId: site.id, name: site.name,
    x: site.x + site.readingOffset[0], z: site.z + site.readingOffset[1],
    reading: site.reading
})));

// These are authored ground-surface centerlines, shared with cartography when
// the population scene is attached. Width is the full traversable path width;
// it is not an invisible wall, auto-move route or guarantee of safe travel.
export const EARTH_PATHS = freeze([
    { id: 'north-trail', width: 8, points: [[0, 100], [0, -600]] },
    { id: 'south-trail', width: 8, points: [[0, 300], [0, 900]] },
    { id: 'west-trail', width: 8, points: [[-100, 200], [-1000, 200]] },
    // Stop outside the Bastion's preserved entrance footprint. The narrow
    // northern bypass continues to the realm edge without crossing its walls.
    { id: 'bastion-road', width: 8, points: [[100, 200], [750, 200]] },
    { id: 'bastion-bypass', width: 6, points: [[720, 200], [720, 135], [880, 135], [1000, 200]] },
    { id: 'pilgrim-path', width: 6, points: [[0, 430], [-180, 430]] },
    { id: 'foresters-path', width: 6, points: [[-180, 430], [-480, 530]] },
    { id: 'bellkeeper-path', width: 6, points: [[0, -180], [-320, -180]] },
    { id: 'milestone-path', width: 6, points: [[520, 200], [520, 320], [505, 355], [505, 400], [520, 440]] },
    // The diary's existing open doorway faces south. Approach from that side,
    // rather than drawing a line through the north wall of the ruined house.
    { id: 'keeper-path', width: 4, points: [[132, 200], [132, 227], [150, 227], [150, 222]] },
    { id: 'scar-path', width: 6, points: [[156, 200], [195, 110], [195, 60], [174, 56]] }
]);

export function distanceToPath(x, z, points) {
    let nearest = Infinity;
    for (let i = 1; i < points.length; i++) {
        const [ax, az] = points[i - 1], [bx, bz] = points[i];
        const dx = bx - ax, dz = bz - az, lengthSquared = dx * dx + dz * dz;
        const t = lengthSquared ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSquared)) : 0;
        nearest = Math.min(nearest, Math.hypot(x - ax - t * dx, z - az - t * dz));
    }
    return nearest;
}
