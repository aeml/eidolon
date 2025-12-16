import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
        this.loadBuildings(centerX, centerZ);
        this.loadTrees(centerX, centerZ);
    }

    loadTrees(cx, cz) {
        const loader = new GLTFLoader();
        const treeTypes = [
            { file: 'birch.glb', count: 150, scaleMin: 4, scaleMax: 7 },
            { file: 'pine.glb', count: 150, scaleMin: 4, scaleMax: 7 },
            { file: 'willow.glb', count: 150, scaleMin: 4, scaleMax: 7 }
        ];

        // Earth Realm Bounds (approximate based on fence)
        const bounds = { minX: -950, maxX: 950, minZ: -550, maxZ: 950 };
        // Town Exclusion Zone (Center 0,200, Size 100 -> +/- 100)
        // Add buffer
        const townBounds = { minX: cx - 150, maxX: cx + 150, minZ: cz - 150, maxZ: cz + 150 };

        const setupTree = (model, x, z, scale, rotation) => {
            const mesh = model.clone();
            mesh.scale.set(scale, scale, scale);
            mesh.rotation.y = rotation;
            mesh.position.set(x, 0, z);

            mesh.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(mesh);
            const bottomY = box.min.y;
            
            // Place on ground (0)
            mesh.position.y += (0 - bottomY);

            mesh.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
            this.scene.add(mesh);

            // Custom Trunk Collider
            // Assume trunk is roughly in center. 
            // Width 2, Height 10 (tall enough to block), Depth 2
            const colliderSize = new THREE.Vector3(2, 10, 2);
            const colliderCenter = new THREE.Vector3(x, 5, z); // Center Y at 5
            const collider = new THREE.Box3().setFromCenterAndSize(colliderCenter, colliderSize);
            this.collisionManager.addCollider(collider);
        };

        treeTypes.forEach(type => {
            loader.load(`./assets/plants/${type.file}`, (gltf) => {
                const model = gltf.scene;
                
                for (let i = 0; i < type.count; i++) {
                    let x, z;
                    let valid = false;
                    let attempts = 0;

                    while (!valid && attempts < 50) {
                        x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
                        z = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);

                        // Check if inside town
                        if (x > townBounds.minX && x < townBounds.maxX && 
                            z > townBounds.minZ && z < townBounds.maxZ) {
                            valid = false;
                        } else {
                            valid = true;
                        }
                        attempts++;
                    }

                    if (valid) {
                        const scale = type.scaleMin + Math.random() * (type.scaleMax - type.scaleMin);
                        const rotation = Math.random() * Math.PI * 2;
                        setupTree(model, x, z, scale, rotation);
                    }
                }
            }, undefined, (err) => console.error(`Failed to load ${type.file}:`, err));
        });
    }

    loadBuildings(cx, cz) {
        const loader = new GLTFLoader();
        
        const setupBuilding = (mesh, scale, x, z, rotationY = 0, targetY = -0.5, customCollider = null) => {
            mesh.scale.set(scale, scale, scale);
            mesh.rotation.y = rotationY;
            mesh.position.set(x, 0, z); // Start at 0
            
            // Update matrix to get correct bounds
            mesh.updateMatrixWorld(true);
            
            const box = new THREE.Box3().setFromObject(mesh);
            const bottomY = box.min.y;
            
            // Shift so the bottom aligns with targetY
            mesh.position.y += (targetY - bottomY);
            
            mesh.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
            this.scene.add(mesh);
            
            if (customCollider) {
                // Use custom collider (e.g. smaller box for campsite)
                // Center it on the mesh position
                const center = new THREE.Vector3(x, 4, z); // Height 4 is arbitrary center
                const size = customCollider; // Vector3 size
                const collider = new THREE.Box3().setFromCenterAndSize(center, size);
                this.collisionManager.addCollider(collider);
            } else {
                // Re-calculate box for collision after moving
                mesh.updateMatrixWorld(true);
                const finalBox = new THREE.Box3().setFromObject(mesh);
                this.collisionManager.addCollider(finalBox);
            }
        };

        // Two Story Building (North) - Scaled 12x
        loader.load('./assets/buildings/two_story_building.glb', (gltf) => {
            // Move to North (z - 30)
            setupBuilding(gltf.scene, 12, cx, cz - 30, 0);
        }, undefined, (err) => console.error("Failed to load two_story_building:", err));

        // Trading Post (East) - Scaled 6x
        loader.load('./assets/buildings/trading_post.glb', (gltf) => {
            setupBuilding(gltf.scene, 6, cx + 30, cz, -Math.PI / 2);
        }, undefined, (err) => console.error("Failed to load trading_post:", err));

        // Blacksmith (West) - Scaled 6x
        loader.load('./assets/buildings/blacksmith.glb', (gltf) => {
            setupBuilding(gltf.scene, 6, cx - 30, cz, Math.PI / 2);
        }, undefined, (err) => console.error("Failed to load blacksmith:", err));

        // Blacksmith Forge (Next to Blacksmith)
        loader.load('./assets/buildings/blacksmith_forge.glb', (gltf) => {
            // Place to the left of the blacksmith (more positive Z, same X)
            setupBuilding(gltf.scene, 4, cx - 28, cz + 18, Math.PI / 2); 
        }, undefined, (err) => console.error("Failed to load blacksmith_forge:", err));

        // Camp Sites (Randomly distributed outside center)
        loader.load('./assets/buildings/camp_site.glb', (gltf) => {
            const campModel = gltf.scene;
            const count = 15;
            const exclusionRadius = 50; // Keep away from center buildings
            const townRadius = 85; // Stay within fences (size 100)
            const placedCamps = [];
            const minCampDist = 20; // Minimum distance between camps

            for (let i = 0; i < count; i++) {
                let x, z, dist;
                let attempts = 0;
                let valid = false;

                do {
                    // Random point in square town
                    x = cx + (Math.random() * 2 - 1) * townRadius;
                    z = cz + (Math.random() * 2 - 1) * townRadius;
                    
                    // Check distance from center
                    dist = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(z - cz, 2));
                    
                    if (dist >= exclusionRadius) {
                        // Check distance from other camps
                        let tooClose = false;
                        for (const camp of placedCamps) {
                            const d = Math.sqrt(Math.pow(x - camp.x, 2) + Math.pow(z - camp.z, 2));
                            if (d < minCampDist) {
                                tooClose = true;
                                break;
                            }
                        }
                        if (!tooClose) {
                            valid = true;
                        }
                    }
                    attempts++;
                } while (!valid && attempts < 50);

                if (valid) {
                    placedCamps.push({x, z});
                    const instance = campModel.clone();
                    const rotation = Math.random() * Math.PI * 2;
                    // Scale 4x, Lower slightly to -0.65 to blend ground
                    // Custom collider: Small box in center (2x2) to allow walking on dirt
                    setupBuilding(instance, 4, x, z, rotation, -0.65, new THREE.Vector3(2, 10, 2));
                }
            }
        }, undefined, (err) => console.error("Failed to load camp_site:", err));
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
