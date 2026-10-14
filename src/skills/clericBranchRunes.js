// Persistent auras capture their branch rune at the paid cast.
const choices = Object.freeze({
    "embrace_wide": {
        "skill": "Guardian Embrace",
        "radius": 1.5,
        "healing": 0.75
    },
    "embrace_shelter": {
        "skill": "Guardian Embrace",
        "duration": 1.5,
        "radius": 0.7
    },
    "embrace_quick": {
        "skill": "Guardian Embrace",
        "cooldown": 0.6,
        "duration": 0.6
    },
    "purifyingwave_wide": {
        "skill": "Purifying Wave",
        "radius": 1.5,
        "damage": 0.7
    },
    "purifyingwave_binding": {
        "skill": "Purifying Wave",
        "slowDuration": 4,
        "damage": 0.7
    },
    "purifyingwave_quick": {
        "skill": "Purifying Wave",
        "cooldown": 0.6,
        "radius": 0.7
    },
    "spiritboost_wide": {
        "skill": "Spirit Guardians Boost",
        "radius": 1.5,
        "damage": 0.75
    },
    "spiritboost_wrath": {
        "skill": "Spirit Guardians Boost",
        "damage": 1.3,
        "slow": 0
    },
    "spiritboost_lasting": {
        "skill": "Spirit Guardians Boost",
        "duration": 1.5,
        "cooldown": 1.5
    },
    "seraph_vigil": {
        "skill": "Avenging Seraph",
        "duration": 1.5,
        "damage": 0.75
    },
    "seraph_wrath": {
        "skill": "Avenging Seraph",
        "damage": 1.4,
        "duration": 0.6666666666666666
    },
    "seraph_guardian": {
        "skill": "Avenging Seraph",
        "health": 1.5,
        "damage": 0.8
    },
    "resolve_rally": {
        "skill": "Blessing of Resolve",
        "radius": 1.5,
        "duration": 0.6
    },
    "resolve_lasting": {
        "skill": "Blessing of Resolve",
        "duration": 1.5,
        "radius": 0.6
    },
    "resolve_quick": {
        "skill": "Blessing of Resolve",
        "cooldown": 0.6,
        "duration": 0.6
    },
    "zeal_rally": {
        "skill": "Blessing of Zeal",
        "radius": 1.5,
        "duration": 0.625
    },
    "zeal_lasting": {
        "skill": "Blessing of Zeal",
        "duration": 1.5,
        "radius": 0.6
    },
    "zeal_quick": {
        "skill": "Blessing of Zeal",
        "cooldown": 0.6,
        "duration": 0.625
    },
    "weakness_distant": {
        "skill": "Mark of Weakness",
        "reach": 1.5,
        "duration": 0.6
    },
    "weakness_lasting": {
        "skill": "Mark of Weakness",
        "duration": 1.5,
        "cooldown": 1.3
    },
    "weakness_quick": {
        "skill": "Mark of Weakness",
        "cooldown": 0.6,
        "duration": 0.6
    },
    "trumpet_wide": {
        "skill": "Heaven's Trumpet",
        "radius": 1.5,
        "damage": 0.7
    },
    "trumpet_binding": {
        "skill": "Heaven's Trumpet",
        "stun": 5,
        "damage": 0.7
    },
    "trumpet_quick": {
        "skill": "Heaven's Trumpet",
        "cooldown": 0.6,
        "stun": 1.5,
        "duration": 0.6
    }
});

export function getClericBranchPlan(skill, rune) {
    const base = {"damage": 1, "healing": 1, "health": 1, "radius": 1, "reach": 1, "cooldown": 1, "duration": 1, "slow": 0.3, "slowDuration": 2, "stun": 3};
    const choice = choices[rune];
    return choice?.skill === skill ? { ...base, ...choice } : base;
}
