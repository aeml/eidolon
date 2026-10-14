// Resolve rune choices at paid admission; travelling attacks retain their plan.
const choices = Object.freeze({
    "guardianroar_rally": {
        "skill": "Guardian Roar",
        "radius": 1.6,
        "duration": 0.6
    },
    "guardianroar_vigil": {
        "skill": "Guardian Roar",
        "radius": 0.6,
        "duration": 1.5
    },
    "guardianroar_cadence": {
        "skill": "Guardian Roar",
        "cooldown": 0.65,
        "duration": 0.6
    },
    "sweepingstrike_wide": {
        "skill": "Sweeping Strike",
        "radius": 1.4,
        "damage": 0.8
    },
    "sweepingstrike_close": {
        "skill": "Sweeping Strike",
        "radius": 0.75,
        "damage": 1.3
    },
    "sweepingstrike_quick": {
        "skill": "Sweeping Strike",
        "cooldown": 0.65,
        "damage": 0.75
    },
    "grip_harpoon": {
        "skill": "Unbreakable Grip",
        "reach": 1.5,
        "damage": 0.75
    },
    "grip_binding": {
        "skill": "Unbreakable Grip",
        "root": 3,
        "damage": 0.7
    },
    "grip_impact": {
        "skill": "Unbreakable Grip",
        "damage": 1.4,
        "root": 0,
        "pull": false
    },
    "juggernaut_avalanche": {
        "skill": "Juggernaut Charge",
        "radius": 1.5,
        "damage": 0.75
    },
    "juggernaut_rush": {
        "skill": "Juggernaut Charge",
        "reach": 1.5,
        "radius": 0.75
    },
    "juggernaut_breach": {
        "skill": "Juggernaut Charge",
        "damage": 1.4,
        "slow": 0
    },
    "berserker_rally": {
        "skill": "Berserker Edge",
        "radius": 1.5,
        "duration": 0.6666666666666666
    },
    "berserker_solitary": {
        "skill": "Berserker Edge",
        "share": false,
        "duration": 1.3333333333333333
    },
    "berserker_cadence": {
        "skill": "Berserker Edge",
        "cooldown": 0.5,
        "duration": 0.5333333333333333
    },
    "shattering_lasting": {
        "skill": "Shattering Charge",
        "duration": 2,
        "damage": 0.7
    },
    "shattering_shock": {
        "skill": "Shattering Charge",
        "radius": 1.4,
        "damage": 0.7
    },
    "shattering_quick": {
        "skill": "Shattering Charge",
        "cooldown": 0.65,
        "radius": 0.7
    },
    "executionerspin_wide": {
        "skill": "Executioner Spin",
        "radius": 1.5,
        "damage": 0.75
    },
    "executionerspin_marked": {
        "skill": "Executioner Spin",
        "marked": 2,
        "damage": 0.8
    },
    "executionerspin_quick": {
        "skill": "Executioner Spin",
        "cooldown": 0.65,
        "damage": 0.7
    },
    "rampage_endurance": {
        "skill": "Last Stand Rampage",
        "duration": 1.5,
        "cooldown": 1.5
    },
    "rampage_burst": {
        "skill": "Last Stand Rampage",
        "duration": 0.6,
        "cooldown": 0.6
    },
    "rampage_reprise": {
        "skill": "Last Stand Rampage",
        "duration": 0.5,
        "resetShattering": true
    }
});

export function getFighterBranchPlan(skill, rune) {
    const base = {"damage": 1, "radius": 1, "reach": 1, "cooldown": 1, "duration": 1, "root": 1, "slow": 0.6, "marked": 1.5, "pull": true, "share": true, "resetShattering": false};
    const choice = choices[rune];
    return choice?.skill === skill ? { ...base, ...choice } : base;
}
