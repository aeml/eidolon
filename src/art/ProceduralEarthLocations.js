import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EARTH_LOCATIONS, EARTH_PATHS, distanceToPath } from '../data/worldPopulation.js';
import { applyWorldSurfaceDetail } from './WorldSurfaceDetail.js';

// The environment owns these resources; no external asset or global disposable
// cache is needed. Each location/material is a separate cullable draw batch.
export function createEarthLocations({ quality = 'high' } = {}) {
    const group = new THREE.Group(); group.name = 'Earth authored locations';
    const pixels = new Uint8Array(64 * 64 * 4);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const i = (y * 64 + x) * 4, radius = Math.hypot(x - 31.5, y - 31.5) / 31.5;
        const noise = ((Math.imul(x + 3, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0) % 101 / 100;
        pixels[i] = 80; pixels[i + 1] = 71; pixels[i + 2] = 51;
        pixels[i + 3] = Math.max(0, Math.min(1, (1 - radius - noise * .14) * 2)) * 135;
    }
    const groundTexture = new THREE.DataTexture(pixels, 64, 64);
    groundTexture.colorSpace = THREE.SRGBColorSpace; groundTexture.magFilter = THREE.LinearFilter;
    groundTexture.needsUpdate = true;
    const materials = {
        stone: applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x777366, roughness: .96 }), 'stone'),
        wood: applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x504435, roughness: .98 }), 'timber'),
        iron: new THREE.MeshStandardMaterial({ color: 0x414647, roughness: .7, metalness: .65 }),
        brass: new THREE.MeshStandardMaterial({ color: 0x93815a, roughness: .62, metalness: .55 }),
        cloth: new THREE.MeshStandardMaterial({ color: 0x746a53, roughness: 1, side: THREE.DoubleSide }),
        moss: new THREE.MeshStandardMaterial({ color: 0x465942, roughness: 1, side: THREE.DoubleSide }),
        soil: new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 1, transparent: true, depthWrite: false, alphaTest: .01 })
    };
    const footprints = [];
    const radial = quality === 'low' ? 6 : 10;
    for (const site of EARTH_LOCATIONS) {
        const root = new THREE.Group(); root.name = `earth-location:${site.id}`;
        root.position.set(site.x, 0, site.z); root.userData.locationId = site.id;
        const batches = new Map();
        const part = (geometry, material, x, y, z, rotation = [0, 0, 0], scale = [1, 1, 1]) => {
            const matrix = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
            const transformed = geometry.index ? geometry.toNonIndexed() : geometry.clone();
            geometry.dispose(); transformed.applyMatrix4(matrix);
            if (!batches.has(material)) batches.set(material, []);
            batches.get(material).push(transformed);
        };
        const box = (m, x, y, z, w, h, d, angle = 0, solid = false) => {
            part(new THREE.BoxGeometry(w, h, d), m, x, y, z, [0, angle, 0]);
            if (solid) footprints.push({ siteId: site.id, x: site.x + x, z: site.z + z, width: w, depth: d, height: h, y, angle });
        };
        const cylinder = (m, x, y, z, top, bottom, height, rotation = [0, 0, 0]) =>
            part(new THREE.CylinderGeometry(top, bottom, height, radial), m, x, y, z, rotation);
        const stone = (x, y, z, sx, sy, sz, angle = 0) =>
            part(new THREE.IcosahedronGeometry(1, quality === 'low' ? 0 : 1), 'stone', x, y, z, [0, angle, .15], [sx, sy, sz]);
        const beam = (a, b, radius = .25, material = 'wood') => {
            const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = end.clone().sub(start);
            const geometry = new THREE.CylinderGeometry(radius * .8, radius, direction.length(), radial);
            geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
            const midpoint = start.add(end).multiplyScalar(.5);
            part(geometry, material, midpoint.x, midpoint.y, midpoint.z);
        };
        const rootCurve = (points, radius) => {
            const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
            part(new THREE.TubeGeometry(curve, quality === 'low' ? 12 : 24, radius, radial, false), 'wood', 0, 0, 0);
        };
        const pennant = (x, z, height = 6) => {
            cylinder('wood', x, height / 2, z, .12, .2, height);
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute([
                x, height - .5, z, x + 2.5, height - 1, z + .4, x + 1.8, height - 2, z + .15,
                x, height - .5, z, x + 1.8, height - 2, z + .15, x, height - 2.8, z
            ], 3));
            geometry.computeVertexNormals();
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
            // Already non-indexed; batching below expects a uniform attribute set.
            if (!batches.has('cloth')) batches.set('cloth', []);
            batches.get('cloth').push(geometry);
        };
        const hearth = (x, z) => {
            cylinder('iron', x, .09, z, 1.5, 1.5, .16);
            for (let i = 0; i < 9; i++) stone(x + Math.cos(i * Math.PI * 2 / 9) * 1.8, .35,
                z + Math.sin(i * Math.PI * 2 / 9) * 1.8, .55, .35, .45, i);
            beam([x - .8, .25, z - .2], [x + .8, .25, z + .2], .17);
            beam([x - .6, .3, z + .6], [x + .5, .3, z - .7], .15);
        };
        switch (site.recipe) {
        case 'evacuated-garden':
            for (const side of [-1, 1]) {
                for (let i = 0; i < 4; i++) box('wood', side * 8, .17, -5 + i * 3, 4, .3, .22);
                for (let i = 0; i < 7; i++) part(new THREE.SphereGeometry(.45, 6, 4), 'moss', side * (7 + i % 2), .22, -4 + i * 1.3, [0, i, 0], [1, .55, 1]);
                box('stone', side * 6, 1.15, 8, .9, 2.3, .9, 0, true);
            }
            box('wood', -9, .6, 9, 2.8, .25, 1.7);
            beam([-10, .5, 9.8], [-7, .5, 12], .09);
            part(new THREE.TorusGeometry(.65, .09, 5, 12), 'wood', -10.3, .65, 9, [0, Math.PI / 2, .25]);
            pennant(10, 9, 4);
            break;
        case 'wounded-grove':
            for (let i = 0; i < 5; i++) {
                const angle = Math.PI * .6 + i * .48, x = Math.cos(angle) * 19, z = Math.sin(angle) * 19;
                stone(x, 1.2, z, 1.3, 1.8, 1, angle);
                box('stone', x, 1, z, 1.5, 2, 1.5, 0, true);
            }
            rootCurve([[-18, .3, -8], [-16, 3, -13], [-8, 2, -17], [0, .4, -19]], .65);
            rootCurve([[-19, .2, 4], [-16, 1.5, 0], [-12, .3, -5]], .4);
            break;
        case 'grave-road':
            for (const side of [-1, 1]) {
                for (let i = 0; i < 3; i++) {
                    box('stone', -58 + i * 6, 1.8, side * 12, 1.5, 3.6 - i * .45, 1.5, 0, true);
                    stone(-58 + i * 6, 3.8 - i * .45, side * 12, 1.2, .7, 1.2);
                }
                pennant(-58, side * 18, 8);
                box('stone', -50, .32, side * 21, 8, .6, 2);
            }
            break;
        case 'root-arch':
            for (const side of [-1, 1]) {
                box('stone', side * 8, 4, 0, 3, 8, 4, 0, true);
                for (let i = 0; i < 3; i++) box('stone', side * (8 - i), 8 + i * 1.1, 0, 3.5, 1.5, 4);
                rootCurve([[side * 14, .2, 4], [side * 10, 3, 2], [side * 9, 8, 0], [side * 3, 11.5, 0]], .85);
                stone(side * 16, .6, -4, 2, .8, 1.2);
            }
            box('stone', 0, 11, 0, 8, 1.6, 3.8);
            break;
        case 'pilgrim-camp':
            hearth(0, -7);
            for (const side of [-1, 1]) {
                box('wood', side * 7, .75, -7, 5, .3, 1.4, .15 * side);
                box('cloth', side * 9, .15, 5, 2, .2, 3);
                beam([side * 12, 0, 8], [side * 10, 4, 4], .2);
                beam([side * 10, 4, 4], [side * 7, 0, 8], .2);
                box('wood', side * 10, .7, -13, 2, 1.4, 2, 0, true);
            }
            pennant(-4, 10, 7);
            cylinder('iron', 0, .5, -7, .65, .5, .8);
            break;
        case 'timber-yard':
            for (const x of [-12, 12]) for (const z of [-10, 10]) box('wood', x, 3, z, .7, 6, .7, 0, true);
            beam([-12, 6, -10], [12, 6, -10], .35);
            beam([-12, 6, -10], [-12, 6, 10], .35);
            box('wood', -10, 1.3, -2, 2.8, .45, 8, 0, true);
            for (let i = 0; i < 5; i++) cylinder('wood', 8 + i % 2, .7 + Math.floor(i / 2) * 1.1, 7, .55, .65, 7, [Math.PI / 2, 0, 0]);
            box('wood', 8.5, 1.5, 7, 2.4, 3, 7, 0, true);
            for (let i = 0; i < 4; i++) box('wood', -3 + i * 2, .12, 12, 1.5, .2, 8, .07 * i);
            part(new THREE.TorusGeometry(1.6, .18, 6, 16), 'wood', -11, 1.7, 5, [0, .2, 0]);
            break;
        case 'bell-cairn':
            for (let i = 0; i < 11; i++) stone(Math.cos(i * 2.4) * (2.4 - i * .13), .4 + i * .14, -5 + Math.sin(i * 2.4) * 1.5, 1, .65, .8, i);
            for (const side of [-1, 1]) box('wood', side * 3, 3.3, -5, .6, 6.6, .6, 0, true);
            beam([-3, 6.5, -5], [3, 6.5, -5], .4);
            cylinder('brass', 0, 4.4, -5, .65, 1.6, 2.2);
            cylinder('iron', 0, 3.4, -5, .1, .22, 1.4);
            box('stone', 0, .75, -6, 2.6, 1.5, 1.3, 0, true);
            break;
        case 'oath-stone':
            box('stone', 8, 2.6, -4, 2.8, 5.2, 1.6, 0, true);
            stone(8, 5.4, -4, 1.7, .8, 1.1);
            for (let i = 0; i < 10; i++) box('brass', 7.4 + (i % 2) * 1.1, 1 + Math.floor(i / 2) * .65, -3.18, .7, .035, .035);
            for (const side of [-1, 1]) box('stone', side * 5, .45, -4, 3.5, .8, 1.6);
            pennant(-6, 2, 5);
            break;
        default: throw new Error(`Unknown Earth location recipe: ${site.recipe}`);
        }
        const apronX = site.arrivalOffset?.[0] || 0;
        const apronRadius = site.role === 'landmark' ? 15 : site.radius * .65;
        part(new THREE.PlaneGeometry(apronRadius * 2, apronRadius * 1.6), 'soil', apronX, .018, 0, [-Math.PI / 2, 0, .12]);
        // Quiet peripheral vegetation/debris ties the composition into the
        // ground. Keep all of it low and off the actual walking centerlines;
        // central mandatory evidence and dungeon silhouettes remain uncluttered.
        for (let i = 0; i < 42; i++) {
            const random = seed => ((Math.imul(seed + 91, 73856093) ^ Math.imul(seed + 7, 19349663)) >>> 0) / 4294967296;
            const angle = random(i * 13 + site.id.length) * Math.PI * 2;
            const radius = site.radius * (.22 + Math.sqrt(random(i * 37 + 11)) * .67);
            const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
            if (site.role === 'story' && radius < 10) continue;
            if (site.id === 'verdant-approach' && x > -42) continue;
            if (EARTH_PATHS.some(path => distanceToPath(site.x + x, site.z + z, path.points) < path.width / 2 + 2)) continue;
            if (i % 4 === 0) stone(x, .14, z, .45 + i % 3 * .3, .22, .4, angle);
            else for (let blade = 0; blade < 3; blade++) {
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute([-.28, 0, 0, .28, 0, 0, .1, .8 + i % 3 * .2, .15], 3));
                geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, .5, 1], 2));
                geometry.computeVertexNormals();
                part(geometry, 'moss', x, .02, z, [0, angle + blade * Math.PI / 3, 0]);
            }
        }
        for (const [key, geometries] of batches) {
            const geometry = mergeGeometries(geometries, false);
            geometries.forEach(value => value.dispose());
            if (!geometry) throw new Error(`Could not batch ${site.id}/${key}`);
            const mesh = new THREE.Mesh(geometry, materials[key]); mesh.name = `${site.id}:${key}`;
            mesh.castShadow = !['moss', 'soil'].includes(key); mesh.receiveShadow = true;
            root.add(mesh);
        }
        group.add(root);
    }
    group.userData.walkFootprints = footprints;
    return group;
}
