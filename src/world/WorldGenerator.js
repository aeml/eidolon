import * as THREE from 'three';

export class WorldGenerator {
    constructor(scene, collisionManager) {
        this.scene = scene;
        this.collisionManager = collisionManager;
    }

    createTown(centerX, centerZ, size) {
        console.log(`Generating town at ${centerX},${centerZ} size ${size}`);
        
        // Use the passed size as radius (should be 100)
        // const radius = size;

        // Note: CollisionManager safe zone is box-only, so we rely on the fence colliders
        // generated below to define the physical boundary.
        
        // this.createCircularFence(centerX, centerZ, radius);
        this.createRectangularFence(centerX, centerZ, size * 2, size * 2);
    }

    createRectangularFence(cx, cz, width, depth) {
        // Taller fence: Post height 8, Rail height adjusted
        const postGeo = new THREE.BoxGeometry(0.8, 8, 0.8);
        const railGeo = new THREE.BoxGeometry(4, 0.4, 0.2);
        const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });

        const group = new THREE.Group();
        
        const minX = cx - width / 2;
        const maxX = cx + width / 2;
        const minZ = cz - depth / 2;
        const maxZ = cz + depth / 2;

        const segmentLength = 4;
        const exitGap = 20;

        // Helper to create segment
        const createSegment = (x, z, rotation) => {
            // Post
            this.addPost(group, postGeo, material, x, z);

            // Rails
            const railHeights = [2, 4, 6];
            for (let h of railHeights) {
                const rail = new THREE.Mesh(railGeo, material);
                rail.position.set(x, h, z);
                rail.rotation.y = rotation;
                group.add(rail);
            }

            // Collider
            const collider = new THREE.Box3();
            const sizeX = (Math.abs(Math.cos(rotation)) > 0.1) ? 4.5 : 1.0;
            const sizeZ = (Math.abs(Math.sin(rotation)) > 0.1) ? 4.5 : 1.0;
            
            collider.setFromCenterAndSize(
                new THREE.Vector3(x, 4, z),
                new THREE.Vector3(sizeX, 8, sizeZ) 
            );
            this.collisionManager.addCollider(collider);
        };

        // North Wall (minZ) - Horizontal
        for (let x = minX; x <= maxX; x += segmentLength) {
            if (Math.abs(x - cx) < exitGap / 2) continue;
            createSegment(x, minZ, 0);
        }

        // South Wall (maxZ) - Horizontal
        for (let x = minX; x <= maxX; x += segmentLength) {
            if (Math.abs(x - cx) < exitGap / 2) continue;
            createSegment(x, maxZ, 0);
        }

        // West Wall (minX) - Vertical
        for (let z = minZ; z <= maxZ; z += segmentLength) {
            if (Math.abs(z - cz) < exitGap / 2) continue;
            createSegment(minX, z, Math.PI / 2);
        }

        // East Wall (maxX) - Vertical
        for (let z = minZ; z <= maxZ; z += segmentLength) {
            if (Math.abs(z - cz) < exitGap / 2) continue;
            createSegment(maxX, z, Math.PI / 2);
        }

        this.scene.add(group);
    }

    addPost(group, geo, mat, x, z) {
        const post = new THREE.Mesh(geo, mat);
        post.position.set(x, 4, z); // Center at y=4 for height 8
        group.add(post);
    }
}
