import { GuildUI } from './GuildUI.js';

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
        this.currentSocialStatus = 'available';

        // --- Friends state (0.38) ---
        this.friendEntries = [];   // [{ username, online, socialStatus }]
        this.pendingUsernames = []; // incoming pending requests
        this._activeTab = 'online';

        // --- Callbacks (set by GameEngine) ---
        this.onSocialOpen = null;
        this.onSocialStatusChange = null;
        this.onPartyInvite = null;
        this.onPartyLeave = null;
        this.onPartyResponse = null;
        this.onPartyKick = null;
        this.onPartyPromote = null;
		this.onPartyReadyCheck = null;
		this.onPartyReady = null;
        this.onPartyLootRule = null;
		this.onTradeRequest = null;
		this.onDuelRequest = null;

        // --- Friends callbacks (set by UIBindings / GameEngine, 0.38) ---
        this.onFriendRequest = null;   // (username) → send request
        this.onFriendAccept  = null;   // (username) → accept pending
        this.onFriendDecline = null;   // (username) → decline pending
        this.onFriendRemove  = null;   // (username) → remove friend

        // --- Create the social window DOM element ---
        this._createSocialWindow();

        // --- Party DOM refs ---
        this.partyPanel = document.getElementById('party-panel');
        this.partyList = document.getElementById('party-list');
        this.partyInviteInput = document.getElementById('party-invite-input');
        this.btnInviteParty = document.getElementById('btn-invite-party');
		this.btnTradePlayer = document.getElementById('btn-trade-player');
        this.btnLeaveParty = document.getElementById('btn-leave-party');
		this.btnPartyReadyCheck = document.getElementById('btn-party-ready-check');
		this.btnPartyReady = document.getElementById('btn-party-ready');
		this.partyReadyStatus = document.getElementById('party-ready-status');
		this.partyLootRule = document.getElementById('party-loot-rule');
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
		this.btnTradePlayer?.addEventListener('click', () => {
			const name = this.partyInviteInput?.value.trim();
			if (name) {
				this.onTradeRequest?.(name);
				this.partyInviteInput.value = '';
			}
		});

        if (this.btnLeaveParty) this.btnLeaveParty.addEventListener('click', () => {
            if (this.onPartyLeave) this.onPartyLeave();
        });

		this.btnPartyReadyCheck?.addEventListener('click', () => this.onPartyReadyCheck?.());
		this.btnPartyReady?.addEventListener('click', () => {
			const ready = this.btnPartyReady.dataset.ready !== 'true';
			this.onPartyReady?.(ready);
		});
		this.partyLootRule?.addEventListener('change', () => {
			this.onPartyLootRule?.(this.partyLootRule.value);
		});

        if (this.btnAcceptParty) this.btnAcceptParty.addEventListener('click', () => {
            if (this.onPartyResponse) this.onPartyResponse(this.currentInviter, true);
            this.hidePartyRequest();
        });

        if (this.btnDeclineParty) this.btnDeclineParty.addEventListener('click', () => {
            if (this.onPartyResponse) this.onPartyResponse(this.currentInviter, false);
            this.hidePartyRequest();
        });

        this.socialStatusSelect = document.getElementById('social-status-select');
        if (this.socialStatusSelect) {
            this.socialStatusSelect.value = this.currentSocialStatus;
            this.socialStatusSelect.addEventListener('change', () => {
                this.setSocialStatus(this.socialStatusSelect.value, { notify: true });
            });
        }
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
            document.getElementById('close-social')?.focus();
            if (this.partyPanel) {
                this.setPartyPanelVisible(true);
            }
        } else {
            if (this.partyPanel && !this.inParty) {
                this.setPartyPanelVisible(false);
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

            const status = document.createElement('span');
            status.className = `social-window__cell social-window__status social-window__status--${this.normalizeSocialStatus(p.socialStatus)}`;
            status.textContent = this.getSocialStatusLabel(p.socialStatus);
            row.appendChild(status);

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
                const duelButton = document.createElement('button');
                duelButton.className = 'social-window__invite-btn';
                duelButton.type = 'button';
                duelButton.textContent = 'Duel';
                duelButton.setAttribute('aria-label', `Challenge ${p.name} to a duel`);
                duelButton.addEventListener('click', () => this.onDuelRequest?.(p.name));
                action.appendChild(duelButton);
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

    setSocialStatus(status, options = {}) {
        const normalized = this.normalizeSocialStatus(status);
        this.currentSocialStatus = normalized;
        if (this.socialStatusSelect && this.socialStatusSelect.value !== normalized) {
            this.socialStatusSelect.value = normalized;
        }
        if (options.notify) {
            this.onSocialStatusChange?.(normalized);
            this.ctx.addChatMessage?.('System', `Social status set to ${this.getSocialStatusLabel(normalized)}.`);
        }
        return normalized;
    }

    normalizeSocialStatus(status) {
        return ['available', 'looking_party', 'in_run', 'busy'].includes(status) ? status : 'available';
    }

    getSocialStatusLabel(status) {
        switch (this.normalizeSocialStatus(status)) {
        case 'looking_party':
            return 'Looking for Party';
        case 'in_run':
            return 'In Run';
        case 'busy':
            return 'Busy';
        case 'available':
        default:
            return 'Available';
        }
    }

    // ================================================================
    // FRIENDS (0.38)
    // ================================================================

    /**
     * Called when a `friend_list` message is received from the server.
     * @param {{ friends: Array<{username,online,socialStatus}>, pending: string[] }} payload
     */
    updateFriendList(payload) {
        this.friendEntries = Array.isArray(payload.friends) ? payload.friends : [];
        this.pendingUsernames = Array.isArray(payload.pending) ? payload.pending : [];
        if (this._activeTab === 'friends') {
            this._renderFriendsPanel();
        }
        this._updateFriendsBadge();
    }

    /**
     * Called when a `friend_presence` message is received.
     * Updates the relevant entry and refreshes the panel if visible.
     * @param {{ username: string, online: boolean }} data
     */
    onFriendPresence(data) {
        const entry = this.friendEntries.find(e => e.username === data.username);
        if (entry) {
            entry.online = data.online;
            if (!data.online) entry.socialStatus = '';
        }
        if (this._activeTab === 'friends') {
            this._renderFriendsPanel();
        }
    }

    /**
     * Called when a `friend_request` notification is pushed by the server
     * (someone sent *this* player a request).
     * @param {{ username: string }} data
     */
    onIncomingFriendRequest(data) {
        if (!this.pendingUsernames.includes(data.username)) {
            this.pendingUsernames.push(data.username);
        }
        if (this._activeTab === 'friends') {
            this._renderFriendsPanel();
        }
        this._updateFriendsBadge();
    }

    // ================================================================
    // PARTY
    // ================================================================

    setPartyPanelVisible(visible) {
        if (!this.partyPanel) return;
        this.partyPanel.style.display = visible ? 'block' : 'none';
        document.body.classList.toggle('party-roster-visible', visible);
    }

    updateParty(partyData) {
        this.partyData = partyData;
        if (!this.partyPanel || !this.partyList) return;

        const panelGuidance = document.getElementById('party-panel-guidance');

        const inParty = !!(partyData && partyData.partyId);
        this.inParty = inParty;

        if (!inParty) {
			if (this.btnPartyReadyCheck) this.btnPartyReadyCheck.hidden = true;
			if (this.btnPartyReady) this.btnPartyReady.hidden = true;
			if (this.partyReadyStatus) this.partyReadyStatus.textContent = '';
			if (this.partyLootRule) {
				this.partyLootRule.value = 'ffa';
				this.partyLootRule.disabled = true;
			}
            if (panelGuidance) {
                panelGuidance.textContent = 'Stay near party members to share kill credit, gold, XP, and dungeon boss rewards. Each nearby member also adds to the party reward bonus.';
            }
            if (this.socialWindow.style.display === 'none') {
                this.setPartyPanelVisible(false);
            } else {
                this.setPartyPanelVisible(true);
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

        this.setPartyPanelVisible(true);
        this.partyList.replaceChildren();

        const members = partyData.members || [];
        const leaderId = partyData.leaderId;
        const player = this.ctx.getLastPlayer();
        const myId = player ? player.id : null;
        const amILeader = myId === leaderId;
		const myMember = members.find((member) => member.id === myId);
		const readyCheckActive = !!partyData.readyCheckActive;
		if (this.btnPartyReadyCheck) this.btnPartyReadyCheck.hidden = !amILeader;
		if (this.btnPartyReady) {
			this.btnPartyReady.hidden = !readyCheckActive;
			this.btnPartyReady.dataset.ready = String(!!myMember?.ready);
			this.btnPartyReady.textContent = myMember?.ready ? 'Not Ready' : 'Ready';
		}
		if (this.partyReadyStatus) {
			this.partyReadyStatus.textContent = readyCheckActive ? 'Check active' : partyData.allReady ? 'All ready' : '';
		}
		if (this.partyLootRule) {
			this.partyLootRule.value = partyData.lootRule || 'ffa';
			this.partyLootRule.disabled = !amILeader;
		}
        const nearbyBonusPct = Math.max(10, members.length * 10);

        if (panelGuidance) {
            panelGuidance.title = amILeader
                ? `Leader view: keep members nearby to share kill credit, gold, XP, and dungeon boss rewards. Current nearby party bonus target reads +${nearbyBonusPct}% before dungeon difficulty multipliers.`
                : `Party rewards are proximity-based: stay near the group to share kill credit, gold, XP, and dungeon boss rewards. A full nearby party currently targets about +${nearbyBonusPct}% bonus rewards before difficulty scaling.`;
            panelGuidance.textContent = `${amILeader ? 'Leader view' : 'Stay together'} · nearby allies share rewards (+${nearbyBonusPct}% target).`;
        }

        members.forEach(member => {
            const div = document.createElement('div');
            div.className = 'party-member';
			div.classList.toggle('party-member--ready', !!member.ready);

            const hpPercent = (member.hp / member.maxHp) * 100;
            const isLeader = member.isLeader;
            const isMe = member.id === myId;
			const combatRole = member.role || 'damage';
			const roleLabel = `${combatRole}${isLeader ? ' • Leader' : isMe ? ' • You' : ''}${member.ready ? ' • Ready' : ''}`;

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
                kickButton.setAttribute('aria-label', `Kick ${member.name} from party`);
                kickButton.textContent = 'K';
                kickButton.addEventListener('click', () => {
                    this.onPartyKick?.(member.id);
                });

                const promoteButton = document.createElement('button');
                promoteButton.className = 'party-btn';
                promoteButton.type = 'button';
                promoteButton.title = 'Promote';
                promoteButton.setAttribute('aria-label', `Promote ${member.name} to party leader`);
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
        this.btnAcceptParty?.focus();
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
        div.className = 'window social-window content-aware-window';
        div.setAttribute('role', 'dialog');
        div.setAttribute('aria-modal', 'true');
        div.setAttribute('aria-labelledby', 'social-window-title');
        div.style.display = 'none';
        div.style.position = 'absolute';
        div.style.top = '50%';
        div.style.left = '50%';
        div.style.transform = 'translate(-50%, -50%)';
        div.style.userSelect = 'none';
        div.style.webkitUserSelect = 'none';

        div.innerHTML = `
            <div class="window-header social-window__header">
                <span id="social-window-title" class="social-window__title">SOCIAL</span>
                <button id="close-social" class="close-btn" type="button" aria-label="Close social window">×</button>
            </div>
            <div class="social-window__status-control">
                <label class="social-window__status-label" for="social-status-select">My social status</label>
                <select id="social-status-select" class="social-window__status-select">
                    <option value="available">Available</option>
                    <option value="looking_party">Looking for Party</option>
                    <option value="in_run">In Run</option>
                    <option value="busy">Busy</option>
                </select>
            </div>
            <div class="social-window__tabs" role="tablist">
                <button class="social-window__tab social-window__tab--active"
                        id="tab-btn-online" role="tab"
                        aria-selected="true" aria-controls="tab-panel-online"
                        type="button">Online</button>
                <button class="social-window__tab"
                        id="tab-btn-friends" role="tab"
                        aria-selected="false" aria-controls="tab-panel-friends"
                        type="button">Friends <span id="friends-badge" class="social-window__friends-badge" style="display:none"></span></button>
                <button class="social-window__tab"
                        id="tab-btn-guild" role="tab"
                        aria-selected="false" aria-controls="tab-panel-guild"
                        type="button">Guild</button>
            </div>
            <div id="tab-panel-online" role="tabpanel" aria-labelledby="tab-btn-online">
                <div class="social-window__columns">
                    <span>Name</span>
                    <span>Class</span>
                    <span>Level</span>
                    <span>Status</span>
                    <span>Action</span>
                </div>
                <div id="social-list" class="social-window__list">
                </div>
            </div>
            <div id="tab-panel-friends" role="tabpanel" aria-labelledby="tab-btn-friends" style="display:none">
                <div class="friends-add-row">
                    <input type="text" id="friend-add-input"
                           class="friends-add-input" placeholder="Username" maxlength="32"
                           aria-label="Friend username to add" />
                    <button id="btn-add-friend" class="friends-add-btn" type="button">Add Friend</button>
                </div>
                <div id="friends-pending-section" class="friends-pending-section" style="display:none">
                    <div class="friends-section-header">Pending Requests</div>
                    <div id="friends-pending-list" class="friends-pending-list"></div>
                </div>
                <div class="friends-section-header">Friends</div>
                <div id="friends-list" class="friends-list"></div>
            </div>
            <div id="tab-panel-guild" role="tabpanel" aria-labelledby="tab-btn-guild" style="display:none"></div>
        `;

        if (!div.parentElement) {
            document.body.appendChild(div);
        }

        div.querySelector('#close-social')?.addEventListener('click', () => this.toggleSocial(false));

        // Tab switching
        div.querySelector('#tab-btn-online')?.addEventListener('click', () => this._switchTab('online'));
        div.querySelector('#tab-btn-friends')?.addEventListener('click', () => {
            this._switchTab('friends');
            this._renderFriendsPanel();
        });
        div.querySelector('#tab-btn-guild')?.addEventListener('click', () => this._switchTab('guild'));

        // Add friend button
        const addBtn = div.querySelector('#btn-add-friend');
        const addInput = div.querySelector('#friend-add-input');
        if (addBtn && addInput) {
            const submit = () => {
                const name = addInput.value.trim();
                if (name && this.onFriendRequest) {
                    this.onFriendRequest(name);
                    addInput.value = '';
                }
            };
            addBtn.addEventListener('click', submit);
            addInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') submit();
            });
        }

        this.socialWindow = div;
        this.socialList = div.querySelector('#social-list');
        this._friendsPanel = div.querySelector('#tab-panel-friends');
        this._friendsList = div.querySelector('#friends-list');
        this._friendsPendingList = div.querySelector('#friends-pending-list');
        this._friendsPendingSection = div.querySelector('#friends-pending-section');
        this._friendsBadge = div.querySelector('#friends-badge');
        this.guild = new GuildUI({
            container: div.querySelector('#tab-panel-guild'),
            getLastPlayer: this.ctx.getLastPlayer,
            addChatMessage: this.ctx.addChatMessage,
        });
    }

    /** Switch between 'online' and 'friends' tabs. */
    _switchTab(tab) {
        this._activeTab = tab;
        const onlinePanel = this.socialWindow.querySelector('#tab-panel-online');
        const friendsPanel = this.socialWindow.querySelector('#tab-panel-friends');
        const guildPanel = this.socialWindow.querySelector('#tab-panel-guild');
        const onlineBtn = this.socialWindow.querySelector('#tab-btn-online');
        const friendsBtn = this.socialWindow.querySelector('#tab-btn-friends');
        const guildBtn = this.socialWindow.querySelector('#tab-btn-guild');

        for (const panel of [onlinePanel, friendsPanel, guildPanel]) panel.style.display = 'none';
        for (const button of [onlineBtn, friendsBtn, guildBtn]) {
            button?.classList.remove('social-window__tab--active');
            button?.setAttribute('aria-selected', 'false');
        }

        if (tab === 'online') {
            if (onlinePanel) onlinePanel.style.display = '';
            onlineBtn?.classList.add('social-window__tab--active');
            onlineBtn?.setAttribute('aria-selected', 'true');
        } else if (tab === 'friends') {
            if (friendsPanel) friendsPanel.style.display = '';
            friendsBtn?.classList.add('social-window__tab--active');
            friendsBtn?.setAttribute('aria-selected', 'true');
        } else {
            if (guildPanel) guildPanel.style.display = '';
            guildBtn?.classList.add('social-window__tab--active');
            guildBtn?.setAttribute('aria-selected', 'true');
        }
    }

    /** Rebuild the friends tab content from current state. */
    _renderFriendsPanel() {
        if (!this._friendsList) return;

        // Pending requests section
        if (this._friendsPendingSection && this._friendsPendingList) {
            if (this.pendingUsernames.length > 0) {
                this._friendsPendingSection.style.display = '';
                this._friendsPendingList.replaceChildren();
                this.pendingUsernames.forEach(username => {
                    const row = document.createElement('div');
                    row.className = 'friends-row friends-row--pending';

                    const nameEl = document.createElement('span');
                    nameEl.className = 'friends-name';
                    nameEl.textContent = username;
                    row.appendChild(nameEl);

                    const actions = document.createElement('div');
                    actions.className = 'friends-actions';

                    const acceptBtn = document.createElement('button');
                    acceptBtn.type = 'button';
                    acceptBtn.className = 'friends-btn friends-btn--accept';
                    acceptBtn.textContent = 'Accept';
                    acceptBtn.addEventListener('click', () => {
                        this.onFriendAccept?.(username);
                    });

                    const declineBtn = document.createElement('button');
                    declineBtn.type = 'button';
                    declineBtn.className = 'friends-btn friends-btn--decline';
                    declineBtn.textContent = 'Decline';
                    declineBtn.addEventListener('click', () => {
                        this.onFriendDecline?.(username);
                    });

                    actions.appendChild(acceptBtn);
                    actions.appendChild(declineBtn);
                    row.appendChild(actions);
                    this._friendsPendingList.appendChild(row);
                });
            } else {
                this._friendsPendingSection.style.display = 'none';
            }
        }

        // Friends list
        this._friendsList.replaceChildren();

        if (this.friendEntries.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'friends-empty';
            empty.textContent = 'No friends yet. Add someone!';
            this._friendsList.appendChild(empty);
            return;
        }

        // Sort: online first, then alphabetical
        const sorted = [...this.friendEntries].sort((a, b) => {
            if (a.online !== b.online) return a.online ? -1 : 1;
            return a.username.localeCompare(b.username);
        });

        sorted.forEach(entry => {
            const row = document.createElement('div');
            row.className = `friends-row${entry.online ? ' friends-row--online' : ' friends-row--offline'}`;

            const dot = document.createElement('span');
            dot.className = `friends-dot friends-dot--${entry.online ? 'online' : 'offline'}`;
            dot.setAttribute('aria-hidden', 'true');
            row.appendChild(dot);

            const nameEl = document.createElement('span');
            nameEl.className = 'friends-name';
            nameEl.textContent = entry.username;
            row.appendChild(nameEl);

            if (entry.online && entry.socialStatus) {
                const statusEl = document.createElement('span');
                statusEl.className = `friends-status friends-status--${this.normalizeSocialStatus(entry.socialStatus)}`;
                statusEl.textContent = this.getSocialStatusLabel(entry.socialStatus);
                row.appendChild(statusEl);
            } else if (!entry.online) {
                const offlineEl = document.createElement('span');
                offlineEl.className = 'friends-status friends-status--offline';
                offlineEl.textContent = 'Offline';
                row.appendChild(offlineEl);
            }

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'friends-btn friends-btn--remove';
            removeBtn.title = `Remove ${entry.username}`;
            removeBtn.textContent = '✕';
            removeBtn.setAttribute('aria-label', `Remove ${entry.username} from friends`);
            removeBtn.addEventListener('click', () => {
                this.onFriendRemove?.(entry.username);
            });
            row.appendChild(removeBtn);

            this._friendsList.appendChild(row);
        });
    }

    /** Update the pending-requests badge on the Friends tab button. */
    _updateFriendsBadge() {
        if (!this._friendsBadge) return;
        const count = this.pendingUsernames.length;
        if (count > 0) {
            this._friendsBadge.textContent = String(count);
            this._friendsBadge.style.display = '';
        } else {
            this._friendsBadge.style.display = 'none';
        }
    }
}
