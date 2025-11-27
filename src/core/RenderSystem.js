import * as THREE from 'three';
import { CONSTANTS } from './Constants.js';

export class RenderSystem {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x220033); // Temporary fallback color (Dark Purple)
        
        // Load Background Texture
        console.log("RenderSystem: Loading background texture...");
        const loader = new THREE.TextureLoader();
        loader.load('./assets/backgrounds/space_texture.png', (texture) => {
            console.log("RenderSystem: Background texture loaded successfully.", texture);
            texture.colorSpace = THREE.SRGBColorSpace;
            this.scene.background = texture;
        }, (xhr) => {
            console.log(`RenderSystem: Background load progress: ${(xhr.loaded / xhr.total * 100)}%`);
        }, (err) => {
            console.error("RenderSystem: Error loading background texture:", err);
        });

        // Camera Setup (Isometric Orthographic)
        const aspect = window.innerWidth / window.innerHeight;
        this.currentZoom = CONSTANTS.CAMERA.ZOOM;
        const d = this.currentZoom;
        this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 2000); // Increased Far Plane
        
        // Isometric rotation
        this.cameraOffset = new THREE.Vector3(100, 100, 100);
        this.cameraTarget = new THREE.Vector3(0, 0, 0);
        this.updateCamera();
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        
        // Ensure canvas is behind UI but visible
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.zIndex = '1'; // Behind UI (which is 10)
        
        document.body.appendChild(this.renderer.domElement);

        // Lighting
        this.setupLights();
        
        // Ground Plane
        this.setupGround();

        // Handle Resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0x404040, 2); // Soft white light
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 2);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        const d = 50;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;
        this.scene.add(dirLight);
    }

    setupGround() {
        console.log("RenderSystem: Loading ground texture...");
        const loader = new THREE.TextureLoader();
        // Add timestamp to force reload of texture (bypass cache)
        const groundTexture = loader.load(`./assets/backgrounds/ground_texture.png?v=${Date.now()}`, (tex) => {
            console.log("RenderSystem: Ground texture loaded successfully.", tex);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;

            // Improve texture sampling to reduce visual gaps/seams
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

            // Scale repeat based on ground size (assuming 100 units = 4 repeats)
            const repeatCount = Math.max(4, CONSTANTS.SCENE.GROUND_SIZE / 25);
            tex.repeat.set(repeatCount, repeatCount); 
            tex.colorSpace = THREE.SRGBColorSpace;
            
            // Force material update
            if (this.ground) this.ground.material.needsUpdate = true;
        }, undefined, (err) => console.error("RenderSystem: Error loading ground texture:", err));

        const geometry = new THREE.PlaneGeometry(CONSTANTS.SCENE.GROUND_SIZE, CONSTANTS.SCENE.GROUND_SIZE);
        const material = new THREE.MeshStandardMaterial({ 
            map: groundTexture,
            color: 0xffffff,
            roughness: 0.8,
            metalness: 0.2
        });
        this.ground = new THREE.Mesh(geometry, material);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);
    }

    onWindowResize() {
        const aspect = window.innerWidth / window.innerHeight;
        const d = this.currentZoom;
        
        this.camera.left = -d * aspect;
        this.camera.right = d * aspect;
        this.camera.top = d;
        this.camera.bottom = -d;
        
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    setZoom(zoomLevel) {
        this.currentZoom = Math.max(CONSTANTS.CAMERA.MIN_ZOOM, Math.min(CONSTANTS.CAMERA.MAX_ZOOM, zoomLevel));
        this.onWindowResize();
    }

    updateCamera() {
        this.camera.position.copy(this.cameraTarget).add(this.cameraOffset);
        this.camera.lookAt(this.cameraTarget);
    }

    panCamera(deltaX, deltaZ) {
        this.cameraTarget.x += deltaX;
        this.cameraTarget.z += deltaZ;
        this.updateCamera();
    }

    setCameraTarget(target) {
        this.cameraTarget.copy(target);
        this.updateCamera();
    }

    add(mesh) {
        this.scene.add(mesh);
    }

    remove(mesh) {
        this.scene.remove(mesh);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}