// Walking waypoints, never a teleport or camera override. Chords stay outside
// the landmark and end on its far side for a real orthographic occlusion check.
export function entranceInspectionPath(definition) {
    const [x, , z] = definition.position;
    const radius = Math.max(50, definition.interactionRadius + 12);
    return Array.from({ length: 7 }, (_, index) => {
        // The lower remodeled Bastion no longer hides a hero at225 degrees.
        // End behind its west tower at210 degrees, retaining the same radius,
        // seven ordinary walking points and clear collision chords.
        const angle = Math.PI / 2 + index * Math.PI / 9;
        return { x: x + radius * Math.cos(angle), z: z + radius * Math.sin(angle) };
    });
}
