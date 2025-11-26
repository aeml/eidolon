import * as THREE from 'three';

export class InputManager {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Plane at Y=0
        
        // Event Listeners
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('contextmenu', (e) => e.preventDefault()); // Disable context menu
        window.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        
        this.callbacks = {
            onClick: [],
            onRightClick: [],
            onZoom: [],
            onSpace: []
        };

        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false
        };

        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
    }

    onKeyDown(e) {
        const key = e.key.toLowerCase();
        if (this.keys.hasOwnProperty(key)) {
            this.keys[key] = true;
        }
        if (e.code === 'Space') {
            this.callbacks.onSpace.forEach(cb => cb());
        }
    }

    onKeyUp(e) {
        const key = e.key.toLowerCase();
        if (this.keys.hasOwnProperty(key)) {
            this.keys[key] = false;
        }
    }

    onMouseMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    onWheel(event) {
        event.preventDefault();
        // Normalize wheel delta
        const delta = Math.sign(event.deltaY);
        this.callbacks.onZoom.forEach(cb => cb(delta));
    }

    onMouseDown(event) {
        const intersection = this.getRayIntersection();
        
        if (event.button === 0) { // Left Click
            if (intersection) {
                this.callbacks.onClick.forEach(cb => cb(intersection));
            }
        } else if (event.button === 2) { // Right Click
            if (intersection) {
                this.callbacks.onRightClick.forEach(cb => cb(intersection));
            }
        }
    }

    getRayIntersection() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Intersect with an invisible mathematical plane for movement
        const target = new THREE.Vector3();
        const intersection = this.raycaster.ray.intersectPlane(this.groundPlane, target);
        
        return intersection ? target : null;
    }

    subscribe(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        }
    }
}