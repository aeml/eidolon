// Warning audio follows the screen's horizontal axis, not world compass east.
// Hearing distance is measured from the dangerous area, so a large field that
// reaches the listener remains audible even when its centre is far away.
export function dangerAudioOptions(source, listener, camera, radius = 0) {
    if (![source?.x, source?.z, listener?.x, listener?.z].every(Number.isFinite)) return null;
    const dx = source.x - listener.x, dz = source.z - listener.z;
    const distance = Math.hypot(dx, dz);
    const reach = Number.isFinite(radius) ? Math.max(0, radius) : 0;
    const edgeDistance = Math.max(0, distance - reach);
    if (edgeDistance >= 60) return null;
    const axis = camera?.matrixWorld?.elements;
    const rightX = axis?.[0], rightZ = axis?.[2];
    const axisLength = Math.hypot(rightX, rightZ);
    const horizontal = Number.isFinite(axisLength) && axisLength > .001
        ? (dx * rightX + dz * rightZ) / axisLength : 0;
    return {
        pan: Math.max(-.8, Math.min(.8, horizontal / Math.max(10, distance))),
        gain: (1 - edgeDistance / 60) ** 2
    };
}
