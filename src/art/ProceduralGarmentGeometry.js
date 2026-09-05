import * as THREE from 'three';

/** Five tailored rings: waist, abdomen, ribcage, shoulder and neckline.
 * The open neckline avoids the broad flat lid of a tapered cylinder. Callers
 * own caching so the same garment can be shared by local and remote actors.
 */
export function createTailoredTorsoGeometry(waist, chest, height, neck = chest * 0.4) {
    const profile = [
        [waist, -height * 0.5],
        [waist * 0.96, -height * 0.27],
        [chest, height * 0.12],
        [chest * 0.94, height * 0.34],
        [neck, height * 0.5]
    ];
    return new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 12);
}

/** Two separate inlaid eyes in one draw call; not a luminous visor bar. */
export function createPairedEyesGeometry(width, height, separation) {
    const shapes = [-1, 1].map((side) => {
        const x = side * separation / 2;
        const shape = new THREE.Shape();
        shape.moveTo(x - width / 2, 0);
        shape.lineTo(x, height / 2);
        shape.lineTo(x + width / 2, 0);
        shape.lineTo(x, -height / 2);
        shape.closePath();
        return shape;
    });
    return new THREE.ShapeGeometry(shapes);
}

export function createOpenHoodGeometry() {
    return new THREE.LatheGeometry(
        [[0.42, -0.12], [0.44, 0.25], [0.33, 0.52], [0.08, 0.68], [0, 0.7]]
            .map(([radius, y]) => new THREE.Vector2(radius, y)),
        12, 0.72, Math.PI * 2 - 1.44
    );
}
