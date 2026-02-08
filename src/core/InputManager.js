import * as THREE from 'three';

export class InputManager {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Plane at Y=0
        this._intersectionTarget = new THREE.Vector3(); // Reusable vector
        
        this._listeners = [];
        this._onMouseMove = (e) => this.onMouseMove(e);
        this._onMouseDown = (e) => this.onMouseDown(e);
        this._onContextMenu = (e) => e.preventDefault();
        this._onWheel = (e) => this.onWheel(e);
        this._onKeyDown = (e) => this.onKeyDown(e);
        this._onKeyUp = (e) => this.onKeyUp(e);
        this._onMouseUp = (e) => this.onMouseUp(e);

        this._registerListener(window, 'mousemove', this._onMouseMove);
        this._registerListener(window, 'mousedown', this._onMouseDown);
        this._registerListener(window, 'contextmenu', this._onContextMenu);
        this._registerListener(window, 'wheel', this._onWheel, { passive: false });
        
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
            onQuest: [], // New callback for Quest Journal
            onChat: [], // New callback for Chat
            onInteract: [], // New callback for Mobile "USE" button
            onSocial: [], // New callback for Social Window
            onSkills: [], // New callback for Skill Tree
            onAbilities: [], // New callback for Abilities Menu (P)
            onHotbar: [] // New callback for Hotbar (1-4)
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

        this._registerListener(window, 'keydown', this._onKeyDown);
        this._registerListener(window, 'keyup', this._onKeyUp);
        this._registerListener(window, 'mouseup', this._onMouseUp);
        
        this.isMouseDown = false;
        this.isRightMouseDown = false;
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

            const onZoneTouchStart = (e) => {
                e.preventDefault();
                const touch = e.changedTouches[0];
                joystickTouchId = touch.identifier;
                handleJoystick(touch);
            };

            const onZoneTouchMove = (e) => {
                e.preventDefault();
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === joystickTouchId) {
                        handleJoystick(e.changedTouches[i]);
                        break;
                    }
                }
            };

            const onZoneTouchEnd = (e) => {
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

            this._registerListener(zone, 'touchstart', onZoneTouchStart, { passive: false });
            this._registerListener(zone, 'touchmove', onZoneTouchMove, { passive: false });
            this._registerListener(zone, 'touchend', onZoneTouchEnd);
            this._registerListener(zone, 'touchcancel', onZoneTouchEnd);
        }

        // Buttons
        const bindBtn = (id, callbackName) => {
            const btn = document.getElementById(id);
            if (btn) {
                const handler = (e) => {
                    e.preventDefault();
                    e.stopPropagation(); // Prevent click-through
                    this.callbacks[callbackName].forEach(cb => cb());
                };
                this._registerListener(btn, 'touchstart', handler, { passive: false });
                this._registerListener(btn, 'mousedown', handler);
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
        bindBtn('btn-mobile-social', 'onSocial');
        bindBtn('btn-mobile-map', 'onMap');
        bindBtn('btn-mobile-quest', 'onQuest');
        bindBtn('btn-mobile-menu', 'onEscape');

        // Pinch to Zoom Logic
        let initialPinchDist = null;
        
        const onPinchStart = (e) => {
            if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                initialPinchDist = Math.sqrt(dx * dx + dy * dy);
            }
        };

        const onPinchMove = (e) => {
            if (e.touches.length === 2 && initialPinchDist) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                const diff = dist - initialPinchDist;
                
                // Threshold to avoid jitter
                if (Math.abs(diff) > 2) {
                    // diff > 0 means spreading (Zoom In) -> We want negative delta (Zoom In)
                    // diff < 0 means pinching (Zoom Out) -> We want positive delta (Zoom Out)
                    const sensitivity = 0.1; 
                    const dir = diff > 0 ? -1 : 1;
                    
                    this.callbacks.onZoom.forEach(cb => cb(dir * sensitivity));
                    
                    initialPinchDist = dist;
                }
            }
        };

        const onPinchEnd = (e) => {
            if (e.touches.length < 2) {
                initialPinchDist = null;
            }
        };

        this._registerListener(window, 'touchstart', onPinchStart, { passive: false });
        this._registerListener(window, 'touchmove', onPinchMove, { passive: false });
        this._registerListener(window, 'touchend', onPinchEnd);
    }


    getMovementDirection() {
        const dir = new THREE.Vector3(0, 0, 0);
        
        // Keyboard
        if (this.keys.w) { dir.x -= 1; dir.z -= 1; }
        if (this.keys.s) { dir.x += 1; dir.z += 1; }
        if (this.keys.a) { dir.x -= 1; dir.z += 1; }
        if (this.keys.d) { dir.x += 1; dir.z -= 1; }

        // Joystick (Isometric Mapping)
        // Camera is at (100, 100, 100) looking at (0, 0, 0).
        // Screen Up (Joystick Y < 0) -> World North-West (-X, -Z)
        // Screen Right (Joystick X > 0) -> World North-East (+X, -Z)
        
        if (this.joystickVector.lengthSq() > 0.01) {
            const jx = this.joystickVector.x;
            const jy = this.joystickVector.y;
            
            // Correct Isometric Mapping
            // dir.x = jx + jy
            // dir.z = jy - jx
            
            dir.x += (jx + jy);
            dir.z += (jy - jx);
        }

        if (dir.lengthSq() > 0) dir.normalize();
        return dir;
    }

    onKeyDown(e) {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            if (e.key === 'Escape') {
                activeElement.blur();
            }
            return;
        }

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
        if (key === 'j') {
            this.callbacks.onQuest.forEach(cb => cb());
        }
        if (key === 'b') {
            this.callbacks.onTeleport.forEach(cb => cb());
        }
        if (key === 'm') {
            this.callbacks.onMap.forEach(cb => cb());
        }
        if (key === 'o') {
            this.callbacks.onSocial.forEach(cb => cb());
        }
        if (key === 'k') {
            this.callbacks.onSkills.forEach(cb => cb());
        }
        if (key === 'p') {
            this.callbacks.onAbilities.forEach(cb => cb());
        }
        if (['1', '2', '3', '4'].includes(key)) {
            const slot = parseInt(key) - 1;
            this.callbacks.onHotbar.forEach(cb => cb(slot));
        }
        if (e.key === 'Enter') {
            this.callbacks.onChat.forEach(cb => cb());
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
        // Only zoom if hovering over the game canvas
        if (event.target.tagName === 'CANVAS') {
            event.preventDefault();
            // Normalize wheel delta
            const delta = Math.sign(event.deltaY);
            this.callbacks.onZoom.forEach(cb => cb(delta));
        }
    }

    onMouseDown(event) {
        // Only handle clicks on the canvas (ignore UI)
        if (event.target.tagName !== 'CANVAS') return;

        if (event.button === 0) { // Left Click
            this.isMouseDown = true;
            this.callbacks.onClick.forEach(cb => cb());
        } else if (event.button === 2) { // Right Click
            this.isRightMouseDown = true;
            this.callbacks.onRightClick.forEach(cb => cb());
        }
    }

    onMouseUp(event) {
        if (event.button === 0) {
            this.isMouseDown = false;
        } else if (event.button === 2) {
            this.isRightMouseDown = false;
        }
    }

    getGroundIntersection() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersection = this.raycaster.ray.intersectPlane(this.groundPlane, this._intersectionTarget);
        return intersection ? this._intersectionTarget : null;
    }

    clearInputState() {
        this.isMouseDown = false;
        this.isRightMouseDown = false;
        this.joystickVector.set(0, 0);
        Object.keys(this.keys).forEach((key) => {
            this.keys[key] = false;
        });
    }

    subscribe(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        }
    }

    _registerListener(target, event, handler, options) {
        if (!target || !target.addEventListener) return;
        target.addEventListener(event, handler, options);
        this._listeners.push({ target, event, handler, options });
    }

    dispose() {
        for (const listener of this._listeners) {
            listener.target.removeEventListener(listener.event, listener.handler, listener.options);
        }
        this._listeners = [];
    }
}
