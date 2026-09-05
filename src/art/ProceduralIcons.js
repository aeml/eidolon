import {
    PROCEDURAL_ABILITY_CAST_ALIAS_DEFINITIONS,
    PROCEDURAL_ABILITY_CAST_DEFINITIONS
} from './ProceduralAbilityCasts.js';
import {
    EQUIPMENT_VISUAL_DESCRIPTORS,
    resolveEquipmentVisualDescriptor
} from './ProceduralEquipment.js';
import { GEM_QUALITIES, GEM_TYPES } from '../core/ItemSystem.js';

const ABILITY_CACHE = new Map();
const ITEM_CACHE = new Map();
const ITEM_CACHE_LIMIT = 512;

const QUEST_ITEM_DEFINITIONS = Object.freeze({
    'Verdant Memory Seed': Object.freeze({ variant: 'memory-seed', base: '23492d', accent: '8fdc77', pale: 'e4ffd2',
        body: '<path d="M48 79C18 59 28 28 48 19c20 9 30 40 0 60Z"/><path d="M48 72V30M48 47 34 37M48 59l15-14" fill="none"/><path d="M49 31c1-16 16-18 23-15-1 14-13 23-23 15Z"/>' }),
    'Moon-Tide Pearl': Object.freeze({ variant: 'moon-tide-pearl', base: '173e66', accent: '8bcfec', pale: 'f0faff',
        body: '<path d="M18 60q30 36 60 0L65 79H31Z"/><circle cx="48" cy="42" r="23"/><path d="M52 23c-20 5-21 28-3 36-27-1-29-33 3-36Z" fill="#4e8ac1"/><path d="M27 66q21 12 42 0" fill="none"/>' }),
    'Cinderheart Ore': Object.freeze({ variant: 'cinderheart-ore', base: '512820', accent: 'ef793f', pale: 'ffe3a1',
        body: '<path d="m24 30 24-13 27 20-5 34-29 11-24-22Z" fill="#5d4240"/><path d="m48 22-7 20 12 9-7 27M23 36l18 6M53 51l19-10" fill="none" stroke="#ffc16d" stroke-width="5"/><path d="m48 39 11 11-10 14-11-14Z"/>' }),
    'Stormglass Pinion': Object.freeze({ variant: 'stormglass-pinion', base: '253254', accent: 'a7bcfa', pale: 'f1f4ff',
        body: '<path d="M72 15Q28 20 23 77l17-12 10 1-5-14 17-7-10-8Q65 30 72 15Z"/><path d="m29 76 29-43M39 58l-1-16M47 49l13-4" fill="none"/><path d="m68 47-12 15h9L53 80l23-23H65Z" fill="#fff0a9"/>' })
});
const UNKNOWN_QUEST_ITEM = Object.freeze({ variant: 'chronicle-relic', base: '453552', accent: 'ddbb67', pale: 'fff0c7',
    body: '<path d="m48 15 23 22-8 38-15 10-15-10-8-38Z"/><path d="M48 32v23m0 9v3" fill="none" stroke-width="5"/>' });

const CURRENCY_DEFINITIONS = Object.freeze({
    'Eidolon Shard': Object.freeze({
        family: 'currency',
        variant: 'soul-shard',
        motif: 'broken-purpose-prism',
        primary: 0x6b35a6,
        secondary: 0xbc78f2,
        pale: 0xf1dcff
    }),
    'Eidolon Heart': Object.freeze({
        family: 'currency',
        variant: 'eidolon-heart',
        motif: 'enduring-soul-heart',
        primary: 0x7e203f,
        secondary: 0xe05879,
        pale: 0xffd0dd
    })
});

const GEM_ICON_COLORS = Object.freeze({
    Ruby: Object.freeze({ dark: 0x26090e, primary: 0xc52d3b, pale: 0xffbec7 }),
    Sapphire: Object.freeze({ dark: 0x0c1730, primary: 0x3566cc, pale: 0xc8e2ff }),
    Emerald: Object.freeze({ dark: 0x0b2116, primary: 0x35ad68, pale: 0xcaffdc }),
    Topaz: Object.freeze({ dark: 0x2a2108, primary: 0xe1ad28, pale: 0xffedac }),
    Diamond: Object.freeze({ dark: 0x182229, primary: 0xbfd9e2, pale: 0xffffff }),
    Onyx: Object.freeze({ dark: 0x100d16, primary: 0x393044, pale: 0xb8a7c8 }),
    Opal: Object.freeze({ dark: 0x102027, primary: 0x77bad2, pale: 0xedffff })
});

const RARITY_COLORS = Object.freeze({
    Common: 0xb9b7ad,
    Uncommon: 0x55b96a,
    Rare: 0x4f86d9,
    Legendary: 0xe39a38,
    Eidolic: 0xa966df
});

const SET_COLORS = Object.freeze({
    warlord_fury: 0xc44a32,
    bulwark_ages: 0x6e91a0,
    shadow_embrace: 0x705179,
    venom_lord: 0x55a85b,
    inferno_heart: 0xe06a32,
    temporal_weave: 0x617ed3,
    divine_light: 0xe6c66a,
    crusader_zeal: 0xd7e2d2
});

const UNIQUE_COLORS = Object.freeze({
    vampiric: 0xa32d3d,
    efficient: 0x4a88b7,
    lucky: 0xd6ad42,
    explosive: 0xdb5b2b,
    swift: 0x4ec6a2,
    thorns: 0x6da253,
    berserker: 0xd14232,
    guardian: 0x648da8,
    executioner: 0x8d557e,
    regenerative: 0x4ea86f
});

const canonicalEntries = (record) => Object.entries(record).filter(([key]) => key === key.toUpperCase());

export const PROCEDURAL_ABILITY_ICON_DEFINITIONS = Object.freeze(Object.fromEntries(
    Object.entries(PROCEDURAL_ABILITY_CAST_DEFINITIONS).flatMap(([className, abilities]) =>
        Object.entries(abilities).map(([abilityName, definition]) => [
            `${className}:${abilityName}`,
            Object.freeze({ className, abilityName, ...definition })
        ])
    ).concat(Object.entries(PROCEDURAL_ABILITY_CAST_ALIAS_DEFINITIONS).flatMap(([className, abilities]) =>
        Object.entries(abilities).map(([abilityName, definition]) => [
            `${className}:${abilityName}`,
            Object.freeze({ className, abilityName, ...definition, compatibility: true })
        ])
    ))
));

export const PROCEDURAL_ITEM_ICON_DEFINITIONS = Object.freeze({
    equipment: EQUIPMENT_VISUAL_DESCRIPTORS,
    currency: CURRENCY_DEFINITIONS,
    quest: QUEST_ITEM_DEFINITIONS,
    gems: Object.freeze(Object.fromEntries(canonicalEntries(GEM_TYPES).flatMap(([, gem]) =>
        canonicalEntries(GEM_QUALITIES).map(([, quality]) => [
            `${quality.name}:${gem.name}`,
            Object.freeze({
                family: 'gem',
                variant: gem.name.toLowerCase(),
                motif: `${quality.name.toLowerCase()}-${gem.name.toLowerCase()}-soulstone`,
                gemType: gem.name,
                gemQuality: quality.name,
                gemColor: gem.color,
                qualityColor: quality.color,
                qualityValue: quality.value
            })
        ])
    )))
});

function toHex(color, fallback = 'ffffff') {
    const numeric = Number(color);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, Math.min(0xffffff, numeric)).toString(16).padStart(6, '0');
}

function cssColorToHex(color, fallback = 'ffffff') {
    const match = String(color || '').match(/^#([0-9a-f]{6})$/i);
    return match ? match[1].toLowerCase() : fallback;
}

function dataUri(svg) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function cachedValue(cache, key) {
    if (!cache.has(key)) return null;
    const value = cache.get(key);
    cache.delete(key);
    cache.set(key, value);
    return value;
}

function cacheValue(cache, key, value, limit = Number.POSITIVE_INFINITY) {
    if (!cache.has(key) && cache.size >= limit) {
        cache.delete(cache.keys().next().value);
    }
    cache.set(key, value);
    return value;
}

function frameSvg({ id, dark, base, accent, pale, body, marks = '', badges = '' }) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" data-procedural-icon="${id}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#${dark}"/><stop offset="1" stop-color="#08090d"/></linearGradient>
<radialGradient id="wake"><stop stop-color="#${base}" stop-opacity=".5"/><stop offset="1" stop-color="#${dark}" stop-opacity="0"/></radialGradient>
<filter id="glow"><feGaussianBlur stdDeviation="1.25" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<rect x="2" y="2" width="92" height="92" rx="13" fill="url(#bg)" stroke="#${accent}" stroke-width="3"/>
<path d="M13 72 24 22 48 10 72 22 83 72 68 86 28 86Z" fill="url(#wake)" stroke="#${base}" stroke-opacity=".55"/>
<circle cx="48" cy="48" r="32" fill="none" stroke="#${base}" stroke-width="2" stroke-dasharray="3 5" opacity=".72"/>
${marks}
<g fill="#${accent}" stroke="#${pale}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" filter="url(#glow)">${body}</g>
${badges}
<path d="M14 18h10M72 18h10M14 78h10M72 78h10" fill="none" stroke="#${pale}" stroke-width="2" opacity=".7"/>
</svg>`;
}

function abilityRelic(relic) {
    const shapes = {
        shield: '<path d="M48 18 72 28 68 58Q62 74 48 81Q34 74 28 58L24 28Z"/>',
        blade: '<path d="M42 76 44 34 52 15 57 36 52 76Z"/><path d="M31 65h34l-5 9H36Z"/>',
        fang: '<path d="M29 22Q39 31 38 72L48 58 58 72Q57 31 67 22Q48 31 29 22Z"/>',
        crystal: '<path d="M48 13 71 37 60 75 48 84 36 75 25 37Z"/><path d="m25 37 23 12 23-12M48 13v71" fill="none"/>',
        feather: '<path d="M69 18Q29 22 26 73L35 61 48 64 43 53 58 48 47 42Q61 33 69 18Z"/>',
        bar: '<path d="M25 28h46v11H25ZM31 46h34v10H31ZM37 63h22v10H37Z"/>',
        relic: '<path d="M48 14 67 27 72 53 59 78H37L24 53 29 27Z"/><circle cx="48" cy="48" r="12" fill="none"/>'
    };
    return shapes[relic] || shapes.relic;
}

function radialMarks(signature, color) {
    const count = 3 + (signature % 6);
    const marks = [];
    for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2 + signature * 0.17;
        const x1 = 48 + Math.cos(angle) * 35;
        const y1 = 48 + Math.sin(angle) * 35;
        const x2 = 48 + Math.cos(angle) * 42;
        const y2 = 48 + Math.sin(angle) * 42;
        marks.push(`<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="#${color}" stroke-width="3"/>`);
    }
    return `<g opacity=".82">${marks.join('')}</g>`;
}

function normalizeClassName(className) {
    const lower = String(className || '').toLowerCase();
    return Object.keys(PROCEDURAL_ABILITY_CAST_DEFINITIONS).find((name) => name.toLowerCase() === lower) || '';
}

export function getProceduralAbilityIcon(className, abilityName) {
    const canonicalClass = normalizeClassName(className);
    const key = `${canonicalClass}:${abilityName || ''}`;
    const cached = cachedValue(ABILITY_CACHE, key);
    if (cached) return cached;
    const definition = PROCEDURAL_ABILITY_ICON_DEFINITIONS[key];
    if (!definition) return null;
    const palette = definition.palette;
    const signature = Number(definition.signature) || 1;
    const svg = frameSvg({
        id: `ability-${canonicalClass.toLowerCase()}-${signature}`,
        dark: toHex(palette.dark),
        base: toHex(palette.base),
        accent: toHex(palette.accent),
        pale: toHex(palette.pale),
        body: `<g transform="rotate(${(signature * 23) % 46 - 23} 48 48)">${abilityRelic(definition.relic)}</g>`,
        marks: radialMarks(signature, toHex(palette.pale))
    });
    const uri = dataUri(svg);
    return cacheValue(ABILITY_CACHE, key, uri);
}

function equipmentGlyph(visual) {
    const glyphs = {
        blade: '<path d="M44 77 46 30 52 15 57 31 52 77Z"/><path d="M31 67h34l-5 9H36Z"/>',
        focusWeapon: visual.variant === 'staff'
            ? '<path d="M45 80 48 31" fill="none" stroke-width="7"/><circle cx="52" cy="24" r="13" fill="none"/><path d="m52 12 8 12-8 12-8-12Z"/>'
            : '<path d="M44 81 47 35" fill="none" stroke-width="8"/><path d="m48 13 15 12-11 17-17-7-1-15Z"/>',
        offhand: visual.variant === 'tome'
            ? '<path d="M25 22Q40 18 48 29v51Q38 69 25 73ZM71 22Q56 18 48 29v51Q58 69 71 73Z"/>'
            : '<path d="M48 14 73 25 68 62Q62 77 48 84Q34 77 28 62L23 25Z"/>',
        headwear: visual.variant === 'hood'
            ? '<path d="M48 12Q70 25 72 58L62 81H34L24 58Q26 25 48 12ZM38 42Q48 32 58 42L55 65H41Z" fill-rule="evenodd"/>'
            : '<path d="M24 54Q24 17 48 14 72 17 72 54L63 76H33Z"/><path d="M30 47h36" fill="none"/>',
        bodyArmor: '<path d="m28 18-15 17 13 12 6-8v42h32V39l6 8 13-12-15-17-13 8H41Z"/>',
        legArmor: '<path d="M29 17h38l-5 65H49L46 45l-3 37H30Z"/>',
        footwear: '<path d="M25 24h21l-2 35 19 8 10 13H23ZM55 24h16l1 34-18-7Z"/>',
        handwear: '<path d="M31 19h10l3 25 4-30h9l-2 31 5-27h8l-5 45-15 19-18-14-5-38Z"/>',
        shoulderArmor: '<path d="M12 43Q21 17 42 24L37 53 18 59ZM84 43Q75 17 54 24L59 53 78 59Z"/><path d="M38 50h20v29H38Z"/>',
        waist: '<path d="M13 38h70v22H13Z"/><path d="M38 32h20v34H38Z" fill="none"/>',
        ring: '<circle cx="48" cy="52" r="25" fill="none" stroke-width="10"/><path d="m48 13 12 13-12 13-12-13Z"/>',
        neckwear: '<path d="M20 19Q48 71 76 19" fill="none" stroke-width="8"/><path d="m48 49 14 14-14 21-14-21Z"/>',
        trinket: visual.variant === 'orb'
            ? '<circle cx="48" cy="49" r="24"/><ellipse cx="48" cy="49" rx="37" ry="15" fill="none"/><path d="m48 29 13 20-13 20-13-20Z"/>'
            : '<path d="M48 14 68 31 61 70 48 84 35 70 28 31Z"/><circle cx="48" cy="48" r="11" fill="none"/>'
    };
    return glyphs[visual.family] || glyphs.trinket;
}

function gemBadges(item) {
    const gems = Array.isArray(item?.gems) ? item.gems : [];
    const socketCount = Math.min(3, Math.max(gems.length, Number(item?.sockets) || 0));
    if (socketCount <= 0) return '';
    const circles = [];
    for (let index = 0; index < socketCount; index += 1) {
        const gemName = gems[index]?.type || gems[index]?.gemType;
        const color = GEM_ICON_COLORS[gemName]?.primary || 0x25252d;
        circles.push(`<circle cx="${38 + index * 10}" cy="85" r="3.5" fill="#${toHex(color)}" stroke="#e7e3d5"/>`);
    }
    return circles.join('');
}

function itemBadges(item, accent) {
    const setColor = SET_COLORS[item?.setId];
    const uniqueColor = UNIQUE_COLORS[item?.uniqueEffect];
    const potency = Math.max(0, Number(item?.potency) || 0);
    const level = Math.max(1, Number(item?.level) || 1);
    return `<g>${setColor ? `<path d="M5 26 18 13l9 9L14 35Z" fill="#${toHex(setColor)}"/>` : ''}
${uniqueColor ? `<path d="m72 8 16 5-5 16-16-5Z" fill="#${toHex(uniqueColor)}" stroke="#f7e9d0"/>` : ''}
${potency ? `<path d="M10 84h${Math.min(24, 5 + potency * 2)}" stroke="#${accent}" stroke-width="4"/>` : ''}
<path d="M82 84v-${Math.min(20, 4 + (level % 9) * 2)}" stroke="#${accent}" stroke-width="3"/>
${gemBadges(item)}</g>`;
}

function normalizeCurrencyName(item) {
    const name = String(item?.baseName || item?.name || item || '');
    if (name === 'Shard') return 'Eidolon Shard';
    if (name === 'Heart') return 'Eidolon Heart';
    return name;
}

function resolveGemDefinition(item) {
    const isGem = item?.type === 'GEM' || item?.type === 'Gem' || item?.slot === 'gem';
    if (!isGem) return null;
    const words = String(item?.name || '').split(/\s+/);
    const gemType = GEM_TYPES[item?.gemType] || GEM_TYPES[String(item?.gemType || words.at(-1) || '').toUpperCase()];
    const gemQuality = GEM_QUALITIES[item?.gemQuality]
        || GEM_QUALITIES[String(item?.gemQuality || words[0] || '').toUpperCase()];
    if (!gemType || !gemQuality) return null;
    return PROCEDURAL_ITEM_ICON_DEFINITIONS.gems[`${gemQuality.name}:${gemType.name}`] || null;
}

function gemIcon(definition) {
    const palette = GEM_ICON_COLORS[definition.gemType] || GEM_ICON_COLORS.Diamond;
    const qualityRank = canonicalEntries(GEM_QUALITIES).findIndex(([, value]) => value.name === definition.gemQuality) + 1;
    const facets = [];
    for (let index = 0; index < qualityRank; index += 1) {
        const y = 34 + index * 7;
        facets.push(`<path d="M${29 + index} ${y}h${38 - index * 2}" fill="none" opacity="${0.35 + index * 0.08}"/>`);
    }
    return frameSvg({
        id: `gem-${definition.motif}`,
        dark: toHex(palette.dark),
        base: cssColorToHex(definition.qualityColor, toHex(palette.primary)),
        accent: toHex(palette.primary),
        pale: toHex(palette.pale),
        body: `<path d="M48 12 73 34 62 72 48 85 34 72 23 34Z"/><path d="m23 34 25 14 25-14M48 12v73" fill="none"/>${facets.join('')}`,
        marks: radialMarks(qualityRank + definition.gemType.length, toHex(palette.pale)),
        badges: `<circle cx="79" cy="17" r="10" fill="#${cssColorToHex(definition.qualityColor)}" stroke="#${toHex(palette.pale)}"/><path d="M76 17h6" stroke="#171118" stroke-width="3"/>`
    });
}

function currencyIcon(name, definition) {
    const heart = name === 'Eidolon Heart';
    return frameSvg({
        id: `currency-${definition.variant}`,
        dark: heart ? '250b14' : '170d24',
        base: toHex(definition.primary),
        accent: toHex(definition.secondary),
        pale: toHex(definition.pale),
        body: heart
            ? '<path d="M48 82Q13 58 19 31 24 12 48 30 72 12 77 31 83 58 48 82Z"/><path d="M48 30v42M35 42l13 8 13-8" fill="none"/>'
            : '<path d="m48 9 20 25-7 45-13 9-13-9-7-45Z"/><path d="m48 9-5 30 5 12 7-18ZM28 34l15 5-8 40M68 34l-13-1 6 46" fill="none"/>',
        marks: radialMarks(heart ? 8 : 11, toHex(definition.pale))
    });
}

export function getProceduralItemIcon(item) {
    if (!item) return null;
    const questDefinition = QUEST_ITEM_DEFINITIONS[item.name] ||
        (String(item.id || '').startsWith('chronicle-item-') ? UNKNOWN_QUEST_ITEM : null);
    if (questDefinition) {
        const key = `quest:${questDefinition.variant}`;
        const cached = cachedValue(ITEM_CACHE, key);
        if (cached) return cached;
        return cacheValue(ITEM_CACHE, key, dataUri(frameSvg({
            ...questDefinition, id: key, dark: '141922',
            badges: '<circle cx="79" cy="17" r="10" fill="#d4ad53" stroke="#fff0c7"/><path d="M79 11v7m0 4v1" stroke="#292015" stroke-width="3"/>'
        })), ITEM_CACHE_LIMIT);
    }
    const gemDefinition = resolveGemDefinition(item);
    if (gemDefinition) {
        const key = `gem:${gemDefinition.motif}`;
        const cached = cachedValue(ITEM_CACHE, key);
        if (cached) return cached;
        return cacheValue(ITEM_CACHE, key, dataUri(gemIcon(gemDefinition)), ITEM_CACHE_LIMIT);
    }

    const currencyName = normalizeCurrencyName(item);
    const currencyDefinition = CURRENCY_DEFINITIONS[currencyName];
    if (currencyDefinition) {
        const key = `currency:${currencyName}`;
        const cached = cachedValue(ITEM_CACHE, key);
        if (cached) return cached;
        return cacheValue(
            ITEM_CACHE,
            key,
            dataUri(currencyIcon(currencyName, currencyDefinition)),
            ITEM_CACHE_LIMIT
        );
    }

    const visual = resolveEquipmentVisualDescriptor(item);
    if (!visual) return null;
    const rarityName = typeof item.rarity === 'string' ? item.rarity : (item.rarity?.name || 'Common');
    const rarityColor = toHex(RARITY_COLORS[rarityName] || RARITY_COLORS.Common);
    const key = [
        'equipment', visual.baseName, rarityName, Number(item.level) || 1, Number(item.potency) || 0,
        Number(item.sockets) || 0, item.setId || '', item.uniqueEffect || '',
        JSON.stringify(item.gems || [])
    ].join(':');
    const cached = cachedValue(ITEM_CACHE, key);
    if (cached) return cached;
    const variantSignature = visual.variant.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const svg = frameSvg({
        id: `equipment-${visual.variant}`,
        dark: '111318',
        base: toHex(visual.primary),
        accent: rarityColor,
        pale: toHex(visual.secondary),
        body: equipmentGlyph(visual),
        marks: radialMarks(variantSignature, toHex(visual.secondary)),
        badges: itemBadges(item, rarityColor)
    });
    const uri = dataUri(svg);
    return cacheValue(ITEM_CACHE, key, uri, ITEM_CACHE_LIMIT);
}

export function getProceduralIconCacheMetrics() {
    return Object.freeze({
        icons: ABILITY_CACHE.size + ITEM_CACHE.size,
        abilities: ABILITY_CACHE.size,
        items: ITEM_CACHE.size,
        itemLimit: ITEM_CACHE_LIMIT
    });
}
