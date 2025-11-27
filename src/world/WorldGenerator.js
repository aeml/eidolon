import * as THREE from 'three';

export class WorldGenerator {
    constructor(scene, collisionManager) {
        this.scene = scene;
        this.collisionManager = collisionManager;
    }

    createTown(centerX, centerZ, size) {
        console.log(`Generating town at ${centerX},${centerZ} size ${size}`);
        
        // Define Safe Zone (Town Area)
        const halfSize = size / 2;
        const townBox = new THREE.Box3(
            new THREE.Vector3(centerX - halfSize, -10, centerZ - halfSize),
            new THREE.Vector3(centerX + halfSize, 10, centerZ + halfSize)
        );
        this.collisionManager.addSafeZone(townBox);

        this.createFence(centerX, centerZ, size);
    }

    createFence(cx, cz, size) {
        const halfSize = size / 2;
        const postGeo = new THREE.BoxGeometry(0.5, 2, 0.5);
        const railGeo = new THREE.BoxGeometry(size, 0.2, 0.2);
        const material = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // SaddleBrown

        const group = new THREE.Group();

        // --- Visuals ---

        // Posts
        const step = 5;
        // North & South Walls
        for (let x = -halfSize; x <= halfSize; x += step) {
            this.addPost(group, postGeo, material, cx + x, cz - halfSize); // North
            
            // South Wall (Leave gap in middle)
            if (Math.abs(x) > 5) { 
                this.addPost(group, postGeo, material, cx + x, cz + halfSize); 
            }
        }
        // East & West Walls
        for (let z = -halfSize; z <= halfSize; z += step) {
            this.addPost(group, postGeo, material, cx - halfSize, cz + z); // West
            this.addPost(group, postGeo, material, cx + halfSize, cz + z); // East
        }

        // Rails
        // North
        const railN = new THREE.Mesh(railGeo, material);
        railN.position.set(cx, 1.5, cz - halfSize);
        group.add(railN);

        // South (Split into two to make gap)
        const gapSize = 10;
        const railLen = (size - gapSize) / 2;
        const railSGeo = new THREE.BoxGeometry(railLen, 0.2, 0.2);
        
        const railS1 = new THREE.Mesh(railSGeo, material);
        railS1.position.set(cx - halfSize + railLen/2, 1.5, cz + halfSize);
        group.add(railS1);

        const railS2 = new THREE.Mesh(railSGeo, material);
        railS2.position.set(cx + halfSize - railLen/2, 1.5, cz + halfSize);
        group.add(railS2);

        // East/West
        const railEW = new THREE.Mesh(railGeo, material);
        railEW.rotation.y = Math.PI / 2;
        railEW.position.set(cx - halfSize, 1.5, cz);
        group.add(railEW);

        const railEW2 = railEW.clone();
        railEW2.rotation.y = Math.PI / 2;
        railEW2.position.set(cx + halfSize, 1.5, cz);
        group.add(railEW2);

        this.scene.add(group);

        // --- Colliders ---
        const thickness = 1;
        
        // North Wall Collider
        this.collisionManager.addCollider(new THREE.Box3(
            new THREE.Vector3(cx - halfSize, 0, cz - halfSize - thickness),
            new THREE.Vector3(cx + halfSize, 5, cz - halfSize + thickness)
        ));

        // West Wall Collider
        this.collisionManager.addCollider(new THREE.Box3(
            new THREE.Vector3(cx - halfSize - thickness, 0, cz - halfSize),
            new THREE.Vector3(cx - halfSize + thickness, 5, cz + halfSize)
        ));

        // East Wall Collider
        this.collisionManager.addCollider(new THREE.Box3(
            new THREE.Vector3(cx + halfSize - thickness, 0, cz - halfSize),
            new THREE.Vector3(cx + halfSize + thickness, 5, cz + halfSize)
        ));

        // South Wall Colliders (Left and Right of gap)
        // Gap is from x = -5 to x = 5
        // Left part: -halfSize to -5
        this.collisionManager.addCollider(new THREE.Box3(
            new THREE.Vector3(cx - halfSize, 0, cz + halfSize - thickness),
            new THREE.Vector3(cx - 5, 5, cz + halfSize + thickness)
        ));
        // Right part: 5 to halfSize
        this.collisionManager.addCollider(new THREE.Box3(
            new THREE.Vector3(cx + 5, 0, cz + halfSize - thickness),
            new THREE.Vector3(cx + halfSize, 5, cz + halfSize + thickness)
        ));
    }

    addPost(group, geo, mat, x, z) {
        const post = new THREE.Mesh(geo, mat);
        post.position.set(x, 1, z);
        group.add(post);
    }
}
