// Shared opt-in scene contract; ordinary live worlds do not install it.
export const EARTH_OUTCROP_PROFILE = 'earth-elevation-rocks-v1';
export const EARTH_OUTCROP_OUTLINE = Object.freeze([
    [-.82, -1], [.65, -1], [1, -.62], [1, .55], [.7, 1], [-.65, 1], [-1, .68], [-1, -.58]
].map(Object.freeze));

export const EARTH_OUTCROP_FORMATIONS = Object.freeze([
    { id: 'grove-west-shelf', x: -102, z: -321, width: 15, depth: 8, height: 4.8 },
    { id: 'grove-east-shelf', x: 62, z: -307, width: 13, depth: 7, height: 3.8 },
    { id: 'grove-west-break', x: -111, z: -210, width: 18, depth: 10, height: 4.5 },
    { id: 'bastion-west-shelf', x: 390, z: 155, width: 18, depth: 9, height: 5 },
    { id: 'bastion-road-break', x: 590, z: 251, width: 16, depth: 8, height: 4.2 },
    { id: 'bastion-east-shelf', x: 690, z: 142, width: 19, depth: 10, height: 5.5 }
].map(Object.freeze));

export const EARTH_OUTCROP_SOLIDS = Object.freeze(EARTH_OUTCROP_FORMATIONS.flatMap((formation, index) => [
    { ...formation, formationId: formation.id, seed: index * 19 + 7 },
    { id: `${formation.id}:heel`, formationId: formation.id, seed: index * 19 + 11,
        x: formation.x - formation.width * .48, z: formation.z + formation.depth * .28,
        width: formation.width * .42, depth: formation.depth * .75, height: formation.height * .42 },
    { id: `${formation.id}:toe`, formationId: formation.id, seed: index * 19 + 13,
        x: formation.x + formation.width * .42, z: formation.z - formation.depth * .25,
        width: formation.width * .4, depth: formation.depth * .7, height: formation.height * .34 }
].map(Object.freeze)));

export const EARTH_OUTCROP_COLLISIONS = Object.freeze(EARTH_OUTCROP_SOLIDS.map(({ id, x, z, width, depth, height }) => Object.freeze({
    id, x, z, height,
    outline: Object.freeze(EARTH_OUTCROP_OUTLINE.map(([px, pz]) => Object.freeze([x + px * width / 2, z + pz * depth / 2])))
})));
