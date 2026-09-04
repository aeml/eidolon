import { MeshCatalog } from '../utils/MeshCatalog.js';

const entry = (category, source, states, options = {}) => Object.freeze({
    category,
    source,
    states: Object.freeze(states),
    jump: options.jump || 'not-used',
    special: options.special || 'Attack clip plus class telegraph/VFX',
    browserEvidence: options.browserEvidence || 'local hardware gallery: High/Low'
});

const STANDARD_CLIPS = ['Idle', 'Walk', 'Run', 'Attack', 'Death'];
const WALKING_ENEMY_CLIPS = ['Idle', 'Walk', 'Run', 'Attack', 'Death'];

export const ACTOR_ANIMATION_MANIFEST = Object.freeze({
    Fighter: entry('player', 'shared procedural humanoid rig', STANDARD_CLIPS, { jump: 'procedural arc/lean with locomotion clip fallback' }),
    Rogue: entry('player', 'shared procedural humanoid rig', STANDARD_CLIPS, { jump: 'procedural arc/lean with locomotion clip fallback' }),
    Wizard: entry('player', 'shared procedural humanoid rig', STANDARD_CLIPS, { jump: 'procedural arc/lean with locomotion clip fallback' }),
    Cleric: entry('player', 'shared procedural humanoid rig', STANDARD_CLIPS, { jump: 'procedural arc/lean with locomotion clip fallback' }),

    Skeleton: entry('enemy', 'procedural Gloamwood ossuary rig', WALKING_ENEMY_CLIPS, {
        special: 'grave-sickle, soul lantern, shroud, and loose-bone collapse'
    }),
    Imp: entry('enemy', 'procedural Cinder Wastes ember-scavenger rig', WALKING_ENEMY_CLIPS, {
        special: 'beating coal heart, bat wings, pilfer-fork, and spaded tail'
    }),
    DemonOrc: entry('enemy', 'procedural Cinder Wastes kiln-warrior rig', WALKING_ENEMY_CLIPS, {
        special: 'furnace breastplate, cinder cleaver, coal chain, and heavy collapse'
    }),
    Construct: entry('enemy', 'procedural Gloamwood grave-reliquary rig', WALKING_ENEMY_CLIPS, {
        special: 'captive-soul chest, grave bell, root joints, and tolling stone maul'
    }),
    InfernoTitan: entry('enemy', 'procedural Cinder Wastes crucible-titan rig', WALKING_ENEMY_CLIPS, {
        special: 'white-hot furnace core, vent flames, caldera cleaver, and ash censer'
    }),
    Siren: entry('enemy', 'procedural Moonfrost choir-siren rig', WALKING_ENEMY_CLIPS, {
        special: 'drowned shroud, rib harp, voice shards, crescent blade, and floating collapse'
    }),
    FrostGuardian: entry('enemy', 'procedural Moonfrost glacial-bell rig', WALKING_ENEMY_CLIPS, {
        special: 'ice heart, broken halo, vigil bell, aurora polearm, and armored collapse'
    }),
    AquaGolem: entry('enemy', 'procedural Moonfrost drowned-cairn rig', WALKING_ENEMY_CLIPS, {
        special: 'tide-soul chest, barnacled cairn body, anchor, water drips, and stone collapse'
    }),
    MountainTroll: entry('enemy', 'procedural Moonfrost rimeback-troll rig', WALKING_ENEMY_CLIPS, {
        special: 'ice ridge, fur mantle, cairn club, aurora charm, and heavy collapse'
    }),
    RootboundWarden: entry('enemy', 'procedural Thorncrypt root-gate rig', WALKING_ENEMY_CLIPS, {
        special: 'root crown, ossuary gate plates, grave maul, funerary ivy, and heavy collapse'
    }),
    BriarMatron: entry('enemy', 'procedural Thorncrypt briar-crown rig', WALKING_ENEMY_CLIPS, {
        special: 'sepulchre petals, thorn halo, witch shards, briar sickle, and ritual collapse'
    }),
    RustboundColossus: entry('enemy', 'procedural Thorncrypt rust-reliquary rig', WALKING_ENEMY_CLIPS, {
        special: 'procession slabs, funeral pipes, reliquary rivets, great hammer, and stone collapse'
    }),
    HollowSentinel: entry('enemy', 'procedural Thorncrypt hollow-vigil rig', WALKING_ENEMY_CLIPS, {
        special: 'empty ribs, last witchlight, vigil tatters, crown, poleblade, and final collapse'
    }),
    Cindermaw: entry('enemy', 'procedural Furnace Below cinder-hound rig', WALKING_ENEMY_CLIPS, {
        special: 'quadruped gait, rib kiln, chain tail, horned fire maw, and pouncing collapse'
    }),
    ScorchedTwins: entry('enemy', 'procedural Furnace Below twin-flame rig', WALKING_ENEMY_CLIPS, {
        special: 'two oathbound upper bodies, divided masks, covenant brand, and split glaive'
    }),
    ForgemasterPyrax: entry('enemy', 'procedural Furnace Below oath-anvil rig', WALKING_ENEMY_CLIPS, {
        special: 'white-hot furnace cage, chain apron, six chimneys, and oath-anvil hammer'
    }),
    ObsidianGuardian: entry('enemy', 'procedural Furnace Below black-glass bulwark rig', WALKING_ENEMY_CLIPS, {
        special: 'layered obsidian crest, sealed core, branded bulwark, and monolithic collapse'
    }),
    LordInfernax: entry('enemy', 'procedural Furnace Below furnace-lord rig', WALKING_ENEMY_CLIPS, {
        special: 'ashen throne mantle, eleven-spire crown, orbiting censers, and caldera scepter'
    }),
    Windshear: entry('enemy', 'procedural Shattered Aerie wind-razor rig', WALKING_ENEMY_CLIPS, {
        special: 'floating gale tatters, vacuum rings, razor-vane halo, and pressure scythe'
    }),
    Stormcallers: entry('enemy', 'procedural Shattered Aerie divided-oracle rig', WALKING_ENEMY_CLIPS, {
        special: 'Voltara and Zephyros masks, split storm halos, convergence sparks, and forked staff'
    }),
    RocMatriarch: entry('enemy', 'procedural Shattered Aerie thunder-roc rig', WALKING_ENEMY_CLIPS, {
        special: 'twenty-two articulated storm feathers, silver talons, crown plumage, and dive collapse'
    }),
    ThunderlordKaelix: entry('enemy', 'procedural Shattered Aerie storm-bell rig', WALKING_ENEMY_CLIPS, {
        special: 'conductor throne, captive storm, nine-spire crown, and thunder-bell maul'
    }),
    Zephyrion: entry('enemy', 'procedural Shattered Aerie eternal-gale rig', WALKING_ENEMY_CLIPS, {
        special: 'nine vortex rings, thirteen-spire eye crown, horizon blades, and sky scepter'
    }),
    TiderendLeviathan: entry('enemy', 'procedural Drowned Sanctum tide-rend rig', WALKING_ENEMY_CLIPS, {
        special: 'serpentine tide scales, broad fins, maw tendrils, pearl eyes, and coral crown'
    }),
    DrownedChoir: entry('enemy', 'procedural Drowned Sanctum many-voiced rig', WALKING_ENEMY_CLIPS, {
        special: 'three crowned voices, exposed rib harp, orbiting voice pearls, and cantor chime'
    }),
    AbyssalGoliath: entry('enemy', 'procedural Drowned Sanctum anchor-cairn rig', WALKING_ENEMY_CLIPS, {
        special: 'sunken cairn armor, anchor fists, drowned chain, grave-anchor, and captive souls'
    }),
    MaelstromWarden: entry('enemy', 'procedural Drowned Sanctum maelstrom-bulwark rig', WALKING_ENEMY_CLIPS, {
        special: 'crossed tide rings, vigil shell mantle, moon-anchor poleblade, and pearl orbit'
    }),
    Thalorath: entry('enemy', 'procedural Drowned Sanctum tide-king rig', WALKING_ENEMY_CLIPS, {
        special: 'thirteen-antler crown, black-tide rings, throne tentacles, pearls, and deep trident'
    }),
    DissonantShade: entry('enemy', 'recomposed procedural Scorched Wraith rig', WALKING_ENEMY_CLIPS, {
        special: 'Umbral Nexus shade palette, void-feather trails, and dissonance telegraphs'
    }),
    MemoryReaver: entry('enemy', 'recomposed procedural Construct rig', WALKING_ENEMY_CLIPS, {
        special: 'fractured-memory reliquary, violet seams, and echo-strike telegraphs'
    }),
    DissonantHerald: entry('enemy', 'recomposed procedural Stormcallers rig', WALKING_ENEMY_CLIPS, {
        special: 'split void masks, memory storm halo, and dissonance telegraphs'
    }),
    NullArchitect: entry('enemy', 'recomposed procedural Obsidian Guardian rig', WALKING_ENEMY_CLIPS, {
        special: 'null masonry plates, broken constellation core, and collapse telegraphs'
    }),
    EidolonDevourer: entry('enemy', 'recomposed procedural Hollow Sentinel rig', WALKING_ENEMY_CLIPS, {
        special: 'eidolon seam crown, memory maw, and final-dungeon telegraphs'
    }),
    UmbraPrime: entry('enemy', 'recomposed procedural Hollow Sentinel raid rig', WALKING_ENEMY_CLIPS, {
        special: 'weekly raid scale, rotating void crown, and lethal null-zone telegraphs'
    }),
    GravenColossus: entry('enemy', 'recomposed procedural Hollow Sentinel raid rig', WALKING_ENEMY_CLIPS, {
        special: 'Rootheart Sanctum raid guardian and crystal-vigil transition'
    }),
    TideboundTyrant: entry('enemy', 'recomposed procedural Thalorath raid rig', WALKING_ENEMY_CLIPS, {
        special: 'Tidestar Confluence raid guardian and crystal-vigil transition'
    }),
    AshenImperator: entry('enemy', 'recomposed procedural Lord Infernax raid rig', WALKING_ENEMY_CLIPS, {
        special: 'Ember Crown Crucible raid guardian and crystal-vigil transition'
    }),
    TempestSovereign: entry('enemy', 'recomposed procedural Zephyrion raid rig', WALKING_ENEMY_CLIPS, {
        special: 'Skyglass Eyrie raid guardian and crystal-vigil transition'
    }),
    SandstormDjinn: entry('enemy', 'procedural Cinder Wastes ash-dune rig', WALKING_ENEMY_CLIPS, {
        special: 'floating glasswind veils, crossed sand rings, depth shards, crown, and glass scimitar'
    }),
    MagmaGolem: entry('enemy', 'procedural Cinder Wastes fault-heart rig', WALKING_ENEMY_CLIPS, {
        special: 'eighteen basalt fault slabs, caged magma heart, burning fists, and fault hammer'
    }),
    ScorchedWraith: entry('enemy', 'procedural Cinder Wastes cinder-shroud rig', WALKING_ENEMY_CLIPS, {
        special: 'burnt rib reliquary, crown, paired censers, ember orbit, and cinder scythe'
    }),
    InfernalBehemoth: entry('enemy', 'procedural Cinder Wastes kiln-behemoth rig', WALKING_ENEMY_CLIPS, {
        special: 'quadruped kiln body, horned bull skull, cloven hooves, tusks, and caldera spine'
    }),
    PhoenixSentinel: entry('enemy', 'procedural Cinder Wastes oathflame-phoenix rig', WALKING_ENEMY_CLIPS, {
        special: 'twenty-four oathflame wing feathers, ember keel, crown plumage, talons, and long fire tail'
    }),
    StormHarpy: entry('enemy', 'procedural Stormcrown gale-talon rig', WALKING_ENEMY_CLIPS, {
        special: 'eighteen razor feathers, masked torso, crown, raptor talons, and lightning javelin'
    }),
    CloudElemental: entry('enemy', 'procedural Stormcrown captive-cloud rig', WALKING_ENEMY_CLIPS, {
        special: 'twelve cloud cairns, eight pressure rings, storm core, orbit shards, and conductor crown'
    }),
    ThunderRoc: entry('enemy', 'procedural Stormcrown conductor-roc rig', WALKING_ENEMY_CLIPS, {
        special: 'twenty-six conductor feathers, lightning breast keel, crown plumage, talons, and storm tail'
    }),
    TempestGiant: entry('enemy', 'procedural Stormcrown thunder-cairn rig', WALKING_ENEMY_CLIPS, {
        special: 'sixteen storm slabs, ten conductor rods, captive heart, nine-spire crown, and thunder maul'
    }),
    CycloneAvatar: entry('enemy', 'procedural Stormcrown hollow-cyclone rig', WALKING_ENEMY_CLIPS, {
        special: 'eleven crossed cyclone rings, sixteen horizon blades, hollow eye crown, and wind blade'
    }),

    AvengingSeraph: entry('summon', 'procedural reliquary seraph rig', WALKING_ENEMY_CLIPS, {
        special: 'articulated broken-sun wings, oath-spear, censer, and collapse'
    }),
    DwarfSalesman: entry('npc', 'procedural town actor rig', ['Idle'], { special: 'merchant hammer and ember coin language' }),
    QuestNPC: entry('npc', 'procedural town actor rig', ['Idle'], { special: 'oath-scroll and broken-sun quest language' }),
    DungeonNPC: entry('npc', 'procedural town actor rig', ['Idle'], { special: 'wayfinding lantern and key language' }),
    RespecNPC: entry('npc', 'procedural town actor rig', ['Idle'], { special: 'memory reliquary and soul language' }),

    ...Object.fromEntries(
        Object.keys(MeshCatalog.getProceduralEnemySpecs()).map((type) => [
            type,
            entry('enemy-or-boss', 'procedural clips', WALKING_ENEMY_CLIPS)
        ])
    )
});

export function listActorAnimationEntries() {
    return Object.entries(ACTOR_ANIMATION_MANIFEST).map(([type, metadata]) => ({ type, ...metadata }));
}

export function getActorAnimationEntry(type) {
    return ACTOR_ANIMATION_MANIFEST[type] || null;
}
