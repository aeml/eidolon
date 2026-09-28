import * as THREE from 'three';

// Site-owned geometry; no global caches, textures, collider or gameplay changes.
export function createTaperedRoot(points, radius, quality = 'high') {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    const segments = quality === 'low' ? 12 : 24, radial = quality === 'low' ? 6 : 10;
    const geometry = new THREE.TubeGeometry(curve, segments, radius, radial, false);
    const position = geometry.attributes.position, center = new THREE.Vector3(), vertex = new THREE.Vector3();
    for (let ring = 0; ring <= segments; ring++) {
        const t = ring / segments;
        curve.getPointAt(t, center);
        const taper = .035 + .965 * Math.pow(1 - t, .8);
        for (let side = 0; side <= radial; side++) {
            const index = ring * (radial + 1) + side;
            const rib = 1 + .055 * Math.sin(side / radial * Math.PI * 10 + t * 4) * Math.sin(t * Math.PI);
            vertex.fromBufferAttribute(position, index).sub(center).multiplyScalar(taper * rib).add(center);
            position.setXYZ(index, vertex.x, vertex.y, vertex.z);
        }
    }
    geometry.computeVertexNormals();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}

export function createGroveArchStone(index, count = 13) {
    const a = index / count * Math.PI + .005, b = (index + 1) / count * Math.PI - .005;
    const inner = 6.5, outer = 9.5 + (index === Math.floor(count / 2) ? .24 : 0);
    const shape = new THREE.Shape();
    shape.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    shape.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    shape.lineTo(Math.cos(b) * outer, Math.sin(b) * outer);
    shape.lineTo(Math.cos(b) * inner, Math.sin(b) * inner);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 3.72, steps: 1,
        bevelEnabled: true, bevelThickness: .10, bevelSize: .06, bevelSegments: 1, curveSegments: 1 });
    // A low segmental vault keeps the complete landmark readable at the actual
    // gameplay camera, rather than pushing its crown off the desktop view.
    geometry.scale(1, .55, 1);
    geometry.translate(0, 8, -1.86);
    return geometry;
}

export function createGrovePierCourse(index) {
    const shape = new THREE.Shape();
    shape.moveTo(-1.42, 0); shape.lineTo(1.42, 0);
    shape.lineTo(1.42, 1.2); shape.lineTo(-1.42, 1.2); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 3.78, steps: 1,
        bevelEnabled: true, bevelThickness: .10, bevelSize: .06, bevelSegments: 1, curveSegments: 1 });
    geometry.translate(index % 2 ? .01 : -.01, index * (8 / 6) + .06, -1.89);
    return geometry;
}
