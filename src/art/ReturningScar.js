import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyWorldSurfaceDetail } from './WorldSurfaceDetail.js';
import { createTaperedRoot } from './EarthLandmarkGeometry.js';

// An irregular standing slab, not a sphere painted with masonry joints.
// Geometry and materials are site-owned, with no texture or resource cache.
export function createScarStandingStone(seed, width = 1.4, height = 2.7, depth = 1.3) {
    const w = width / 2, bevel = .035;
    const shape = new THREE.Shape();
    shape.moveTo(-w + .06, bevel); shape.lineTo(w - .07, bevel);
    shape.lineTo(w - .02, height * .51); shape.lineTo(w * .68, height * .91);
    shape.lineTo(w * .14, height - bevel); shape.lineTo(-w * .69, height * (.85 + seed % 3 * .025));
    shape.lineTo(-w + .04, height * .47); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: depth - bevel * 2,
        bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
        bevelSegments: 1, curveSegments: 1, steps: 1 });
    geometry.translate(0, 0, -depth / 2 + bevel);
    const p = geometry.attributes.position, colors = [];
    for (let i = 0; i < p.count; i++) {
        const damp = Math.max(0, 1 - p.getY(i) / (height * .45));
        const vein = .93 + .06 * Math.sin(p.getY(i) * 6 + p.getX(i) + seed);
        colors.push(vein * (1 - damp * .34), vein * (1 - damp * .24), vein * (1 - damp * .39));
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
}

export function createReturningScarClue(kind) {
    if (!['root_memory', 'root_growth', 'command_stone'].includes(kind)) throw new Error(`Unknown grove clue: ${kind}`);
    const root = new THREE.Group(); root.name = `Returning scar:${kind}`;
    const batches = new Map(), surfaces = new Map();
    const material = key => {
        if (!surfaces.has(key)) {
            const properties = {
                stone: { color: 0x777b6b, roughness: .97 },
                bark: { color: 0x514b38, roughness: 1 },
                grain: { color: 0xa29166, roughness: .99 },
                leaves: { color: 0x879d55, roughness: .9, side: THREE.DoubleSide },
                incision: { color: 0x222327, roughness: 1 },
                seal: { color: 0x95754e, roughness: .66, metalness: .45 },
                binding: { color: 0x806286, emissive: 0x624675, emissiveIntensity: .18, roughness: 1 }
            }[key];
            const surface = new THREE.MeshStandardMaterial({ ...properties, vertexColors: true });
            if (key === 'stone' || key === 'bark') applyWorldSurfaceDetail(surface, key === 'stone' ? 'fieldstone' : 'bark');
            surfaces.set(key, surface);
        }
        return surfaces.get(key);
    };
    const part = (source, key, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) => {
        const geometry = source.index ? source.toNonIndexed() : source.clone(); source.dispose();
        geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale)));
        if (!geometry.attributes.color) {
            const colors = [];
            for (let i = 0; i < geometry.attributes.position.count; i++) colors.push(1, 1, 1);
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        }
        if (!batches.has(key)) batches.set(key, []);
        batches.get(key).push(geometry);
    };
    const branch = (points, radius) => part(createTaperedRoot(points, radius, 'low'), 'bark');
    // Buried fragments replace the identical large circular display plinths.
    for (let i = 0; i < 5; i++) {
        const angle = i * 2.4;
        part(createScarStandingStone(i, .48, .12 + i % 2 * .06, .32), 'stone',
            [Math.cos(angle) * 1.45, -.035, Math.sin(angle) * 1.4], [0, angle, 0]);
    }
    if (kind === 'command_stone') {
        part(createScarStandingStone(4, 1.6, 2.55, .78), 'stone');
        // Four curved strokes, each interrupted by the straight fifth cut:
        // match the actual clue text rather than unrelated luminous bars.
        for (let row = 0; row < 4; row++) for (const side of [-1, 1]) {
            const points = [];
            for (let i = 0; i <= 6; i++) {
                const x = side * (.075 + i * .07);
                points.push(new THREE.Vector3(x, .95 + row * .31 + .17 * (x / .5) ** 2, .397));
            }
            part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 8, .028, 4, false), 'incision');
        }
        part(new THREE.BoxGeometry(.065, 1.6, .017), 'incision', [0, 1.49, .399]);
        part(new THREE.BoxGeometry(.019, 1.58, .008), 'binding', [0, 1.49, .411]);
        // Broken half of a courier seal fused beneath the imposed command.
        part(new THREE.CylinderGeometry(.19, .2, .045, 12, 1, false, 0, Math.PI * 1.3), 'seal',
            [.12, .51, .405], [Math.PI / 2, 0, .25]);
        part(new THREE.TorusGeometry(.135, .016, 4, 12, Math.PI * 1.15), 'incision', [.12, .51, .435], [0, 0, .25]);
    } else {
        for (let i = 0; i < 5; i++) {
            const a = i * 1.27;
            branch([[Math.cos(a) * .23, .64, Math.sin(a) * .23],
                [Math.cos(a) * .8, .22, Math.sin(a) * .8],
                [Math.cos(a) * 1.7, .04, Math.sin(a) * 1.7]], .24);
        }
        if (kind === 'root_memory') {
            // A broad severed trunk exposes its end grain; splinters interrupt
            // the edge while low twisting roots retain the old tree's weight.
            part(new THREE.CylinderGeometry(.43, .67, 1.3, 9), 'bark', [0, .64, 0]);
            part(new THREE.CircleGeometry(.405, 24), 'grain', [0, 1.297, 0], [-Math.PI / 2, 0, 0]);
            for (const radius of [.11, .21, .32]) part(new THREE.TorusGeometry(radius, .009, 3, 24),
                'bark', [0, 1.305, 0], [Math.PI / 2, 0, .2]);
            for (let i = 0; i < 5; i++) {
                const a = i * 1.24;
                branch([[Math.cos(a) * .4, 1.05, Math.sin(a) * .4],
                    [Math.cos(a) * .39, 1.48 + i % 2 * .18, Math.sin(a) * .4]], .085);
            }
            branch([[-.4, .7, 0], [-.8, 1, .16], [-1.35, .93, .18]], .21);
        } else {
            branch([[0, .25, 0], [-.08, .92, -.14], [-.24, 1.6, -.42], [-.59, 2.25, -.98]], .22);
            // Every new branch bends NW toward the command stone at (-6,-10).
            for (let i = 0; i < 5; i++) {
                const y = .7 + i * .27, side = i % 2 ? 1 : -1;
                const tip = [-.5 + side * .2, y + .36, -.72 - i * .1];
                branch([[-.12, y, -.19], [side * .37, y + .14, -.5], tip], .075);
                for (const leafSide of [-1, 1]) {
                    const leaf = new THREE.BufferGeometry();
                    leaf.setAttribute('position', new THREE.Float32BufferAttribute([
                        0, 0, 0, -.2, .08, -.24, 0, .16, -.23,
                        -.2, .08, -.24, -.12, .15, -.55, 0, .16, -.23,
                        0, 0, 0, 0, .16, -.23, .2, .08, -.24,
                        0, .16, -.23, -.12, .15, -.55, .2, .08, -.24
                    ], 3));
                    leaf.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, .5, .5, .5, 0, .5, .5, 1, .5, .5,
                        0, 0, .5, .5, 1, .5, .5, .5, .5, 1, 1, .5], 2));
                    leaf.computeVertexNormals();
                    part(leaf, 'leaves', tip, [0, leafSide * .5, leafSide * .25]);
                }
            }
        }
    }
    for (const [key, parts] of batches) {
        const geometry = mergeGeometries(parts, false); parts.forEach(value => value.dispose());
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, material(key)); mesh.name = `${kind}:${key}`;
        mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
    }
    return root;
}
