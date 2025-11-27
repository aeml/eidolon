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
            onInteract: [] // New callback for Mobile "USE" button
        };

        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            alt: false, // Track Alt
            control: false // Track Control
        };
        
        this.joystickVector = new THREE.Vector2(0, 0);
        this.isMobile = false;

        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));
        
        this.isMouseDown = false;
    }

    setupMobileControls() {
        this.isMobile = true;
        const mobileUI = document.getElementById('mobile-ui');
        if (mobileUI) mobileUI.style.display = 'block';

        // Joystick Logic
        const zone = document.getElementById('joystick-zone');
        const knob = document.getElementById('joystick-knob');
        
        if (zone && knob) {
            let joystickTouchId = null;
            const maxDist = 35; // Max radius for knob movement

            const handleJoystick = (touch) => {
                const rect = zone.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                let dx = touch.clientX - centerX;
                let dy = touch.clientY - centerY;
                
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                // Normalize and Clamp
                if (dist > maxDist) {
                    dx = (dx / dist) * maxDist;
                    dy = (dy / dist) * maxDist;
                }

                // Move Knob
                knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

                // Update Vector (-1 to 1)
                this.joystickVector.x = dx / maxDist;
                this.joystickVector.y = dy / maxDist;
            };

            zone.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const touch = e.changedTouches[0];
                joystickTouchId = touch.identifier;
                handleJoystick(touch);
            }, { passive: false });

            zone.addEventListener('touchmove', (e) => {
                e.preventDefault();
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === joystickTouchId) {
                        handleJoystick(e.changedTouches[i]);
                        break;
                    }
                }
            }, { passive: false });

            const endHandler = (e) => {
                e.preventDefault();
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === joystickTouchId) {
                        joystickTouchId = null;
                        knob.style.transform = `translate(-50%, -50%)`;
                        this.joystickVector.set(0, 0);
                        break;
                    }
                }
            };

            zone.addEventListener('touchend', endHandler);
            zone.addEventListener('touchcancel', endHandler);
        }

        // Buttons
        const bindBtn = (id, callbackName) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    e.stopPropagation(); // Prevent click-through
                    this.callbacks[callbackName].forEach(cb => cb());
                }, { passive: false });
            }
        };

        // Map Mobile Buttons to Game Actions
        // Attack -> Left Click (Ground/Enemy) logic is handled by GameEngine, but we need to trigger it.
        // Actually, GameEngine listens to 'onClick'.
        // But 'onClick' usually expects a mouse position for raycasting.
        // For mobile, "Attack" button should probably attack the nearest enemy or just trigger "Attack" action.
        // Since we don't have a "target" from mouse hover, we might need auto-targeting or just attack in front.
        // For now, let's map Attack to onClick, but we need to fake a mouse position? 
        // Or better, GameEngine should handle "Attack Button Pressed" differently.
        
        // Let's reuse existing callbacks but maybe add a flag or new callback?
        // Reuse 'onClick' for Attack. GameEngine will need to handle "no mouse position" or use player position/direction.
        
        bindBtn('btn-mobile-attack', 'onClick'); // Attack
        bindBtn('btn-mobile-ability', 'onRightClick'); // Ability
        bindBtn('btn-mobile-interact', 'onInteract'); // Interact (Loot/NPC)
        
        bindBtn('btn-mobile-inv', 'onInventory');
        bindBtn('btn-mobile-char', 'onCharacter');
        bindBtn('btn-mobile-menu', 'onEscape');
    }

    getMovementDirection() {
        const dir = new THREE.Vector3(0, 0, 0);
        
        // Keyboard
        if (this.keys.w) { dir.x -= 1; dir.z -= 1; }
        if (this.keys.s) { dir.x += 1; dir.z += 1; }
        if (this.keys.a) { dir.x -= 1; dir.z += 1; }
        if (this.keys.d) { dir.x += 1; dir.z -= 1; }

        // Joystick (Isometric Mapping)
        // Joystick Up (Y < 0) -> World North (X-1, Z-1)
        // Joystick Right (X > 0) -> World East (X+1, Z-1)
        // Joystick Down (Y > 0) -> World South (X+1, Z+1)
        // Joystick Left (X < 0) -> World West (X-1, Z+1)
        
        // Standard 2D to Iso rotation is 45 degrees.
        // Iso X = Screen X - Screen Y
        // Iso Z = Screen X + Screen Y
        // Let's try this mapping:
        if (this.joystickVector.lengthSq() > 0.01) {
            const jx = this.joystickVector.x;
            const jy = this.joystickVector.y;
            
            // Rotate inputs by 45 degrees for isometric
            // x' = x cos(45) - y sin(45)
            // y' = x sin(45) + y cos(45)
            // cos(45) = sin(45) ~= 0.707
            
            dir.x += (jx - jy); // * 0.707 (normalized later)
            dir.z += (jx + jy); // * 0.707
        }

        if (dir.lengthSq() > 0) dir.normalize();
        return dir;
    }

    onKeyDown(e) {
        const key = e.key.toLowerCase();
        if (this.keys.hasOwnProperty(key)) {
            this.keys[key] = true;
        }
        if (e.key === 'Alt') this.keys.alt = true; // Handle Alt specifically
        if (e.key === 'Control') this.keys.control = true; // Handle Control specifically
        
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
    }

    onKeyUp(e) {
        const key = e.key.toLowerCase();
        if (this.keys.hasOwnProperty(key)) {
            this.keys[key] = false;
        }
        if (e.key === 'Alt') this.keys.alt = false;
        if (e.key === 'Control') this.keys.control = false;
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
        if (event.button === 0) { // Left Click
            this.isMouseDown = true;
            this.callbacks.onClick.forEach(cb => cb());
        } else if (event.button === 2) { // Right Click
            this.callbacks.onRightClick.forEach(cb => cb());
        }
    }

    onMouseUp(event) {
        if (event.button === 0) {
            this.isMouseDown = false;
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