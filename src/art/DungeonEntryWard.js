import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createDungeonBevelBlock } from './DungeonVigilGeometry.js';
import { createDungeonVeilMaterial } from './DungeonVeilMaterial.js';

// Room-owned masonry borrows the kit's existing surface maps. The authoritative
// dungeon summary still drives readiness and the physical doorway stays fixed.
export function createDungeonEntryWard(theme, { surfaceMaterials = null } = {}) {
    const root = new THREE.Group();
    root.name = 'DungeonEntryWard';
    root.userData.visualOnly = true;
    const stoneParts = [], metalParts = [];
    const color = new THREE.Color();
    const bake = (geometry, parts, shade = 1) => {
        const source = geometry.index ? geometry.toNonIndexed() : geometry;
        if (source !== geometry) geometry.dispose();
        source.clearGroups();
        const colors = new Float32Array(source.attributes.position.count * 3);
        const uvs = new Float32Array(source.attributes.position.count * 2);
        const p = source.attributes.position;
        for (let i = 0; i < source.attributes.position.count; i++) {
            // Broad worn courses, never per-frame random glitter.
            const wear = .96 + .04 * Math.sin(p.getX(i) * 1.7 + p.getY(i) * 2.1);
            color.setScalar(shade * wear).toArray(colors, i * 3);
        }
        // Give each physical triangle one dominant-axis chart. Smoothed vertex
        // normals can straddle axes on bevels and collapse the texture area.
        // Project in metres so individual courses and the wide threshold keep
        // the same grain scale, without changing the silhouette or shading.
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
        for (let i = 0; i < p.count; i += 3) {
            a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
            const normal = b.sub(a).cross(c.sub(a));
            const nx = Math.abs(normal.x), ny = Math.abs(normal.y), nz = Math.abs(normal.z);
            const top = ny >= nx && ny >= nz, side = !top && nx >= nz;
            for (let j = i; j < i + 3; j++) {
                uvs[j * 2] = (side ? p.getZ(j) : p.getX(j)) / 1.2;
                uvs[j * 2 + 1] = (top ? p.getZ(j) : p.getY(j)) / 1.2;
            }
        }
        source.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        source.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        parts.push(source);
    };
    const block = (parts, x, y, z, width, height, depth, shade = 1) => {
        const geometry = createDungeonBevelBlock();
        geometry.scale(width, height, depth); geometry.translate(x, y, z);
        bake(geometry, parts, shade);
    };
    // Two circular arcs meet at a pointed crown. Each voussoir has real bevels
    // and a narrow mortar joint; the opening remains continuous to the floor.
    for (const side of [-1, 1]) {
        for (let course = 0; course < 4; course++)
            block(stoneParts, side * 3.2, .65 + course * .78, 0, .76, .75, .82, .87 + course * .035);
        block(stoneParts, side * 3.2, .18, 0, 1.3, .34, 1.3, .85);
        block(stoneParts, side * 3.2, 3.45, 0, 1.02, .25, 1.08, 1);
        for (let segment = 0; segment < 7; segment++) {
            const shape = new THREE.Shape();
            const point = (radius, fraction) => {
                const end = Math.acos(-2.8 / radius), angle = Math.PI + (end - Math.PI) * fraction;
                return [side * -(2.8 + Math.cos(angle) * radius), 3.5 + Math.sin(angle) * radius];
            };
            const a = (segment + .018) / 7, b = (segment + .982) / 7;
            const points = [point(6.42, a), point(6.42, b), point(5.66, b), point(5.66, a)];
            shape.moveTo(...points[0]); points.slice(1).forEach(p => shape.lineTo(...p)); shape.closePath();
            const geometry = new THREE.ExtrudeGeometry(shape, { depth: .8, steps: 1,
                bevelEnabled: true, bevelThickness: .035, bevelSize: .035, bevelSegments: 1 });
            geometry.translate(0, 0, -.4);
            bake(geometry, stoneParts, .86 + (segment % 3) * .055);
        }
        // Tarnished straps and inset nails share one material/draw.
        for (const y of [1.25, 2.75, 3.45]) {
            block(metalParts, side * 3.2, y, .45, .82, .11, .08, .9);
            for (const dx of [-.23, .23]) block(metalParts, side * 3.2 + dx, y, .51, .065, .065, .045);
        }
    }
    block(stoneParts, 0, .015, 0, 7.7, .02, 1.35, .88);
    block(metalParts, 0, .033, .12, 5.6, .005, .08, .9);
    const addBaked = (name, parts, material, castShadow) => {
        const geometry = mergeGeometries(parts, false); parts.forEach(part => part.dispose());
        geometry.clearGroups(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = name; mesh.castShadow = castShadow; mesh.receiveShadow = true; root.add(mesh);
    };
    // Desaturate the regional stone palette; colored witchlight belongs in
    // the veil and existing vigils rather than a uniformly luminous green frame.
    const stoneColor = new THREE.Color(theme.palette.midtone).lerp(new THREE.Color(0x77736b), .72);
    const finish = (material, role) => {
        const shared = surfaceMaterials?.[role];
        if (shared) {
            for (const key of ['map', 'normalMap', 'roughnessMap']) material[key] = shared[key];
            material.normalScale.copy(shared.normalScale);
            material.emissive.copy(shared.emissive);
            material.emissiveIntensity = shared.emissiveIntensity;
            material.roughness = 1;
            material.userData.dungeonPropSurface = role;
        }
        return material;
    };
    addBaked('DungeonEntryWard:Masonry', stoneParts, finish(new THREE.MeshStandardMaterial({
        color: stoneColor, vertexColors: true, roughness: .93, metalness: 0 }), 'stone'), true);
    addBaked('DungeonEntryWard:Ironwork', metalParts, finish(new THREE.MeshStandardMaterial({
        color: 0x615b4b, vertexColors: true, roughness: .48, metalness: .68 }), 'metal'), false);

    const shape = new THREE.Shape();
    shape.moveTo(-2.83, .03); shape.lineTo(-2.83, 3.5);
    const end = Math.acos(-2.8 / 5.63);
    for (let i = 0; i <= 14; i++) {
        const angle = Math.PI + (end - Math.PI) * i / 14;
        shape.lineTo(2.8 + Math.cos(angle) * 5.63, 3.5 + Math.sin(angle) * 5.63);
    }
    for (let i = 14; i >= 0; i--) {
        const angle = Math.PI + (end - Math.PI) * i / 14;
        shape.lineTo(-(2.8 + Math.cos(angle) * 5.63), 3.5 + Math.sin(angle) * 5.63);
    }
    shape.lineTo(2.83, .03); shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape), position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) geometry.attributes.uv.setXY(i, position.getX(i) / 5.66 + .5, position.getY(i) / 8.4);
    const material = createDungeonVeilMaterial(theme.palette.spirit);
    material.transparent = true; material.opacity = .18; material.depthWrite = false;
    const veil = new THREE.Mesh(geometry, material);
    veil.name = 'DungeonExitPortal'; veil.position.z = -.05; root.add(veil);
    root.traverse(part => {
        part.userData.visualOnly = true; part.userData.proceduralDungeonRoomState = true;
        if (part.isMesh) part.userData.proceduralDungeonInteriorPart = true;
    });
    return root;
}
