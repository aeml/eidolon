// Paid casts snapshot this plan. Talents, Focus, recipient defenses and
// collision checks remain at their existing boundaries.
export function getWizardPrecisionPlan(skill, rune, barrage = false) {
    const plan = { damage: 1, range: 1, radius: 1, speed: 40, cooldown: 1,
        slow: .3, slowDuration: 3, missiles: barrage ? 5 : 3, homing: true, pierce: false };
    if (skill === 'Scorch Beam') {
        if (rune === 'scorchbeam_longshot') { plan.range = 1.5; plan.damage = .8; }
        if (rune === 'scorchbeam_incision') { plan.damage = 1.25; plan.slow = 0; }
        if (rune === 'scorchbeam_snare') { plan.damage = .75; plan.slow = .5; plan.slowDuration = 5; }
    } else if (skill === 'Arcane Missiles') {
        plan.speed = 25;
        if (rune === 'arcanemissiles_salvo') { plan.missiles += 2; plan.damage = .6; }
        if (rune === 'arcanemissiles_compression') { plan.missiles--; plan.damage = 1.4; }
        if (rune === 'arcanemissiles_convergence') { plan.homing = false; plan.speed = 40; plan.damage = 1.2; }
    } else if (skill === 'Dragonfire Lance') {
        if (rune === 'dragonfire_needle') { plan.radius = .5; plan.damage = 1.25; }
        if (rune === 'dragonfire_broadside') { plan.radius = 2.5; plan.damage = .75; plan.pierce = true; }
        if (rune === 'dragonfire_quickfire') { plan.damage = .65; plan.cooldown = .6; plan.speed = 60; }
    }
    return plan;
}
