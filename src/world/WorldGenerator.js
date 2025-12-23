import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Shared temp objects to reduce allocations during instancing
const TEMP_BOX = new THREE.Box3();
const TEMP_POS = new THREE.Vector3();
const TEMP_SCALE = new THREE.Vector3();
const TEMP_QUAT = new THREE.Quaternion();
const TEMP_MAT4 = new THREE.Matrix4();
const TEMP_UP = new THREE.Vector3(0, 1, 0);

export class WorldGenerator {
    constructor(scene, collisionManager) {
        this.scene = scene;
        this.collisionManager = collisionManager;

        const loader = new THREE.TextureLoader();
        this.floorTexture = loader.load('./assets/backgrounds/cobblestone.png');
        this.floorTexture.wrapS = THREE.RepeatWrapping;
        this.floorTexture.wrapT = THREE.RepeatWrapping;

        this.wallTexture = loader.load('./assets/backgrounds/cobblestone_walls.png');
        this.wallTexture.wrapS = THREE.RepeatWrapping;
        this.wallTexture.wrapT = THREE.RepeatWrapping;
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

        const pickTreePlacements = (count) => {
            const placements = [];
            placements.length = 0;

            for (let i = 0; i < count; i++) {
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
                    placements.push({ x, z });
                }
            }
            return placements;
        };

        const extractMeshParts = (root) => {
            const parts = [];
            root.traverse((child) => {
                if (!child.isMesh) return;
                // Ensure geometry bounds exist so instancing doesn't do extra work later
                if (child.geometry && child.geometry.boundingBox === null) {
                    child.geometry.computeBoundingBox();
                }
                parts.push(child);
            });
            return parts;
        };

        treeTypes.forEach(type => {
            loader.load(`./assets/plants/${type.file}`, (gltf) => {
                const model = gltf.scene;
                model.updateMatrixWorld(true);

                // Compute a base bottom offset once (approx) so instances sit on the ground.
                TEMP_BOX.setFromObject(model);
                const baseBottomY = TEMP_BOX.min.y;

                const placements = pickTreePlacements(type.count);
                if (placements.length === 0) return;

                const parts = extractMeshParts(model);
                if (parts.length === 0) return;

                const group = new THREE.Group();
                group.name = `trees:${type.file}`;

                // One InstancedMesh per mesh-part in the GLB.
                // This preserves multi-mesh tree models (trunk + leaves etc.) without hundreds of scene nodes.
                const instancedMeshes = [];
                for (const part of parts) {
                    const material = Array.isArray(part.material)
                        ? part.material.map(m => m.clone())
                        : part.material.clone();
                    const inst = new THREE.InstancedMesh(part.geometry, material, placements.length);
                    inst.castShadow = true;
                    inst.receiveShadow = true;
                    instancedMeshes.push(inst);
                    group.add(inst);
                }

                for (let i = 0; i < placements.length; i++) {
                    const { x, z } = placements[i];
                    const scale = type.scaleMin + Math.random() * (type.scaleMax - type.scaleMin);
                    const rotation = Math.random() * Math.PI * 2;

                    TEMP_POS.set(x, (-baseBottomY) * scale, z);
                    TEMP_SCALE.set(scale, scale, scale);
                    TEMP_QUAT.setFromAxisAngle(TEMP_UP, rotation);
                    TEMP_MAT4.compose(TEMP_POS, TEMP_QUAT, TEMP_SCALE);

                    for (const inst of instancedMeshes) {
                        inst.setMatrixAt(i, TEMP_MAT4);
                    }

                    // Trunk Collider (keep as before)
                    const colliderSize = new THREE.Vector3(2, 10, 2);
                    const colliderCenter = new THREE.Vector3(x, 5, z);
                    const collider = new THREE.Box3().setFromCenterAndSize(colliderCenter, colliderSize);
                    this.collisionManager.addCollider(collider);
                }

                for (const inst of instancedMeshes) {
                    inst.instanceMatrix.needsUpdate = true;
                }

                this.scene.add(group);
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
        
        const texture = this.floorTexture.clone();
        texture.repeat.set(size / 10, size / 10);
        texture.needsUpdate = true;

        const floorMat = new THREE.MeshStandardMaterial({ map: texture });
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
        
        if (layout && layout.rooms && layout.rooms.length > 0) {
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
                
                // Corridor to previous (Manhattan Routing)
                if (prevRoom) {
                    const corridorWidth = 40;
                    const halfWidth = corridorWidth / 2;
                    
                    const dx = room.x - prevRoom.x;
                    const dz = room.z - prevRoom.z;
                    
                    // Use width for size since rooms are square
                    const prevSize = prevRoom.width; 
                    const currentSize = room.width;

                    if (Math.abs(dz) > Math.abs(dx)) {
                        // Vertical -> Horizontal -> Vertical
                        
                        // Check for straight line (or very close)
                        if (Math.abs(dx) < corridorWidth) {
                             this.createCorridor(prevRoom.x, prevRoom.z, room.x, room.z, corridorWidth, prevSize/2, currentSize/2);
                        } else {
                            const midZ = (prevRoom.z + room.z) / 2;
                            
                            // 1. Vertical from Prev
                            this.createCorridor(prevRoom.x, prevRoom.z, prevRoom.x, midZ, corridorWidth, prevSize/2, halfWidth);

                            // Corner 1
                            const c1Openings = {};
                            if (prevRoom.z < midZ) c1Openings.north = true;
                            else c1Openings.south = true;
                            
                            if (room.x > prevRoom.x) c1Openings.east = true;
                            else c1Openings.west = true;

                            this.createCorner(prevRoom.x, midZ, corridorWidth, c1Openings);

                            // 2. Horizontal
                            this.createCorridor(prevRoom.x, midZ, room.x, midZ, corridorWidth, halfWidth, halfWidth);

                            // Corner 2
                            const c2Openings = {};
                            if (prevRoom.x < room.x) c2Openings.west = true;
                            else c2Openings.east = true;
                            
                            if (room.z < midZ) c2Openings.north = true;
                            else c2Openings.south = true;

                            this.createCorner(room.x, midZ, corridorWidth, c2Openings);

                            // 3. Vertical to Room
                            this.createCorridor(room.x, midZ, room.x, room.z, corridorWidth, halfWidth, currentSize/2);
                        }
                    } else {
                        // Horizontal -> Vertical -> Horizontal
                        
                        // Check for straight line
                        if (Math.abs(dz) < corridorWidth) {
                             this.createCorridor(prevRoom.x, prevRoom.z, room.x, room.z, corridorWidth, prevSize/2, currentSize/2);
                        } else {
                            const midX = (prevRoom.x + room.x) / 2;
                            
                            // 1. Horizontal from Prev
                            this.createCorridor(prevRoom.x, prevRoom.z, midX, prevRoom.z, corridorWidth, prevSize/2, halfWidth);

                            // Corner 1
                            const c1Openings = {};
                            if (prevRoom.x < midX) c1Openings.west = true;
                            else c1Openings.east = true;
                            
                            if (room.z > prevRoom.z) c1Openings.south = true;
                            else c1Openings.north = true;

                            this.createCorner(midX, prevRoom.z, corridorWidth, c1Openings);

                            // 2. Vertical
                            this.createCorridor(midX, prevRoom.z, midX, room.z, corridorWidth, halfWidth, halfWidth);

                            // Corner 2
                            const c2Openings = {};
                            if (prevRoom.z < room.z) c2Openings.north = true;
                            else c2Openings.south = true;
                            
                            if (room.x > midX) c2Openings.east = true;
                            else c2Openings.west = true;

                            this.createCorner(midX, room.z, corridorWidth, c2Openings);

                            // 3. Horizontal to Room
                            this.createCorridor(midX, room.z, room.x, room.z, corridorWidth, halfWidth, currentSize/2);
                        }
                    }
                }
                
                prevRoom = room;
            });
            return;
        }

        const roomSize = 80;
        const corridorWidth = 20;
        
        // Start Room (0,0) - Open North
        this.createRoom(centerX, centerZ, roomSize, 0x444444, { north: true });
        
        // Boss Rooms (Linear Path North)
        const bossLocations = [
            { x: 0, z: -200, name: "Rootbound Warden" },
            { x: 0, z: -400, name: "Briar Matron" },
            { x: 0, z: -600, name: "Rustbound Colossus" },
            { x: 0, z: -800, name: "Hollow Sentinel" }
        ];
        
        let prevX = centerX;
        let prevZ = centerZ;
        
        for (let i = 0; i < bossLocations.length; i++) {
            const loc = bossLocations[i];
            const x = centerX + loc.x;
            const z = centerZ + loc.z;
            
            // Corridor
            // Start at prevRoom edge (40), End at room edge (40)
            this.createCorridor(prevX, prevZ, x, z, corridorWidth, 40, 40);
            
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
        
        const texture = this.floorTexture.clone();
        texture.repeat.set(size / 10, size / 10);
        texture.needsUpdate = true;

        const floorMat = new THREE.MeshStandardMaterial({ map: texture });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(x, 0.1, z);
        this.scene.add(floor);
        
        const wallHeight = 15;
        const wallThickness = 2;
        const doorWidth = 40; // Match corridor width

        // Helper to create wall segments with potential doorway
        const createWallSide = (cx, cz, isVertical, hasOpening, isTransparent) => {
            if (!hasOpening) {
                // Full Wall
                if (isVertical) {
                    this.createWall(cx, cz, size + wallThickness, wallHeight, wallThickness, Math.PI/2, isTransparent);
                } else {
                    this.createWall(cx, cz, size + wallThickness, wallHeight, wallThickness, 0, isTransparent);
                }
            } else {
                // Wall with Doorway (Two segments)
                const segmentLen = (size - doorWidth) / 2;
                if (segmentLen <= 0) return; // Room too small for door walls

                const offset = (doorWidth + segmentLen) / 2;

                if (isVertical) {
                    // East/West side (Vertical along Z)
                    this.createWall(cx, cz - offset, segmentLen, wallHeight, wallThickness, Math.PI/2, isTransparent);
                    this.createWall(cx, cz + offset, segmentLen, wallHeight, wallThickness, Math.PI/2, isTransparent);
                } else {
                    // North/South side (Horizontal along X)
                    this.createWall(cx - offset, cz, segmentLen, wallHeight, wallThickness, 0, isTransparent);
                    this.createWall(cx + offset, cz, segmentLen, wallHeight, wallThickness, 0, isTransparent);
                }
            }
        };

        // North (z - size/2) - Back Wall (Opaque)
        createWallSide(x, z - size/2, false, openings.north, false);
        // South (z + size/2) - Front Wall (Transparent)
        createWallSide(x, z + size/2, false, openings.south, true);
        // East (x + size/2) - Right Wall (Transparent)
        createWallSide(x + size/2, z, true, openings.east, true);
        // West (x - size/2) - Left Wall (Opaque)
        createWallSide(x - size/2, z, true, openings.west, false);
    }

    createWall(x, z, w, h, d, rotY, isTransparent = false) {
        const geo = new THREE.BoxGeometry(w, h, d);
        
        const texture = this.wallTexture.clone();
        texture.repeat.set(w / 10, h / 10);
        texture.needsUpdate = true;

        const mat = new THREE.MeshStandardMaterial({ 
            map: texture,
            transparent: isTransparent,
            opacity: isTransparent ? 0.3 : 1.0
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, h/2, z);
        mesh.rotation.y = rotY;
        this.scene.add(mesh);
        
        const collider = new THREE.Box3().setFromObject(mesh);
        this.collisionManager.addCollider(collider);
    }

    createCorner(x, z, width, openings = {}) {
        // Floor
        const floorGeo = new THREE.PlaneGeometry(width, width);
        
        const texture = this.floorTexture.clone();
        texture.repeat.set(width / 10, width / 10);
        texture.needsUpdate = true;

        const floorMat = new THREE.MeshStandardMaterial({ map: texture });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(x, 0.1, z); // Match room/corridor height
        this.scene.add(floor);

        // Walls
        const wallHeight = 15;
        const wallThickness = 2;

        if (!openings.north) {
             this.createWall(x, z - width/2, width, wallHeight, wallThickness, 0, false);
        }
        if (!openings.south) {
             this.createWall(x, z + width/2, width, wallHeight, wallThickness, 0, true);
        }
        if (!openings.east) {
             this.createWall(x + width/2, z, width, wallHeight, wallThickness, Math.PI/2, true);
        }
        if (!openings.west) {
             this.createWall(x - width/2, z, width, wallHeight, wallThickness, Math.PI/2, false);
        }

        // Corner Pillars (to fill gaps)
        const pillarSize = 2.5; // Slightly larger than wall thickness (2)
        const pillarGeo = new THREE.BoxGeometry(pillarSize, 15, pillarSize);
        
        const offsets = [
            { ox: -width/2, oz: -width/2 },
            { ox: width/2, oz: -width/2 },
            { ox: -width/2, oz: width/2 },
            { ox: width/2, oz: width/2 }
        ];

        offsets.forEach(off => {
            const px = x + off.ox;
            const pz = z + off.oz;
            
            // Transparency Check
            const isTransparent = (px + pz) > (x + z);
            
            const pillarTexture = this.wallTexture.clone();
            pillarTexture.repeat.set(0.5, 1.5);
            pillarTexture.needsUpdate = true;

            const pillarMat = new THREE.MeshStandardMaterial({ 
                map: pillarTexture,
                transparent: isTransparent,
                opacity: isTransparent ? 0.3 : 1.0
            });

            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(px, 7.5, pz);
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
        
        // Calculate center of walls/floor
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

        const segmentLength = dist - wallStartOffset - wallEndOffset;
        if (segmentLength <= 0) return; // Completely trimmed

        // Floor (Trimmed)
        // Use 0.1 to match room floor height since we are trimming
        const geo = new THREE.PlaneGeometry(segmentLength, width);
        
        const texture = this.floorTexture.clone();
        texture.repeat.set(segmentLength / 10, width / 10);
        texture.needsUpdate = true;

        const mat = new THREE.MeshStandardMaterial({ map: texture });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(cx, 0.1, cz);
        mesh.rotation.z = -angle; 
        this.scene.add(mesh);
        
        // Walls (Trimmed)
        const wallLength = segmentLength;
        const wallHeight = 15;
        const wallThickness = 2;
        const wallGeo = new THREE.BoxGeometry(wallLength, wallHeight, wallThickness);

        // Determine transparency based on wall position relative to corridor center
        // Camera is at (+100, +100, +100) looking at (0,0,0)
        // Walls with higher X or higher Z than the floor center block the view
        
        // Left Wall Position
        const lx = cx + Math.cos(angle + Math.PI/2) * (width/2 + wallThickness/2);
        const lz = cz + Math.sin(angle + Math.PI/2) * (width/2 + wallThickness/2);
        
        // Right Wall Position
        const rx = cx + Math.cos(angle - Math.PI/2) * (width/2 + wallThickness/2);
        const rz = cz + Math.sin(angle - Math.PI/2) * (width/2 + wallThickness/2);

        // Check if Left Wall is "in front" (Higher X or Z)
        // Simple heuristic: Sum of X+Z. Higher sum = closer to camera.
        const leftScore = lx + lz;
        const rightScore = rx + rz;
        const centerScore = cx + cz;

        const isLeftTransparent = leftScore > centerScore;
        const isRightTransparent = rightScore > centerScore;

        const leftTexture = this.wallTexture.clone();
        leftTexture.repeat.set(wallLength / 10, wallHeight / 10);
        leftTexture.needsUpdate = true;

        const leftMat = new THREE.MeshStandardMaterial({ 
            map: leftTexture,
            transparent: isLeftTransparent,
            opacity: isLeftTransparent ? 0.3 : 1.0
        });

        const rightTexture = this.wallTexture.clone();
        rightTexture.repeat.set(wallLength / 10, wallHeight / 10);
        rightTexture.needsUpdate = true;

        const rightMat = new THREE.MeshStandardMaterial({ 
            map: rightTexture,
            transparent: isRightTransparent,
            opacity: isRightTransparent ? 0.3 : 1.0
        });

        // Left Wall
        const leftWall = new THREE.Mesh(wallGeo, leftMat);
        leftWall.position.set(lx, wallHeight/2, lz);
        leftWall.rotation.y = -angle;
        this.scene.add(leftWall);
        this.collisionManager.addCollider(new THREE.Box3().setFromObject(leftWall));

        // Right Wall
        const rightWall = new THREE.Mesh(wallGeo, rightMat);
        rightWall.position.set(rx, wallHeight/2, rz);
        rightWall.rotation.y = -angle;
        this.scene.add(rightWall);
        this.collisionManager.addCollider(new THREE.Box3().setFromObject(rightWall));
    }
}
