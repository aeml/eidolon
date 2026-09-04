/**
 * SocialPresenceController — owns all social / party / friend network-message
 * routing and the local party-highlight state for GameEngine.
 *
 * Extracted from GameEngine.js in 0.39.2.
 */
export class SocialPresenceController {
    /**
     * @param {object} deps
     * @param {import('./NetworkManager.js').NetworkManager} deps.network
     * @param {import('../ui/UIManager.js').UIManager}       deps.uiManager
     * @param {Map<string, *>} deps.remotePlayers  Live reference — mutations visible immediately.
     */
    constructor({ network, uiManager, remotePlayers }) {
        this.network = network;
        this.uiManager = uiManager;
        this.remotePlayers = remotePlayers;
        /** @type {string} Party ID for the local player; empty string when not in a party. */
        this.myPartyId = '';
        this.pvpOpponents = new Set();
    }

    /**
     * Route an inbound social / party / friend network message.
     * @param {{ type: string, payload: * }} msg
     * @returns {boolean} true if the message was consumed, false if unrecognised.
     */
    handleMessage(msg) {
        switch (msg.type) {
            case 'party_update':
                this.uiManager.updateParty(msg.payload);
                return true;
            case 'party_request':
                this.uiManager.showPartyRequest(msg.payload.targetName);
                return true;
            case 'social_status':
                this.uiManager.social?.setSocialStatus?.(msg.payload?.status, { notify: false });
                return true;
            case 'friend_list':
                // Server pushed a fresh friend list.
                this.uiManager.social?.updateFriendList?.(msg.payload);
                return true;
            case 'friend_presence':
                // A friend came online or went offline.
                this.uiManager.social?.onFriendPresence?.(msg.payload);
                this.uiManager.showFriendToast?.(msg.payload?.username, msg.payload?.online);
                return true;
            case 'friend_request':
                // Another player sent us a friend request.
                this.uiManager.social?.onIncomingFriendRequest?.(msg.payload);
                return true;
            case 'friend_accept':
                // Confirmation that a request was accepted (no-op: friend_list is pushed separately).
                return true;
            case 'friend_decline':
                // Confirmation that a request was declined (no-op).
                return true;
            case 'guild_update':
                this.uiManager.social?.guild?.update?.(msg.payload);
                return true;
            case 'guild_leaderboard':
                this.uiManager.social?.guild?.updateLeaderboard?.(msg.payload);
                return true;
            case 'pvp_update':
                this.uiManager.pvp?.update?.(msg.payload);
                this.setPvPOpponents(msg.payload?.opponents);
                return true;
            case 'pvp_leaderboard':
                this.uiManager.pvp?.updateLeaderboard?.(msg.payload);
                return true;
            case 'endgame_update': {
                const player = this.uiManager.lastPlayerRef;
                if (player && msg.payload) {
                    player.resonanceUnlocked = Boolean(msg.payload.unlocked);
                    player.resonanceLevel = Number(msg.payload.level) || 0;
                    player.resonanceXP = Number(msg.payload.xp) || 0;
                    player.resonanceXPToNext = Number(msg.payload.xpToNext) || 1;
                    player.resonancePoints = Number(msg.payload.availablePoints) || 0;
                    player.resonanceRanks = { ...(msg.payload.ranks || {}) };
                    this.uiManager.lastCharacterSheetSignature = '';
                    this.uiManager.updateCharacterSheet?.(player);
                }
                return true;
            }
            case 'social':
                this.uiManager.updateSocialList(msg.payload);
                return true;
            default:
                return false;
        }
    }

    /**
     * Update the local player's party ID and immediately refresh all
     * remote-entity highlights.  Called whenever the local player's partyId
     * changes in the state / delta stream.
     * @param {string} partyId
     */
    setMyPartyId(partyId) {
        const next = partyId || '';
        if (next === this.myPartyId) return;
        this.myPartyId = next;
        this.refreshAllPartyHighlights();
    }

    /**
     * Re-evaluate the party-member highlight on every known remote entity.
     * Called after myPartyId changes so existing actors update immediately.
     */
    refreshAllPartyHighlights() {
        this.remotePlayers.forEach((entity) => {
            if (typeof entity.setPartyHighlight === 'function') {
                entity.setPartyHighlight(!!(this.myPartyId && entity.partyId === this.myPartyId));
            }
        });
    }

    setPvPOpponents(opponents = []) {
        this.pvpOpponents = new Set(Array.isArray(opponents) ? opponents : []);
        this.remotePlayers.forEach((entity, id) => entity.setPvPHostile?.(this.pvpOpponents.has(id)));
    }

    isPvPHostile(entityId) {
        return this.pvpOpponents.has(entityId);
    }

    /**
     * Send a party-related message via the network layer.
     * @param {string} type     Message type (e.g. 'party_invite').
     * @param {object} payload
     */
    sendPartyMessage(type, payload) {
        this.network.send(type, payload);
    }

    /** Remove a member from the current party. */
    kickPartyMember(targetId) {
        this.sendPartyMessage('party_kick', { targetId });
    }

    /** Promote a member to party leader. */
    promotePartyMember(targetId) {
        this.sendPartyMessage('party_promote', { targetId });
    }
}
