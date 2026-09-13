import * as THREE from 'three';

const COLORS = { earth: 0xa5db83, water: 0x76d7ff, fire: 0xffac62, air: 0xc3b2ff };

// Optional nearby objective, not another quest entry or a daily reward claim.
export class PublicEventController {
    constructor(engine) {
        this.engine = engine;
        this.root = document.createElement('details');
        this.root.className = 'public-event'; this.root.hidden = true;
        this.summary = document.createElement('summary');
        this.objective = document.createElement('p');
        this.progress = document.createElement('progress'); this.progress.max = 20;
        this.progress.setAttribute('aria-label', 'Ward charge');
        this.status = document.createElement('p');
        this.lore = document.createElement('p'); this.lore.className = 'public-event-lore';
        this.root.append(this.summary, this.objective, this.progress, this.status, this.lore);
        for (const name of ['pointerdown', 'pointerup', 'click', 'wheel']) this.root.addEventListener(name, e => e.stopPropagation());
        document.body.append(this.root);
        this.marker = new THREE.Group(); this.marker.name = 'public-event-ward';
        this.ring = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 64), new THREE.MeshBasicMaterial({
            color: COLORS.earth, transparent: true, opacity: .75, side: THREE.DoubleSide, depthWrite: false
        }));
        this.ring.rotation.x = -Math.PI / 2;
        this.inner = this.ring.clone(); this.inner.material = this.ring.material.clone();
        this.marker.add(this.ring, this.inner);
        this.marker.visible = false;
    }

    updateState(data) {
        this.data = data?.site && Number.isFinite(data.runeX) && Number.isFinite(data.runeZ) ? data : null;
        if (!this.data) { this.root.hidden = true; this.marker.visible = false; return; }
        const e = this.data;
        if (this.eventID !== e.id) { this.eventID = e.id; this.root.open = false; }
        const phase = { announced: 'Gather at the ward', defending: `Wave ${e.wave}/3`, champion: 'Fracturekeeper',
            complete: 'Road restored', expired: 'Disturbance faded' }[e.phase] || '';
        this.summary.textContent = `${e.site.title} · ${phase}`;
        this.objective.textContent = e.phase === 'champion' ? 'Defeat the Fracturekeeper to calm the nearby roads.' : e.site.objective;
        this.lore.textContent = e.site.lore;
        this.progress.max = e.chargeNeeded || 20; this.progress.value = e.charge || 0;
        this.progress.hidden = e.phase !== 'defending';
        const color = e.phase === 'complete' ? 0xd5ffe5 : (COLORS[e.site.realm] || COLORS.earth);
        this.ring.material.color.setHex(color); this.inner.material.color.setHex(color);
        this.marker.position.set(e.runeX, .16, e.runeZ);
        this.ring.scale.setScalar(e.radius || 12);
        this.inner.scale.setScalar(e.innerRadius || 1); this.inner.visible = e.innerRadius > 0;
        this.engine.worldMap?.update(this.engine.player);
        this.update(0);
    }

    update(dt) {
        const e = this.data, player = this.engine.player;
        const visible = Boolean(e && player && !this.engine.currentInstanceId && e.phase !== 'expired');
        const nearby = visible && Math.hypot(player.position.x - e.site.x, player.position.z - e.site.z) <= 100;
        this.root.hidden = !nearby || Boolean(this.engine.casino?.active);
        this.marker.visible = nearby;
        if (!nearby) return;
        if (!this.marker.parent) this.engine.renderSystem.scene.add(this.marker);
        this.time = (this.time || 0) + Math.min(dt, .1);
        this.ring.material.opacity = .65 + .1 * Math.sin(this.time * 2);
        const seconds = Math.max(0, Math.ceil((Date.parse(e.phase === 'complete' ? e.calmedUntil : e.phase === 'announced' ? e.startsAt : e.endsAt) - Date.now()) / 1000));
        const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
        this.status.textContent = e.phase === 'complete' ? `Nearby hazards calmed · ${clock}. Normal enemy loot and shared XP; no reward to claim.`
            : e.phase === 'announced' ? `${seconds ? `Begins in ${clock}` : 'Waiting for nearby adventurers'} · recommended level ${e.site.level}. Anyone may help.`
                : `${e.remaining} enemies · ${e.participants} adventurers · ${clock} remaining. ${e.phase === 'defending' ? `Ward ${Math.floor(e.charge)}/${e.chargeNeeded}: hold it clear of attackers.` : ''}`;
    }

    dispose() {
        this.root.remove(); this.marker.removeFromParent();
        this.ring.geometry.dispose(); this.ring.material.dispose(); this.inner.material.dispose();
    }
}
