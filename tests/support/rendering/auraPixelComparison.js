// Compare only RGB changes against the same no-aura scene. Alpha is opaque
// background coverage, not a measure of emitted aura detail.
export function compareAuraPixels(batched, reference, baseline) {
    if (!batched?.length || batched.length % 4 || batched.length !== reference?.length ||
        batched.length !== baseline?.length) throw new Error('Matching nonempty RGBA frames are required');
    let referenceSignal = 0, absoluteDifference = 0, changedPixels = 0;
    for (let pixel = 0; pixel < batched.length; pixel += 4) {
        let changed = false;
        for (let channel = 0; channel < 3; channel++) {
            referenceSignal += Math.abs(reference[pixel + channel] - baseline[pixel + channel]);
            const difference = Math.abs(batched[pixel + channel] - reference[pixel + channel]);
            absoluteDifference += difference;
            changed ||= difference > 0;
        }
        if (changed) changedPixels++;
    }
    return { referenceSignal, absoluteDifference, changedPixels,
        relativeError: referenceSignal > 0 ? absoluteDifference / referenceSignal : Infinity };
}
