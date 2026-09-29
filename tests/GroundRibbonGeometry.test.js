import * as THREE from 'three';
import { createWorldPathGeometry } from '../src/art/ProceduralWorldPaths.js';
import { EARTH_ELEVATION as field } from '../src/data/worldElevation.js';
import { EARTH_PATHS } from '../src/data/worldPopulation.js';

function triangles(geometry) {
    const p = geometry.attributes.position, uv = geometry.attributes.uv, result = [];
    for (let i = 0; i < (geometry.index?.count ?? p.count); i += 3) {
        const ids = [0, 1, 2].map(j => geometry.index ? geometry.index.getX(i + j) : i + j);
        result.push({ points: ids.map(j => new THREE.Vector3().fromBufferAttribute(p, j)),
            uv: ids.map(j => new THREE.Vector2().fromBufferAttribute(uv, j)) });
    }
    return result;
}
const area = tri => {
    const [a, b, c] = tri.points;
    return ((b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z)) / 2;
};

test.each([...EARTH_PATHS, { id: 'diagonal-hill', width: 9, points: [[-615, 390], [-550, 430], [-498, 480]] },
    { id: 'outside-realm', width: 8, points: [[2200, 1700], [2310, 1730]] }])('$id follows terrain triangles without changing footprint or UV mapping', path => {
    const flat = createWorldPathGeometry(path), raised = createWorldPathGeometry(path, { elevation: field });
    const before = triangles(flat), after = triangles(raised);
    expect(after.length).toBeGreaterThan(0);
    const beforeArea = before.reduce((sum, tri) => sum + area(tri), 0);
    const afterArea = after.reduce((sum, tri) => sum + area(tri), 0);
    expect(Math.abs(beforeArea - afterArea) / beforeArea).toBeLessThan(1e-5);
    for (const tri of after) {
        expect(area(tri)).toBeGreaterThan(0);
        for (const weights of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [.2, .3, .5], [1/3, 1/3, 1/3]]) {
            const p = new THREE.Vector3();
            tri.points.forEach((point, i) => p.addScaledVector(point, weights[i]));
            expect(Math.abs(p.y - field.sample(p.x, p.z) - .035)).toBeLessThan(.000025);
        }
        const center = tri.points.reduce((v, p) => v.add(p), new THREE.Vector3()).divideScalar(3);
        const uv = tri.uv.reduce((v, p) => v.add(p), new THREE.Vector2()).divideScalar(3);
        const planar = center.clone().setY(before[0].points[0].y);
        const source = before.find(t => THREE.Triangle.containsPoint(planar, ...t.points));
        expect(source).toBeDefined();
        const bary = THREE.Triangle.getBarycoord(planar, ...source.points, new THREE.Vector3());
        const expectedUV = source.uv.reduce((v, p, i) => v.addScaledVector(p, bary.getComponent(i)), new THREE.Vector2());
        expect(uv.distanceTo(expectedUV)).toBeLessThan(.00005);
    }
    flat.dispose(); raised.dispose();
});
