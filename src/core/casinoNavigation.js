// Matches the authoritative casino-only walking surface in casino_navigation.go.
// This does not introduce general platform physics or another instance system.
export function inCasinoVenue(x, z) {
    return x >= -14 && x <= 14 && z >= 161 && z <= 179;
}

export function constrainCasinoWalk(old, target) {
    if (!Number.isFinite(target.x) || !Number.isFinite(target.z)) return { x: old.x, y: old.y, z: old.z };
    if (!inCasinoVenue(old.x, old.z) && !inCasinoVenue(target.x, target.z)) return { x: target.x, y: 0, z: target.z };
    let { x: px, y: py, z: pz } = old;
    if (!inCasinoVenue(old.x, old.z)) py = 0;
    const steps = Math.max(1, Math.ceil(Math.hypot(target.x - old.x, target.z - old.z) / .25));
    if (steps > 800) return { x: old.x, y: old.y, z: old.z };
    for (let i = 1; i <= steps; i++) {
        const nx = old.x + (target.x - old.x) * i / steps, nz = old.z + (target.z - old.z) * i / steps;
        let ny = 0;
        const ramp = nx >= 9.2 && nx <= 11.8 && nz > 164 && nz < 176;
        const onRamp = px >= 9.2 && px <= 11.8 && pz > 164 && pz < 176 && py > 0 && py < 6;
        if (onRamp) {
            if (ramp) ny = (176 - nz) / 2;
            else if (nx >= 9.2 && nx <= 11.8 && nz >= 176 && nz <= 177.1) ny = 0;
            else if (nx >= 9.2 && nx <= 11.8 && nz <= 164 && nz >= 162.9) ny = 6;
            else break;
        } else if (py >= 5.99) {
            if (nx < -12.1 || nx > 11.8 || nz < 162.9 || nz > 177.1) break;
            ny = 6;
            if (nx > 8.5 && nz > 164) {
                if (ramp && pz <= 164) ny = (176 - nz) / 2;
                else break;
            }
        } else if (ramp) {
            if (pz < 176) break;
            ny = (176 - nz) / 2;
        }
        px = nx; py = ny; pz = nz;
    }
    return { x: px, y: py, z: pz };
}
