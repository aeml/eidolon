import * as THREE from 'three';
import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/proto/state_pb.js', () => {
    const mock = {
        eidolon: {
            state: {
                StateEnvelope: {
                    decode: jest.fn()
                }
            }
        }
    };
    return { default: mock, ...mock };
});

const { GameEngine } = await import('../src/core/GameEngine.js');

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
        setPartyHighlight: GameEngine.prototype._partyHighlightStub || function (active) {
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
// Engine harness — only the fields touched by party-highlight methods
// ---------------------------------------------------------------------------
function createEngineHarness() {
    const engine = Object.create(GameEngine.prototype);
    engine.myPartyId = '';
    engine.remotePlayers = new Map();
    engine.setMyPartyId = GameEngine.prototype.setMyPartyId;
    engine.refreshAllPartyHighlights = GameEngine.prototype.refreshAllPartyHighlights;
    return engine;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GameEngine party-member highlight (0.37.2)', () => {
    test('setMyPartyId stores the partyId', () => {
        const engine = createEngineHarness();
        engine.setMyPartyId('party-abc');
        expect(engine.myPartyId).toBe('party-abc');
    });

    test('setMyPartyId is a no-op when called with the same value', () => {
        const engine = createEngineHarness();
        engine.myPartyId = 'party-abc';
        const spy = jest.spyOn(engine, 'refreshAllPartyHighlights');
        engine.setMyPartyId('party-abc');
        expect(spy).not.toHaveBeenCalled();
    });

    test('setMyPartyId calls refreshAllPartyHighlights on change', () => {
        const engine = createEngineHarness();
        const spy = jest.spyOn(engine, 'refreshAllPartyHighlights');
        engine.setMyPartyId('party-abc');
        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('refreshAllPartyHighlights enables ring for matching remote actor', () => {
        const engine = createEngineHarness();
        engine.myPartyId = 'party-xyz';
        const mate = createRemoteEntity('player-2', 'party-xyz');
        engine.remotePlayers.set(mate.id, mate);

        engine.refreshAllPartyHighlights();

        expect(mate._partyHighlightActive).toBe(true);
        expect(mate.mesh.getObjectByName('PartyRing')).toBeTruthy();
    });

    test('refreshAllPartyHighlights disables ring for non-matching remote actor', () => {
        const engine = createEngineHarness();
        engine.myPartyId = 'party-xyz';
        const stranger = createRemoteEntity('player-3', 'party-other');
        stranger._partyHighlightActive = true; // pre-lit from an earlier party
        stranger.setPartyHighlight(true); // attach ring
        engine.remotePlayers.set(stranger.id, stranger);

        engine.refreshAllPartyHighlights();

        expect(stranger._partyHighlightActive).toBe(false);
        expect(stranger.mesh.getObjectByName('PartyRing')).toBeFalsy();
    });

    test('refreshAllPartyHighlights handles actors without setPartyHighlight gracefully', () => {
        const engine = createEngineHarness();
        engine.myPartyId = 'party-xyz';
        const bare = { id: 'npc-1', partyId: 'party-xyz' }; // no setPartyHighlight
        engine.remotePlayers.set(bare.id, bare);

        expect(() => engine.refreshAllPartyHighlights()).not.toThrow();
    });

    test('setMyPartyId with empty string clears highlights for all remote actors', () => {
        const engine = createEngineHarness();
        engine.myPartyId = 'party-xyz';
        const mate = createRemoteEntity('player-2', 'party-xyz');
        mate.setPartyHighlight(true); // ring is showing
        engine.remotePlayers.set(mate.id, mate);

        engine.setMyPartyId(''); // local player left the party

        expect(mate._partyHighlightActive).toBe(false);
        expect(mate.mesh.getObjectByName('PartyRing')).toBeFalsy();
    });

    test('remote actor partyId update immediately applies correct highlight state', () => {
        const engine = createEngineHarness();
        engine.myPartyId = 'party-abc';
        const mate = createRemoteEntity('player-4', '');
        engine.remotePlayers.set(mate.id, mate);

        // Simulate syncRemoteEntity receiving partyId matching local player
        const newPartyId = 'party-abc';
        if (newPartyId !== mate.partyId) {
            mate.partyId = newPartyId;
            mate.setPartyHighlight(!!(engine.myPartyId && newPartyId === engine.myPartyId));
        }

        expect(mate._partyHighlightActive).toBe(true);
        expect(mate.mesh.getObjectByName('PartyRing')).toBeTruthy();
    });
});
