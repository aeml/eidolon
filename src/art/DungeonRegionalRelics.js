import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTaperedRoot } from './EarthLandmarkGeometry.js';

const TYPES = new Set(['molten_core', 'tempest_spire', 'abyssal_well', 'umbral_nexus']);

// Kit-owned physical silhouettes. Body/ironwork/light channels use the existing
// materials and production batching. No new lights, textures or animation clock.
export function createDungeonRegionalRelics(type, quality = 'high') {
    if (!TYPES.has(type)) throw new Error(`Unknown dungeon relic: ${type}`);
    const low = quality === 'low', radial = low ? 10 : 16;
    const parts = { body: [], metal: [], glow: [] };
    const add = (role, geometry, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) => {
        const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...position),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
        const value = geometry.index ? geometry.toNonIndexed() : geometry;
        if (value !== geometry) geometry.dispose();
        value.clearGroups(); value.applyMatrix4(matrix); parts[role].push(value);
    };
    const turned = profile => new THREE.LatheGeometry(profile.map(point => new THREE.Vector2(...point)), radial);
    const band = (radius, tube = .035) => new THREE.TorusGeometry(radius, tube, 4, radial);
    const plate = (outline, thickness) => {
        const shape = new THREE.Shape(outline.map(point => new THREE.Vector2(...point)));
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, steps: 1,
            bevelEnabled: true, bevelSize: .035, bevelThickness: .025, bevelSegments: 1, curveSegments: 1 });
        geometry.rotateX(-Math.PI / 2); return geometry;
    };
    const wire = points => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))),
        low ? 6 : 10, .035, 4, false);

    if (type === 'molten_core') {
        // A continuous foot, heavy bowl and hollow rolled rim hold a small coal
        // bed. Magic belongs inside the vessel rather than lighting its body.
        add('body', turned([[0, .11], [.64, .11], [.82, .2], [.83, .32], [.73, .98],
            [.84, 1.03], [.84, 1.14], [.68, 1.14], [.61, .98], [.5, .47], [0, .36]]));
        add('metal', band(.78), [0, .94, 0], [Math.PI / 2, 0, 0]);
        add('metal', band(.77), [0, .37, 0], [Math.PI / 2, 0, 0]);
        for (let i = 0; i < 3; i++) {
            const angle = i * Math.PI * 2 / 3;
            const point = (r, y) => [Math.cos(angle) * r, y, Math.sin(angle) * r];
            add('metal', wire([point(.8, .25), point(.85, .55), point(.8, .9), point(.74, 1.05)]));
            add('glow', new THREE.DodecahedronGeometry(.23, 0), point(.28, .91), [0, angle, .2], [1, .45, 1]);
        }
    } else if (type === 'tempest_spire') {
        // Broken wind-scoured slate is held in a forged conductor cradle.
        // The upper split remains open; no bright filled disc hides the stone.
        add('body', plate([[-1.1, -.64], [.77, -.72], [1.12, -.28], [.94, .64], [-.88, .71]], .12), [0, .11, 0]);
        add('body', plate([[-1.3, -.75], [.2, -.82], [.07, -.12], [.42, .65], [-1.05, .75]], .14),
            [0, 1.28, 0], [.1, -.1, -.08]);
        add('body', plate([[.38, -.82], [1.28, -.6], [1.18, .51], [.62, .77], [.25, -.04]], .14),
            [.08, 1.38, .04], [.08, .1, .1]);
        for (const side of [-1, 1]) {
            add('metal', wire([[side * .62, .22, -.42], [side * .88, .7, -.35], [side * 1.02, 1.4, -.15], [side * .7, 1.64, .25]]));
            add('metal', wire([[side * .62, .22, .42], [side * .88, .7, .35], [side * 1.02, 1.4, .15]]));
        }
        add('glow', wire([[.13, 1.5, -.68], [.1, 1.52, -.15], [.29, 1.51, .2], [.39, 1.5, .61]]));
    } else if (type === 'abyssal_well') {
        // Branches have shared roots and tapered organic tips. Restrained pearl
        // buds punctuate pale mineral coral instead of an all-emissive cone.
        add('body', plate([[-.75, -.48], [.44, -.62], [.81, -.14], [.61, .53], [-.61, .48]], .12), [0, .11, 0]);
        const branches = [
            [.23, [[0, .18, 0], [-.08, .66, .03], [.09, 1.22, -.06], [-.1, 1.94, .02]]],
            [.12, [[-.03, .64, 0], [-.4, .91, .02], [-.66, 1.37, .1], [-.58, 1.65, .06]]],
            [.1, [[.04, 1.02, -.02], [.37, 1.2, -.03], [.6, 1.55, -.09], [.52, 1.83, -.12]]],
            [.085, [[-.36, .92, .02], [-.4, 1.2, -.2], [-.28, 1.46, -.28]]],
            [.08, [[.35, 1.2, -.03], [.42, 1.38, .3], [.3, 1.61, .36]]]
        ];
        for (const [radius, points] of branches) add('body', createTaperedRoot(points, radius, quality));
        for (const position of [[-.1, 1.94, .02], [-.58, 1.65, .06], [.52, 1.83, -.12]])
            add('glow', new THREE.SphereGeometry(.085, low ? 6 : 10, low ? 4 : 6), position);
        add('metal', band(.45, .025), [0, .22, 0], [Math.PI / 2, 0, 0]);
    } else {
        // Three broken monolith courses surround a narrow memory fracture.
        // Opaque stone still carries the silhouette against regional bloom.
        for (const [x, y, z, sx, sy, sz, lean] of [[-.25, .11, 0, .68, 2.9, .63, -.13],
            [.48, .11, .1, .52, 1.72, .61, .18], [-.7, .11, .19, .35, .74, .46, -.3]]) {
            const shape = new THREE.Shape([[-.48, 0], [.45, 0], [.44, .78], [.07, 1], [-.45, .9]].map(p => new THREE.Vector2(...p)));
            const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, steps: 1,
                bevelEnabled: true, bevelSize: .03, bevelThickness: .02, bevelSegments: 1, curveSegments: 1 });
            geometry.translate(0, 0, -.5); add('body', geometry, [x, y, z], [0, .14, lean], [sx, sy, sz]);
        }
        add('metal', wire([[-.73, .17, .48], [-.42, .4, .43], [.02, .4, .45], [.53, .2, .5]]));
        const fracture = new THREE.Shape([[-.035, .4], [.065, .9], [.025, 1.4], [.12, 1.82], [.14, 2.11],
            [.04, 1.8], [-.07, 1.38], [-.035, .9]].map(p => new THREE.Vector2(...p)));
        add('glow', new THREE.ShapeGeometry(fracture), [.02, 0, .39], [0, -.08, 0]);
    }

    return Object.fromEntries(Object.entries(parts).map(([role, values]) => {
        const geometry = mergeGeometries(values, false); values.forEach(value => value.dispose());
        geometry.clearGroups(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        geometry.userData.dungeonRegionalRelic = { type, role, quality: low ? 'low' : 'high', visualOnly: true };
        return [role, geometry];
    }));
}
