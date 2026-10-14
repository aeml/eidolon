import * as THREE from 'three';
import { createMotionPreference } from '../core/MotionPreference.js';

export class FloatingTextManager {
    constructor(camera, containerId = 'ui-layer') {
        this.camera = camera;
        this.container = document.getElementById(containerId);
        this.texts = [];
        this.pool = []; // DOM Element Pool
        this.placedLabels = [];
        this.projectedPosition = new THREE.Vector3();
        this.motionPreference = createMotionPreference();
    }

    getElement() {
        if (this.pool.length > 0) {
            const el = this.pool.pop();
            el.style.display = 'block';
            el.style.opacity = '0';
            el.style.transform = 'translate(-50%, -50%) scale(1.0)';
            return el;
        }
        
        const el = document.createElement('div');
        el.style.position = 'absolute';
        el.style.fontWeight = 'bold';
        el.style.fontFamily = "'Cinzel', serif";
        el.style.textShadow = '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
        el.style.pointerEvents = 'none';
        el.style.userSelect = 'none';
        el.style.zIndex = 'calc(var(--z-hud) - 10)';
        el.style.whiteSpace = 'nowrap';
        el.style.willChange = 'transform, opacity';
        el.style.top = '0';
        el.style.left = '0';
        
        this.container.appendChild(el);
        return el;
    }

    releaseElement(el) {
        el.style.display = 'none';
        this.pool.push(el);
    }

    spawn(text, position, color = '#fff', fontSize = '24px', options = {}) {
        if (!this.container || this.disposed) return;

        const el = this.getElement();
        el.textContent = text;
        el.style.color = color;
        el.style.fontSize = fontSize;
        // Pooled numeric feedback must not inherit a prior action card's layout.
        el.className = '';
        el.style.width = '';
        el.style.maxWidth = '';
        el.style.overflowWrap = '';
        el.style.whiteSpace = 'nowrap';
        el.style.lineHeight = '';
        el.style.textAlign = '';
        el.style.transformOrigin = '';
        el.style.visibility = 'visible';
        el.removeAttribute('aria-label');
        const compact = options.compactActorAction;
        const bounded = !compact && /\p{L}/u.test(String(text));
        if (bounded) {
            el.style.width = 'max-content';
            el.style.whiteSpace = 'normal';
            el.style.overflowWrap = 'anywhere';
            el.style.textAlign = 'center';
        }
        if (compact) {
            el.className = 'floating-text--compact-action';
            el.setAttribute('aria-label', String(text));
            el.textContent = '';
            el.style.fontSize = '16px';
            el.style.lineHeight = '20px';
            el.style.whiteSpace = 'normal';
            el.style.textAlign = 'center';
            el.style.transformOrigin = 'center bottom';
            if (compact.source) {
                const source = document.createElement('div');
                source.dataset.floatingSource = '';
                source.textContent = compact.source;
                source.style.whiteSpace = 'nowrap';
                source.style.overflow = 'hidden';
                source.style.textOverflow = 'ellipsis';
                el.appendChild(source);
            }
            const action = document.createElement('div');
            action.dataset.floatingAction = '';
            action.textContent = compact.action;
            action.style.overflowWrap = 'anywhere';
            el.appendChild(action);
        }
        
        // Initial hidden state
        el.style.opacity = '0';
        
        const instance = {
            el: el,
            position: position.clone(),
            life: 1.5, // seconds
            maxLife: 1.5,
            offsetY: 0,
            velocity: 2.0 + Math.random() * 1.0, // Random float speed
            scale: 1.0,
            compact,
            bounded,
            popScale: compact || bounded ? 1.12 : 1.5
        };

        // Initial position update
        this.updatePosition(instance);
        
        // Pop in animation (Manual tween to avoid CSS transitions causing reflows/complexity with pooling)
        instance.scale = this.motionPreference.matches ? 1 : instance.popScale;
        instance.targetScale = 1.0;
        instance.scaleTimer = this.motionPreference.matches ? 0 : 0.2;
        if (this.motionPreference.matches) el.style.opacity = '1';

        this.texts.push(instance);
    }

    update(dt) {
        const reducedMotion = this.motionPreference.matches;
        for (let i = this.texts.length - 1; i >= 0; i--) {
            const t = this.texts[i];
            t.life -= dt;
            if (!reducedMotion) t.offsetY += t.velocity * dt;

            // Manual Scale Animation
            if (reducedMotion) {
                t.scaleTimer = 0;
                t.scale = 1;
                t.el.style.opacity = Math.max(0, Math.min(1, t.life / 0.5)).toString();
            } else if (t.scaleTimer > 0) {
                t.scaleTimer -= dt;
                const progress = 1 - (t.scaleTimer / 0.2);
                // Lerp scale
                t.scale = t.popScale - ((t.popScale - 1) * progress);
                t.el.style.opacity = progress.toString();
            } else {
                t.scale = 1.0;
                // Fade out in last 0.5s
                if (t.life < 0.5) {
                    t.el.style.opacity = (t.life / 0.5).toString();
                } else {
                    t.el.style.opacity = '1';
                }
            }

            if (t.life <= 0) {
                this.releaseElement(t.el);
                this.texts.splice(i, 1);
            }
        }
        // Keep arrival order stable: newer feedback yields to labels already read.
        this.placedLabels.length = 0;
        for (const t of this.texts) this.updatePosition(t);
    }

    updatePosition(t) {
        const pos = this.projectedPosition.copy(t.position);
        pos.y += (t.compact?.anchorHeight || 2.5) + t.offsetY;

        const screenPos = pos.project(this.camera);
        
        // Convert to screen coords
        // Screen space is -1 to 1
        let x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
        let y = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight;

        if (t.compact) {
            const width = Math.min(192, Math.max(44, (window.innerWidth - 24) / t.popScale));
            if (t.boxWidth !== width) {
                t.boxWidth = width;
                t.el.style.width = `${width}px`;
                // Measure only on spawn or responsive width change, never each tick.
                t.boxHeight = t.el.offsetHeight;
            }
            const halfWidth = width * t.popScale / 2;
            x = Math.max(12 + halfWidth, Math.min(window.innerWidth - 12 - halfWidth, x));
            y = Math.max(12 + t.boxHeight * t.popScale, Math.min(window.innerHeight - 12, y));
            const actorScreen = this.projectedPosition.copy(t.position).project(this.camera);
            t.el.style.visibility = Math.abs(actorScreen.x) > 1 || Math.abs(actorScreen.y) > 1
                || Math.abs(actorScreen.z) > 1 ? 'hidden' : 'visible';
            y = this.placeLabel(t, x, y - t.boxHeight * t.popScale) + t.boxHeight * t.popScale;
            t.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${t.scale})`;
            return;
        }

        if (t.bounded) {
            const available = Math.max(1, (window.innerWidth - 24) / t.popScale);
            if (t.availableWidth !== available) {
                t.availableWidth = available;
                t.el.style.maxWidth = `${available}px`;
                // Cache layout at spawn/rotation; animation ticks only write transforms.
                t.boxWidth = t.el.offsetWidth;
                t.boxHeight = t.el.offsetHeight;
            }
            const halfWidth = t.boxWidth * t.popScale / 2;
            const halfHeight = t.boxHeight * t.popScale / 2;
            x = Math.max(12 + halfWidth, Math.min(window.innerWidth - 12 - halfWidth, x));
            y = Math.max(12 + halfHeight, Math.min(window.innerHeight - 12 - halfHeight, y));
            const actorScreen = this.projectedPosition.copy(t.position).project(this.camera);
            t.el.style.visibility = Math.abs(actorScreen.x) > 1 || Math.abs(actorScreen.y) > 1
                || Math.abs(actorScreen.z) > 1 ? 'hidden' : 'visible';
            y = this.placeLabel(t, x, y - halfHeight) + halfHeight;
        }

        // Use transform for everything to avoid layout thrashing
        t.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${t.scale})`;
    }

    placeLabel(t, x, top) {
        if (t.el.style.visibility === 'hidden') return top;
        const width = t.boxWidth * t.popScale, height = t.boxHeight * t.popScale;
        const left = x - width / 2, right = x + width / 2;
        let above = top, below = top;
        // Reserve the largest animated footprint, not today's shrinking glyphs.
        // Search monotonically in both directions, retaining the nearest free slot.
        for (let i = this.placedLabels.length - 1; i >= 0; i--) {
            const box = this.placedLabels[i];
            if (left < box.right + 4 && right > box.left - 4 &&
                above < box.bottom + 4 && above + height > box.top - 4) {
                above = box.top - height - 4;
            }
        }
        for (const box of this.placedLabels) {
            if (left < box.right + 4 && right > box.left - 4 &&
                below < box.bottom + 4 && below + height > box.top - 4) {
                below = box.bottom + 4;
            }
        }
        const aboveFits = above >= 12, belowFits = below + height <= window.innerHeight - 12;
        if (aboveFits && (!belowFits || t.labelSide === -1 ||
            (t.labelSide !== 1 && top - above <= below - top))) {
            if (above !== top) t.labelSide = -1;
            top = above;
        } else if (belowFits) {
            if (below !== top) t.labelSide = 1;
            top = below;
        }
        // If the viewport is completely full, retain the original bounded label:
        // feedback must not disappear or acquire a misleading offscreen anchor.
        const box = t.layoutBox || (t.layoutBox = {});
        box.left = left; box.right = right; box.top = top; box.bottom = top + height;
        let index = this.placedLabels.length;
        while (index > 0 && this.placedLabels[index - 1].top > top) index--;
        this.placedLabels.splice(index, 0, box);
        return top;
    }

    dispose() {
        this.disposed = true;
        for (const t of this.texts) t.el.remove();
        for (const el of this.pool) el.remove();
        this.texts.length = 0;
        this.pool.length = 0;
        this.placedLabels.length = 0;
    }
}
