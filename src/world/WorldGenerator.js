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
                // Center it on the mesh's actual center (better for rotated/offset meshes)
                mesh.updateMatrixWorld(true);
                const currentBox = new THREE.Box3().setFromObject(mesh);
                const center = currentBox.getCenter(new THREE.Vector3());
                // Keep the Y center somewhat grounded or use the passed size's half height?
                // For now, let's use the visual center but override Y if needed?
                // Actually, box.getCenter() gives the geometric center.
                
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

        // Blacksmith (West) - Scaled 7.8x
        loader.load('./assets/buildings/blacksmith.glb', (gltf) => {
            setupBuilding(gltf.scene, 7.8, cx - 30, cz, Math.PI / 2);
        }, undefined, (err) => console.error("Failed to load blacksmith:", err));

        // Trading House is now an Entity (loaded in MeshFactory) to handle interaction/collision better

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

    createDungeon(centerX, centerZ, size) {
        console.log(`Generating dungeon at ${centerX},${centerZ}`);

        // Simple room for now
        const floorGeo = new THREE.PlaneGeometry(size, size);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(centerX, 0.1, centerZ); // Slightly above ground to cover grass
        this.scene.add(floor);

        // Walls
        this.createRectangularFence(centerX, centerZ, size, size);

        // Add some pillars
        const pillarGeo = new THREE.BoxGeometry(2, 10, 2);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x555555 });

        for (let i = 0; i < 10; i++) {
            const x = (Math.random() * size) - size / 2;
            const z = (Math.random() * size) - size / 2;
            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(centerX + x, 5, centerZ + z);
            this.scene.add(pillar);

            const collider = new THREE.Box3().setFromObject(pillar);
            this.collisionManager.addCollider(collider);
        }
    }

    createOverworldStructures() {
        const loader = new GLTFLoader();
        
        // The Verdant Bastion (Level 40-50 Dungeon)
        // Location: X=800, Z=200 (In the InfernoTitan area)
        loader.load('./assets/buildings/dungeons/the_verdant_bastion.glb', (gltf) => {
            const mesh = gltf.scene;
            mesh.name = 'DungeonEntrance'; // Tag for interaction
            const scale = 40; // "Very large"
            mesh.scale.set(scale, scale, scale);
            mesh.position.set(800, 0, 200);
            
            mesh.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(mesh);
            const bottomY = box.min.y;
            mesh.position.y += (0 - bottomY); // Ground it

            mesh.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
            this.scene.add(mesh);

            // Update matrix again to account for the Y shift
            mesh.updateMatrixWorld(true);

            // Add collision
            // const collider = new THREE.Box3().setFromObject(mesh);
            // this.collisionManager.addCollider(collider);

            // Use circular collider for better fit
            const collisionBox = new THREE.Box3().setFromObject(mesh);
            const size = new THREE.Vector3();
            collisionBox.getSize(size);
            // Use slightly smaller radius than full box width to avoid "corners" issue
            const radius = (Math.min(size.x, size.z) / 2) * 0.9; 
            
            // Store radius for interaction range
            mesh.userData.interactionRadius = radius;

            console.log(`Bastion Size: ${size.x}x${size.z}, Radius: ${radius}`);
            this.collisionManager.addCircularCollider(800, 200, radius);
            
            console.log(`Loaded The Verdant Bastion at 800, 200 with radius ${radius}`);
            
            console.log("Loaded The Verdant Bastion at 800, 200");
        }, undefined, (err) => console.error("Failed to load the_verdant_bastion:", err));
    }

    createVerdantBastionCatacombs(centerX, centerZ, layout) {
        console.log(`Generating Verdant Bastion Catacombs at ${centerX},${centerZ}`);
        
        if (layout && layout.rooms) {
            let prevRoom = null;
            
            layout.rooms.forEach((room, index) => {
                const nextRoom = layout.rooms[index + 1];
                
                // Determine openings based on neighbors
                const openings = {};
                const checkOpening = (target) => {
                    if (!target) return;
                    const dx = target.x - room.x;
                    const dz = target.z - room.z;
                    
                    if (Math.abs(dz) > Math.abs(dx)) {
                        // Mostly vertical
                        if (dz < 0) openings.north = true;
                        else openings.south = true;
                    } else {
                        // Mostly horizontal
                        if (dx > 0) openings.east = true;
                        else openings.west = true;
                    }
                };
                
                checkOpening(prevRoom);
                checkOpening(nextRoom);
                
                this.createRoom(room.x, room.z, room.width, room.color, openings);
                
                // Corridor to previous (Z-Shaped / Manhattan Routing)
                if (prevRoom) {
                    const corridorWidth = 20;
                    const halfWidth = corridorWidth / 2;
                    
                    // 1. Vertical Segment from PrevRoom
                    // Exit North/South from PrevRoom to the midpoint Z
                    const midZ = (prevRoom.z + room.z) / 2;
                    
                    // Wall Start: prevRoom.height/2 (Exit Room)
                    // Wall End: halfWidth (Enter Corner)
                    this.createCorridor(prevRoom.x, prevRoom.z, prevRoom.x, midZ, corridorWidth, prevRoom.height/2, halfWidth);

                    // Corner 1
                    this.createCorner(prevRoom.x, midZ, corridorWidth);

                    // 2. Horizontal Segment
                    // Move East/West to align with Room X
                    // Wall Start: halfWidth (Exit Corner 1)
                    // Wall End: halfWidth (Enter Corner 2)
                    this.createCorridor(prevRoom.x, midZ, room.x, midZ, corridorWidth, halfWidth, halfWidth);

                    // Corner 2
                    this.createCorner(room.x, midZ, corridorWidth);

                    // 3. Vertical Segment to Room
                    // Enter North/South into Room
                    // Wall Start: halfWidth (Exit Corner 2)
                    // Wall End: room.height/2 (Enter Room)
                    this.createCorridor(room.x, midZ, room.x, room.z, corridorWidth, halfWidth, room.height/2);
                }
                
                prevRoom = room;
            });
            return;
        }

        const roomSize = 40;
        const corridorWidth = 10;
        
        // Start Room (0,0) - Open North
        this.createRoom(centerX, centerZ, roomSize, 0x444444, { north: true });
        
        // Boss Rooms (Linear Path North)
        const bossLocations = [
            { x: 0, z: -100, name: "Rootbound Warden" },
            { x: 0, z: -200, name: "Briar Matron" },
            { x: 0, z: -300, name: "Rustbound Colossus" },
            { x: 0, z: -400, name: "Hollow Sentinel" }
        ];
        
        let prevX = centerX;
        let prevZ = centerZ;
        
        for (let i = 0; i < bossLocations.length; i++) {
            const loc = bossLocations[i];
            const x = centerX + loc.x;
            const z = centerZ + loc.z;
            
            // Corridor
            // Start at prevRoom edge (20), End at room edge (20)
            this.createCorridor(prevX, prevZ, x, z, corridorWidth, 20, 20);
            
            // Room
            const isLast = i === bossLocations.length - 1;
            // Open South (entry) and North (exit) unless last
            this.createRoom(x, z, roomSize, 0x222222, { south: true, north: !isLast });
            
            prevX = x;
            prevZ = z;
        }
    }

    createRoom(x, z, size, color, openings = {}) {
        // Floor
        const floorGeo = new THREE.PlaneGeometry(size, size);
        const floorMat = new THREE.MeshStandardMaterial({ color: color });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(x, 0.1, z);
        this.scene.add(floor);
        
        const wallHeight = 15;
        const wallThickness = 2;
        const doorWidth = 20; // Match corridor width

        // Helper to create wall segments with potential doorway
        const createWallSide = (cx, cz, isVertical, hasOpening) => {
            if (!hasOpening) {
                // Full Wall
                if (isVertical) {
                    this.createWall(cx, cz, wallThickness, wallHeight, size + wallThickness, 0);
                } else {
                    this.createWall(cx, cz, size + wallThickness, wallHeight, wallThickness, 0);
                }
            } else {
                // Wall with Doorway (Two segments)
                const segmentLen = (size - doorWidth) / 2;
                if (segmentLen <= 0) return; // Room too small for door walls

                const offset = (doorWidth + segmentLen) / 2;

                if (isVertical) {
                    // East/West side (Vertical along Z)
                    this.createWall(cx, cz - offset, wallThickness, wallHeight, segmentLen, 0);
                    this.createWall(cx, cz + offset, wallThickness, wallHeight, segmentLen, 0);
                } else {
                    // North/South side (Horizontal along X)
                    this.createWall(cx - offset, cz, segmentLen, wallHeight, wallThickness, 0);
                    this.createWall(cx + offset, cz, segmentLen, wallHeight, wallThickness, 0);
                }
            }
        };

        // North (z - size/2)
        createWallSide(x, z - size/2, false, openings.north);
        // South (z + size/2)
        createWallSide(x, z + size/2, false, openings.south);
        // East (x + size/2)
        createWallSide(x + size/2, z, true, openings.east);
        // West (x - size/2)
        createWallSide(x - size/2, z, true, openings.west);
    }

    createWall(x, z, w, h, d, rotY) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshStandardMaterial({ color: 0x555555 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, h/2, z);
        mesh.rotation.y = rotY;
        this.scene.add(mesh);
        
        const collider = new THREE.Box3().setFromObject(mesh);
        this.collisionManager.addCollider(collider);
    }

    createCorner(x, z, width) {
        // Floor
        const floorGeo = new THREE.PlaneGeometry(width, width);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(x, 0.11, z);
        this.scene.add(floor);

        // Corner Pillars (to fill gaps)
        const pillarSize = 2.5; // Slightly larger than wall thickness (2)
        const pillarGeo = new THREE.BoxGeometry(pillarSize, 15, pillarSize);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x555555 });

        const offsets = [
            { ox: -width/2, oz: -width/2 },
            { ox: width/2, oz: -width/2 },
            { ox: -width/2, oz: width/2 },
            { ox: width/2, oz: width/2 }
        ];

        offsets.forEach(off => {
            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(x + off.ox, 7.5, z + off.oz);
            this.scene.add(pillar);
            this.collisionManager.addCollider(new THREE.Box3().setFromObject(pillar));
        });
    }

    createCorridor(x1, z1, x2, z2, width, wallStartOffset = 0, wallEndOffset = 0) {
        const dx = x2 - x1;
        const dz = z2 - z1;
        const dist = Math.sqrt(dx*dx + dz*dz);
        if (dist < 0.1) return; // Too short

        const angle = Math.atan2(dz, dx); // Angle in radians
        
        // Floor (Full Length)
        // Raise slightly to 0.11 to avoid z-fighting with room floors
        const geo = new THREE.PlaneGeometry(dist, width);
        const mat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set((x1+x2)/2, 0.11, (z1+z2)/2);
        mesh.rotation.z = -angle; 
        this.scene.add(mesh);
        
        // Walls (Trimmed)
        const wallLength = dist - wallStartOffset - wallEndOffset;
        if (wallLength <= 0) return; // Walls completely trimmed

        const wallHeight = 15;
        const wallThickness = 2;
        const wallGeo = new THREE.BoxGeometry(wallLength, wallHeight, wallThickness);
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
        
        // Calculate center of walls
        // Start point shifted by wallStartOffset
        // End point shifted by wallEndOffset
        // Center is midpoint of trimmed segment
        
        // Direction vector
        const dirX = Math.cos(angle);
        const dirZ = Math.sin(angle);

        const startX = x1 + dirX * wallStartOffset;
        const startZ = z1 + dirZ * wallStartOffset;
        const endX = x2 - dirX * wallEndOffset;
        const endZ = z2 - dirZ * wallEndOffset;

        const cx = (startX + endX) / 2;
        const cz = (startZ + endZ) / 2;

        // Left Wall
        const leftWall = new THREE.Mesh(wallGeo, wallMat);
        leftWall.position.set(
            cx + Math.cos(angle + Math.PI/2) * (width/2 + wallThickness/2),
            wallHeight/2,
            cz + Math.sin(angle + Math.PI/2) * (width/2 + wallThickness/2)
        );
        leftWall.rotation.y = -angle;
        this.scene.add(leftWall);
        this.collisionManager.addCollider(new THREE.Box3().setFromObject(leftWall));

        // Right Wall
        const rightWall = new THREE.Mesh(wallGeo, wallMat);
        rightWall.position.set(
            cx + Math.cos(angle - Math.PI/2) * (width/2 + wallThickness/2),
            wallHeight/2,
            cz + Math.sin(angle - Math.PI/2) * (width/2 + wallThickness/2)
        );
        rightWall.rotation.y = -angle;
        this.scene.add(rightWall);
        this.collisionManager.addCollider(new THREE.Box3().setFromObject(rightWall));
    }
}
