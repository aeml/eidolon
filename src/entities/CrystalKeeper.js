import { Actor } from './Actor.js';

// Maelin is a persistent raid NPC, not a Spirit Guardian summon. Reuse the
// clothed humanoid mage rig without inheriting player skills, summon lifetime,
// or Ilyra's quest-marker/turn-in behavior. The server owns the Vigil state.
export class CrystalKeeper extends Actor {
    constructor(id) {
        super(id, {
            STATS: { STRENGTH: 10, INTELLIGENCE: 10, DEXTERITY: 10, WISDOM: 10, STAMINA: 100 }
        });
        this.type = 'CrystalKeeper';
        this.meshType = 'Wizard';
        this.name = 'Maelin, Resonance Artificer';
        this.radius = 1.5;
        this.state = 'IDLE';
    }
}
