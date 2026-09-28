import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WATER_LOCATIONS, FIRE_LOCATIONS, AIR_LOCATIONS, WATER_PATHS, FIRE_PATHS, AIR_PATHS } from '../data/elementalPopulation.js';
import { applyWorldSurfaceDetail } from './WorldSurfaceDetail.js';
import { distanceToPath } from '../data/worldPopulation.js';
import { createLocationGroundMaterials, addLocationGroundWear } from './LocationGroundWear.js';
import { FOLIAGE_HAZARD_CLEARINGS } from '../data/worldFoliage.js';
import { createTideRibStone, createWreckPlank, wreckHullHalfWidth } from './WaterLandmarkGeometry.js';
import { createKilnArchBeam } from './FireLandmarkGeometry.js';

// Original regional compositions; scene ownership and material batches match
// the Earth kit, but silhouettes/working spaces are specific to each realm.
export function createElementalLocations(realm, { quality = 'high' } = {}) {
    if (!['water', 'fire', 'air'].includes(realm)) throw new Error(`Unsupported population realm: ${realm}`);
    const water = realm === 'water', air = realm === 'air', sites = air ? AIR_LOCATIONS : water ? WATER_LOCATIONS : FIRE_LOCATIONS;
    const root = new THREE.Group(); root.name = `${realm} authored locations`;
    const groundMaterials = createLocationGroundMaterials(realm);
    const paths = air ? AIR_PATHS : water ? WATER_PATHS : FIRE_PATHS;
    const materials = {
        stone: applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: air ? 0x77727d : water ? 0x657d87 : 0x584841, roughness: .91 }), 'stone'),
        wood: applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: air ? 0x555160 : water ? 0x4e6264 : 0x473c32, roughness: .96 }), 'timber'),
        iron: new THREE.MeshStandardMaterial({ color: air ? 0x9e9476 : water ? 0x748f99 : 0x4b4542, roughness: .65, metalness: .7 }),
        cloth: new THREE.MeshStandardMaterial({ color: air ? 0x9891ac : water ? 0x91a9aa : 0x987957, side: THREE.DoubleSide, roughness: 1 }),
        accent: new THREE.MeshStandardMaterial({ color: air ? 0xbcb3cb : water ? 0x95c7d2 : 0xb8804b, roughness: water ? .3 : .82,
            metalness: water ? .1 : .3, emissive: air ? 0x211d32 : water ? 0x16333b : 0x392017, emissiveIntensity: .22 })
    };
    const footprints = [], radial = quality === 'low' ? 6 : 12;
    if (water) materials.rib = applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({
        color: 0x849594, roughness: .87, metalness: .04
    }), 'fieldstone');
    for (const site of sites) {
        const group = new THREE.Group(); group.name = `${realm}-location:${site.id}`;
        group.position.set(site.x, 0, site.z); group.userData.locationId = site.id;
        const batches = new Map();
        const footprint = (x, y, z, width, height, depth) => footprints.push({
            siteId: site.id, x: site.x + x, y, z: site.z + z, width, height, depth, angle: 0
        });
        const part = (geometry, key, x, y, z, rotation = [0, 0, 0], scale = [1, 1, 1]) => {
            if (site.recipe === 'tide-rib' && key === 'stone') key = 'rib';
            const baked = geometry.index ? geometry.toNonIndexed() : geometry.clone(); geometry.dispose();
            baked.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale)));
            if (!batches.has(key)) batches.set(key, []);
            batches.get(key).push(baked);
        };
        const box = (key, x, y, z, width, height, depth, solid = false) => {
            part(new THREE.BoxGeometry(width, height, depth), key, x, y, z);
            if (solid) footprint(x, y, z, width, height, depth);
        };
        const cylinder = (key, x, y, z, top, bottom, height) =>
            part(new THREE.CylinderGeometry(top, bottom, height, radial), key, x, y, z);
        const beam = (a, b, radius = .16, key = 'wood') => {
            const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = end.clone().sub(start);
            const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), radial);
            geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
            const middle = start.add(end).multiplyScalar(.5); part(geometry, key, middle.x, middle.y, middle.z);
        };
        const rope = (points, radius = .08, key = 'wood') => {
            const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
            part(new THREE.TubeGeometry(curve, quality === 'low' ? 10 : 20, radius, 5, false), key, 0, 0, 0);
        };
        const gauge = (x, z, height = 7) => {
            box('stone', x, height / 2, z, 1.2, height, 1.2, true);
            box('iron', x, .5, z, 1.35, .2, 1.35);
            box('stone', x, height + .12, z, 1.5, .24, 1.5);
            for (let i = 1; i < height; i++) box('accent', x, i, z + .63, i % 2 ? .5 : .9, .06, .04);
        };
        const rack = (x, z) => {
            box('wood', x, 1.5, z, 5, .3, 2.6, true);
            for (const side of [-1, 1]) box('wood', x + side * 2, .7, z, .3, 1.4, 2.2);
            for (let i = 0; i < 5; i++) {
                cylinder('accent', x - 1.8 + i * .9, 1.84, z, .35, .3, .38);
                part(new THREE.TorusGeometry(.29, .065, 4, radial), 'iron', x - 1.8 + i * .9, 2.04, z, [Math.PI / 2, 0, 0]);
            }
        };
        const hull = (x, z) => {
            footprint(x, 1.5, z, 5.5, 3, 13);
            // Tapered bow/stern and surviving curved planking read as a wreck,
            // with open ribs and no deck. All remain inside the old hull solid.
            for (let i = 0; i < 6; i++) {
                const along = -5 + i * 2, halfWidth = wreckHullHalfWidth(along);
                rope([[x - halfWidth, 2.8, z + along], [x - halfWidth * .5, 1, z + along],
                    [x, .4, z + along], [x + halfWidth * .5, 1, z + along], [x + halfWidth, 2.8, z + along]], .14);
            }
            beam([x, .35, z - 6.5], [x, .35, z + 6.5], .3);
            for (const side of [-1, 1]) {
                rope([[-6, 1.7], [-3, 2.4], [0, 2.8], [3, 2.4], [6, 1.7]]
                    .map(([along, y]) => [x + side * wreckHullHalfWidth(along), y, z + along]), .12);
                for (let band = 0; band < 3; band++) {
                    part(createWreckPlank(side, band, -6, -1.4 + band * .3, quality), 'wood', x, 0, z);
                    if (side < 0 || band !== 1) part(createWreckPlank(side, band, .6 + band * .4, 6, quality), 'wood', x, 0, z);
                }
            }
        };
        switch (site.recipe) {
        case 'chart-court':
        case 'vane-array':
            for (const side of [-1, 1]) {
                const x = side * 18, z = site.recipe === 'chart-court' ? 12 : -19;
                box('stone', x, .45, z, 3, .9, 3, true);
                cylinder('iron', x, 3.8, z, .13, .2, 7);
                beam([x - 2, 7, z], [x + 2, 7, z], .13, 'iron');
                part(new THREE.ConeGeometry(.6, 1.5, 3), 'accent', x + 2, 7, z, [0, 0, -Math.PI / 2]);
                part(new THREE.TorusGeometry(1.8, .1, 5, radial * 2), 'iron', x, 4.4, z, [0, .6, 0]);
                if (site.recipe === 'chart-court') {
                    box('wood', x, 1.4, z + 5, 5, .3, 2, true);
                    box('cloth', x, 1.57, z + 5, 3.8, .04, 1.5);
                    for (let i = 0; i < 4; i++) box('iron', x - 1.4 + i * .9, 1.6, z + 5, .03, .03, 1.3);
                }
            }
            break;
        case 'courier-muster':
            for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
                const x = -39 - i * 6, z = side * 13;
                box('stone', x, .5, z, 2, 1, 2, true);
                cylinder('iron', x, 4, z, .12, .2, 8);
                beam([x, 7.7, z], [x + 2.5, 7.7, z], .12, 'iron');
                part(new THREE.PlaneGeometry(2.2, 3 - i * .4), 'cloth', x + 1.3, 6, z, [0, .2, .1]);
            }
            break;
        case 'horizon-orrery':
            for (const side of [-1, 1]) {
                box('stone', 0, 1, side * 12, 4, 2, 4, true);
                beam([0, 1.8, side * 12], [0, 11, side * 5], .4, 'iron');
            }
            for (const angle of [-.7, .7]) part(new THREE.TorusGeometry(6, .22, 6, radial * 3),
                'iron', 0, 12, 0, [angle, Math.PI / 2, 0]);
            part(new THREE.SphereGeometry(1.4, radial, 8), 'accent', 0, 12, 0);
            break;
        case 'courier-exchange':
        case 'weather-bivouac':
            for (const side of [-1, 1]) {
                const x = side * 12;
                for (const z of [-7, 7]) box('wood', x, 2.5, z, .6, 5, .6, true);
                beam([x, 5, -7], [x, 5, 7], .22);
                // Narrow side sails shelter open bays, leaving the central
                // aisle and all ground-level gameplay sightlines unobstructed.
                part(new THREE.PlaneGeometry(14, 3.5, 12, 2), 'cloth', x, 3, 0, [0, Math.PI / 2, -.1]);
                footprint(x, 2.5, 0, .7, 5, 14);
                rope([[x, 4.8, -7], [x + side * 2, 2, -9], [x + side * 3, .1, -10]], .09, 'iron');
                if (site.recipe === 'courier-exchange') {
                    for (let shelf = 0; shelf < 3; shelf++) box('wood', x - side * 2, .6 + shelf * .8, 4, 3, .15, 4);
                    footprint(x - side * 2, 1.2, 4, 3, 2.4, 4);
                    for (let i = 0; i < 4; i++) box('cloth', x - side * 2, .9, 2.8 + i * .8, 1.5, .45, .6);
                } else {
                    for (const z of [-4, 4]) box('cloth', x - side * 3, .2, z, 2.6, .4, 4);
                    box('stone', x - side * 2, .55, -8, 5, 1.1, 1.5, true);
                }
            }
            break;
        case 'dispatch-frame':
        case 'sky-measure':
            box('stone', 6, .75, -6, 2.6, 1.5, 1.3, true);
            for (const z of [-7, 7]) box('stone', -8, .5, z, 2.4, 1, 2.4, true);
            beam([-8, .7, -7], [-8, 6, 0], .2, 'iron');
            beam([-8, .7, 7], [-8, 6, 0], .2, 'iron');
            if (site.recipe === 'dispatch-frame') {
                box('wood', -8, 3.5, 0, .3, 4, 8);
                for (let i = 0; i < 5; i++) box('cloth', -7.8, 3 + i % 2, -3 + i * 1.5, .04, 1.2, 1);
                footprint(-8, 3, 0, .5, 6, 8);
            } else part(new THREE.TorusGeometry(3.7, .16, 6, radial * 2), 'iron', -8, 5, 0, [0, Math.PI / 2, .25]);
            break;
        case 'mooring-yard':
            for (const side of [-1, 1]) {
                gauge(side * 12, 10, 5);
                for (let i = 0; i < 5; i++) box('wood', side * 11, .12, 3 + i, 5.5, .15, .7);
                part(new THREE.TorusGeometry(1.5, .1, 5, radial * 2), 'wood', side * 11, .3, 5, [Math.PI / 2, 0, 0]);
            }
            break;
        case 'echo-bank':
            for (const side of [-1, 1]) { gauge(side * 16, -7, 6); gauge(side * 16, 7, 3); }
            rope([[-16, 3, -7], [0, 1.8, -16], [16, 3, -7]]);
            for (let i = 0; i < 5; i++) box('stone', -14 + i * 7, .1, -16, 3, .15, 1.5);
            break;
        case 'tide-procession':
        case 'furnace-procession':
            for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
                const x = water ? side * 14 : 48 + i * 5, z = water ? 43 + i * 5 : side * 14;
                gauge(x, z, 7 - i);
                if (!water) box('iron', x + 1.4, 1.8, z, 1.4, 3.4, 1.6, true);
            }
            break;
        case 'tide-rib':
        case 'kiln-span':
            for (const side of [-1, 1]) {
                box('stone', water ? side * 10 : 0, 4, water ? 0 : side * 10, 3, 8, 3, true);
            }
            for (const shift of [-2.5, 2.5]) {
                if (water) {
                    for (let i = 0; i < 15; i++) part(createTideRibStone(i), 'rib', 0, 0, shift);
                    continue;
                }
                part(createKilnArchBeam(), 'iron', shift, 0, 0, [0, Math.PI / 2, 0]);
                for (const edge of [-1, 1]) {
                    part(createKilnArchBeam(true), 'iron', shift + edge * .5, 0, 0, [0, Math.PI / 2, 0]);
                    for (let i = 1; i < 10; i++) {
                        const angle = i / 10 * Math.PI;
                        part(new THREE.CylinderGeometry(.17, .17, .15, 6), 'accent',
                            shift + edge * .61, 7 + Math.sin(angle) * 5.5, -Math.cos(angle) * 10, [0, 0, Math.PI / 2]);
                    }
                }
            }
            if (water) {
                for (const side of [-1, 1]) {
                    // Overhead capital carries both ribs; the narrow ground
                    // pier and its existing collision footprint stay intact.
                    box('stone', side * 10, 7.7, 0, 3, .6, 6.8);
                    for (let level = 1; level <= 7; level++) {
                        box('iron', side * 10, level, 1.51, level % 2 ? .9 : 1.65, .085, .04);
                    }
                    beam([side * 10, 7.7, -2.5], [side * 10, 7.7, 2.5], .12, 'iron');
                }
            } else {
                for (const side of [-1, 1]) box('stone', 0, 7.7, side * 10, 7, .6, 3);
                for (const angle of [Math.PI / 4, Math.PI / 2, Math.PI * .75]) {
                    box('iron', 0, 7 + Math.sin(angle) * 5.5, -Math.cos(angle) * 10, 5, .22, .25);
                }
            }
            break;
        case 'sail-shelter':
        case 'workers-court':
            for (const side of [-1, 1]) {
                box('wood', side * 9, 3, -8, .5, 6, .5, true);
                box('stone', side * 10, .55, 9, 5, 1.1, 1.7, true);
            }
            {
                const sail = new THREE.PlaneGeometry(17, 6, 16, 4);
                const positions = sail.attributes.position;
                for (let i = 0; i < positions.count; i++) {
                    const x = positions.getX(i), y = positions.getY(i);
                    positions.setXYZ(i, x, y - .65 * Math.cos(x / 17 * Math.PI),
                        Math.sin(x * 1.8) * .12 + Math.cos(x / 17 * Math.PI) * .55);
                }
                sail.computeVertexNormals(); part(sail, 'cloth', 0, 4.4, -8, [-.3, 0, 0]);
            }
            beam([-9, 6, -8], [9, 6, -8], .2);
            for (const side of [-1, 1]) rope([[side * 9, 5.8, -8], [side * 9.5, 3, -9], [side * 10, .2, -10]]);
            cylinder('iron', -9, .5, 9, 1.5, 1, 1); rack(9, -10);
            break;
        case 'boat-grave':
            hull(-10, -3); hull(11, 4);
            beam([-10, 1, -7], [-16, 5.5, -12], .22);
            part(new THREE.PlaneGeometry(4, 5), 'cloth', -14, 2.5, -10, [-.5, .8, .2]);
            break;
        case 'kiln-yard':
            for (const side of [-1, 1]) {
                rack(side * 12, 10);
                cylinder('stone', side * 12, 2, -10, 1.3, 2.5, 4);
                footprint(side * 12, 2, -10, 5, 4, 5);
                cylinder('iron', side * 12, 4.8, -10, .6, .8, 2);
            }
            break;
        case 'exhaust-channel':
            for (const side of [-1, 1]) {
                for (let i = 0; i < 5; i++) box('stone', -6 + side * 4, .13, -22 + i * 4, 1.2, .2, 3.6);
                box('iron', side * 22, 1, -20, 2, 2, 7, true);
            }
            break;
        case 'quenched-foundry':
            for (const side of [-1, 1]) {
                const x = side * 11;
                // Cold furnace with a recessed, barred mouth. The same solid
                // footprint remains authoritative; the hollow is not a doorway.
                footprint(x, 2, -5, 4.5, 4, 5);
                box('stone', x, .35, -5, 4.5, .7, 5);
                for (const edge of [-1, 1]) box('stone', x + edge * 1.85, 2, -5, .8, 4, 5);
                box('stone', x, 2, -7, 4.5, 4, 1);
                box('stone', x, 3.7, -5, 4.5, .6, 5);
                for (let bar = -1; bar <= 1; bar++) box('iron', x + bar * .8, 1.9, -2.45, .12, 2.5, .15);
                for (const y of [.8, 3.3]) box('iron', x, y, -2.35, 4.7, .2, .25);
                cylinder('iron', x, 5.2, -6, .7, 1, 3);
                part(new THREE.TorusGeometry(.7, .13, 5, radial), 'iron', x, 6.7, -6, [Math.PI / 2, 0, 0]);
                rack(side * 11, 7);
                for (let i = 0; i < 3; i++) box('stone', side * (7 + i * 2), .2, -12, 1.5, .35, 4);
            }
            break;
        case 'sounding-gauge':
        case 'name-mooring':
        case 'kiln-register':
        case 'counterseal':
            box('stone', 6, .75, -6, 2.6, 1.5, 1.3, true); // Actual reading pedestal.
            if (site.recipe === 'sounding-gauge') {
                for (let i = 0; i < 3; i++) { gauge(-8 + i * 4, -15, 5 + i); cylinder('iron', -8 + i * 4, 1.2, -13.5, .22, .5, 1.5); }
                beam([-8, 5, -15], [0, 7, -15], .15, 'iron');
            } else if (site.recipe === 'name-mooring') {
                gauge(-5, -6, 7); gauge(-5, 7, 3);
                rope([[-5, 5, -6], [-5, 2, -1], [-5, 2, 7]]);
                for (let i = 0; i < 8; i++) box('iron', -5.2 + i % 2 * .45, 1.2 + Math.floor(i / 2), -5.35, .32, .65, .08);
            } else if (site.recipe === 'kiln-register') {
                rack(-9, -5); box('stone', -10, .35, 4, 6, .7, 3, true);
                for (let i = 0; i < 6; i++) cylinder('stone', -12 + i * .8, .95, 4, .3, .2, .5);
            } else {
                for (const side of [-1, 1]) part(new THREE.TorusGeometry(3, .3, 6, radial * 2, Math.PI * .8),
                    'iron', -10, 3.2, -5, [0, side * .3, side * Math.PI * .5]);
                box('stone', -10, 1, -5, 7, 2, 2.5, true);
            }
            break;
        default: throw new Error(`Unknown elemental recipe: ${site.recipe}`);
        }
        for (const [key, parts] of batches) {
            if (!parts.length) continue;
            const geometry = mergeGeometries(parts, false); parts.forEach(part => part.dispose());
            const mesh = new THREE.Mesh(geometry, materials[key]); mesh.name = `${site.id}:${key}`;
            mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
        }
        addLocationGroundWear(group, site, groundMaterials, (x, z) =>
            paths.every(path => distanceToPath(x, z, path.points) > path.width / 2 + 2), FOLIAGE_HAZARD_CLEARINGS[realm]);
        root.add(group);
    }
    root.userData.walkFootprints = footprints;
    return root;
}
