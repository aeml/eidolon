import { Fighter } from '../entities/Fighter.js';
import { Rogue } from '../entities/Rogue.js';
import { Wizard } from '../entities/Wizard.js';
import { Cleric } from '../entities/Cleric.js';
import { AvengingSeraph } from '../entities/AvengingSeraph.js';

function at(origin, color, type, extra = {}) {
    return { color, type, origin, ...extra };
}

const FIGHTER_VISUALS = {
    'Charge': ({ position }) => at(position, 0xff5500, 'wave'),
    'Whirlwind': ({ position }) => at(position, 0xaaaaaa, 'spin'),
    'Shield Slam': ({ position }) => at(position, 0xffff00, 'impact'),
    'Iron Fortress': ({ position }) => at(position, 0x808080, 'buff'),
    'Guardian Roar': ({ position }) => at(position, 0xff0000, 'wave'),
    'Sweeping Strike': ({ position }) => at(position, 0xffffff, 'cone'),
    'Earthshaker': ({ position }) => at(position, 0x8b4513, 'wave'),
    'Unbreakable Grip': ({ targetPos }) => at(targetPos, 0x0000ff, 'impact'),
    'Juggernaut Charge': ({ position }) => at(position, 0xff0000, 'wave'),
    'Berserker Edge': ({ position }) => at(position, 0xff0000, 'buff'),
    'Shattering Charge': ({ position }) => at(position, 0xffffff, 'wave'),
    'Executioner Spin': ({ position }) => at(position, 0xff0000, 'spin'),
    'Last Stand Rampage': ({ position }) => at(position, 0xff0000, 'buff')
};

const ROGUE_VISUALS = {
    'Piercing Throw': ({ position }) => at(position, 0xdddddd, 'burst'),
    'Ricochet Blades': ({ position }) => at(position, 0xdddddd, 'burst'),
    'Shadow Step': ({ position }) => at(position, 0x000000, 'smoke'),
    'Shadow Lunge': ({ position }) => at(position, 0x000000, 'smoke'),
    'Fan of Knives': ({ position }) => at(position, 0x333333, 'spin'),
    'Venomous Strike': ({ targetPos }) => at(targetPos, 0xff0000, 'mark'),
    'Weak Point Mark': ({ targetPos }) => at(targetPos, 0xff0000, 'mark'),
    'Assassinate': ({ targetPos }) => at(targetPos, 0xff0000, 'blood'),
    'Backstab': ({ targetPos }) => at(targetPos, 0xff0000, 'blood'),
    'Shadow Strike': ({ targetPos }) => at(targetPos, 0xff0000, 'blood'),
    'Death Spiral': ({ position }) => at(position, 0x333333, 'spin'),
    'Serrated Edges': ({ position }) => at(position, 0xff0000, 'buff'),
    'Blade Storm': ({ position }) => at(position, 0xcccccc, 'cone'),
    'Phantom Volley': ({ position }) => at(position, 0x8800ff, 'burst'),
    'Smoke Bomb': ({ position }) => at(position, 0x555555, 'smoke_cloud'),
    'Poison Coating': ({ position }) => at(position, 0x00ff00, 'buff'),
    'Tripwire': ({ position }) => at(position, 0xaaaaaa, 'impact'),
    'Snare Trap': ({ position }) => at(position, 0xaaaaaa, 'impact'),
    'Explosive Trap': ({ position }) => at(position, 0xaaaaaa, 'impact'),
    'Adrenaline Rush': ({ position }) => at(position, 0x000000, 'smoke'),
    'Stealth': ({ position }) => at(position, 0x000000, 'smoke'),
    'Cloak & Vanish': ({ position }) => at(position, 0x000000, 'smoke'),
    'Rain of Arrows': ({ targetPos }) => at(targetPos, 0xffffff, 'ring')
};

const WIZARD_VISUALS = {
    'Frost Nova': ({ position }) => at(position, 0x00ffff, 'ring'),
    'Blink': ({ position }) => at(position, 0x00ffff, 'burst'),
    'Teleport': ({ position }) => at(position, 0x00ffff, 'burst'),
    'Fireball': ({ position }) => at(position, 0xff4500, 'burst'),
    'Flame Whip': ({ position }) => at(position, 0xff4500, 'cone'),
    'Flame Tornado': ({ position }) => at(position, 0xff5500, 'spin'),
    'Meteor': () => ({ handled: true }),
    'Meteor Drop': () => ({ handled: true }),
    'Ice Barrier': ({ position }) => at(position, 0x0088ff, 'sphere'),
    'Arcane Shield': ({ position }) => at(position, 0x0088ff, 'sphere'),
    'Scorch Beam': ({ targetPos }) => at(targetPos, 0xffaa00, 'beam'),
    'Dragonfire Lance': ({ targetPos }) => at(targetPos, 0xffaa00, 'beam'),
    'Arcane Missiles': ({ position }) => at(position, 0xaa00ff, 'burst'),
    'Spell Focus': ({ position }) => at(position, 0x8800ff, 'buff'),
    'Gravity Well': ({ targetPos }) => at(targetPos, 0x440088, 'ring'),
    'Inferno Cataclysm': ({ targetPos }) => at(targetPos, 0xff2200, 'ring'),
    'Time Warp': ({ position }) => at(position, 0xffd700, 'ring')
};

const CLERIC_VISUALS = {
    'Spirit Guardians': ({ position }) => at(position, 0xffff66, 'buff'),
    'Spirit Guardians Boost': ({ position }) => at(position, 0xffff66, 'buff'),
    'Smite': ({ targetPos }) => at(targetPos, 0xffff00, 'impact'),
    'Healing Light': ({ targetPos }) => at(targetPos, 0x00ff88, 'pillar'),
    'Guardian Embrace': ({ position }) => at(position, 0xffff00, 'buff'),
    'Purifying Wave': ({ position }) => at(position, 0x00ffff, 'ring'),
    'Holy Nova': ({ position }) => at(position, 0x00ffff, 'ring'),
    'Divine Protection': ({ targetPos }) => at(targetPos, 0xffd700, 'pillar'),
    'Divine Intervention': ({ targetPos }) => at(targetPos, 0xffd700, 'pillar'),
    'Sacred Ground': ({ position }) => at(position, 0xffd700, 'ground_circle'),
    'Consecrated Ground': ({ position }) => at(position, 0xffd700, 'ground_circle'),
    'Radiant Strike': ({ position }) => at(position, 0xffff00, 'burst'),
    'Blessing of Resolve': ({ position }) => at(position, 0xffff00, 'ring'),
    'Blessing of Zeal': ({ position }) => at(position, 0xffff00, 'ring'),
    'Mark of Weakness': ({ targetPos }) => at(targetPos, 0x800080, 'pillar'),
    "Heaven's Trumpet": ({ position }) => at(position, 0xffd700, 'ring'),
    'Resurrection': ({ targetPos }) => at(targetPos, 0xffffff, 'beam')
};

const SERAPH_VISUALS = {
    'Smite': ({ targetPos }) => at(targetPos, 0xffff00, 'impact')
};

const REGISTRY = [
    {
        match: (entity) => entity instanceof Fighter,
        visuals: FIGHTER_VISUALS,
        fallback: ({ position }) => at(position, 0xffaa55, 'wave', { fallback: true })
    },
    {
        match: (entity) => entity instanceof Rogue,
        visuals: ROGUE_VISUALS,
        fallback: ({ position }) => at(position, 0xaaaaaa, 'smoke', { fallback: true })
    },
    {
        match: (entity) => entity instanceof Wizard,
        visuals: WIZARD_VISUALS,
        fallback: ({ position }) => at(position, 0x66bbff, 'ring', { fallback: true })
    },
    {
        match: (entity) => entity instanceof Cleric,
        visuals: CLERIC_VISUALS,
        fallback: ({ position }) => at(position, 0xffff99, 'buff', { fallback: true })
    },
    {
        match: (entity) => entity instanceof AvengingSeraph,
        visuals: SERAPH_VISUALS,
        fallback: ({ position }) => at(position, 0xffff99, 'buff', { fallback: true })
    }
];

export function resolveRemoteSkillVisual(entity, skillName, targetPos) {
    const position = entity.position.clone ? entity.position.clone() : entity.position;
    const target = targetPos?.clone ? targetPos.clone() : targetPos;
    const context = { entity, position, targetPos: target };

    const entry = REGISTRY.find(({ match }) => match(entity));
    if (!entry) {
        return at(position, 0xffffff, 'impact', { fallback: true });
    }

    const resolver = entry.visuals[skillName];
    if (resolver) {
        return resolver(context);
    }

    return entry.fallback(context);
}
