// Local render lifetime only. The server still owns death, loot and respawn.
// Dithered opacity retains opaque depth/shadows instead of drawing a transparent
// ghost through itself. Clone materials only during the final half-second.
export class EnemyCorpsePresentation {
    constructor(actor) {
        this.actor = actor;
        this.mesh = actor.mesh;
        const duration = actor.animations?.Death?.getClip?.().duration;
        this.hold = Math.min(4, Math.max(.6, Number.isFinite(duration) ? duration : 1.5)) + .3;
        this.elapsed = 0;
        this.finished = false;
        this.originals = new Map();
        this.materials = new Map();
    }

    prepare() {
        this.mesh.traverse(node => {
            if (!node.material || node.visible === false) return;
            const source = node.material;
            const clone = material => {
                // Invisible interaction proxies must remain untouched.
                if (material.visible === false || material.opacity <= 0) return material;
                if (!this.materials.has(material)) {
                    const copy = material.clone();
                    // Three's clone intentionally does not copy shader hooks.
                    copy.onBeforeCompile = material.onBeforeCompile;
                    copy.customProgramCacheKey = material.customProgramCacheKey;
                    copy.alphaHash = true;
                    copy.needsUpdate = true;
                    this.materials.set(material, copy);
                }
                return this.materials.get(material);
            };
            const replacement = Array.isArray(source) ? source.map(clone) : clone(source);
            if (replacement === source || (Array.isArray(source) && replacement.every((entry, i) => entry === source[i]))) return;
            this.originals.set(node, source);
            node.material = replacement;
        });
    }

    update(dt) {
        if (this.finished || !Number.isFinite(dt) || dt <= 0) return;
        this.elapsed += dt;
        if (this.elapsed < this.hold) return;
        const progress = Math.min(1, (this.elapsed - this.hold) / .5);
        if (progress >= 1) {
            this.mesh.visible = false;
            this.restore();
            this.finished = true;
            return;
        }
        if (!this.originals.size) this.prepare();
        const opacity = 1 - progress * progress * (3 - 2 * progress);
        for (const [source, clone] of this.materials) clone.opacity = source.opacity * opacity;
    }

    restore() {
        for (const [node, original] of this.originals) node.material = original;
        for (const material of this.materials.values()) material.dispose();
        this.originals.clear(); this.materials.clear();
    }

    dispose() {
        this.restore();
        this.finished = true;
    }
}
