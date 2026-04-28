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
        this.onPartyKick = null;
        this.onPartyPromote = null;

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
        if (show) {
            if (this.ctx.openManagedWindow) {
                this.ctx.openManagedWindow('social');
            } else {
                this.ctx.closePrimaryHudMenus?.({ except: 'social' });
                this.socialWindow.style.display = 'block';
            }
        } else if (this.ctx.closeManagedWindow) {
            this.ctx.closeManagedWindow('social');
        } else {
            this.socialWindow.style.display = 'none';
        }

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
            row.className = 'social-window__row';

            const isSelf = player && player.name === p.name;

            const name = document.createElement('span');
            name.className = `social-window__cell social-window__name${isSelf ? ' social-window__name--self' : ''}`;
            name.textContent = p.name;
            row.appendChild(name);

            const className = document.createElement('span');
            className.className = 'social-window__cell social-window__class';
            className.textContent = p.class;
            row.appendChild(className);

            const level = document.createElement('span');
            level.className = 'social-window__cell social-window__level';
            level.textContent = String(p.level);
            row.appendChild(level);

            const action = document.createElement('div');
            action.className = 'social-window__cell social-window__action';
            if (!isSelf) {
                const inviteButton = document.createElement('button');
                inviteButton.className = 'social-window__invite-btn';
                inviteButton.type = 'button';
                inviteButton.dataset.name = p.name;
                inviteButton.textContent = 'Invite';
                inviteButton.setAttribute('aria-label', `Invite ${p.name} to party`);
                inviteButton.addEventListener('click', (e) => {
                    const nameToInvite = e.currentTarget?.getAttribute('data-name');
                    if (nameToInvite && this.onPartyInvite) {
                        this.onPartyInvite(nameToInvite);
                        if (this.ctx.addChatMessage) this.ctx.addChatMessage('System', `Invited ${nameToInvite} to party.`);
                    }
                });
                action.appendChild(inviteButton);
            } else {
                const selfBadge = document.createElement('span');
                selfBadge.className = 'social-window__self-badge';
                selfBadge.textContent = 'You';
                action.appendChild(selfBadge);
            }
            row.appendChild(action);

            this.socialList.appendChild(row);
        });
    }

    // ================================================================
    // PARTY
    // ================================================================

    updateParty(partyData) {
        this.partyData = partyData;
        if (!this.partyPanel || !this.partyList) return;

        const panelGuidance = document.getElementById('party-panel-guidance');

        const inParty = !!(partyData && partyData.partyId);
        this.inParty = inParty;

        if (!inParty) {
            if (panelGuidance) {
                panelGuidance.textContent = 'Stay near party members to share kill credit, gold, XP, and dungeon boss rewards. Each nearby member also adds to the party reward bonus.';
            }
            if (this.socialWindow.style.display === 'none') {
                this.partyPanel.style.display = 'none';
            } else {
                this.partyPanel.style.display = 'block';
            }
            this.partyList.replaceChildren();
            const emptyState = document.createElement('div');
            emptyState.style.color = '#aaa';
            emptyState.style.fontStyle = 'italic';
            emptyState.style.padding = '5px';
            emptyState.textContent = 'No party. Invite someone!';
            this.partyList.appendChild(emptyState);
            return;
        }

        this.partyPanel.style.display = 'block';
        this.partyList.replaceChildren();

        const members = partyData.members || [];
        const leaderId = partyData.leaderId;
        const player = this.ctx.getLastPlayer();
        const myId = player ? player.id : null;
        const amILeader = myId === leaderId;
        const nearbyBonusPct = Math.max(10, members.length * 10);

        if (panelGuidance) {
            panelGuidance.textContent = amILeader
                ? `Leader view: keep members nearby to share kill credit, gold, XP, and dungeon boss rewards. Current nearby party bonus target reads +${nearbyBonusPct}% before dungeon difficulty multipliers.`
                : `Party rewards are proximity-based: stay near the group to share kill credit, gold, XP, and dungeon boss rewards. A full nearby party currently targets about +${nearbyBonusPct}% bonus rewards before difficulty scaling.`;
        }

        members.forEach(member => {
            const div = document.createElement('div');
            div.className = 'party-member';

            const hpPercent = (member.hp / member.maxHp) * 100;
            const isLeader = member.isLeader;
            const isMe = member.id === myId;
            const roleLabel = isLeader ? 'Leader' : isMe ? 'You' : 'Member';

            const info = document.createElement('div');
            info.className = 'party-member-info';

            const nameRow = document.createElement('div');
            nameRow.className = 'party-name';

            if (isLeader) {
                const leaderIcon = document.createElement('span');
                leaderIcon.className = 'party-leader-icon';
                leaderIcon.textContent = '★';
                nameRow.appendChild(leaderIcon);
                nameRow.appendChild(document.createTextNode(' '));
            }

            nameRow.appendChild(document.createTextNode(member.name));

            const meta = document.createElement('span');
            meta.style.color = '#aaa';
            meta.style.fontSize = '10px';
            meta.textContent = ` (Lvl ${member.level} ${member.class})`;
            nameRow.appendChild(meta);

            const hpBar = document.createElement('div');
            hpBar.className = 'party-hp-bar';

            const hpFill = document.createElement('div');
            hpFill.className = 'party-hp-fill';
            hpFill.style.width = `${Math.max(0, Math.min(100, hpPercent))}%`;
            hpBar.appendChild(hpFill);

            info.appendChild(nameRow);
            info.appendChild(hpBar);
            div.appendChild(info);

            const metaRow = document.createElement('div');
            metaRow.className = 'party-member-meta';

            const role = document.createElement('span');
            role.className = 'party-member-role';
            role.textContent = roleLabel;

            const bonus = document.createElement('span');
            bonus.className = 'party-member-bonus';
            bonus.textContent = `Nearby share: +${nearbyBonusPct}%`;

            metaRow.appendChild(role);
            metaRow.appendChild(bonus);
            div.appendChild(metaRow);

            if (amILeader && !isMe) {
                const actions = document.createElement('div');
                actions.className = 'party-actions';

                const kickButton = document.createElement('button');
                kickButton.className = 'party-btn';
                kickButton.type = 'button';
                kickButton.title = 'Kick';
                kickButton.textContent = 'K';
                kickButton.addEventListener('click', () => {
                    this.onPartyKick?.(member.id);
                });

                const promoteButton = document.createElement('button');
                promoteButton.className = 'party-btn';
                promoteButton.type = 'button';
                promoteButton.title = 'Promote';
                promoteButton.textContent = 'P';
                promoteButton.addEventListener('click', () => {
                    this.onPartyPromote?.(member.id);
                });

                actions.appendChild(kickButton);
                actions.appendChild(promoteButton);
                div.appendChild(actions);
            }

            this.partyList.appendChild(div);
        });
    }

    showPartyRequest(inviterName) {
        if (!this.partyRequestModal) return;
        this.currentInviter = inviterName;
        if (this.partyInviterName) this.partyInviterName.textContent = inviterName;
        const benefits = document.getElementById('party-request-benefits');
        if (benefits) {
            benefits.textContent = 'Accept to share nearby kill rewards, dungeon boss credit, and party-led dungeon entry flow.';
        }
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
        const div = document.getElementById('social-window') || document.createElement('div');
        div.id = 'social-window';
        div.className = 'window social-window';
        div.style.display = 'none';
        div.style.position = 'absolute';
        div.style.top = '50%';
        div.style.left = '50%';
        div.style.transform = 'translate(-50%, -50%)';
        div.style.userSelect = 'none';
        div.style.webkitUserSelect = 'none';

        div.innerHTML = `
            <div class="window-header social-window__header">
                <span class="social-window__title">SOCIAL</span>
                <button id="close-social" class="close-btn" type="button" aria-label="Close social window">×</button>
            </div>
            <div class="social-window__columns">
                <span>Name</span>
                <span>Class</span>
                <span>Level</span>
                <span>Action</span>
            </div>
            <div id="social-list" class="social-window__list">
            </div>
        `;

        if (!div.parentElement) {
            document.body.appendChild(div);
        }

        div.querySelector('#close-social')?.addEventListener('click', () => this.toggleSocial(false));

        this.socialWindow = div;
        this.socialList = div.querySelector('#social-list');
    }
}
