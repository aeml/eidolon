import { hasChronicleRestoration } from './ChronicleRestoration.js';

// Reach the outer pedestals without walking through them. The server retains
// its ten-metre admission radius, allowing normal snapshot/latency tolerance.
export const PORTAL_INTERACTION_RANGE = 9;

export const PORTAL_CRYSTALS = Object.freeze([
    { realm: 'earth', name: 'Rootheart', color: 0x82c793 },
    { realm: 'water', name: 'Tidestar', color: 0x65bedd },
    { realm: 'fire', name: 'Ember Crown', color: 0xed9561 },
    { realm: 'air', name: 'Skyglass', color: 0xbcaff3 }
].map(Object.freeze));

// Presentation only. The existing enter_dark_realm handler rechecks every
// requirement, personal receipt, position and action on the authoritative server.
export function getResonancePortalState(player, administrator = false) {
    const quests = player?.quests || [];
    const restored = PORTAL_CRYSTALS.map(crystal => hasChronicleRestoration(quests, crystal.realm));
    const legacy = quests.some(quest => ['chronicle_14_resonance_gate', 'chronicle_15_dark_king'].includes(quest.id)
        && (quest.completed === true || quest.accepted === true));
    const whole = restored.every(Boolean) || legacy;
    const administratorPass = administrator === true && !whole;
    const eligible = Number(player?.level) >= 100 && (whole || administratorPass);
    return { restored, legacy, administratorPass, eligible, stage: eligible ? 'active' : whole ? 'ready' : 'locked' };
}
