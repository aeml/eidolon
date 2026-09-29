import { getAbilityPresentation } from '../skills/abilityVisualManifest.js';

const tone = (frequency, endFrequency, duration, gain, type = 'triangle', delay = 0) =>
    Object.freeze({ frequency, endFrequency, duration, gain, type, delay });
const profile = (...tones) => Object.freeze(tones);

// Original synthesized accents. Short envelopes distinguish actions without
// stacking sustained chords over enemy warnings or pretending to be impact hits.
export const ABILITY_CAST_PROFILES = Object.freeze({
    steel: profile(tone(680, 160, .11, .05), tone(190, 90, .09, .045, 'sine', .025)),
    guard: profile(tone(125, 75, .18, .075, 'sine'), tone(420, 310, .08, .025, 'triangle', .04)),
    force: profile(tone(180, 55, .23, .07), tone(85, 60, .17, .035, 'sine', .05)),
    blade: profile(tone(1350, 240, .085, .045), tone(760, 380, .045, .02, 'sine', .035)),
    shadow: profile(tone(220, 70, .19, .045, 'sine'), tone(520, 160, .14, .025, 'triangle', .025)),
    trap: profile(tone(920, 680, .035, .035), tone(390, 220, .05, .035, 'triangle', .065)),
    fire: profile(tone(150, 530, .16, .06, 'sawtooth'), tone(100, 55, .18, .04, 'sine', .03)),
    arcane: profile(tone(320, 960, .18, .06, 'sine'), tone(640, 1280, .13, .025, 'sine', .04)),
    gravity: profile(tone(240, 45, .28, .065, 'sine'), tone(360, 90, .22, .025, 'triangle', .03)),
    time: profile(tone(660, 330, .07, .035, 'sine'), tone(330, 990, .14, .045, 'sine', .09)),
    frost: profile(tone(1800, 1100, .055, .025, 'sine'), tone(1250, 760, .1, .035, 'triangle', .025)),
    healing: profile(tone(392, 523, .18, .045, 'sine'), tone(659, 784, .2, .035, 'sine', .055)),
    radiant: profile(tone(260, 520, .11, .05), tone(1046, 784, .14, .025, 'sine', .03)),
    summon: profile(tone(196, 392, .22, .045, 'sine'), tone(587, 784, .22, .03, 'sine', .07))
});

export function getAbilityCastProfile(className, skillName) {
    const presentation = getAbilityPresentation(className, skillName);
    if (!presentation) return null;
    const name = presentation.canonicalName;
    switch (className) {
        case 'Fighter':
            if (['Shield Slam', 'Iron Fortress', 'Unbreakable Grip'].includes(name)) return 'guard';
            return ['heavy', 'shout', 'charge'].includes(presentation.animation) ? 'force' : 'steel';
        case 'Rogue':
            if (['Tripwire', 'Poison Coating', 'Weak Point Mark'].includes(name)) return 'trap';
            return ['Shadow Lunge', 'Cloak & Vanish', 'Smoke Bomb', 'Phantom Volley'].includes(name) ? 'shadow' : 'blade';
        case 'Wizard':
            // Frost Nova retains its icy alias override, not Flame Whip's fire.
            if (skillName === 'Frost Nova' || skillName === 'Ice Barrier') return 'frost';
            if (['Teleport', 'Time Warp'].includes(name)) return 'time';
            if (name === 'Gravity Well') return 'gravity';
            return ['Fireball', 'Flame Whip', 'Flame Tornado', 'Meteor Drop', 'Inferno Cataclysm', 'Scorch Beam', 'Dragonfire Lance'].includes(name)
                ? 'fire' : 'arcane';
        case 'Cleric':
            if (['summon', 'persistent-aura'].includes(presentation.category)) return 'summon';
            return ['Radiant Strike', 'Mark of Weakness', "Heaven's Trumpet"].includes(name) ? 'radiant' : 'healing';
        default: return null;
    }
}
