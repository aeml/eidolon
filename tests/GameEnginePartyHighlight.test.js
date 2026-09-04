import * as THREE from 'three';
import { jest } from '@jest/globals';
import { SocialPresenceController } from '../src/core/SocialPresenceController.js';

// ---------------------------------------------------------------------------
// Minimal entity stub — mirrors Entity.setPartyHighlight / _updatePartyRing
// ---------------------------------------------------------------------------
function createRemoteEntity(id, partyId = '') {
    const mesh = new THREE.Object3D();
    return {
        id,
        partyId,
        mesh,
        _partyHighlightActive: false,
        setPartyHighlight(active) {
            active = Boolean(active);
            if (active === Boolean(this._partyHighlightActive)) return;
            this._partyHighlightActive = active;
            // Simplified _updatePartyRing inline for test
            const NAME = 'PartyRing';
            const existing = this.mesh.getObjectByName(NAME);
            if (active) {
                if (!existing) {
                    const ring = new THREE.Mesh(
                        new THREE.RingGeometry(0.55, 0.75, 32),
                        new THREE.MeshBasicMaterial({ color: 0x44ff88 })
                    );
                    ring.name = NAME;
                    this.mesh.add(ring);
                }
            } else {
                if (existing) this.mesh.remove(existing);
            }
        }
    };
}

// ---------------------------------------------------------------------------
// Controller harness — only the deps touched by party-highlight methods
// ---------------------------------------------------------------------------
function createControllerHarness() {
    const remotePlayers = new Map();
    const controller = new SocialPresenceController({
        network: {},
        uiManager: {},
        remotePlayers,
    });
    return { controller, remotePlayers };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('SocialPresenceController party-member highlight (0.37.2 / 0.39.2)', () => {
    test('setMyPartyId stores the partyId', () => {
        const { controller } = createControllerHarness();
        controller.setMyPartyId('party-abc');
        expect(controller.myPartyId).toBe('party-abc');
    });

    test('setMyPartyId is a no-op when called with the same value', () => {
        const { controller } = createControllerHarness();
        controller.myPartyId = 'party-abc';
        const spy = jest.spyOn(controller, 'refreshAllPartyHighlights');
        controller.setMyPartyId('party-abc');
        expect(spy).not.toHaveBeenCalled();
    });

    test('setMyPartyId calls refreshAllPartyHighlights on change', () => {
        const { controller } = createControllerHarness();
        const spy = jest.spyOn(controller, 'refreshAllPartyHighlights');
        controller.setMyPartyId('party-abc');
        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('refreshAllPartyHighlights enables ring for matching remote actor', () => {
        const { controller, remotePlayers } = createControllerHarness();
        controller.myPartyId = 'party-xyz';
        const mate = createRemoteEntity('player-2', 'party-xyz');
        remotePlayers.set(mate.id, mate);

        controller.refreshAllPartyHighlights();

        expect(mate._partyHighlightActive).toBe(true);
        expect(mate.mesh.getObjectByName('PartyRing')).toBeTruthy();
    });

    test('refreshAllPartyHighlights disables ring for non-matching remote actor', () => {
        const { controller, remotePlayers } = createControllerHarness();
        controller.myPartyId = 'party-xyz';
        const stranger = createRemoteEntity('player-3', 'party-other');
        stranger._partyHighlightActive = true; // pre-lit from an earlier party
        stranger.setPartyHighlight(true); // attach ring
        remotePlayers.set(stranger.id, stranger);

        controller.refreshAllPartyHighlights();

        expect(stranger._partyHighlightActive).toBe(false);
        expect(stranger.mesh.getObjectByName('PartyRing')).toBeFalsy();
    });

    test('refreshAllPartyHighlights handles actors without setPartyHighlight gracefully', () => {
        const { controller, remotePlayers } = createControllerHarness();
        controller.myPartyId = 'party-xyz';
        const bare = { id: 'npc-1', partyId: 'party-xyz' }; // no setPartyHighlight
        remotePlayers.set(bare.id, bare);

        expect(() => controller.refreshAllPartyHighlights()).not.toThrow();
    });

    test('setMyPartyId with empty string clears highlights for all remote actors', () => {
        const { controller, remotePlayers } = createControllerHarness();
        controller.myPartyId = 'party-xyz';
        const mate = createRemoteEntity('player-2', 'party-xyz');
        mate.setPartyHighlight(true); // ring is showing
        remotePlayers.set(mate.id, mate);

        controller.setMyPartyId(''); // local player left the party

        expect(mate._partyHighlightActive).toBe(false);
        expect(mate.mesh.getObjectByName('PartyRing')).toBeFalsy();
    });

    test('remote actor partyId update immediately applies correct highlight state', () => {
        const { controller, remotePlayers } = createControllerHarness();
        controller.myPartyId = 'party-abc';
        const mate = createRemoteEntity('player-4', '');
        remotePlayers.set(mate.id, mate);

        // Simulate syncRemoteEntity receiving partyId matching local player
        const newPartyId = 'party-abc';
        if (newPartyId !== mate.partyId) {
            mate.partyId = newPartyId;
            mate.setPartyHighlight(!!(controller.myPartyId && newPartyId === controller.myPartyId));
        }

        expect(mate._partyHighlightActive).toBe(true);
        expect(mate.mesh.getObjectByName('PartyRing')).toBeTruthy();
    });
});

describe('SocialPresenceController PvP opponents', () => {
    test('marks only authoritative opponents hostile', () => {
        const hostile = { setPvPHostile: jest.fn() };
        const neutral = { setPvPHostile: jest.fn() };
        const controller = new SocialPresenceController({
            network: { send: jest.fn() },
            uiManager: { pvp: { update: jest.fn() } },
            remotePlayers: new Map([['player-hostile', hostile], ['player-neutral', neutral]]),
        });
        expect(controller.handleMessage({ type: 'pvp_update', payload: { opponents: ['player-hostile'] } })).toBe(true);
        expect(controller.isPvPHostile('player-hostile')).toBe(true);
        expect(hostile.setPvPHostile).toHaveBeenCalledWith(true);
        expect(neutral.setPvPHostile).toHaveBeenCalledWith(false);
    });
});
