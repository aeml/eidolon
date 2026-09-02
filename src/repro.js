import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RenderSystem } from './core/RenderSystem.js';
import { AnimationGallery } from './animationGallery.js';
import { EnvironmentalHazard } from './entities/EnvironmentalHazard.js';
import { ACTIVE_WORLD_HAZARD_TYPES, getRegionTheme } from './art/darkFantasyTheme.js';
import {
    PROCEDURAL_FOLIAGE_RECIPES,
    createProceduralFoliagePreview,
    getProceduralFoliageCacheMetrics
} from './art/ProceduralRealmFoliage.js';
import {
    LANTERNHOLD_STRUCTURE_DEFINITIONS,
    LANTERNHOLD_STRUCTURE_IDS,
    createProceduralLanternholdStructure,
    getProceduralLanternholdCacheMetrics
} from './art/ProceduralLanternholdArchitecture.js';
import {
    DUNGEON_ENTRANCE_DEFINITIONS,
    DUNGEON_ENTRANCE_IDS,
    createProceduralDungeonEntrance,
    getProceduralDungeonEntranceCacheMetrics
} from './art/ProceduralDungeonEntrances.js';
import {
    DUNGEON_INTERIOR_DEFINITIONS,
    DUNGEON_INTERIOR_IDS,
    DUNGEON_ROOM_IDENTITY_IDS,
    createProceduralDungeonInteriorKit
} from './art/ProceduralDungeonInteriors.js';

const urlParams = new URLSearchParams(window.location.search);
const perfOverlayEnabled = urlParams.get('perf') === '1';
const instanceCount = Number.parseInt(urlParams.get('instances') || '250', 10);
const useInstancing = urlParams.get('instancing') !== '0';
const galleryMode = urlParams.get('gallery') === '1';
const hazardGalleryMode = urlParams.get('hazards') === '1';
const foliageGalleryMode = urlParams.get('foliage') === '1';
const architectureGalleryMode = urlParams.get('architecture') === '1';
const entranceGalleryMode = urlParams.get('entrances') === '1';
const interiorGalleryMode = urlParams.get('interiors') === '1';
const specializedGalleryMode = galleryMode || hazardGalleryMode || foliageGalleryMode || architectureGalleryMode || entranceGalleryMode || interiorGalleryMode;

const perfOverlay = document.getElementById('perf-overlay');
const readout = document.getElementById('repro-readout');
const previewWindow = document.getElementById('repro-preview-window');
const triggerTelegraphButton = document.getElementById('repro-trigger-telegraph');
const triggerLootButton = document.getElementById('repro-trigger-loot');
const triggerJumpButton = document.getElementById('repro-trigger-jump');
const triggerVerdantRoomButton = document.getElementById('repro-trigger-room-verdant');
const triggerAbyssRoomButton = document.getElementById('repro-trigger-room-abyss');
const triggerMoltenRoomButton = document.getElementById('repro-trigger-room-molten');
const triggerTempestRoomButton = document.getElementById('repro-trigger-room-tempest');
const toggleWindowButton = document.getElementById('repro-toggle-window');
const resetSceneButton = document.getElementById('repro-reset-scene');
const previewWindowCloseButton = document.getElementById('repro-window-close');

const renderSystem = new RenderSystem(false);
renderSystem.scene.background = new THREE.Color(0x0b0e13);

if (perfOverlayEnabled && perfOverlay) {
    renderSystem.enablePerfOverlay(perfOverlay);
}

await renderSystem.preloadEnvironment();

const controls = new OrbitControls(renderSystem.camera, renderSystem.renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 10;
controls.maxDistance = 120;
controls.target.set(0, 0, 0);
controls.update();

const gridHelper = new THREE.GridHelper(200, 20, 0x3366aa, 0x223344);
gridHelper.position.y = 0.01;
renderSystem.scene.add(gridHelper);

const marker = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 24),
    new THREE.MeshBasicMaterial({ color: 0x66f7ff, opacity: 0.6, transparent: true })
);
marker.rotation.x = -Math.PI / 2;
marker.position.y = 0.05;
marker.visible = false;
renderSystem.scene.add(marker);

const telegraphPreview = new THREE.Mesh(
    new THREE.RingGeometry(3.4, 4.2, 48),
    new THREE.MeshBasicMaterial({ color: 0xff6644, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
);
telegraphPreview.rotation.x = -Math.PI / 2;
telegraphPreview.position.set(0, 0.08, 0);
telegraphPreview.visible = false;
renderSystem.scene.add(telegraphPreview);

const lootPreview = new THREE.Group();
lootPreview.visible = false;
for (let i = 0; i < 6; i += 1) {
    const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.35, 0),
        new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0xffd700 : 0x55ddff, emissive: i % 2 === 0 ? 0x664400 : 0x113355, emissiveIntensity: 0.7 })
    );
    gem.position.set(Math.cos((i / 6) * Math.PI * 2) * 1.8, 0.8 + (i % 2) * 0.2, Math.sin((i / 6) * Math.PI * 2) * 1.8);
    lootPreview.add(gem);
}
renderSystem.scene.add(lootPreview);

const jumpPreview = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 1.7, 0.2, 24),
    new THREE.MeshStandardMaterial({ color: 0xcaa46c, transparent: true, opacity: 0.7 })
);
jumpPreview.position.set(0, 0.1, 0);
jumpPreview.visible = false;
renderSystem.scene.add(jumpPreview);

const dungeonRoomPreview = new THREE.Group();
dungeonRoomPreview.visible = false;
renderSystem.scene.add(dungeonRoomPreview);

const dungeonPreviewThemes = {
    verdant: {
        label: 'Verdant Bastion',
        floorColor: 0x244b32,
        corridorColor: 0x3c6844,
        accentColor: 0x7ce38b,
        bossColor: 0xd8f7a8
    },
    abyss: {
        label: 'Abyssal Well',
        floorColor: 0x18334a,
        corridorColor: 0x1d4f69,
        accentColor: 0x5ed5ff,
        bossColor: 0xb2e9ff
    },
    molten: {
        label: 'Molten Core',
        floorColor: 0x4a2518,
        corridorColor: 0x6d321c,
        accentColor: 0xff8a42,
        bossColor: 0xffd08a
    },
    tempest: {
        label: 'Tempest Spire',
        floorColor: 0x272c55,
        corridorColor: 0x384080,
        accentColor: 0xa78cff,
        bossColor: 0xe1d6ff
    }
};

function clearDungeonRoomPreview() {
    while (dungeonRoomPreview.children.length > 0) {
        const child = dungeonRoomPreview.children.pop();
        child.geometry?.dispose?.();
        child.material?.dispose?.();
    }
}

function addFloorRect(width, depth, x, z, color, opacity = 0.82) {
    const tile = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.12, depth),
        new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.9 })
    );
    tile.position.set(x, 0.04, z);
    tile.receiveShadow = true;
    dungeonRoomPreview.add(tile);
    return tile;
}

function addRoomMarker(x, z, color, radius = 0.55) {
    const markerMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, 0.18, 24),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35 })
    );
    markerMesh.position.set(x, 0.28, z);
    markerMesh.castShadow = true;
    dungeonRoomPreview.add(markerMesh);
    return markerMesh;
}

function triggerDungeonRoomPreview(themeKey) {
    const theme = dungeonPreviewThemes[themeKey] || dungeonPreviewThemes.verdant;
    clearDungeonRoomPreview();

    addFloorRect(9, 7, -14, 0, theme.floorColor);
    addFloorRect(14, 3, -4, 0, theme.corridorColor, 0.72);
    addFloorRect(8, 8, 6, 0, theme.floorColor);
    addFloorRect(14, 3, 16, 0, theme.corridorColor, 0.72);
    addFloorRect(9, 7, 26, 0, theme.floorColor);

    addRoomMarker(-14, 0, 0x66f7ff, 0.45);
    addRoomMarker(6, 0, 0xffd700, 0.5);
    addRoomMarker(26, 0, theme.bossColor, 0.75);

    const approachRing = new THREE.Mesh(
        new THREE.RingGeometry(2.8, 3.45, 48),
        new THREE.MeshBasicMaterial({ color: theme.accentColor, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    approachRing.name = 'boss_approach';
    approachRing.rotation.x = -Math.PI / 2;
    approachRing.position.set(16, 0.18, 0);
    dungeonRoomPreview.add(approachRing);

    for (let i = 0; i < 6; i += 1) {
        const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.28, 0.4, 2.4, 12),
            new THREE.MeshStandardMaterial({ color: theme.accentColor, roughness: 0.75 })
        );
        pillar.position.set(24 + (i % 3) * 1.8, 1.2, i < 3 ? -2.1 : 2.1);
        pillar.castShadow = true;
        dungeonRoomPreview.add(pillar);
    }

    dungeonRoomPreview.visible = true;
    controls.target.set(6, 0, 0);
    controls.update();
    setReadout(`Preview: ${theme.label} dungeon room\nRoute: Entry Gate -> Treasure Cache -> Boss Approach -> Boss Lair\nUse to smoke-check room identity labels, corridor readability, and boss-approach contrast.`);
}

const baseGeometry = new THREE.IcosahedronGeometry(0.8, 0);
const baseMaterial = new THREE.MeshStandardMaterial({ color: 0xff9f66, roughness: 0.4, metalness: 0.1 });

const instances = [];
let instancedMesh = null;
let lightEnabled = true;
let gridEnabled = true;
let telegraphPreviewUntil = 0;
let lootPreviewUntil = 0;
let jumpPreviewUntil = 0;
const spawnCount = Math.max(1, Math.min(instanceCount, 2000));

function setReadout(message) {
    if (readout) {
        readout.textContent = message;
    }
}

function triggerTelegraphPreview() {
    telegraphPreview.visible = true;
    telegraphPreviewUntil = performance.now() + 1400;
    setReadout('Preview: telegraph ring\nUse to sanity-check delayed danger readability.');
}

function triggerLootPreview() {
    lootPreview.visible = true;
    lootPreviewUntil = performance.now() + 1400;
    setReadout('Preview: loot burst\nUse to sanity-check reward punch and object readability.');
}

function triggerJumpPreview() {
    jumpPreview.visible = true;
    jumpPreview.scale.set(1.6, 1, 1.6);
    jumpPreviewUntil = performance.now() + 800;
    setReadout('Preview: jump landing\nUse to sanity-check impact footprint and camera-follow context.');
}

function toggleWindowPreview(forceOpen = null) {
    if (!previewWindow) return;
    const isOpen = previewWindow.style.display === 'block';
    const nextOpen = forceOpen === null ? !isOpen : forceOpen;
    previewWindow.style.display = nextOpen ? 'block' : 'none';
    previewWindow.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');
    if (nextOpen) {
        setReadout('Preview: menu chrome\nCheck close button, Esc dismissal, and non-selectable window text.');
    }
}

function resetPreviewState() {
    telegraphPreview.visible = false;
    lootPreview.visible = false;
    jumpPreview.visible = false;
    dungeonRoomPreview.visible = false;
    telegraphPreviewUntil = 0;
    lootPreviewUntil = 0;
    jumpPreviewUntil = 0;
    clearDungeonRoomPreview();
    marker.visible = false;
    toggleWindowPreview(false);
    setReadout('Last pick: none');
}

if (!specializedGalleryMode && useInstancing) {
    instancedMesh = new THREE.InstancedMesh(baseGeometry, baseMaterial, spawnCount);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < spawnCount; i += 1) {
        const angle = (i / spawnCount) * Math.PI * 2;
        const radius = 20 + (i % 8) * 3;
        dummy.position.set(Math.cos(angle) * radius, 1.2, Math.sin(angle) * radius);
        dummy.rotation.y = angle;
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
    }
    renderSystem.scene.add(instancedMesh);
} else if (!specializedGalleryMode) {
    for (let i = 0; i < spawnCount; i += 1) {
        const angle = (i / spawnCount) * Math.PI * 2;
        const radius = 20 + (i % 8) * 3;
        const mesh = new THREE.Mesh(baseGeometry, baseMaterial.clone());
        mesh.position.set(Math.cos(angle) * radius, 1.2, Math.sin(angle) * radius);
        mesh.rotation.y = angle;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        renderSystem.scene.add(mesh);
        instances.push(mesh);
    }
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const intersection = new THREE.Vector3();

const onPointerMove = (event) => {
    const rect = renderSystem.renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
};

const onPointerDown = () => {
    raycaster.setFromCamera(mouse, renderSystem.camera);
    if (raycaster.ray.intersectPlane(plane, intersection)) {
        marker.visible = true;
        marker.position.set(intersection.x, 0.05, intersection.z);
        setReadout(`Last pick: ${intersection.x.toFixed(1)}, ${intersection.z.toFixed(1)}`);
    }
};

renderSystem.renderer.domElement.addEventListener('pointermove', onPointerMove);
renderSystem.renderer.domElement.addEventListener('pointerdown', onPointerDown);

const toggleLight = () => {
    lightEnabled = !lightEnabled;
    renderSystem.scene.traverse((obj) => {
        if (obj.isLight) {
            obj.visible = lightEnabled;
        }
    });
};

const toggleGrid = () => {
    gridEnabled = !gridEnabled;
    gridHelper.visible = gridEnabled;
};

const togglePerf = () => {
    if (!perfOverlay) return;
    const isVisible = perfOverlay.style.display === 'block';
    perfOverlay.style.display = isVisible ? 'none' : 'block';
};

triggerTelegraphButton?.addEventListener('click', () => triggerTelegraphPreview());
triggerLootButton?.addEventListener('click', () => triggerLootPreview());
triggerJumpButton?.addEventListener('click', () => triggerJumpPreview());
triggerVerdantRoomButton?.addEventListener('click', () => triggerDungeonRoomPreview('verdant'));
triggerAbyssRoomButton?.addEventListener('click', () => triggerDungeonRoomPreview('abyss'));
triggerMoltenRoomButton?.addEventListener('click', () => triggerDungeonRoomPreview('molten'));
triggerTempestRoomButton?.addEventListener('click', () => triggerDungeonRoomPreview('tempest'));
toggleWindowButton?.addEventListener('click', () => toggleWindowPreview());
resetSceneButton?.addEventListener('click', () => resetPreviewState());
previewWindowCloseButton?.addEventListener('click', () => toggleWindowPreview(false));

let animationGallery = null;
if (galleryMode) {
    document.body.classList.add('gallery-mode');
    gridHelper.visible = true;
    animationGallery = new AnimationGallery(renderSystem, controls, setReadout);
    await animationGallery.initialize();
}

const hazardGallery = [];
if (hazardGalleryMode) {
    document.body.classList.add('hazard-gallery-mode');
    const spacing = 16;
    ACTIVE_WORLD_HAZARD_TYPES.forEach((hazardType, index) => {
        const position = {
            x: (index - (ACTIVE_WORLD_HAZARD_TYPES.length - 1) / 2) * spacing,
            y: 0,
            z: 0
        };
        const hazard = new EnvironmentalHazard(`gallery-${hazardType}`, hazardType, position, { radius: 6 });
        hazard.addToScene(renderSystem.effectGroup);
        hazardGallery.push(hazard);
    });
    renderSystem.camera.position.set(24, 28, 38);
    controls.target.set(0, 0, 0);
    controls.update();
    setReadout('Dark-fantasy hazard gallery\nEvery glowing outer edge is the exact server-authoritative damage radius.');
}

const foliageGallery = new THREE.Group();
foliageGallery.name = 'ProceduralRealmFoliageGallery';
if (foliageGalleryMode) {
    document.body.classList.add('foliage-gallery-mode');
    PROCEDURAL_FOLIAGE_RECIPES.forEach((recipe, index) => {
        const column = index % 3;
        const row = Math.floor(index / 3);
        const x = (column - 1) * 7.5;
        const z = (row - 1) * 8.5;
        const preview = createProceduralFoliagePreview(recipe.id);
        preview.position.set(x, 0, z);
        preview.rotation.y = (index % 2 ? -1 : 1) * 0.18;
        foliageGallery.add(preview);

        const theme = getRegionTheme(recipe.region);
        const plinth = new THREE.Mesh(
            new THREE.CylinderGeometry(2.65, 2.85, 0.22, 10),
            new THREE.MeshStandardMaterial({
                color: theme.palette.shadow,
                emissive: theme.palette.accent,
                emissiveIntensity: 0.08,
                roughness: 0.95,
                flatShading: true
            })
        );
        plinth.name = `realm-plinth:${recipe.region}:${recipe.id}`;
        plinth.position.set(x, -0.12, z);
        plinth.receiveShadow = true;
        foliageGallery.add(plinth);
    });
    renderSystem.scene.add(foliageGallery);
    renderSystem.camera.position.set(22, 24, 34);
    controls.target.set(0, 3.2, 0);
    controls.update();
    setReadout('Procedural realm foliage gallery\nNine distinct silhouettes across Gloamwood, Moonfrost, Cinder Wastes, and Stormreach.');
}

const architectureGallery = new THREE.Group();
architectureGallery.name = 'ProceduralLanternholdArchitectureGallery';
if (architectureGalleryMode) {
    document.body.classList.add('architecture-gallery-mode');
    const placements = Object.freeze({
        oathhall: [-23, 0, -14, 0.08],
        trading_house: [0, 0, -14, 0],
        blacksmith: [21, 0, -13, -0.12],
        trading_post: [-22, 0, 15, 0.12],
        forge: [-7, 0, 15, -0.08],
        stash: [7, 0, 15, 0.1],
        camp: [20, 0, 15, -0.15]
    });
    for (const structureId of LANTERNHOLD_STRUCTURE_IDS) {
        const preview = createProceduralLanternholdStructure(structureId);
        const [x, y, z, rotationY] = placements[structureId];
        preview.position.set(x, y, z);
        preview.rotation.y = rotationY;
        architectureGallery.add(preview);
    }
    renderSystem.scene.add(architectureGallery);
    renderSystem.applyLightingPreset('town', true);
    renderSystem.setZoom(30);
    renderSystem.camera.position.set(54, 48, 64);
    controls.target.set(0, 6, 0);
    controls.update();
    window.__eidolonSetArchitectureQuality = (quality) => {
        renderSystem.setGraphicsQuality(quality);
    };
    setReadout('Procedural Lanternhold architecture gallery\nSeven collision-faithful silhouettes: oathhall, market, smithy, camps, auction hall, forge, and stash.');
}

const entranceGallery = new THREE.Group();
entranceGallery.name = 'ProceduralDungeonEntranceGallery';
if (entranceGalleryMode) {
    document.body.classList.add('entrance-gallery-mode');
    const placements = Object.freeze({
        verdant_bastion_catacombs: [-25, 0, -18, 0.08],
        molten_core: [25, 0, -18, -0.08],
        tempest_spire: [-25, 0, 19, 0.08],
        abyssal_well: [25, 0, 19, -0.08]
    });
    for (const dungeonType of DUNGEON_ENTRANCE_IDS) {
        const preview = createProceduralDungeonEntrance(dungeonType, { optimized: false });
        const [x, y, z, rotationY] = placements[dungeonType];
        preview.position.set(x, y, z);
        preview.rotation.y = rotationY;
        preview.scale.setScalar(0.4);
        entranceGallery.add(preview);
    }
    renderSystem.scene.add(entranceGallery);
    renderSystem.applyLightingPreset('town', true);
    renderSystem.setZoom(30);
    renderSystem.camera.position.set(54, 48, 64);
    controls.target.set(0, 9, 0);
    controls.update();
    window.__eidolonSetEntranceQuality = (quality) => {
        renderSystem.setGraphicsQuality(quality);
    };
    setReadout('Procedural dungeon threshold gallery\nFour exact-footprint landmarks: Thorncrypt, Furnace Below, Shattered Aerie, and Drowned Sanctum.');
}

const interiorGallery = new THREE.Group();
interiorGallery.name = 'ProceduralDungeonInteriorGallery';
const interiorGalleryKits = new Map();
if (interiorGalleryMode) {
    document.body.classList.add('interior-gallery-mode');
    renderSystem.staticEnvironmentGroup.visible = false;
    renderSystem.scene.background = new THREE.Color(0x080a0d);
    gridHelper.visible = false;
    const placements = Object.freeze({
        verdant_bastion_catacombs: [-23, 0, -15],
        molten_core: [23, 0, -15],
        tempest_spire: [-23, 0, 15],
        abyssal_well: [23, 0, 15]
    });
    const roomTemplates = Object.freeze({
        entry_gate: { type: 'start' },
        treasure_cache: { type: 'normal', hook: 'chest' },
        restorative_shrine: { type: 'normal', hook: 'shrine' },
        ambush_chamber: { type: 'elite', hook: 'elite_ambush' },
        boss_approach: { type: 'normal', pacing: 'boss_approach' },
        elite_guard: { type: 'elite' },
        boss_lair: { type: 'boss' },
        route_hall: { type: 'normal' }
    });

    for (const dungeonType of DUNGEON_INTERIOR_IDS) {
        const kit = createProceduralDungeonInteriorKit(dungeonType);
        interiorGalleryKits.set(dungeonType, kit);
        const panel = new THREE.Group();
        panel.name = `DungeonInteriorPanel:${dungeonType}`;
        panel.position.set(...placements[dungeonType]);
        panel.position.y = 0.2;
        panel.scale.setScalar(0.58);
        panel.userData.dungeonType = dungeonType;
        panel.userData.artStyle = DUNGEON_INTERIOR_DEFINITIONS[dungeonType].artStyle;
        panel.userData.surfaceLanguage = DUNGEON_INTERIOR_DEFINITIONS[dungeonType].surfaceLanguage;
        panel.userData.roomIdentities = [...DUNGEON_ROOM_IDENTITY_IDS];

        const floor = new THREE.Mesh(kit.floorGeometry(76, 50), kit.floorMaterial(76, 50));
        floor.name = `${dungeonType}:gallery-floor`;
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0.08;
        floor.receiveShadow = true;
        floor.userData.proceduralDungeonSurface = true;
        panel.add(floor);

        const rearWall = new THREE.Mesh(kit.wallGeometry(78, 15, 2), kit.wallMaterial(78, 15));
        rearWall.name = `${dungeonType}:gallery-rear-wall`;
        rearWall.position.set(0, 7.5, -25);
        rearWall.castShadow = true;
        rearWall.receiveShadow = true;
        rearWall.userData.proceduralDungeonSurface = true;
        panel.add(rearWall);

        const sideWall = new THREE.Mesh(kit.wallGeometry(52, 15, 2), kit.wallMaterial(52, 15));
        sideWall.name = `${dungeonType}:gallery-side-wall`;
        sideWall.position.set(-38, 7.5, 0);
        sideWall.rotation.y = Math.PI / 2;
        sideWall.castShadow = true;
        sideWall.receiveShadow = true;
        sideWall.userData.proceduralDungeonSurface = true;
        panel.add(sideWall);

        DUNGEON_ROOM_IDENTITY_IDS.forEach((identity, roomIndex) => {
            const column = roomIndex % 4;
            const row = Math.floor(roomIndex / 4);
            const room = {
                x: -27 + (column * 18),
                z: -11 + (row * 23),
                width: 40,
                height: 40,
                ...roomTemplates[identity]
            };
            const dressing = kit.createRoomDressing(room, roomIndex, { optimized: false });
            dressing.scale.setScalar(0.68);
            panel.add(dressing);
        });

        interiorGallery.add(panel);
    }
    renderSystem.scene.add(interiorGallery);
    renderSystem.applyLightingPreset('town', true);
    renderSystem.setZoom(42);
    renderSystem.camera.position.set(58, 100, 70);
    controls.target.set(0, 3.5, 0);
    controls.update();
    window.__eidolonSetInteriorQuality = (quality) => {
        renderSystem.setGraphicsQuality(quality);
    };
    setReadout('Procedural dungeon interior gallery\nFour generated surface languages and every authoritative room beat: gate, cache, shrine, ambush, approach, elite, boss, and route.');
}

window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key === 'p') togglePerf();
    if (key === 'g') toggleGrid();
    if (key === 'l') toggleLight();
    if (key === 'escape') toggleWindowPreview(false);
});

const clock = new THREE.Clock();

const animate = () => {
    const delta = clock.getDelta();
    const now = performance.now();
    controls.update();
    animationGallery?.update(delta);
    hazardGallery.forEach((hazard) => hazard.update(delta));

    if (hazardGalleryMode) {
        window.__eidolonHazardGallery = {
            ready: true,
            hazards: hazardGallery.map((hazard) => ({
                type: hazard.hazardType,
                radius: hazard.radius,
                boundaryRadius: hazard.boundaryMesh?.geometry?.boundingSphere?.radius,
                themeName: hazard.boundaryMesh?.userData?.themeName,
                meshCount: hazard.meshes.length,
                finite: hazard.meshes.every((mesh) => [
                    mesh.position.x, mesh.position.y, mesh.position.z,
                    mesh.scale.x, mesh.scale.y, mesh.scale.z
                ].every(Number.isFinite))
            }))
        };
    }


    if (foliageGalleryMode) {
        const previews = foliageGallery.children.filter((child) => child.userData?.proceduralFoliage);
        window.__eidolonFoliageGallery = {
            ready: previews.length === PROCEDURAL_FOLIAGE_RECIPES.length,
            cache: getProceduralFoliageCacheMetrics(),
            foliage: previews.map((preview) => {
                const bounds = new THREE.Box3().setFromObject(preview);
                return {
                    id: preview.userData.foliageId,
                    region: preview.userData.region,
                    theme: preview.userData.theme,
                    meshCount: preview.children.filter((child) => child.isMesh).length,
                    height: bounds.max.y - bounds.min.y,
                    finite: [...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)
                };
            })
        };
    }

    if (architectureGalleryMode) {
        window.__eidolonArchitectureGallery = {
            ready: architectureGallery.children.length === LANTERNHOLD_STRUCTURE_IDS.length,
            quality: renderSystem.graphicsQuality,
            cache: getProceduralLanternholdCacheMetrics(),
            structures: architectureGallery.children.map((preview) => {
                const bounds = new THREE.Box3().setFromObject(preview);
                const structureId = preview.userData.structureId;
                const definition = LANTERNHOLD_STRUCTURE_DEFINITIONS[structureId];
                const gameplayBounds = preview.getObjectByName(`${structureId}:gameplay-bounds`);
                let visibleMeshCount = 0;
                preview.traverse((child) => {
                    if (child.isMesh && child.userData.proceduralTownPart) visibleMeshCount += 1;
                });
                return {
                    id: structureId,
                    artStyle: preview.userData.artStyle,
                    role: preview.userData.role,
                    meshCount: visibleMeshCount,
                    size: gameplayBounds.scale.toArray(),
                    expectedSize: [...definition.bounds],
                    finite: [...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)
                };
            })
        };
    }

    if (entranceGalleryMode) {
        window.__eidolonEntranceGallery = {
            ready: entranceGallery.children.length === DUNGEON_ENTRANCE_IDS.length,
            quality: renderSystem.graphicsQuality,
            cache: getProceduralDungeonEntranceCacheMetrics(),
            entrances: entranceGallery.children.map((preview) => {
                const dungeonType = preview.userData.dungeonType;
                const definition = DUNGEON_ENTRANCE_DEFINITIONS[dungeonType];
                const gameplayBounds = preview.getObjectByName(`${dungeonType}:gameplay-bounds`);
                const worldBounds = new THREE.Box3().setFromObject(preview);
                let meshCount = 0;
                let portalSurfaceCount = 0;
                preview.traverse((child) => {
                    if (child.isMesh && child.userData.proceduralDungeonEntrancePart) meshCount += 1;
                    if (child.isMesh && child.userData.portalSurface) portalSurfaceCount += 1;
                });
                return {
                    dungeonType,
                    label: preview.userData.entranceLabel,
                    artStyle: preview.userData.artStyle,
                    meshCount,
                    portalSurfaceCount,
                    interactionRadius: preview.userData.interactionRadius,
                    size: gameplayBounds.scale.toArray(),
                    expectedSize: [...definition.bounds],
                    finite: [...worldBounds.min.toArray(), ...worldBounds.max.toArray()].every(Number.isFinite)
                };
            })
        };
    }

    if (interiorGalleryMode) {
        window.__eidolonInteriorGallery = {
            ready: interiorGallery.children.length === DUNGEON_INTERIOR_IDS.length,
            quality: renderSystem.graphicsQuality,
            interiors: interiorGallery.children.map((panel) => {
                const bounds = new THREE.Box3().setFromObject(panel);
                const dungeonType = panel.userData.dungeonType;
                let surfaceCount = 0;
                let detailCount = 0;
                const roomIdentities = [];
                panel.traverse((child) => {
                    if (child.isMesh && child.userData.proceduralDungeonSurface) surfaceCount += 1;
                    if (child.isMesh && child.userData.proceduralDungeonInteriorPart) detailCount += 1;
                    if (child.userData?.proceduralDungeonInterior) roomIdentities.push(child.userData.roomIdentity);
                });
                return {
                    dungeonType,
                    artStyle: panel.userData.artStyle,
                    surfaceLanguage: panel.userData.surfaceLanguage,
                    surfaceCount,
                    detailCount,
                    roomIdentities,
                    cache: interiorGalleryKits.get(dungeonType)?.metrics(),
                    finite: [...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)
                };
            })
        };
    }

    if (instancedMesh) {
        instancedMesh.rotation.y += delta * 0.1;
    } else {
        for (const mesh of instances) {
            mesh.rotation.y += delta * 0.1;
        }
    }

    if (telegraphPreview.visible) {
        telegraphPreview.scale.setScalar(1 + Math.sin(now * 0.01) * 0.08);
        telegraphPreview.material.opacity = 0.5 + Math.sin(now * 0.018) * 0.2;
        if (now >= telegraphPreviewUntil) {
            telegraphPreview.visible = false;
        }
    }

    if (lootPreview.visible) {
        lootPreview.rotation.y += delta * 1.8;
        lootPreview.children.forEach((gem, index) => {
            gem.position.y = 0.7 + Math.sin(now * 0.006 + index) * 0.35;
        });
        if (now >= lootPreviewUntil) {
            lootPreview.visible = false;
        }
    }

    if (jumpPreview.visible) {
        const t = Math.max(0, (jumpPreviewUntil - now) / 800);
        const squash = 1 + (1 - t) * 0.8;
        jumpPreview.scale.set(1.8 * squash, Math.max(0.35, t), 1.8 * squash);
        jumpPreview.material.opacity = Math.max(0.15, t * 0.7);
        if (now >= jumpPreviewUntil) {
            jumpPreview.visible = false;
            jumpPreview.scale.set(1, 1, 1);
            jumpPreview.material.opacity = 0.7;
        }
    }

    if (dungeonRoomPreview.visible) {
        const approachRing = dungeonRoomPreview.getObjectByName('boss_approach');
        if (approachRing) {
            approachRing.scale.setScalar(1 + Math.sin(now * 0.006) * 0.08);
            approachRing.material.opacity = 0.62 + Math.sin(now * 0.01) * 0.18;
        }
    }

    renderSystem.render();
    requestAnimationFrame(animate);
};

setReadout('Last pick: none');
animate();

export {
    triggerTelegraphPreview,
    triggerLootPreview,
    triggerJumpPreview,
    triggerDungeonRoomPreview,
    toggleWindowPreview,
    resetPreviewState
};
