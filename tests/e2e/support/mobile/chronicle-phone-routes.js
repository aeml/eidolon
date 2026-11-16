// Ordinary walking waypoints. Realm fences are crossed through their actual
// gates; these positions are destinations for the joystick, never assignments.
export const chroniclePhoneRoutes = {
    earth: [[0, 230], [55, 230], [80, 200], [125, 200]],
    water: [[0, 230], [55, 230], [80, 200], [125, 200], [145, -200], [145, -550], [0, -575], [0, -625]],
    fire: [[0, 230], [-55, 230], [-80, 200], [-125, 200], [-500, 200], [-900, 200], [-1030, 200], [-1130, 245]],
    // The direct (500,200) → (900,200) leg crossed the solid Bastion entrance
    // centered at (800,200). Walk north around its actual footprint, then
    // return to the realm fence's opening. Do not jump or disable collision.
    air: [[0, 230], [55, 230], [80, 200], [125, 200], [500, 200], [700, 130],
        [900, 130], [950, 200], [1030, 200], [1110, 245]]
};
