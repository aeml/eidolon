import * as THREE from 'three';

export class WorldGenerator {
    constructor(scene, collisionManager) {
        this.scene = scene;
        this.collisionManager = collisionManager;
    }

    createTown(centerX, centerZ, size) {
        console.log(`Generating town at ${centerX},${centerZ} size ${size}`);
        
        // Switch to circular town with radius 60 (matching Lv 1-10 border)
        const radius = 60;

        // Note: CollisionManager safe zone is box-only, so we rely on the fence colliders
        // generated below to define the physical boundary.
        
        this.createCircularFence(centerX, centerZ, radius);
    }

    createCircularFence(cx, cz, radius) {
        const postGeo = new THREE.BoxGeometry(0.5, 2, 0.5);
        const railGeo = new THREE.BoxGeometry(4, 0.2, 0.2);
        const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });

        const group = new THREE.Group();
        const circumference = 2 * Math.PI * radius;
        const segmentLength = 4; 
        const count = Math.floor(circumference / segmentLength);
        const angleStep = (2 * Math.PI) / count;

        // Exits at N, S, E, W
        // Angles in 3D (X, Z): 0=East, PI/2=South, PI=West, 3PI/2=North
        const exitWidthAngle = 12 / radius; // ~12 unit gap

        for (let i = 0; i < count; i++) {
            const angle = i * angleStep;
            
            // Check for exits
            let isExit = false;
            for (let exitAngle of [0, Math.PI/2, Math.PI, 3*Math.PI/2]) {
                let diff = Math.abs(angle - exitAngle);
                if (diff > Math.PI) diff = 2*Math.PI - diff;
                if (diff < exitWidthAngle / 2) {
                    isExit = true;
                    break;
                }
            }

            if (isExit) continue;

            const x = cx + Math.cos(angle) * radius;
            const z = cz + Math.sin(angle) * radius;
            
            // Post
            this.addPost(group, postGeo, material, x, z);

            // Rail
            const rail = new THREE.Mesh(railGeo, material);
            rail.position.set(x, 1.5, z);
            // Tangent rotation
            rail.rotation.y = -angle + Math.PI/2;
            group.add(rail);

            // Collider (Approximate circle with small boxes)
            const collider = new THREE.Box3();
            // Make collider slightly larger/thicker to prevent slipping through
            collider.setFromCenterAndSize(
                new THREE.Vector3(x, 1.5, z),
                new THREE.Vector3(2, 5, 2) 
            );
            this.collisionManager.addCollider(collider);
        }

        this.scene.add(group);
    }

    addPost(group, geo, mat, x, z) {
        const post = new THREE.Mesh(geo, mat);
        post.position.set(x, 1, z);
        group.add(post);
    }
}
