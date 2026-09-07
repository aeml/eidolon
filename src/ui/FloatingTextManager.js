import * as THREE from 'three';

export class FloatingTextManager {
    constructor(camera, containerId = 'ui-layer') {
        this.camera = camera;
        this.container = document.getElementById(containerId);
        this.texts = [];
        this.pool = []; // DOM Element Pool
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
        el.style.whiteSpace = 'nowrap';
        el.style.lineHeight = '';
        el.style.textAlign = '';
        el.style.transformOrigin = '';
        el.style.visibility = 'visible';
        el.removeAttribute('aria-label');
        const compact = options.compactActorAction;
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
            popScale: compact ? 1.12 : 1.5
        };

        // Initial position update
        this.updatePosition(instance);
        
        // Pop in animation (Manual tween to avoid CSS transitions causing reflows/complexity with pooling)
        instance.scale = instance.popScale;
        instance.targetScale = 1.0;
        instance.scaleTimer = 0.2;

        this.texts.push(instance);
    }

    update(dt) {
        for (let i = this.texts.length - 1; i >= 0; i--) {
            const t = this.texts[i];
            t.life -= dt;
            t.offsetY += t.velocity * dt;

            // Manual Scale Animation
            if (t.scaleTimer > 0) {
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
            } else {
                this.updatePosition(t);
            }
        }
    }

    updatePosition(t) {
        const pos = t.position.clone();
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
            const actorScreen = t.position.clone().project(this.camera);
            t.el.style.visibility = Math.abs(actorScreen.x) > 1 || Math.abs(actorScreen.y) > 1
                || Math.abs(actorScreen.z) > 1 ? 'hidden' : 'visible';
            t.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${t.scale})`;
            return;
        }

        // Use transform for everything to avoid layout thrashing
        t.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${t.scale})`;
    }

    dispose() {
        this.disposed = true;
        for (const t of this.texts) t.el.remove();
        for (const el of this.pool) el.remove();
        this.texts.length = 0;
        this.pool.length = 0;
    }
}
