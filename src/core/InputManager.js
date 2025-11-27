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
            onSpace: [],
            onEscape: [],
            onMouseMove: [], // New callback
            onCharacter: [],
            onInventory: [],
            onTeleport: [],
            onMap: [],
            onToggleRun: [] // New callback
        };

        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            alt: false // Track Alt
        };

        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
    }

    onKeyDown(e) {
        const key = e.key.toLowerCase();
        if (this.keys.hasOwnProperty(key)) {
            this.keys[key] = true;
        }
        if (e.key === 'Alt') this.keys.alt = true; // Handle Alt specifically
        
        if (e.code === 'Space') {
            this.callbacks.onSpace.forEach(cb => cb());
        }

        if (e.code === 'Escape') {
            this.callbacks.onEscape.forEach(cb => cb());
        }

        if (key === 'c') {
            this.callbacks.onCharacter.forEach(cb => cb());
        }
        if (key === 'i') {
            this.callbacks.onInventory.forEach(cb => cb());
        }
        if (key === 'b') {
            this.callbacks.onTeleport.forEach(cb => cb());
        }
        if (key === 'm') {
            this.callbacks.onMap.forEach(cb => cb());
        }
        if (key === 'r') {
            this.callbacks.onToggleRun.forEach(cb => cb());
        }
    }

    onKeyUp(e) {
        const key = e.key.toLowerCase();
        if (this.keys.hasOwnProperty(key)) {
            this.keys[key] = false;
        }
        if (e.key === 'Alt') this.keys.alt = false;
    }

    onMouseMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Notify listeners of mouse move (for hover checks)
        this.callbacks.onMouseMove.forEach(cb => cb(this.mouse));
    }

    onWheel(event) {
        event.preventDefault();
        // Normalize wheel delta
        const delta = Math.sign(event.deltaY);
        this.callbacks.onZoom.forEach(cb => cb(delta));
    }

    onMouseDown(event) {
        // We now pass the raw mouse coordinates or let the GameEngine handle the raycasting logic entirely
        // But to keep the interface consistent, we'll just trigger the callback.
        // The GameEngine will query the raycaster state.
        
        if (event.button === 0) { // Left Click
            this.callbacks.onClick.forEach(cb => cb());
        } else if (event.button === 2) { // Right Click
            this.callbacks.onRightClick.forEach(cb => cb());
        }
    }

    getGroundIntersection() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
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