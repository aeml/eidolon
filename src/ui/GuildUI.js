export class GuildUI {
    constructor({ container, getLastPlayer, addChatMessage }) {
        this.container = container;
        this.getLastPlayer = getLastPlayer;
        this.addChatMessage = addChatMessage;
        this.state = { guild: null, invites: [] };

        this.onCreate = null;
        this.onInvite = null;
        this.onRespond = null;
        this.onLeave = null;
        this.onKick = null;
        this.onSetRank = null;
        this.onTransfer = null;
        this.onSetMOTD = null;
        this.onDisband = null;
        this.onClaimLeadership = null;
        this.onBankDeposit = null;
        this.onBankWithdraw = null;
        this.onLeaderboard = null;
        this.leaderboard = { season: '', runs: [] };

        this.render();
    }

    update(payload = {}) {
        this.state = {
            guild: payload.guild || null,
            invites: Array.isArray(payload.invites) ? payload.invites : [],
        };
        this.render();
    }

    updateLeaderboard(payload = {}) {
        this.leaderboard = {
            season: payload.season || '',
            runs: Array.isArray(payload.runs) ? payload.runs : [],
        };
        this.render();
    }

    render() {
        if (!this.container) return;
        this.container.replaceChildren();
        if (!this.state.guild) {
            this.renderEnrollment();
            return;
        }
        this.renderGuild(this.state.guild);
    }

    renderEnrollment() {
        const create = document.createElement('section');
        create.className = 'guild-card';
        create.innerHTML = `
            <h3>Create a guild</h3>
            <div class="guild-form-row">
                <input data-guild-name maxlength="24" placeholder="Guild name" aria-label="Guild name">
                <input data-guild-tag maxlength="5" placeholder="TAG" aria-label="Guild tag">
                <button type="button" data-guild-create>Create</button>
            </div>`;
        create.querySelector('[data-guild-create]')?.addEventListener('click', () => {
            const name = create.querySelector('[data-guild-name]')?.value.trim();
            const tag = create.querySelector('[data-guild-tag]')?.value.trim();
            if (name && tag) this.onCreate?.(name, tag);
        });
        this.container.appendChild(create);

        const invites = document.createElement('section');
        invites.className = 'guild-card';
        const heading = document.createElement('h3');
        heading.textContent = 'Invitations';
        invites.appendChild(heading);
        if (this.state.invites.length === 0) {
            invites.appendChild(this.empty('No pending guild invitations.'));
        }
        for (const invite of this.state.invites) {
            const row = document.createElement('div');
            row.className = 'guild-row';
            const name = document.createElement('span');
            name.textContent = `[${invite.guildTag}] ${invite.guildName}`;
            row.appendChild(name);
            row.appendChild(this.button('Accept', 'guild-btn--success', () => this.onRespond?.(invite.guildId, true)));
            row.appendChild(this.button('Decline', 'guild-btn--danger', () => this.onRespond?.(invite.guildId, false)));
            invites.appendChild(row);
        }
        this.container.appendChild(invites);
    }

    renderGuild(guild) {
        const header = document.createElement('section');
        header.className = 'guild-card guild-card--header';
        const identity = document.createElement('div');
        identity.className = 'guild-identity';
        identity.textContent = `[${guild.tag}] ${guild.name}`;
        const summary = document.createElement('span');
        summary.textContent = `${guild.members?.length || 0} / 100 members`;
        header.append(identity, summary);
        const motd = document.createElement('p');
        motd.className = 'guild-motd';
        motd.textContent = guild.motd || 'No guild message has been set.';
        header.appendChild(motd);
        header.appendChild(this.button('Leave Guild', 'guild-btn--danger', () => this.onLeave?.()));
		if (guild.permissions?.disband) {
			header.appendChild(this.button('Disband Guild', 'guild-btn--danger', () => this.onDisband?.()));
		}
		if (guild.permissions?.claim_leadership) {
			header.appendChild(this.button('Claim Inactive Leadership', '', () => this.onClaimLeadership?.()));
		}
        this.container.appendChild(header);

        if (guild.permissions?.invite) {
            const inviteRow = document.createElement('div');
            inviteRow.className = 'guild-form-row';
            inviteRow.innerHTML = '<input data-guild-invite maxlength="32" placeholder="Player username" aria-label="Guild invite username"><button type="button" data-guild-invite-btn>Invite</button>';
            inviteRow.querySelector('[data-guild-invite-btn]')?.addEventListener('click', () => {
                const username = inviteRow.querySelector('[data-guild-invite]')?.value.trim();
                if (username) this.onInvite?.(username);
            });
            header.appendChild(inviteRow);
        }
		if (guild.permissions?.manage_motd) {
			const motdRow = document.createElement('div');
			motdRow.className = 'guild-form-row';
			motdRow.innerHTML = '<input data-guild-motd maxlength="160" placeholder="Message of the day" aria-label="Guild message of the day"><button type="button" data-guild-motd-btn>Set Message</button>';
			motdRow.querySelector('[data-guild-motd]')?.setAttribute('value', guild.motd || '');
			motdRow.querySelector('[data-guild-motd-btn]')?.addEventListener('click', () => {
				this.onSetMOTD?.(motdRow.querySelector('[data-guild-motd]')?.value || '');
			});
			header.appendChild(motdRow);
		}

        const roster = document.createElement('section');
        roster.className = 'guild-card';
        roster.innerHTML = '<h3>Roster</h3>';
        const selfName = this.getLastPlayer?.()?.name;
        const sortedMembers = [...(guild.members || [])].sort((a, b) => {
            const order = { leader: 0, officer: 1, member: 2 };
            return (order[a.rank] ?? 3) - (order[b.rank] ?? 3) || a.username.localeCompare(b.username);
        });
        for (const member of sortedMembers) {
            const row = document.createElement('div');
            row.className = 'guild-row guild-roster-row';
            const dot = document.createElement('span');
            dot.className = `guild-presence guild-presence--${member.online ? 'online' : 'offline'}`;
            const details = document.createElement('span');
            details.className = 'guild-member-name';
            details.textContent = member.username;
            const combat = document.createElement('span');
            combat.className = 'guild-member-combat';
            combat.textContent = member.online ? `${member.class || 'Adventurer'} · ${member.level || 1}` : 'Offline';
            const rank = document.createElement('span');
            rank.className = 'guild-rank';
            rank.textContent = member.rank;
            row.append(dot, details, combat, rank);
            const isSelf = member.username === selfName;
            if (!isSelf && member.rank !== 'leader' && guild.permissions?.set_rank) {
                const nextRank = member.rank === 'officer' ? 'member' : 'officer';
                row.appendChild(this.button(nextRank === 'officer' ? 'Promote' : 'Demote', '', () => this.onSetRank?.(member.playerId, nextRank)));
                row.appendChild(this.button('Transfer', '', () => this.onTransfer?.(member.playerId)));
            }
            if (!isSelf && member.rank !== 'leader' && guild.permissions?.kick) {
                row.appendChild(this.button('Kick', 'guild-btn--danger', () => this.onKick?.(member.username)));
            }
            roster.appendChild(row);
        }
        this.container.appendChild(roster);
        this.renderBank(guild);
        this.renderLeaderboard();
        this.renderAudit(guild);
    }

    renderLeaderboard() {
        const section = document.createElement('section');
        section.className = 'guild-card';
        const heading = document.createElement('h3');
        heading.textContent = `Dungeon Records${this.leaderboard.season ? ` · ${this.leaderboard.season}` : ''}`;
        section.appendChild(heading);

        const filters = document.createElement('div');
        filters.className = 'guild-form-row';
        filters.innerHTML = `
            <select data-guild-leaderboard-dungeon aria-label="Leaderboard dungeon">
                <option value="umbral_nexus">Umbral Nexus</option>
                <option value="verdant_bastion_catacombs">Verdant Bastion</option>
                <option value="abyssal_well">Abyssal Well</option>
                <option value="molten_core">Molten Core</option>
                <option value="tempest_spire">Tempest Spire</option>
            </select>
            <select data-guild-leaderboard-difficulty aria-label="Leaderboard difficulty">
                <option value="mythic">Mythic</option><option value="heroic">Heroic</option><option value="normal">Normal</option>
            </select>
            <select data-guild-leaderboard-level aria-label="Leaderboard run level">
                <option value="100">Level 100</option><option value="90">Level 90</option><option value="80">Level 80</option>
                <option value="70">Level 70</option><option value="60">Level 60</option><option value="50">Level 50</option>
                <option value="40">Level 40</option><option value="30">Level 30</option>
            </select>`;
        filters.appendChild(this.button('Refresh', '', () => this.onLeaderboard?.({
            dungeonType: filters.querySelector('[data-guild-leaderboard-dungeon]').value,
            difficulty: filters.querySelector('[data-guild-leaderboard-difficulty]').value,
            runLevel: Number(filters.querySelector('[data-guild-leaderboard-level]').value),
        })));
        section.appendChild(filters);

        if (this.leaderboard.runs.length === 0) {
            section.appendChild(this.empty('No qualifying two-member guild clears recorded this season.'));
        } else {
            this.leaderboard.runs.forEach((run, index) => {
                const row = document.createElement('div');
                row.className = 'guild-row guild-leaderboard-row';
                const duration = Math.max(0, Number(run.durationMs) || 0);
                const minutes = Math.floor(duration / 60000);
                const seconds = Math.floor((duration % 60000) / 1000).toString().padStart(2, '0');
                row.textContent = `${index + 1}. [${run.guildTag}] ${run.guildName} · ${minutes}:${seconds} · ${run.memberCount} members`;
                section.appendChild(row);
            });
        }
        this.container.appendChild(section);
    }

    renderBank(guild) {
        const bank = document.createElement('section');
        bank.className = 'guild-card';
        const heading = document.createElement('h3');
        heading.textContent = `Guild Bank · ${guild.bank?.gold || 0} gold`;
        bank.appendChild(heading);
        const goldRow = document.createElement('div');
        goldRow.className = 'guild-form-row';
        goldRow.innerHTML = '<input data-guild-gold type="number" min="1" step="1" placeholder="Gold amount" aria-label="Guild bank gold amount">';
        const amount = () => Number.parseInt(goldRow.querySelector('[data-guild-gold]')?.value, 10) || 0;
        goldRow.appendChild(this.button('Deposit', 'guild-btn--success', () => this.onBankDeposit?.({ gold: amount() })));
        if (guild.permissions?.withdraw_bank) {
            goldRow.appendChild(this.button('Withdraw', '', () => this.onBankWithdraw?.({ gold: amount() })));
        }
        bank.appendChild(goldRow);

        const playerItems = (this.getLastPlayer?.()?.inventory || []).filter(item => item?.id);
        if (playerItems.length > 0) {
            const depositRow = document.createElement('div');
            depositRow.className = 'guild-form-row';
            const select = document.createElement('select');
            select.setAttribute('aria-label', 'Inventory item to deposit');
            for (const item of playerItems) {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = `${item.name}${item.stack > 1 ? ` ×${item.stack}` : ''}`;
                select.appendChild(option);
            }
            depositRow.append(select, this.button('Deposit Item', 'guild-btn--success', () => this.onBankDeposit?.({ itemId: select.value })));
            bank.appendChild(depositRow);
        }

        const items = document.createElement('div');
        items.className = 'guild-bank-items';
        for (const item of guild.bank?.items || []) {
            const row = document.createElement('div');
            row.className = 'guild-row';
            const label = document.createElement('span');
            label.textContent = `${item.name}${item.stack > 1 ? ` ×${item.stack}` : ''}`;
            row.appendChild(label);
            if (guild.permissions?.withdraw_bank) {
                row.appendChild(this.button('Withdraw', '', () => this.onBankWithdraw?.({ itemId: item.id })));
            }
            items.appendChild(row);
        }
        if (!items.children.length) items.appendChild(this.empty('No items deposited.'));
        bank.appendChild(items);
        this.container.appendChild(bank);
    }

    renderAudit(guild) {
        if (!Array.isArray(guild.audit)) return;
        const audit = document.createElement('section');
        audit.className = 'guild-card';
        audit.innerHTML = '<h3>Officer Audit</h3>';
        for (const entry of guild.audit.slice(-10).reverse()) {
            const row = document.createElement('div');
            row.className = 'guild-audit-row';
            row.textContent = `${entry.action.replaceAll('_', ' ')}${entry.itemName ? ` · ${entry.itemName}` : ''}${entry.amount ? ` · ${Math.abs(entry.amount)} gold` : ''}`;
            audit.appendChild(row);
        }
        this.container.appendChild(audit);
    }

    button(label, modifier, handler) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `guild-btn ${modifier}`.trim();
        button.textContent = label;
        button.addEventListener('click', handler);
        return button;
    }

    empty(message) {
        const element = document.createElement('div');
        element.className = 'guild-empty';
        element.textContent = message;
        return element;
    }
}
