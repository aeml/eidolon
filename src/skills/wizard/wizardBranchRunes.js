// Resolve at cast admission. Later equipment/rune changes cannot alter paid effects.
export function getWizardBranchPlan(skill, rune) {
    const p = { damage: 1, radius: 1, cooldown: 1, stun: 3, speed: 10,
        duration: 8, resetTeleport: true, resetGravity: true };
    if (skill === 'Flame Whip') {
        if (rune === 'flamewhip_reach') { p.radius = 1.5; p.damage = .75; }
        if (rune === 'flamewhip_binding') { p.stun = 5; p.damage = .65; }
        if (rune === 'flamewhip_flash') { p.cooldown = .6; p.stun = 1; p.damage = .8; }
    } else if (skill === 'Flame Tornado') {
        if (rune === 'flametornado_broad') { p.radius = 1.5; p.speed = 6; p.damage = .75; }
        if (rune === 'flametornado_swift') { p.radius = 2 / 3; p.speed = 18; }
        if (rune === 'flametornado_focused') { p.radius = .5; p.damage = 1.4; }
    } else if (skill === 'Inferno Cataclysm') {
        if (rune === 'inferno_lingering') { p.duration = 12; p.damage = .65; }
        if (rune === 'inferno_concentrated') { p.radius = .65; p.damage = 1.4; }
        if (rune === 'inferno_flashburn') { p.duration = 4; p.damage = 1.5; p.cooldown = 2 / 3; }
    } else if (skill === 'Time Warp') {
        if (rune === 'timewarp_communion') { p.radius = 1.6; p.duration = 6; }
        if (rune === 'timewarp_lingering') { p.duration = 12; p.resetTeleport = p.resetGravity = false; }
        if (rune === 'timewarp_quickening') { p.duration = 5; p.cooldown = 2 / 3; p.resetGravity = false; }
    }
    return p;
}
