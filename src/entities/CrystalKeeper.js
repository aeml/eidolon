import { Actor } from './Actor.js';

// Maelin is a persistent raid NPC with her own artificer rig, not a Spirit
// Guardian, a player Wizard, or Ilyra's quest turn-in. The server owns the Vigil.
export class CrystalKeeper extends Actor {
    constructor(id) {
        super(id, {
            STATS: { STRENGTH: 10, INTELLIGENCE: 10, DEXTERITY: 10, WISDOM: 10, STAMINA: 100 }
        });
        this.type = 'CrystalKeeper';
        this.meshType = 'CrystalKeeper';
        this.name = 'Maelin, Resonance Artificer';
        this.radius = 1.5;
        this.state = 'IDLE';
    }

    getRemoteRestAnimationName() {
        return this.state === 'CHANNELING' && this.animations.Channel ? 'Channel' : 'Idle';
    }
}
