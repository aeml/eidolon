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
    RootboundWarden: entry('enemy', 'GLB', WALKING_ENEMY_CLIPS),
    BriarMatron: entry('enemy', 'GLB', WALKING_ENEMY_CLIPS),
    RustboundColossus: entry('enemy', 'GLB', WALKING_ENEMY_CLIPS),
    HollowSentinel: entry('enemy', 'GLB', WALKING_ENEMY_CLIPS),

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
