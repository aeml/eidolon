// Public cast-time potency: never infer another actor's private talent ranks.
// Float32 wire values need a small boundary tolerance (1.2 rounds upward).
export function readClericUtilityScalar(payload, key, current, baseline = 1, maximum = 1.2) {
    const value = Number(payload[key] !== undefined ? payload[key] : current);
    const minimum = baseline === 1 ? 1 : Number.MIN_VALUE;
    if (!Number.isFinite(value) || value <= 0 || value < minimum - 1e-6 || value > maximum + 1e-6) return baseline;
    return Math.max(minimum, Math.min(maximum, value));
}
