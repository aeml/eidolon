/**
 * Social UI module — handles the social (online players) window,
 * party panel, party invite/leave/kick/promote, and party request modal.
 *
 * Extracted from UIManager to keep each UI domain independently readable.
 * The parent UIManager passes shared helpers via the `ctx` object.
 */
export class SocialUI {
    /**
     * @param {Object} ctx
     * @param {Function} ctx.getLastPlayer  – returns current player ref
     * @param {Function} ctx.addChatMessage – (sender, msg) adds system chat
     */
    constructor(ctx) {
        this.ctx = ctx;

        // --- State ---
        this.partyData = null;
        this.inParty = false;
        this.currentInviter = null;

        // --- Callbacks (set by GameEngine) ---
        this.onSocialOpen = null;
        this.onPartyInvite = null;
        this.onPartyLeave = null;
        this.onPartyResponse = null;

        // --- Create the social window DOM element ---
        this._createSocialWindow();

        // --- Party DOM refs ---
        this.partyPanel = document.getElementById('party-panel');
        this.partyList = document.getElementById('party-list');
        this.partyInviteInput = document.getElementById('party-invite-input');
        this.btnInviteParty = document.getElementById('btn-invite-party');
        this.btnLeaveParty = document.getElementById('btn-leave-party');
        this.partyRequestModal = document.getElementById('party-request-modal');
        this.partyInviterName = document.getElementById('party-inviter-name');
        this.btnAcceptParty = document.getElementById('btn-accept-party');
        this.btnDeclineParty = document.getElementById('btn-decline-party');

        // --- Party event listeners ---
        if (this.btnInviteParty) this.btnInviteParty.addEventListener('click', () => {
            const name = this.partyInviteInput.value.trim();
            if (name && this.onPartyInvite) {
                this.onPartyInvite(name);
                this.partyInviteInput.value = '';
            }
        });

        if (this.btnLeaveParty) this.btnLeaveParty.addEventListener('click', () => {
            if (this.onPartyLeave) this.onPartyLeave();
        });

        if (this.btnAcceptParty) this.btnAcceptParty.addEventListener('click', () => {
            if (this.onPartyResponse) this.onPartyResponse(this.currentInviter, true);
            this.hidePartyRequest();
        });

        if (this.btnDeclineParty) this.btnDeclineParty.addEventListener('click', () => {
            if (this.onPartyResponse) this.onPartyResponse(this.currentInviter, false);
            this.hidePartyRequest();
        });
    }

    // ================================================================
    // PUBLIC API
    // ================================================================

    /** Whether the social window is currently visible. */
    get isOpen() {
        return this.socialWindow &&
               this.socialWindow.style.display === 'block';
    }

    /** Close the social window. */
    close() {
        if (this.socialWindow) this.socialWindow.style.display = 'none';
    }

    /** Toggle social window open/closed. */
    toggleSocial(show) {
        if (show === undefined) {
            show = this.socialWindow.style.display === 'none';
        }
        this.socialWindow.style.display = show ? 'block' : 'none';

        if (show) {
            if (this.onSocialOpen) this.onSocialOpen();
            if (this.partyPanel) {
                this.partyPanel.style.display = 'block';
            }
        } else {
            if (this.partyPanel && !this.inParty) {
                this.partyPanel.style.display = 'none';
            }
        }
    }

    // ================================================================
    // SOCIAL LIST
    // ================================================================

    updateSocialList(players) {
        this.socialList.innerHTML = '';
        const player = this.ctx.getLastPlayer();

        players.forEach(p => {
            const row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '2fr 1fr 1fr 1fr';
            row.style.padding = '5px 0';
            row.style.borderBottom = '1px solid #333';

            const isSelf = player && player.name === p.name;
            row.innerHTML = `
                <span style="color:${isSelf ? '#4CAF50' : 'white'}">${p.name}</span>
                <span style="color:#aaa">${p.class}</span>
                <span style="color:#FFD700">${p.level}</span>
                ${!isSelf ? `<button class="btn-invite" data-name="${p.name}" style="background:#2e7d32; border:none; color:white; cursor:pointer; font-size:10px; padding:2px 5px;">INVITE</button>` : '<span></span>'}
            `;
            this.socialList.appendChild(row);
        });

        const inviteBtns = this.socialList.querySelectorAll('.btn-invite');
        inviteBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const name = e.target.getAttribute('data-name');
                if (this.onPartyInvite) {
                    this.onPartyInvite(name);
                    if (this.ctx.addChatMessage) this.ctx.addChatMessage("System", `Invited ${name} to party.`);
                }
            });
        });
    }

    // ================================================================
    // PARTY
    // ================================================================

    updateParty(partyData) {
        this.partyData = partyData;
        if (!this.partyPanel || !this.partyList) return;

        const inParty = !!(partyData && partyData.partyId);
        this.inParty = inParty;

        if (!inParty) {
            if (this.socialWindow.style.display === 'none') {
                this.partyPanel.style.display = 'none';
            } else {
                this.partyPanel.style.display = 'block';
            }
            this.partyList.innerHTML = '<div style="color:#aaa; font-style:italic; padding:5px;">No party. Invite someone!</div>';
            return;
        }

        this.partyPanel.style.display = 'block';
        this.partyList.innerHTML = '';

        const members = partyData.members || [];
        const leaderId = partyData.leaderId;
        const player = this.ctx.getLastPlayer();
        const myId = player ? player.id : null;
        const amILeader = myId === leaderId;

        members.forEach(member => {
            const div = document.createElement('div');
            div.className = 'party-member';

            const hpPercent = (member.hp / member.maxHp) * 100;
            const isLeader = member.isLeader;
            const isMe = member.id === myId;

            let actionsHtml = '';
            if (amILeader && !isMe) {
                actionsHtml = `
                    <div class="party-actions">
                        <button class="party-btn" onclick="window.game.kickPartyMember('${member.id}')" title="Kick">K</button>
                        <button class="party-btn" onclick="window.game.promotePartyMember('${member.id}')" title="Promote">P</button>
                    </div>
                `;
            }

            div.innerHTML = `
                <div class="party-member-info">
                    <div class="party-name">
                        ${isLeader ? '<span class="party-leader-icon">★</span>' : ''}
                        ${member.name} <span style="color: #aaa; font-size: 10px;">(Lvl ${member.level} ${member.class})</span>
                    </div>
                    <div class="party-hp-bar">
                        <div class="party-hp-fill" style="width: ${hpPercent}%"></div>
                    </div>
                </div>
                ${actionsHtml}
            `;
            this.partyList.appendChild(div);
        });
    }

    showPartyRequest(inviterName) {
        if (!this.partyRequestModal) return;
        this.currentInviter = inviterName;
        if (this.partyInviterName) this.partyInviterName.textContent = inviterName;
        this.partyRequestModal.style.display = 'block';
    }

    hidePartyRequest() {
        if (!this.partyRequestModal) return;
        this.partyRequestModal.style.display = 'none';
        this.currentInviter = null;
    }

    // ================================================================
    // INTERNAL
    // ================================================================

    /** Create the social window DOM element (called from constructor). */
    _createSocialWindow() {
        const div = document.createElement('div');
        div.id = 'social-window';
        div.className = 'window';
        div.style.display = 'none';
        div.style.position = 'absolute';
        div.style.top = '50%';
        div.style.left = '50%';
        div.style.transform = 'translate(-50%, -50%)';
        div.style.width = '400px';
        div.style.height = '500px';
        div.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        div.style.border = '2px solid #444';
        div.style.color = 'white';
        div.style.padding = '20px';
        div.style.zIndex = '1000';
        div.style.fontFamily = 'Arial, sans-serif';

        div.innerHTML = `
            <div class="window-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #666; padding-bottom:10px;">
                <h2 style="margin:0;">Social</h2>
                <button id="close-social" style="background:none; border:none; color:white; font-size:20px; cursor:pointer;">X</button>
            </div>
            <div style="display:grid; grid-template-columns: 2fr 1fr 1fr 1fr; font-weight:bold; margin-bottom:10px; color:#aaa;">
                <span>Name</span>
                <span>Class</span>
                <span>Level</span>
                <span>Action</span>
            </div>
            <div id="social-list" style="overflow-y:auto; height:380px;">
            </div>
        `;

        document.body.appendChild(div);
        document.getElementById('close-social').onclick = () => this.toggleSocial(false);

        this.socialWindow = div;
        this.socialList = document.getElementById('social-list');
    }
}
