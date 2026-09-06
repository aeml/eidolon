import * as THREE from 'three';

export class InputManager {
    constructor(camera, scene, canvas = null) {
        this.camera = camera;
        this.scene = scene;
        this.canvas = canvas;
        this.pinchState = null;
        this.worldTapState = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.pointerOverCanvas = false;
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
        this._onWindowBlur = () => this.clearInputState();
        this._onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                this.clearInputState();
            }
        };

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
            onHotbar: [], // New callback for Hotbar (1-4)
            onDebugOverlay: [] // Toggle dungeon debug overlay (F2)
        };

        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            alt: false, // Track Alt
            control: false, // Track Control
            meta: false // Track Command/Meta
        };
        
        this.joystickVector = new THREE.Vector2(0, 0);
        this.isMobile = false;

        this._registerListener(window, 'keydown', this._onKeyDown);
        this._registerListener(window, 'keyup', this._onKeyUp);
        this._registerListener(window, 'mouseup', this._onMouseUp);
        this._registerListener(window, 'blur', this._onWindowBlur);
        this._registerListener(document, 'visibilitychange', this._onVisibilityChange);
        
        this.isMouseDown = false;
        this.primaryMouseButtonDown = false;
        this.isRightMouseDown = false;
    }


    setupMobileControls() {
        if (this.isMobile) return;
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
                this._registerListener(btn, 'click', handler);
            }
        };

        // An event-less click is an explicit Attack button action. Canvas taps
        // below carry coordinates and select a target without attacking it.
        bindBtn('btn-mobile-attack', 'onClick'); // Attack
        bindBtn('btn-mobile-ability', 'onRightClick'); // Ability
        bindBtn('btn-mobile-interact', 'onInteract'); // Interact (Loot/NPC)
        
        bindBtn('btn-mobile-inv', 'onInventory');
        bindBtn('btn-mobile-char', 'onCharacter');
        bindBtn('btn-mobile-social', 'onSocial');
        bindBtn('btn-mobile-map', 'onMap');
        bindBtn('btn-mobile-quest', 'onQuest');
        bindBtn('btn-mobile-menu', 'onEscape');

        // A game gesture belongs to the actual renderer canvas, never a menu,
        // minimap, joystick/action pair, or a finger that began on the HUD.
        const canvasPair = touches => touches.length === 2 && this.canvas &&
            Array.from(touches).every(touch => touch.target === this.canvas);
        const distanceOf = touches => Math.hypot(
            touches[0].clientX - touches[1].clientX,
            touches[0].clientY - touches[1].clientY
        );
        const onPinchStart = (e) => {
            this.pinchState = null;
            if (e.defaultPrevented || !canvasPair(e.touches)) return;
            const distance = distanceOf(e.touches);
            if (!Number.isFinite(distance) || distance <= 0) return;
            this.pinchState = { ids: Array.from(e.touches, touch => touch.identifier), distance };
            e.preventDefault();
        };

        const onPinchMove = (e) => {
            const state = this.pinchState;
            if (!state) return;
            if (e.defaultPrevented || !canvasPair(e.touches) ||
                !Array.from(e.touches).every(touch => state.ids.includes(touch.identifier))) {
                this.pinchState = null;
                return;
            }
            const distance = distanceOf(e.touches);
            if (!Number.isFinite(distance) || distance <= 0) { this.pinchState = null; return; }
            e.preventDefault();
            // Log ratios add to the same result regardless of event frequency.
            // Spreading fingers zooms in; the renderer retains its zoom bounds.
            const delta = -4 * Math.log(distance / state.distance);
            state.distance = distance;
            if (delta) this.callbacks.onZoom.forEach(cb => cb(delta));
        };

        const onPinchEnd = () => { this.pinchState = null; };

        this._registerListener(window, 'touchstart', onPinchStart, { passive: false });
        this._registerListener(window, 'touchmove', onPinchMove, { passive: false });
        this._registerListener(window, 'touchend', onPinchEnd);
        this._registerListener(window, 'touchcancel', onPinchEnd);

        // Select only after a short, canvas-owned tap. Starting a pinch, dragging
        // or interrupting a gesture must never produce a synthetic combat click.
        const canvasTouches = event => Array.from(event.touches).filter(touch => touch.target === this.canvas);
        this._registerListener(window, 'touchstart', event => {
            if (canvasTouches(event).length !== 1 || event.defaultPrevented) {
                this.worldTapState = null;
                return;
            }
            if (!this.canvas || event.target !== this.canvas) return;
            const touch = canvasTouches(event)[0];
            this.worldTapState = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
            event.preventDefault();
        }, { passive: false });
        this._registerListener(window, 'touchmove', event => {
            const state = this.worldTapState;
            if (!state) return;
            const touches = canvasTouches(event);
            const touch = touches.find(touch => touch.identifier === state.id);
            if (touches.length !== 1 || !touch || Math.hypot(touch.clientX - state.x, touch.clientY - state.y) > 12) {
                this.worldTapState = null;
            }
        }, { passive: true });
        this._registerListener(window, 'touchend', event => {
            const state = this.worldTapState;
            if (!state) return;
            const touch = Array.from(event.changedTouches).find(touch => touch.identifier === state.id);
            if (!touch) return;
            this.worldTapState = null;
            if (event.defaultPrevented || canvasTouches(event).length || Math.hypot(touch.clientX - state.x, touch.clientY - state.y) > 12) return;
            event.preventDefault();
            this.updateMouseFromEvent(touch);
            this.pointerOverCanvas = true;
            this.callbacks.onClick.forEach(callback => callback({ clientX: touch.clientX, clientY: touch.clientY, target: this.canvas }));
        }, { passive: false });
        this._registerListener(window, 'touchcancel', () => { this.worldTapState = null; });
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
        // Native activation must not also cast or move focus to multiplayer chat.
        if ((e.code === 'Space' || e.key === 'Enter') && activeElement?.closest('button, [role="button"], select, a[href]')) return;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            if (e.key === 'Escape') {
                activeElement.blur();
            }
            return;
        }

        const key = e.key.toLowerCase();
        if (Object.prototype.hasOwnProperty.call(this.keys, key)) {
            this.keys[key] = true;
        }
        if (e.key === 'Alt') this.keys.alt = true; // Handle Alt specifically
        if (e.key === 'Control') this.keys.control = true; // Handle Control specifically
        if (e.key === 'Meta') this.keys.meta = true; // Handle Command/Meta specifically
        
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
        if (e.code === 'F2') {
            this.callbacks.onDebugOverlay.forEach(cb => cb());
        }
    }

    onKeyUp(e) {
        const key = e.key.toLowerCase();
        if (Object.prototype.hasOwnProperty.call(this.keys, key)) {
            this.keys[key] = false;
        }
        if (e.key === 'Alt') this.keys.alt = false;
        if (e.key === 'Control') this.keys.control = false;
        if (e.key === 'Meta') this.keys.meta = false;
    }

    onMouseMove(event) {
        this.pointerOverCanvas = event.target?.tagName === 'CANVAS';
        this.updateMouseFromEvent(event);
        
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
        this.pointerOverCanvas = event.target?.tagName === 'CANVAS';
        if (!this.pointerOverCanvas) return;

        // A click can occur without a preceding mousemove (for example after
        // a moving actor crosses a stationary cursor). Always make the click
        // coordinates the authoritative raycast sample for this interaction.
        this.updateMouseFromEvent(event);

        if (event.button === 0) { // Left Click
            this.primaryMouseButtonDown = true;
            this.isMouseDown = true;
            this.callbacks.onClick.forEach(cb => cb(event));
        } else if (event.button === 2) { // Right Click
            this.isRightMouseDown = true;
            this.callbacks.onRightClick.forEach(cb => cb(event));
        }
    }

    onMouseUp(event) {
        if (event.button === 0) {
            this.primaryMouseButtonDown = false;
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

    getGroundIntersectionFromEvent(event) {
        if (!event || typeof event.clientX !== 'number' || typeof event.clientY !== 'number') {
            return this.getGroundIntersection();
        }

        const pointer = this._eventMouse || (this._eventMouse = new THREE.Vector2());
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(pointer, this.camera);
        const intersection = this.raycaster.ray.intersectPlane(this.groundPlane, this._intersectionTarget);
        return intersection ? this._intersectionTarget : null;
    }

    updateMouseFromEvent(event) {
        if (typeof event?.clientX !== 'number' || typeof event?.clientY !== 'number') return;
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    clearInputState() {
        this.pinchState = null;
        this.worldTapState = null;
        this.isMouseDown = false;
        this.primaryMouseButtonDown = false;
        this.isRightMouseDown = false;
        this.pointerOverCanvas = false;
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
        this.pinchState = null;
        this.worldTapState = null;
        for (const listener of this._listeners) {
            listener.target.removeEventListener(listener.event, listener.handler, listener.options);
        }
        this._listeners = [];
    }
}
