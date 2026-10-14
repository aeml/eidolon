// Paid casts capture travelling rune effects before emission.
const choices = Object.freeze({
    "weakpoint_lasting": {
        "skill": "Weak Point Mark",
        "duration": 1.5,
        "cooldown": 1.25
    },
    "weakpoint_distant": {
        "skill": "Weak Point Mark",
        "reach": 1.5,
        "duration": 0.6
    },
    "weakpoint_fleeting": {
        "skill": "Weak Point Mark",
        "cooldown": 0.6,
        "duration": 0.6
    },
    "deathspiral_wide": {
        "skill": "Death Spiral",
        "radius": 1.5,
        "damage": 0.75
    },
    "deathspiral_ruthless": {
        "skill": "Death Spiral",
        "damage": 1.3,
        "radius": 0.7
    },
    "deathspiral_quick": {
        "skill": "Death Spiral",
        "cooldown": 0.6,
        "damage": 0.7
    },
    "serratededges_lasting": {
        "skill": "Serrated Edges",
        "duration": 1.5,
        "cooldown": 1.5
    },
    "serratededges_rapid": {
        "skill": "Serrated Edges",
        "cooldown": 0.6,
        "duration": 0.6
    },
    "serratededges_reprise": {
        "skill": "Serrated Edges",
        "duration": 0.5,
        "resetFan": true
    },
    "bladestorm_focused": {
        "skill": "Blade Storm",
        "spread": 0.5,
        "damage": 1.25
    },
    "bladestorm_broad": {
        "skill": "Blade Storm",
        "spread": 1.5,
        "damage": 0.8
    },
    "bladestorm_long": {
        "skill": "Blade Storm",
        "radius": 1.5,
        "damage": 0.75
    },
    "phantomvolley_barrage": {
        "skill": "Phantom Volley",
        "count": 5,
        "damage": 0.65
    },
    "phantomvolley_burst": {
        "skill": "Phantom Volley",
        "spacing": 0.075,
        "cooldown": 1.2
    },
    "phantomvolley_piercing": {
        "skill": "Phantom Volley",
        "pierce": true,
        "damage": 0.6
    },
    "poisoncoating_lasting": {
        "skill": "Poison Coating",
        "duration": 1.6,
        "cooldown": 1.3
    },
    "poisoncoating_rapid": {
        "skill": "Poison Coating",
        "cooldown": 0.6,
        "duration": 0.6
    },
    "poisoncoating_rearm": {
        "skill": "Poison Coating",
        "duration": 0.5,
        "resetTripwire": true
    },
    "smokebomb_wide": {
        "skill": "Smoke Bomb",
        "radius": 1.5,
        "duration": 0.6
    },
    "smokebomb_choking": {
        "skill": "Smoke Bomb",
        "accuracy": 0.5,
        "slow": 0.25
    },
    "smokebomb_dense": {
        "skill": "Smoke Bomb",
        "slow": 0.7,
        "radius": 0.65
    },
    "tripwire_distant": {
        "skill": "Tripwire",
        "reach": 1.5,
        "damage": 0.7
    },
    "tripwire_grasp": {
        "skill": "Tripwire",
        "root": 5,
        "damage": 0.65
    },
    "tripwire_quick": {
        "skill": "Tripwire",
        "cooldown": 0.6,
        "root": 1.5,
        "damage": 0.8
    }
});

export function getRogueBranchPlan(skill, rune) {
    const base = {"damage": 1, "radius": 1, "reach": 1, "cooldown": 1, "duration": 1, "spread": 1, "root": 3, "slow": 0.5, "accuracy": 0.3, "spacing": 0.15, "count": 3, "pierce": false, "resetFan": false, "resetTripwire": false};
    const choice = choices[rune];
    return choice?.skill === skill ? { ...base, ...choice } : base;
}
