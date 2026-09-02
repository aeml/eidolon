import * as THREE from 'three';
import { MeshFactory } from '../utils/MeshFactory.js';
import {
    PROCEDURAL_FOLIAGE_RECIPES,
    createProceduralFoliagePlacements,
    getProceduralFoliageArchetype
} from '../art/ProceduralRealmFoliage.js';
import {
    LANTERNHOLD_STRUCTURE_DEFINITIONS,
    createLanternholdCampPlacements,
    createProceduralLanternholdCampField,
    createProceduralLanternholdStructure
} from '../art/ProceduralLanternholdArchitecture.js';
import {
    DUNGEON_ENTRANCE_DEFINITIONS,
    DUNGEON_ENTRANCE_IDS,
    createProceduralDungeonEntrance
} from '../art/ProceduralDungeonEntrances.js';

// Shared temp objects to reduce allocations during instancing
const TEMP_POS = new THREE.Vector3();
const TEMP_SCALE = new THREE.Vector3();
const TEMP_QUAT = new THREE.Quaternion();
const TEMP_MAT4 = new THREE.Matrix4();
const TEMP_PART_MAT4 = new THREE.Matrix4();
const TEMP_UP = new THREE.Vector3(0, 1, 0);

export class WorldGenerator {
    constructor(scene, collisionManager) {
        this.scene = scene;
        this.collisionManager = collisionManager;

        this.floorTexture = null;
        this.wallTexture = null;
    }

    async preloadTextures() {
        if (this.floorTexture && this.wallTexture) return;
        const loader = new THREE.TextureLoader();

        const floor = await loader.loadAsync('./assets/backgrounds/cobblestone.png');
        floor.wrapS = THREE.RepeatWrapping;
        floor.wrapT = THREE.RepeatWrapping;
        this.floorTexture = floor;

        const wall = await loader.loadAsync('./assets/backgrounds/cobblestone_walls.png');
        wall.wrapS = THREE.RepeatWrapping;
        wall.wrapT = THREE.RepeatWrapping;
        this.wallTexture = wall;
    }

    async createTown(centerX, centerZ, size) {
        console.log(`Generating town at ${centerX},${centerZ} size ${size}`);

        await this.createTownBase(centerX, centerZ, size);
        await this.createTownDecorations(centerX, centerZ);
    }

    async createTownBase(centerX, centerZ, size) {
        console.log(`Generating town base at ${centerX},${centerZ} size ${size}`);

        await this.preloadTextures();
        
        // Use the passed size as radius (should be 100)
        // const radius = size;

        // Note: CollisionManager safe zone is box-only, so we rely on the fence colliders
        // generated below to define the physical boundary.
        
        // this.createCircularFence(centerX, centerZ, radius);
        this.createRectangularFence(centerX, centerZ, size * 2, size * 2);
    }

    async createTownDecorations(centerX, centerZ) {
        await Promise.all([
            this.loadBuildings(centerX, centerZ),
            this.loadTrees(centerX, centerZ)
        ]);
    }

    async loadTrees(cx, cz, { shouldAttach = () => true } = {}) {
        // cx/cz remain part of the public signature because town generation
        // calls this method as a decoration phase. Placements themselves are
        // deterministic world-space recipes so reconnects and screenshots do
        // not reshuffle landmarks around the player.
        void cx;
        void cz;
        if (!shouldAttach()) return false;

        for (const recipe of PROCEDURAL_FOLIAGE_RECIPES) {
            const placements = createProceduralFoliagePlacements(recipe);
            const parts = getProceduralFoliageArchetype(recipe.id);
            const group = new THREE.Group();
            group.name = `foliage:${recipe.region}:${recipe.id}`;
            group.userData.proceduralFoliage = true;
            group.userData.foliageId = recipe.id;
            group.userData.region = recipe.region;
            group.userData.theme = recipe.theme;
            group.userData.instanceCount = placements.length;
            group.userData.placements = placements;
            const colliders = [];

            const instancedParts = parts.map((descriptor) => {
                const configuredMaterial = MeshFactory.configureShadowCastingForMaterial(
                    descriptor.material,
                    { isFoliage: true }
                );
                const instance = new THREE.InstancedMesh(
                    descriptor.geometry,
                    configuredMaterial,
                    placements.length
                );
                instance.name = descriptor.name;
                instance.castShadow = descriptor.castShadow;
                instance.receiveShadow = descriptor.receiveShadow;
                group.add(instance);
                return { descriptor, instance };
            });

            placements.forEach((placement, index) => {
                TEMP_POS.set(placement.x, 0, placement.z);
                TEMP_SCALE.setScalar(placement.scale);
                TEMP_QUAT.setFromAxisAngle(TEMP_UP, placement.rotation);
                TEMP_MAT4.compose(TEMP_POS, TEMP_QUAT, TEMP_SCALE);

                for (const { descriptor, instance } of instancedParts) {
                    TEMP_PART_MAT4.multiplyMatrices(TEMP_MAT4, descriptor.matrix);
                    instance.setMatrixAt(index, TEMP_PART_MAT4);
                }

                if (recipe.collision) {
                    const [radius, height] = recipe.collision;
                    const colliderSize = new THREE.Vector3(
                        radius * 2 * placement.scale,
                        height * placement.scale,
                        radius * 2 * placement.scale
                    );
                    const colliderCenter = new THREE.Vector3(
                        placement.x,
                        colliderSize.y / 2,
                        placement.z
                    );
                    colliders.push(new THREE.Box3().setFromCenterAndSize(colliderCenter, colliderSize));
                }
            });

            for (const { instance } of instancedParts) {
                instance.instanceMatrix.needsUpdate = true;
                instance.computeBoundingBox();
                instance.computeBoundingSphere();
            }
            if (!shouldAttach()) return false;
            colliders.forEach((collider) => this.collisionManager.addCollider(collider));
            this.scene.add(group);
        }
        return true;
    }

    async loadBuildings(cx, cz, { shouldAttach = () => true } = {}) {
        if (!shouldAttach()) return false;

        const setupBuilding = (mesh, x, z, rotationY = 0, targetY = -0.5, customCollider = null) => {
            mesh.rotation.y = rotationY;
            mesh.position.set(x, 0, z); // Start at 0
            
            // Update matrix to get correct bounds
            mesh.updateMatrixWorld(true);
            
            const box = new THREE.Box3().setFromObject(mesh);
            const bottomY = box.min.y;
            
            // Shift so the bottom aligns with targetY
            mesh.position.y += (targetY - bottomY);
            
            mesh.traverse(c => { if(c.isMesh) { MeshFactory.configureShadowCastingForObject(c, { stableFrontShadows: true }); } });
            if (!shouldAttach()) return false;
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
            return true;
        };

        setupBuilding(
            createProceduralLanternholdStructure('oathhall', { optimized: true }),
            cx,
            cz - 30,
            0
        );
        setupBuilding(
            createProceduralLanternholdStructure('trading_post', { optimized: true }),
            cx + 30,
            cz,
            -Math.PI / 2
        );
        setupBuilding(
            createProceduralLanternholdStructure('blacksmith', { optimized: true }),
            cx - 30,
            cz,
            Math.PI / 2
        );

        // Trading House is now an Entity (loaded in MeshFactory) to handle interaction/collision better

        const campPlacements = createLanternholdCampPlacements(cx, cz);
        const campField = createProceduralLanternholdCampField(campPlacements);
        campField.traverse((part) => {
            if (part.isMesh) {
                MeshFactory.configureShadowCastingForObject(part, { stableFrontShadows: true });
            }
        });
        if (!shouldAttach()) return false;
        this.scene.add(campField);
        const campHeight = LANTERNHOLD_STRUCTURE_DEFINITIONS.camp.bounds[1];
        for (const placement of campPlacements) {
            const collider = new THREE.Box3().setFromCenterAndSize(
                new THREE.Vector3(placement.x, -0.65 + campHeight / 2, placement.z),
                new THREE.Vector3(2, 10, 2)
            );
            this.collisionManager.addCollider(collider);
        }
        return true;
    }

    createRectangularFence(cx, cz, width, depth) {
        // Taller fence: Post height 8, Rail height adjusted
        const postGeo = new THREE.BoxGeometry(0.8, 8, 0.8);
        const railGeo = new THREE.BoxGeometry(4, 0.4, 0.2);
        const createFenceMaterial = () => MeshFactory.configureShadowCastingForMaterial(
            new THREE.MeshStandardMaterial({ color: 0x8B4513 }),
            { stableFrontShadows: true }
        );

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
            this.addPost(group, postGeo, createFenceMaterial(), x, z);

            // Rails
            const railHeights = [2, 4, 6];
            for (let h of railHeights) {
                const rail = new THREE.Mesh(railGeo, createFenceMaterial());
                rail.castShadow = true;
                rail.receiveShadow = true;
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
        post.castShadow = true;
        post.receiveShadow = true;
        post.position.set(x, 4, z); // Center at y=4 for height 8
        group.add(post);
    }

    async createDungeon(centerX, centerZ, size) {
        console.log(`Generating dungeon at ${centerX},${centerZ}`);

        await this.preloadTextures();

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

    async createOverworldStructures({ shouldAttach = () => true } = {}) {
        // All four landmarks are synchronous, cached procedural architecture.
        // Check scene ownership before constructing the set so a realm change
        // cannot leave partial visuals or invisible circular colliders behind.
        if (!shouldAttach()) return false;

        for (const dungeonType of DUNGEON_ENTRANCE_IDS) {
            const definition = DUNGEON_ENTRANCE_DEFINITIONS[dungeonType];
            const entrance = createProceduralDungeonEntrance(dungeonType, { optimized: true });
            entrance.position.set(...definition.position);
            entrance.traverse((part) => {
                if (part.isMesh && part.userData.proceduralDungeonEntrancePart) {
                    MeshFactory.configureShadowCastingForObject(part, { stableFrontShadows: true });
                }
            });
            this.scene.add(entrance);
            this.collisionManager.addCircularCollider(
                definition.position[0],
                definition.position[2],
                definition.interactionRadius
            );
            console.log(
                `Created ${definition.label} at ${definition.position[0]}, ${definition.position[2]} with radius ${definition.interactionRadius}`
            );
        }

        return true;
    }

    hasCanonicalDungeonGeometry(layout) {
        return !!(
            layout &&
            Array.isArray(layout.rooms) &&
            layout.rooms.length > 0 &&
            Array.isArray(layout.walkRects) &&
            layout.walkRects.length > 0 &&
            Array.isArray(layout.corridors) &&
            layout.corridors.length > 0
        );
    }

    createLayoutDrivenDungeon(layout) {
        if (!layout || !Array.isArray(layout.rooms) || layout.rooms.length === 0) {
            return false;
        }

        if (this.hasCanonicalDungeonGeometry(layout)) {
            this.createCanonicalLayoutDungeon(layout);
            return true;
        }

        this.createLegacyLayoutDungeon(layout);
        return true;
    }

    createCanonicalLayoutDungeon(layout) {
        const roomOpenings = this.buildCanonicalRoomOpenings(layout);

        layout.rooms.forEach((room, index) => {
            this.createRoom(room.x, room.z, room.width, room.color, roomOpenings[index] || {});
        });

        layout.corridors.forEach((corridor) => {
            const corridorRects = this.getCanonicalCorridorRects(layout, corridor);
            if (corridorRects.length === 0) return;

            const fromRoom = layout.rooms[corridor.fromRoomIndex];
            const toRoom = layout.rooms[corridor.toRoomIndex];
            if (!fromRoom || !toRoom) return;

            const points = [this.getRoomAttachmentPoint(fromRoom, corridorRects[0])];

            for (let i = 0; i < corridorRects.length - 1; i++) {
                const cornerPoint = this.getCorridorConnectionPoint(corridorRects[i], corridorRects[i + 1]);
                if (cornerPoint) {
                    points.push(cornerPoint);
                }
            }

            points.push(this.getRoomAttachmentPoint(toRoom, corridorRects[corridorRects.length - 1]));

            const corridorWidth = corridor.width || this.getWalkRectThickness(corridorRects[0]) || 40;
            for (let i = 0; i < points.length - 1; i++) {
                const start = points[i];
                const end = points[i + 1];
                if (this.getPointDistance(start, end) < 0.1) continue;
                this.createCorridor(start.x, start.z, end.x, end.z, corridorWidth, 0, 0);
            }

            for (let i = 1; i < points.length - 1; i++) {
                this.createCorner(
                    points[i].x,
                    points[i].z,
                    corridorWidth,
                    this.buildCornerOpenings(points[i - 1], points[i], points[i + 1])
                );
            }
        });
    }

    createLegacyLayoutDungeon(layout) {
        let prevRoom = null;

        layout.rooms.forEach((room, index) => {
            const openings = this.buildLegacyRoomOpenings(layout.rooms, index);
            this.createRoom(room.x, room.z, room.width, room.color, openings);

            if (prevRoom) {
                this.createLegacyCorridorBetweenRooms(prevRoom, room);
            }

            prevRoom = room;
        });
    }

    buildLegacyRoomOpenings(rooms, index) {
        const room = rooms[index];
        const openings = {};
        const checkOpening = (target) => {
            if (!target) return;

            const dx = target.x - room.x;
            const dz = target.z - room.z;

            if (Math.abs(dz) > Math.abs(dx)) {
                if (dz < 0) openings.north = true;
                else openings.south = true;
            } else {
                if (dx > 0) openings.east = true;
                else openings.west = true;
            }
        };

        checkOpening(rooms[index - 1]);
        checkOpening(rooms[index + 1]);
        return openings;
    }

    createLegacyCorridorBetweenRooms(prevRoom, room) {
        const corridorWidth = 40;
        const halfWidth = corridorWidth / 2;

        const dx = room.x - prevRoom.x;
        const dz = room.z - prevRoom.z;

        const prevSize = prevRoom.width;
        const currentSize = room.width;

        if (Math.abs(dz) > Math.abs(dx)) {
            if (Math.abs(dx) < corridorWidth) {
                this.createCorridor(prevRoom.x, prevRoom.z, room.x, room.z, corridorWidth, prevSize / 2, currentSize / 2);
            } else {
                const midZ = (prevRoom.z + room.z) / 2;

                this.createCorridor(prevRoom.x, prevRoom.z, prevRoom.x, midZ, corridorWidth, prevSize / 2, halfWidth);

                const c1Openings = {};
                if (prevRoom.z < midZ) c1Openings.north = true;
                else c1Openings.south = true;

                if (room.x > prevRoom.x) c1Openings.east = true;
                else c1Openings.west = true;

                this.createCorner(prevRoom.x, midZ, corridorWidth, c1Openings);

                this.createCorridor(prevRoom.x, midZ, room.x, midZ, corridorWidth, halfWidth, halfWidth);

                const c2Openings = {};
                if (prevRoom.x < room.x) c2Openings.west = true;
                else c2Openings.east = true;

                if (room.z < midZ) c2Openings.north = true;
                else c2Openings.south = true;

                this.createCorner(room.x, midZ, corridorWidth, c2Openings);

                this.createCorridor(room.x, midZ, room.x, room.z, corridorWidth, halfWidth, currentSize / 2);
            }
        } else if (Math.abs(dz) < corridorWidth) {
            this.createCorridor(prevRoom.x, prevRoom.z, room.x, room.z, corridorWidth, prevSize / 2, currentSize / 2);
        } else {
            const midX = (prevRoom.x + room.x) / 2;

            this.createCorridor(prevRoom.x, prevRoom.z, midX, prevRoom.z, corridorWidth, prevSize / 2, halfWidth);

            const c1Openings = {};
            if (prevRoom.x < midX) c1Openings.west = true;
            else c1Openings.east = true;

            if (room.z > prevRoom.z) c1Openings.south = true;
            else c1Openings.north = true;

            this.createCorner(midX, prevRoom.z, corridorWidth, c1Openings);

            this.createCorridor(midX, prevRoom.z, midX, room.z, corridorWidth, halfWidth, halfWidth);

            const c2Openings = {};
            if (prevRoom.z < room.z) c2Openings.north = true;
            else c2Openings.south = true;

            if (room.x > midX) c2Openings.east = true;
            else c2Openings.west = true;

            this.createCorner(midX, room.z, corridorWidth, c2Openings);

            this.createCorridor(midX, room.z, room.x, room.z, corridorWidth, halfWidth, currentSize / 2);
        }
    }

    buildCanonicalRoomOpenings(layout) {
        const roomOpenings = layout.rooms.map(() => ({}));

        layout.corridors.forEach((corridor) => {
            const corridorRects = this.getCanonicalCorridorRects(layout, corridor);
            if (corridorRects.length === 0) return;

            const fromRoom = layout.rooms[corridor.fromRoomIndex];
            const toRoom = layout.rooms[corridor.toRoomIndex];
            if (!fromRoom || !toRoom) return;

            this.addRoomOpeningFromCorridor(roomOpenings[corridor.fromRoomIndex], fromRoom, corridorRects[0]);
            this.addRoomOpeningFromCorridor(roomOpenings[corridor.toRoomIndex], toRoom, corridorRects[corridorRects.length - 1]);
        });

        return roomOpenings;
    }

    addRoomOpeningFromCorridor(openings, room, rect) {
        const side = this.getRoomAttachmentSide(room, rect);
        if (side) {
            openings[side] = true;
        }
    }

    getCanonicalCorridorRects(layout, corridor) {
        if (!layout || !Array.isArray(layout.walkRects) || !corridor || !Array.isArray(corridor.walkRectIndices)) {
            return [];
        }

        return corridor.walkRectIndices
            .map((index) => layout.walkRects[index])
            .filter((rect) => rect && rect.kind === 'corridor');
    }

    getRoomAttachmentSide(room, rect) {
        const orientation = this.getWalkRectOrientation(rect);
        if (orientation === 'horizontal') {
            return rect.x >= room.x ? 'east' : 'west';
        }
        if (orientation === 'vertical') {
            return rect.z >= room.z ? 'south' : 'north';
        }

        const dx = rect.x - room.x;
        const dz = rect.z - room.z;
        if (Math.abs(dx) >= Math.abs(dz)) {
            return dx >= 0 ? 'east' : 'west';
        }
        return dz >= 0 ? 'south' : 'north';
    }

    getRoomAttachmentPoint(room, rect) {
        const roomHalfWidth = (room.width || 0) / 2;
        const roomHalfHeight = (room.height || room.width || 0) / 2;
        const orientation = this.getWalkRectOrientation(rect);

        if (orientation === 'horizontal') {
            return {
                x: rect.x >= room.x ? room.x + roomHalfWidth : room.x - roomHalfWidth,
                z: this.clampToRange(rect.z, room.z - roomHalfHeight, room.z + roomHalfHeight)
            };
        }

        if (orientation === 'vertical') {
            return {
                x: this.clampToRange(rect.x, room.x - roomHalfWidth, room.x + roomHalfWidth),
                z: rect.z >= room.z ? room.z + roomHalfHeight : room.z - roomHalfHeight
            };
        }

        return { x: room.x, z: room.z };
    }

    getWalkRectOrientation(rect) {
        if (!rect) return 'unknown';

        if (rect.width > rect.height) return 'horizontal';
        if (rect.height > rect.width) return 'vertical';
        return 'unknown';
    }

    getWalkRectThickness(rect) {
        const orientation = this.getWalkRectOrientation(rect);
        if (orientation === 'horizontal') return rect.height;
        if (orientation === 'vertical') return rect.width;
        return Math.min(rect.width || 0, rect.height || 0);
    }

    getCorridorConnectionPoint(a, b) {
        const aOrientation = this.getWalkRectOrientation(a);
        const bOrientation = this.getWalkRectOrientation(b);

        if (aOrientation === 'horizontal' && bOrientation === 'vertical') {
            return { x: b.x, z: a.z };
        }
        if (aOrientation === 'vertical' && bOrientation === 'horizontal') {
            return { x: a.x, z: b.z };
        }

        const minX = Math.max(a.x - a.width / 2, b.x - b.width / 2);
        const maxX = Math.min(a.x + a.width / 2, b.x + b.width / 2);
        const minZ = Math.max(a.z - a.height / 2, b.z - b.height / 2);
        const maxZ = Math.min(a.z + a.height / 2, b.z + b.height / 2);

        if (maxX <= minX || maxZ <= minZ) {
            return null;
        }

        return {
            x: (minX + maxX) / 2,
            z: (minZ + maxZ) / 2
        };
    }

    buildCornerOpenings(prevPoint, cornerPoint, nextPoint) {
        const openings = {};
        const applyDirection = (target) => {
            const dx = target.x - cornerPoint.x;
            const dz = target.z - cornerPoint.z;

            if (Math.abs(dx) >= Math.abs(dz)) {
                if (dx > 0) openings.east = true;
                else if (dx < 0) openings.west = true;
            } else if (dz > 0) {
                openings.south = true;
            } else if (dz < 0) {
                openings.north = true;
            }
        };

        applyDirection(prevPoint);
        applyDirection(nextPoint);
        return openings;
    }

    getPointDistance(a, b) {
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        return Math.sqrt((dx * dx) + (dz * dz));
    }

    clampToRange(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    async createVerdantBastionCatacombs(centerX, centerZ, layout) {
        console.log(`Generating Verdant Bastion Catacombs at ${centerX},${centerZ}`);

        await this.preloadTextures();
        
        if (this.createLayoutDrivenDungeon(layout)) {
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

    async createMoltenCore(centerX, centerZ, layout) {
        console.log(`Generating Molten Core at ${centerX},${centerZ}`);

        await this.preloadTextures();

        if (this.createLayoutDrivenDungeon(layout)) {
            return;
        }
    }

    async createTempestSpire(centerX, centerZ, layout) {
        console.log(`Generating Tempest Spire at ${centerX},${centerZ}`);

        await this.preloadTextures();

        if (this.createLayoutDrivenDungeon(layout)) {
            return;
        }
    }

    async createAbyssalWell(centerX, centerZ, layout) {
        console.log(`Generating Abyssal Well at ${centerX},${centerZ}`);

        await this.preloadTextures();

        if (this.createLayoutDrivenDungeon(layout)) {
            return;
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
