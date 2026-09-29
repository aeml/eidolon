import * as THREE from 'three';

// Beam damage remains a server-owned horizontal segment. Its presentation
// follows that exact XZ segment above the triangulated terrain. Splitting at
// grid/diagonal crossings keeps hill crests out of the beam, including between
// endpoints. The geometry is owned by one effect, never placed in the art cache.
export function createTerrainBeamGeometry(start, end, field, radius, sides = 8) {
    const dx = end.x - start.x, dz = end.z - start.z;
    const horizontal = Math.hypot(dx, dz);
    const sideX = horizontal > 1e-8 ? dz / horizontal : 1;
    const sideZ = horizontal > 1e-8 ? -dx / horizontal : 0;
    const times = new Set([0, 1]);
    const gx = (start.x - field.minX) / field.stepX;
    const gz = (start.z - field.minZ) / field.stepZ;
    const vx = dx / field.stepX, vz = dz / field.stepZ;
    for (const [origin, velocity, limit] of [[gx, vx, field.columns], [gz, vz, field.rows], [gx + gz, vx + vz, field.columns + field.rows]]) {
        if (Math.abs(velocity) < 1e-10) continue;
        const first = Math.max(0, Math.ceil(Math.min(origin, origin + velocity)));
        const last = Math.min(limit, Math.floor(Math.max(origin, origin + velocity)));
        for (let edge = first; edge <= last; edge++) {
            const t = (edge - origin) / velocity;
            if (t > 1e-9 && t < 1 - 1e-9) times.add(t);
        }
    }
    const samples = [...times].sort((a, b) => a - b);
    const centers = [], offsets = [], normals = [], uvs = [], indices = [];
    const startLift = start.y - field.sample(start.x, start.z);
    const endLift = end.y - field.sample(end.x, end.z);
    samples.forEach((t, row) => {
        const x = start.x + dx * t, z = start.z + dz * t;
        const y = field.sample(x, z) + startLift + (endLift - startLift) * t;
        for (let side = 0; side <= sides; side++) {
            const angle = side / sides * Math.PI * 2;
            const nx = sideX * Math.cos(angle), ny = Math.sin(angle), nz = sideZ * Math.cos(angle);
            centers.push(x - start.x, y - start.y, z - start.z);
            offsets.push(nx * radius, ny * radius, nz * radius);
            normals.push(nx, ny, nz);
            uvs.push(side / sides, t);
            if (row < samples.length - 1 && side < sides) {
                const a = row * (sides + 1) + side, b = a + 1, c = a + sides + 1;
                indices.push(a, b, c, b, c + 1, c);
            }
        }
    });
    const geometry = new THREE.BufferGeometry();
    const positions = new THREE.Float32BufferAttribute(centers.length, 3);
    positions.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', positions);
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    const setWidthScale = scale => {
        for (let i = 0; i < centers.length; i++) positions.array[i] = centers[i] + offsets[i] * scale;
        positions.needsUpdate = true;
        geometry.computeBoundingSphere();
        geometry.computeBoundingBox();
    };
    setWidthScale(1);
    return { geometry, setWidthScale };
}
