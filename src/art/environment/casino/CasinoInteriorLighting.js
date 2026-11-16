// The shared gaming hall is an interior, independent of its allocation in the
// overworld. Reuse the existing key/fill lights; sconces need no extra lights.
export const CASINO_INTERIOR_LIGHTING = Object.freeze({
    ambientIntensity: .82,
    keyIntensity: 3.05,
    keyColor: 0xffdfb5,
    fillColor: 0x9aabc5,
    fillIntensity: .34,
    fogColor: 0x17212d,
    fogNear: 260,
    fogFar: 700,
    exposure: 1.18,
    bloomStrength: .2,
    bloomRadius: .28,
    bloomThreshold: .82
});
