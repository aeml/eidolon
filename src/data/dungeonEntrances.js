const defineEntrance = ({ dungeonType, label, artStyle, bounds, position }) => Object.freeze({
    dungeonType,
    label,
    artStyle,
    bounds: Object.freeze([...bounds]),
    position: Object.freeze([...position]),
    interactionRadius: Math.min(bounds[0], bounds[2]) * 0.45
});

/**
 * These dimensions are the production-scaled Box3 contracts of the four GLBs
 * retired by this module. An invisible bounds mesh preserves their exact
 * collision radius, interaction reach, grounding, and click target while the
 * visible architecture is free to carry a clearer regional silhouette.
 */
export const DUNGEON_ENTRANCE_DEFINITIONS = Object.freeze({
    verdant_bastion_catacombs: defineEntrance({
        dungeonType: 'verdant_bastion_catacombs',
        label: 'The Verdant Bastion',
        artStyle: 'Thorncrypt root-bound fortress gate with witchlight heart and briar crown',
        bounds: [76.13120079040527, 61.46895885467529, 72.87123918533325],
        position: [800, 0, 200]
    }),
    molten_core: defineEntrance({
        dungeonType: 'molten_core',
        label: 'The Molten Core',
        artStyle: 'Furnace Below obsidian kiln gate with chained horns and molten throat',
        bounds: [76.23759984970093, 71.23167991638184, 75.87180137634277],
        position: [-2400, 0, 200]
    }),
    tempest_spire: defineEntrance({
        dungeonType: 'tempest_spire',
        label: 'The Tempest Spire',
        artStyle: 'Shattered Aerie storm needle with floating slate and captive lightning',
        bounds: [44.4045615196228, 76.54812097549438, 48.13672065734863],
        position: [2400, 0, 200]
    }),
    abyssal_well: defineEntrance({
        dungeonType: 'abyssal_well',
        label: 'The Abyssal Well',
        artStyle: 'Drowned Sanctum tide altar with black-water eye and coral reliquary arch',
        bounds: [76.47827863693237, 37.49948024749756, 52.10767984390259],
        position: [0, 0, -1400]
    })
});

export const DUNGEON_ENTRANCE_IDS = Object.freeze(Object.keys(DUNGEON_ENTRANCE_DEFINITIONS));
