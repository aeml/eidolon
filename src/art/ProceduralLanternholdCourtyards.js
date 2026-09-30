import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LANTERNHOLD_COURTYARDS } from '../data/worldPopulation.js';
import { applyWorldSurfaceDetail } from './WorldSurfaceDetail.js';
import { createProceduralTownResident } from './ProceduralTownActors.js';
import { batchPosedTownResident } from './PosedTownResidentBatches.js';

export function createLanternholdCourtyards({ quality = 'high' } = {}) {
    const group = new THREE.Group(); group.name = 'Lanternhold communal courtyards';
    const materials = {
        stone: applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: 0xaaa28c, vertexColors: true, roughness: .91 }), 'stone'),
        wood: applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x66533c, roughness: .95 }), 'timber'),
        metal: new THREE.MeshStandardMaterial({ color: 0x71684e, metalness: .6, roughness: .62 }),
        cloth: new THREE.MeshStandardMaterial({ color: 0x859386, roughness: 1, side: THREE.DoubleSide }),
        water: new THREE.MeshStandardMaterial({ color: 0x355852, metalness: .35, roughness: .28 }),
        glow: new THREE.MeshStandardMaterial({ color: 0xe3bb73, emissive: 0xd9943e, emissiveIntensity: .6, roughness: .65 })
    };
    const footprints = [], motions = [];
    const radial = quality === 'low' ? 12 : 24;
    for (const site of LANTERNHOLD_COURTYARDS) {
        const root = new THREE.Group(); root.name = site.id; root.position.set(site.x, 0, site.z);
        const batches = new Map();
        const part = (geometry, key, x, y, z, rotation = [0, 0, 0], animated = false) => {
            if (animated) {
                const mesh = new THREE.Mesh(geometry, materials[key]); mesh.position.set(x, y, z);
                mesh.rotation.set(...rotation); root.add(mesh); return mesh;
            }
            const transformed = geometry.index ? geometry.toNonIndexed() : geometry.clone(); geometry.dispose();
            if (key === 'stone' && !transformed.attributes.color) {
                const colors = new Float32Array(transformed.attributes.position.count * 3).fill(1);
                transformed.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            }
            transformed.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
                new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1, 1, 1)));
            if (!batches.has(key)) batches.set(key, []);
            batches.get(key).push(transformed); return null;
        };
        const box = (key, x, y, z, width, height, depth, solid = false) => {
            part(new THREE.BoxGeometry(width, height, depth), key, x, y, z);
            if (solid) footprints.push({ siteId: site.id, x: site.x + x, y, z: site.z + z, width, height, depth });
        };
        const cylinder = (key, x, y, z, top, bottom, height, solid = false) => {
            part(new THREE.CylinderGeometry(top, bottom, height, radial), key, x, y, z);
            if (solid) footprints.push({ siteId: site.id, x: site.x + x, y, z: site.z + z,
                width: Math.max(top, bottom) * 2, depth: Math.max(top, bottom) * 2, height });
        };
        const bench = (x, z) => {
            box('wood', x, .9, z, 4.4, .25, 1.1, true);
            for (const end of [-1.6, 1.6]) box('stone', x + end, .42, z, .6, .84, .9);
            box('wood', x, 1.65, z - .5, 4.4, .8, .14);
        };
        // Flat inlaid paving follows the existing town floor rather than
        // introducing a raised lip or a new walkable-height rule.
        const paving = new THREE.CylinderGeometry(9.5, 9.5, .012, radial);
        const tones = [];
        for (let i = 0; i < paving.attributes.position.count; i++) {
            const x = paving.attributes.position.getX(i), z = paving.attributes.position.getZ(i);
            const shade = .27 + .035 * Math.sin(x * .65 + z * .38);
            tones.push(shade, shade, shade * .97);
        }
        paving.setAttribute('color', new THREE.Float32BufferAttribute(tones, 3));
        part(paving, 'stone', 0, .034, 0);
        part(new THREE.TorusGeometry(8.8, .06, 4, radial * 2), 'metal', 0, .05, 0, [Math.PI / 2, 0, 0]);
        if (site.recipe === 'common-well') {
            const profile = [[2.4, 0], [2.7, .25], [2.65, .4], [2.3, .5], [2.3, 1.45], [2.65, 1.5], [2.7, 1.7], [2.1, 1.7], [2.05, .4]];
            part(new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), radial), 'stone', 0, 0, 0);
            footprints.push({ siteId: site.id, x: site.x, y: .85, z: site.z, width: 5.4, height: 1.7, depth: 5.4 });
            cylinder('water', 0, .78, 0, 2.05, 2.05, .03);
            for (const side of [-1, 1]) {
                box('wood', side * 2.9, 2.9, 0, .35, 5.8, .35, true);
                part(new THREE.TorusGeometry(.6, .09, 5, 14), 'metal', side * 2.9, 3.8, 0, [0, Math.PI / 2, 0]);
            }
            box('wood', 0, 5.6, 0, 6.6, .35, .45);
            cylinder('wood', 0, 3.85, 0, .04, .04, 3.4);
            cylinder('wood', 0, 2.3, 0, .45, .35, .7);
            for (const x of [-5.5, 5.5]) bench(x, 5.5);
            cylinder('wood', 6, .6, -3, .8, .7, 1.2, true);
            part(new THREE.TorusGeometry(.82, .055, 4, radial), 'metal', 6, 1.08, -3, [Math.PI / 2, 0, 0]);
            const ripple = part(new THREE.TorusGeometry(.7, .035, 4, radial), 'glow', 0, .82, 0, [Math.PI / 2, 0, 0], true);
            ripple.name = 'well-water-ripple'; motions.push({ site, mesh: ripple, kind: 'ripple' });
        } else {
            box('wood', 0, 1.15, -2, 6.5, .35, 2.4, true);
            for (const x of [-2.7, 2.7]) for (const z of [-2.8, -1.2]) box('wood', x, .5, z, .3, 1, .3);
            for (const x of [-3.5, 3.5]) box('wood', x, 2.7, -5, .24, 5.4, .24, true);
            box('wood', 0, 4.8, -5, 7.3, .12, .12);
            for (let i = 0; i < 3; i++) {
                // Folded hanging panels, not a roof concealing the work area.
                const panel = part(new THREE.PlaneGeometry(1.7, 2.3, 2, 3), 'cloth', -2.3 + i * 2.3, 3.45, -5, [0, .12 * i, 0], true);
                const vertices = panel.geometry.attributes.position;
                for (let v = 0; v < vertices.count; v++) vertices.setZ(v, Math.sin(vertices.getX(v) * 5) * .09);
                panel.geometry.computeVertexNormals(); panel.name = `drying-cloth-${i}`;
                motions.push({ site, mesh: panel, kind: 'cloth', phase: i });
            }
            for (let i = 0; i < 4; i++) box('cloth', -2 + i * 1.2, 1.37 + i % 2 * .1, -2, .9, .12, 1.3);
            for (const x of [-6, 6]) {
                box('wood', x, .6, -5, 1.7, 1.2, 1.7, true);
                cylinder('metal', x, 1.3, -5, .35, .4, .3);
            }
            bench(0, 6);
            // Shared cups and a covered brazier make this a working gathering
            // place; no extra vendor, resident or healing interaction is implied.
            cylinder('metal', 5.5, 1, 4.5, .75, .4, 1.6, true);
            cylinder('glow', 5.5, 1.7, 4.5, .55, .55, .08);
        }
        const resident = createProceduralTownResident();
        const well = site.recipe === 'common-well';
        resident.name = well ? 'well-tender' : 'cloth-mender';
        resident.position.set(well ? 4.3 : 0, 0, well ? 0 : -4);
        resident.rotation.y = well ? -Math.PI / 2 : 0;
        resident.scale.setScalar(well ? .9 : .72);
        const arm = resident.getObjectByName('Rig_UpperArmRight');
        const forearm = resident.getObjectByName('Rig_ForearmRight');
        arm.rotation.x = well ? -1.05 : -.6; forearm.rotation.x = -.8;
        const head = resident.getObjectByName('Rig_Head'); head.rotation.x = .15;
        batchPosedTownResident(resident, [forearm, head]);
        root.add(resident);
        motions.push({ site, mesh: forearm, head, rest: -.8, kind: 'resident', phase: well ? 0 : 1 });
        for (const [key, geometries] of batches) {
            const geometry = mergeGeometries(geometries, false); geometries.forEach(g => g.dispose());
            const mesh = new THREE.Mesh(geometry, materials[key]); mesh.name = `${site.id}:${key}`;
            mesh.castShadow = !['water', 'glow'].includes(key); mesh.receiveShadow = true; root.add(mesh);
        }
        group.add(root);
    }
    group.userData.walkFootprints = footprints;
    let elapsed = 0;
    group.userData.update = (dt, position, reducedMotion = false) => {
        if (!group.parent || !position || !Number.isFinite(dt) || dt <= 0) return;
        elapsed = (elapsed + Math.min(dt, .1)) % 10000;
        for (const motion of motions) {
            if (Math.hypot(position.x - motion.site.x, position.z - motion.site.z) > 90) continue;
            if (motion.kind === 'ripple') motion.mesh.scale.setScalar(reducedMotion ? 1 : 1 + Math.sin(elapsed * 1.4) * .25);
            else if (motion.kind === 'resident') {
                motion.mesh.rotation.x = motion.rest + (reducedMotion ? 0 : Math.sin(elapsed * 1.6 + motion.phase) * .12);
                motion.head.rotation.y = reducedMotion ? 0 : Math.sin(elapsed * .4 + motion.phase) * .08;
            }
            else motion.mesh.rotation.x = reducedMotion ? 0 : Math.sin(elapsed * .8 + motion.phase) * .065;
        }
    };
    return group;
}
