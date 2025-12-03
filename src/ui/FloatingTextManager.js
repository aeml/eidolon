import * as THREE from 'three';

export class FloatingTextManager {
    constructor(camera, containerId = 'ui-layer') {
        this.camera = camera;
        this.container = document.getElementById(containerId);
        this.texts = [];
    }

    spawn(text, position, color = '#fff', fontSize = '24px') {
        if (!this.container) return;

        const el = document.createElement('div');
        el.textContent = text;
        el.style.position = 'absolute';
        el.style.color = color;
        el.style.fontSize = fontSize;
        el.style.fontWeight = 'bold';
        el.style.fontFamily = "'Cinzel', serif"; // Match game theme
        el.style.textShadow = '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
        el.style.pointerEvents = 'none';
        el.style.userSelect = 'none';
        el.style.zIndex = '1000';
        el.style.whiteSpace = 'nowrap';
        el.style.willChange = 'transform, opacity';
        
        // Initial hidden state
        el.style.opacity = '0';
        
        this.container.appendChild(el);

        const instance = {
            el: el,
            position: position.clone(),
            life: 1.5, // seconds
            maxLife: 1.5,
            offsetY: 0,
            velocity: 2.0 + Math.random() * 1.0 // Random float speed
        };

        // Initial position update
        this.updatePosition(instance);
        
        // Pop in animation
        requestAnimationFrame(() => {
            el.style.transition = 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.1s';
            el.style.transform = `${el.style.transform} scale(1.5)`;
            el.style.opacity = '1';
            
            setTimeout(() => {
                el.style.transition = 'transform 0.5s, opacity 0.5s';
                el.style.transform = el.style.transform.replace('scale(1.5)', 'scale(1.0)');
            }, 200);
        });

        this.texts.push(instance);
    }

    update(dt) {
        for (let i = this.texts.length - 1; i >= 0; i--) {
            const t = this.texts[i];
            t.life -= dt;
            t.offsetY += t.velocity * dt;

            if (t.life <= 0) {
                t.el.remove();
                this.texts.splice(i, 1);
            } else {
                // Fade out in last 0.5s
                if (t.life < 0.5) {
                    t.el.style.opacity = (t.life / 0.5).toString();
                }
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

        t.el.style.left = `${x}px`;
        t.el.style.top = `${y}px`;
        // Ensure centering
        // We append the scale transform if it exists in the style (from the pop-in animation)
        const currentTransform = t.el.style.transform;
        const scaleMatch = currentTransform.match(/scale\([^)]+\)/);
        const scale = scaleMatch ? scaleMatch[0] : 'scale(1.0)';
        
        t.el.style.transform = `translate(-50%, -50%) ${scale}`;
    }
}
