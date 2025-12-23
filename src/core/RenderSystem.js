import * as THREE from 'three';
import { CONSTANTS } from './Constants.js';

export class RenderSystem {
    constructor(isMobile = false) {
        this.scene = new THREE.Scene();
        
        // Load Background Texture
        const loader = new THREE.TextureLoader();
        loader.load('./assets/backgrounds/underground.png', (texture) => {
            this.scene.background = texture;
        }, undefined, () => {
            // Fallback if texture fails
            this.scene.background = new THREE.Color(0x220033); 
        });
        
        // Optimization: Mobile Settings
        this.isMobile = isMobile;
        console.log(`RenderSystem initialized. Mobile Mode: ${this.isMobile}`);

        // Setup Water (Background)
        this.setupWater();

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
        // Firefox Optimization: alpha: false (we have a background), stencil: false (unused)
        const isFirefox = /firefox/i.test(navigator.userAgent);
        
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: !this.isMobile && !isFirefox, // Disable AA on Firefox for performance
            powerPreference: "high-performance",
            alpha: false,
            stencil: false
        });
        
        // Optimization: Cap pixel ratio to save fill rate on high DPI screens
        // Firefox: Cap at 1.0 to ensure smooth framerate
        const maxPixelRatio = isFirefox ? 1.0 : (this.isMobile ? 1.0 : 1.5);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        // Mobile preset: shadows are a major GPU cost; disable entirely on mobile.
        this.renderer.shadowMap.enabled = !this.isMobile;
        // Optimization: Use PCFSoftShadowMap for better look, or Basic for performance
        // Firefox: Use Basic shadows to reduce GPU load
        this.renderer.shadowMap.type = (this.isMobile || isFirefox) ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
        
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
        dirLight.castShadow = this.renderer.shadowMap.enabled;
        
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

    setupWater() {
        console.log("RenderSystem: Setting up water plane...");
        const loader = new THREE.TextureLoader();
        loader.load('./assets/backgrounds/water_texture.png', (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(500, 500); // High repeat for large plane
            texture.colorSpace = THREE.SRGBColorSpace;
            
            this.waterTexture = texture;
            
            // Huge plane to cover the world
            const geo = new THREE.PlaneGeometry(10000, 10000);
            const mat = new THREE.MeshBasicMaterial({ 
                map: texture, 
                color: 0x88ccff, // Tint it blueish
                transparent: true,
                opacity: 0.8
            });
            
            this.waterPlane = new THREE.Mesh(geo, mat);
            this.waterPlane.rotation.x = -Math.PI / 2;
            this.waterPlane.position.y = -5; // Below ground
            this.scene.add(this.waterPlane);
        });
    }

    setupGround() {
        console.log("RenderSystem: Loading ground textures...");
        const loader = new THREE.TextureLoader();
        
        // Load Grass Texture
        this.groundTexture = loader.load(`./assets/backgrounds/ground_texture.png?v=${Date.now()}`);
        this.setupTexture(this.groundTexture, 80, 64);

        // Load Snow Texture
        this.snowTexture = loader.load(`./assets/backgrounds/abyssal_well_floor.png?v=${Date.now()}`);
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
        tex.anisotropy = this.isMobile ? 1 : Math.min(this.renderer.capabilities.getMaxAnisotropy(), 4);
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
        if (this.waterTexture) {
            const time = performance.now() * 0.0001;
            this.waterTexture.offset.x = time;
            this.waterTexture.offset.y = time;
        }
        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }
        
        this.scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
    }
}