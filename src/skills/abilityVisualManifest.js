import { CONSTANTS } from '../core/Constants.js';

const layer = (type, color, anchor = 'source', options = {}) => Object.freeze({ type, color, anchor, ...options });
const presentation = (category, animation, layers, options = {}) => Object.freeze({
    category,
    animation,
    layers: Object.freeze(layers),
    local: options.local || 'class-handler',
    remote: options.remote || 'explicit',
    persistentState: options.persistentState || null,
    notes: options.notes || null
});

export const PLAYER_ABILITY_VISUALS = Object.freeze({
    Fighter: Object.freeze({
        Charge: presentation('movement', 'charge', [layer('wave', 0xff5500, 'target')]),
        Whirlwind: presentation('area', 'spin', [layer('spin', 0xd7dbe0)]),
        'Shield Slam': presentation('melee', 'heavy', [
            layer('cone', 0xffd86a),
            layer('impact', 0xffef74, 'target')
        ]),
        'Iron Fortress': presentation('buff', 'buff', [layer('sphere', 0xaeb7c2)], { persistentState: 'iron_fortress' }),
        'Guardian Roar': presentation('buff', 'shout', [layer('ring', 0xff4c45)], { persistentState: 'guardian_roar' }),
        'Sweeping Strike': presentation('melee', 'sweep', [layer('cone', 0xf5f7ff)]),
        Earthshaker: presentation('area', 'heavy', [layer('wave', 0xb66b35), layer('impact', 0xffc46b, 'target')]),
        'Unbreakable Grip': presentation('control', 'pull', [layer('beam', 0x6aa9ff, 'target'), layer('impact', 0x326dff, 'target')]),
        'Juggernaut Charge': presentation('movement', 'charge', [layer('wave', 0xff3f35), layer('impact', 0xffaa55, 'target')]),
        'Berserker Edge': presentation('buff', 'buff', [layer('buff', 0xff3434), layer('ring', 0x9e1212)], { persistentState: 'berserker_edge' }),
        'Shattering Charge': presentation('movement', 'charge', [layer('wave', 0xffffff, 'target'), layer('impact', 0xff7744, 'target')]),
        'Executioner Spin': presentation('area', 'spin', [layer('spin', 0xff3030), layer('blood', 0x9d1010, 'target')]),
        'Last Stand Rampage': presentation('buff', 'shout', [layer('buff', 0xff1515), layer('ring', 0xff6b32)], { persistentState: 'last_stand' })
    }),
    Rogue: Object.freeze({
        'Piercing Throw': presentation('projectile', 'throw', [layer('burst', 0xe5e9ef)]),
        Backstab: presentation('melee', 'quick', [layer('blood', 0xff3030, 'target')]),
        'Weak Point Mark': presentation('debuff', 'mark', [layer('mark', 0xff3434, 'target')], { persistentState: 'weak_point_mark' }),
        'Shadow Lunge': presentation('movement', 'lunge', [layer('smoke', 0x15101f), layer('blood', 0xb52cff, 'target')]),
        'Death Spiral': presentation('area', 'spin', [layer('spin', 0x4b405c), layer('blood', 0xd11f45, 'target')]),
        'Fan of Knives': presentation('projectile-area', 'spin', [layer('spin', 0xadb7c7), layer('burst', 0xe2e8f0)]),
        'Serrated Edges': presentation('buff', 'buff', [layer('buff', 0xc91f37)], { persistentState: 'serrated_edges' }),
        'Blade Storm': presentation('projectile-area', 'throw', [layer('cone', 0xe2e8f0), layer('burst', 0x8895a7, 'target')]),
        'Phantom Volley': presentation('projectile', 'volley', [layer('burst', 0xb35cff), layer('impact', 0x7d2cff, 'target')]),
        'Smoke Bomb': presentation('ground', 'throw', [layer('smoke_cloud', 0x626978)], { persistentState: 'smoke_bomb' }),
        'Poison Coating': presentation('buff', 'buff', [layer('buff', 0x4dff70)], { persistentState: 'poison_coating' }),
        Tripwire: presentation('trap', 'place', [layer('impact', 0xc9d0d8, 'target')], { persistentState: 'tripwire' }),
        'Cloak & Vanish': presentation('buff', 'vanish', [layer('smoke', 0x211c2c), layer('ring', 0x785b91)], { persistentState: 'stealth' })
    }),
    Wizard: Object.freeze({
        Fireball: presentation('projectile', 'cast', [layer('burst', 0xff6a24)]),
        'Flame Whip': presentation('cone', 'sweep', [layer('cone_large', 0xff5a1f)]),
        'Flame Tornado': presentation('projectile-area', 'cast', [layer('spin', 0xff7b24, 'target')]),
        'Meteor Drop': presentation('delayed-area', 'heavy-cast', [layer('telegraph', 0xff3324, 'target'), layer('ring', 0xff9b32, 'target')]),
        'Inferno Cataclysm': presentation('persistent-area', 'heavy-cast', [layer('ring', 0xff2717, 'target'), layer('burst', 0xff8a2b, 'target')], { persistentState: 'inferno_cataclysm' }),
        'Scorch Beam': presentation('beam', 'channel', [layer('beam', 0xffb136, 'target')]),
        'Arcane Missiles': presentation('projectile', 'volley', [layer('burst', 0xc66bff)]),
        'Spell Focus': presentation('buff', 'channel', [layer('buff', 0xa449ff), layer('sphere', 0x6e2ca8)], { persistentState: 'spell_focus' }),
        'Dragonfire Lance': presentation('projectile', 'heavy-cast', [layer('beam', 0xff8b2e, 'target'), layer('impact', 0xffc24c, 'target')]),
        Teleport: presentation('movement', 'teleport', [layer('smoke', 0x4169b8), layer('burst', 0x63d9ff, 'target')]),
        'Arcane Shield': presentation('buff', 'buff', [layer('sphere', 0x4da6ff), layer('buff', 0x9edbff)], { persistentState: 'arcane_shield' }),
        'Gravity Well': presentation('persistent-area', 'heavy-cast', [layer('ring', 0x6d33a8, 'target'), layer('sphere', 0x32164f, 'target')], { persistentState: 'gravity_well' }),
        'Time Warp': presentation('buff-area', 'channel', [layer('ring', 0xffd75a), layer('buff', 0xfff1a8)], { persistentState: 'time_warp' })
    }),
    Cleric: Object.freeze({
        'Spirit Guardians': presentation('persistent-aura', 'summon', [layer('buff', 0xffe066), layer('ring', 0xfff4a3)], { persistentState: 'spirit_guardians' }),
        'Healing Light': presentation('heal', 'cast', [
            layer('pillar', 0x55ff9b, 'target'),
            layer('burst', 0xc8ffe0, 'target'),
            layer('ring', 0x7dffc0, 'target', { runeOnly: 'healinglight_beacon' })
        ]),
        'Guardian Embrace': presentation('persistent-aura', 'channel', [layer('ring', 0xffef78), layer('buff', 0xfff5ad)], { persistentState: 'guardian_embrace' }),
        'Purifying Wave': presentation('area', 'cast', [layer('ring', 0x70f5ff), layer('burst', 0xe1fdff)]),
        'Divine Intervention': presentation('buff', 'heavy-cast', [layer('pillar', 0xffd85a, 'target'), layer('sphere', 0xfff2a6, 'target')], { persistentState: 'divine_intervention' }),
        'Radiant Strike': presentation('melee', 'heavy', [layer('cone', 0xffff6a), layer('impact', 0xffffff, 'target')]),
        'Consecrated Ground': presentation('persistent-area', 'cast', [layer('ground_circle', 0xffd447), layer('pillar', 0xfff1a1)], { persistentState: 'consecrated_ground' }),
        'Spirit Guardians Boost': presentation('persistent-aura', 'summon', [layer('buff', 0xffffff), layer('ring', 0xffd75a)], { persistentState: 'spirit_guardians_boost' }),
        'Avenging Seraph': presentation('summon', 'summon', [layer('pillar', 0xffffff), layer('ring', 0xffe58a)], { persistentState: 'avenging_seraph' }),
        'Blessing of Resolve': presentation('buff-area', 'bless', [layer('ring', 0x66aaff), layer('sphere', 0xb9d8ff)], { persistentState: 'blessing_resolve' }),
        'Blessing of Zeal': presentation('buff-area', 'bless', [layer('ring', 0xff755f), layer('buff', 0xffc273)], { persistentState: 'blessing_zeal' }),
        'Mark of Weakness': presentation('debuff', 'mark', [layer('pillar', 0xb45cff, 'target'), layer('mark', 0x7d2a9d, 'target')], { persistentState: 'mark_weakness' }),
        "Heaven's Trumpet": presentation('area-control', 'shout', [layer('ring', 0xffd64d), layer('pillar', 0xffffff)], { persistentState: 'heavens_trumpet' })
    })
});

export const ABILITY_VISUAL_ALIASES = Object.freeze({
    Fighter: Object.freeze({}),
    Rogue: Object.freeze({
        'Ricochet Blades': 'Piercing Throw',
        'Shadow Step': 'Shadow Lunge',
        'Shadow Strike': 'Backstab',
        Assassinate: 'Backstab',
        'Venomous Strike': 'Poison Coating',
        'Adrenaline Rush': 'Cloak & Vanish',
        Stealth: 'Cloak & Vanish',
        'Explosive Trap': 'Tripwire',
        'Snare Trap': 'Tripwire',
        'Rain of Arrows': 'Phantom Volley'
    }),
    Wizard: Object.freeze({
        Meteor: 'Meteor Drop',
        Blink: 'Teleport',
        'Ice Barrier': 'Arcane Shield',
        'Frost Nova': 'Flame Whip'
    }),
    Cleric: Object.freeze({
        'Guardian Spirits': 'Spirit Guardians',
        Smite: 'Radiant Strike',
        'Holy Nova': 'Purifying Wave',
        'Divine Protection': 'Divine Intervention',
        'Sacred Ground': 'Consecrated Ground',
        Resurrection: 'Divine Intervention'
    })
});

const ABILITY_VISUAL_ALIAS_OVERRIDES = Object.freeze({
    Wizard: Object.freeze({
        'Frost Nova': presentation('area-control', 'cast', [
            layer('ring', 0x72cfff),
            layer('burst', 0xd7f4ff)
        ])
    })
});

export const ABILITY_ANIMATION_PROFILES = Object.freeze({
    attack: Object.freeze({ clip: 'Attack', duration: 0.72 }),
    quick: Object.freeze({ clip: 'Attack', duration: 0.42 }),
    throw: Object.freeze({ clip: 'Attack', duration: 0.52 }),
    volley: Object.freeze({ clip: 'Attack', duration: 0.68 }),
    cast: Object.freeze({ clip: 'Attack', duration: 0.7 }),
    'heavy-cast': Object.freeze({ clip: 'Attack', duration: 1.05 }),
    channel: Object.freeze({ clip: 'Attack', duration: 1.15 }),
    heavy: Object.freeze({ clip: 'Attack', duration: 0.82 }),
    sweep: Object.freeze({ clip: 'Attack', duration: 0.72 }),
    spin: Object.freeze({ clip: 'Attack', duration: 0.9 }),
    charge: Object.freeze({ clip: 'Run', duration: 0.75, movement: true }),
    lunge: Object.freeze({ clip: 'Attack', duration: 0.48 }),
    pull: Object.freeze({ clip: 'Attack', duration: 0.75 }),
    buff: Object.freeze({ clip: 'Attack', duration: 0.78 }),
    shout: Object.freeze({ clip: 'Attack', duration: 0.88 }),
    mark: Object.freeze({ clip: 'Attack', duration: 0.62 }),
    place: Object.freeze({ clip: 'Attack', duration: 0.58 }),
    vanish: Object.freeze({ clip: 'Attack', duration: 0.45 }),
    teleport: Object.freeze({ clip: 'Attack', duration: 0.5 }),
    summon: Object.freeze({ clip: 'Attack', duration: 1.0 }),
    bless: Object.freeze({ clip: 'Attack', duration: 0.82 })
});

export function getSkillTreeAbilityNames(className) {
    const tree = CONSTANTS.SKILL_TREES?.[className];
    if (!tree) return [];
    const names = [];
    const visit = (node) => {
        if (!node || typeof node !== 'object') return;
        if (typeof node.name === 'string' && /^Tier\d+$/.test(node._key || '')) names.push(node.name);
        for (const [key, value] of Object.entries(node)) {
            if (value && typeof value === 'object') visit({ ...value, _key: key });
        }
    };
    visit(tree);
    return [...new Set(names)];
}

export function resolveCanonicalAbilityName(className, skillName) {
    if (!className || !skillName) return null;
    if (PLAYER_ABILITY_VISUALS[className]?.[skillName]) return skillName;
    return ABILITY_VISUAL_ALIASES[className]?.[skillName] || null;
}

export function getAbilityPresentation(className, skillName) {
    const canonicalName = resolveCanonicalAbilityName(className, skillName);
    if (!canonicalName) return null;
    return {
        className,
        skillName,
        canonicalName,
        ...PLAYER_ABILITY_VISUALS[className][canonicalName],
        ...(ABILITY_VISUAL_ALIAS_OVERRIDES[className]?.[skillName] || {})
    };
}

export function isAbilityVisualLayerEnabled(entry, source, canonicalName) {
    if (!entry?.runeOnly) return true;
    return source?.skillRunes?.[canonicalName] === entry.runeOnly;
}

export function getAbilityAnimationProfile(className, skillName) {
    const ability = getAbilityPresentation(className, skillName);
    if (!ability) return ABILITY_ANIMATION_PROFILES.attack;
    return ABILITY_ANIMATION_PROFILES[ability.animation] || ABILITY_ANIMATION_PROFILES.attack;
}

export function listPlayerAbilityPresentations() {
    return Object.entries(PLAYER_ABILITY_VISUALS).flatMap(([className, skills]) =>
        Object.entries(skills).map(([skillName, entry]) => ({ className, skillName, ...entry }))
    );
}

export function listPlayerAbilityPresentationVariants() {
    return listPlayerAbilityPresentations().flatMap((ability) => [
        { ...ability, runeId: null, runeName: null },
        ...getAbilityRuneVariants(ability.className, ability.skillName).map((rune) => ({
            ...ability,
            runeId: rune.id,
            runeName: rune.name
        }))
    ]);
}

export function getAbilityRuneVariants(className, skillName) {
    return (CONSTANTS.SKILL_RUNES?.[className] || [])
        .filter((rune) => rune.skill === skillName)
        .map((rune) => ({ id: rune.id, name: rune.name, description: rune.description }));
}
