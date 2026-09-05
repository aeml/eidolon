import * as THREE from 'three';
import { Actor } from './Actor.js';

export function questMarkerState(quests, story = false) {
    const relevant = (quests || []).filter((quest) =>
        (quest.category === 'chronicle' || Boolean(quest.id?.startsWith('chronicle_'))) === story && !quest.completed);
    if (relevant.some((quest) => quest.accepted && quest.maxCount > 0 && quest.count >= quest.maxCount)) return '?';
    return relevant.some((quest) => !quest.accepted) ? '!' : '';
}

export class QuestNPC extends Actor {
    constructor(id, { story = false } = {}) {
        super(id, {
            STATS: {
                STRENGTH: 10,
                INTELLIGENCE: 10,
                DEXTERITY: 10,
                WISDOM: 10,
                STAMINA: 100
            }
        });
        this.type = 'QuestNPC';
        this.story = story;
        this.meshType = story ? 'Wizard' : 'QuestNPC';
        this.name = story ? 'Archmage Ilyra' : 'Quest Giver';
        this.radius = 1.0;
        this.state = 'IDLE';
        this.markerSymbol = '';
    }

    setMesh(mesh) {
        super.setMesh(mesh);
        this.refreshQuestMarker();
    }

    update(dt, collisionManager, player, activeEntities) {
        super.update(dt, collisionManager, player, activeEntities);
        const symbol = questMarkerState(player?.quests, this.story);
        if (symbol !== this.markerSymbol) {
            this.markerSymbol = symbol;
            this.refreshQuestMarker();
        }
    }

    refreshQuestMarker() {
        if (!this.mesh) return;
        if (!this.questMarker && this.markerSymbol) {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 160;
            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, toneMapped: false });
            this.questMarker = new THREE.Sprite(material);
            this.questMarker.name = 'QuestMarker';
            this.questMarker.position.y = (this.mesh.userData.bounds?.height || 2.5) + 1.15;
            this.questMarker.scale.set(0.85, 1.06, 1);
            this.questMarker.renderOrder = 20;
            this.mesh.add(this.questMarker);
        }
        if (!this.questMarker) return;
        this.questMarker.visible = Boolean(this.markerSymbol);
        this.questMarker.userData.symbol = this.markerSymbol;
        this.questMarker.userData.questKind = this.story ? 'story' : 'daily';
        if (!this.markerSymbol) return;
        const texture = this.questMarker.material.map;
        const ctx = texture.image.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, 128, 160);
        ctx.font = 'bold 128px Georgia';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#111923';
        ctx.lineWidth = 10;
        ctx.strokeText(this.markerSymbol, 64, 80);
        ctx.fillStyle = this.story ? '#ffd56a' : '#65baff';
        ctx.fillText(this.markerSymbol, 64, 80);
        texture.needsUpdate = true;
    }

    dispose() {
        this.questMarker?.removeFromParent();
        this.questMarker?.material.map.dispose();
        this.questMarker?.material.dispose();
        this.questMarker = null;
        super.dispose();
    }
}
