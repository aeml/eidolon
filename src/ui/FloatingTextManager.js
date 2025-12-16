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
        el.style.zIndex = '1000';
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

    spawn(text, position, color = '#fff', fontSize = '24px') {
        if (!this.container) return;

        const el = this.getElement();
        el.textContent = text;
        el.style.color = color;
        el.style.fontSize = fontSize;
        
        // Initial hidden state
        el.style.opacity = '0';
        
        const instance = {
            el: el,
            position: position.clone(),
            life: 1.5, // seconds
            maxLife: 1.5,
            offsetY: 0,
            velocity: 2.0 + Math.random() * 1.0, // Random float speed
            scale: 1.0
        };

        // Initial position update
        this.updatePosition(instance);
        
        // Pop in animation (Manual tween to avoid CSS transitions causing reflows/complexity with pooling)
        instance.scale = 1.5;
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
                t.scale = 1.5 - (0.5 * progress);
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
        pos.y += 2.5 + t.offsetY; // Start above head + float

        const screenPos = pos.project(this.camera);
        
        // Convert to screen coords
        // Screen space is -1 to 1
        const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight;

        // Use transform for everything to avoid layout thrashing
        t.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${t.scale})`;
    }
}
