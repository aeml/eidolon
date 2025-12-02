import * as THREE from 'three';
import { CONSTANTS } from './Constants.js';

export class RenderSystem {
    constructor(isMobile = false) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x220033); // Temporary fallback color (Dark Purple)
        
        // Optimization: Mobile Settings
        this.isMobile = isMobile;
        console.log(`RenderSystem initialized. Mobile Mode: ${this.isMobile}`);

        // Load Background Texture
        console.log("RenderSystem: Loading background texture...");
        const loader = new THREE.TextureLoader();
        loader.load('./assets/backgrounds/space_texture.png', (texture) => {
            console.log("RenderSystem: Background texture loaded successfully.", texture);
            texture.colorSpace = THREE.SRGBColorSpace;
            this.scene.background = texture;
        }, undefined, (err) => {
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
        // Optimization: Disable antialias on mobile for performance
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: !this.isMobile,
            powerPreference: "high-performance"
        });
        
        // Optimization: Cap pixel ratio to save fill rate on high DPI screens
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        // Optimization: Use PCFSoftShadowMap for better look, or Basic for performance
        this.renderer.shadowMap.type = this.isMobile ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
        
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
        
        // Optimization: Reduce Shadow Map Size on Mobile
        // 512 is much lighter on VRAM than 1024/2048
        // Reduced desktop to 1024 for better performance
        const shadowSize = this.isMobile ? 512 : 1024;
        dirLight.shadow.mapSize.width = shadowSize;
        dirLight.shadow.mapSize.height = shadowSize;
        
        const d = 40; // Reduced shadow frustum slightly to increase effective resolution
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;
        this.scene.add(dirLight);
    }

    setupGround() {
        console.log("RenderSystem: Loading ground textures...");
        const loader = new THREE.TextureLoader();
        
        // Load Grass Texture
        this.groundTexture = loader.load(`./assets/backgrounds/ground_texture.png?v=${Date.now()}`);
        this.setupTexture(this.groundTexture, 80, 64);

        // Load Snow Texture
        this.snowTexture = loader.load(`./assets/backgrounds/snow_texture.png?v=${Date.now()}`);
        this.setupTexture(this.snowTexture, 80, 64);

        // Earth Ground (Z > -600)
        // Center at Z = 200 (covering -600 to 1000) -> Size 1600 (Height)
        const earthGeo = new THREE.PlaneGeometry(2000, 1600);
        const earthMat = new THREE.MeshStandardMaterial({ 
            map: this.groundTexture,
            color: 0xffffff,
            roughness: 0.8,
            metalness: 0.2
        });
        this.groundEarth = new THREE.Mesh(earthGeo, earthMat);
        this.groundEarth.rotation.x = -Math.PI / 2;
        this.groundEarth.position.set(0, 0, 200); // Center at 200. Top: -600, Bottom: 1000.
        this.groundEarth.receiveShadow = true;
        this.scene.add(this.groundEarth);

        // Snow Ground (Z < -600)
        // Covers -600 to -2200. Center: -1400. Height: 1600.
        const snowGeo = new THREE.PlaneGeometry(2000, 1600);
        const snowMat = new THREE.MeshStandardMaterial({ 
            map: this.snowTexture,
            color: 0xffffff,
            roughness: 0.8,
            metalness: 0.2
        });
        this.groundSnow = new THREE.Mesh(snowGeo, snowMat);
        this.groundSnow.rotation.x = -Math.PI / 2;
        this.groundSnow.position.set(0, 0, -1400); // Center at -1400. Top: -2200, Bottom: -600.
        this.groundSnow.receiveShadow = true;
        this.scene.add(this.groundSnow);
    }

    setupTexture(tex, repeatX = 80, repeatY = 80) {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 4);
        tex.repeat.set(repeatX, repeatY); 
        tex.colorSpace = THREE.SRGBColorSpace;
    }

    setGroundTexture(type) {
        // Deprecated: Ground is now split
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
        if (mesh) {
            this.scene.add(mesh);
        } else {
            console.warn("RenderSystem: Attempted to add null/undefined mesh to scene.");
        }
    }

    remove(mesh) {
        this.scene.remove(mesh);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}