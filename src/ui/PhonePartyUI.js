const node = (tag, text = '', className = '') => {
    const el = document.createElement(tag); el.textContent = text; el.className = className; return el;
};
const text = (el, value) => { if (el.textContent !== value) el.textContent = value; };

// The roster is a deliberate reading/target-selection surface, not a permanent
// card over the hero. Keyed rows keep touch targets stable through HP updates.
export class PhonePartyUI {
    constructor(social) {
        document.getElementById('phone-party-panel')?._partyOwner?.dispose();
        this.social = social; this.rows = new Map(); this.selectedId = null;
        const host = document.getElementById('ui-layer') || document.body;
        this.launcher = node('button', 'Party', 'phone-party-launcher');
        this.launcher.id = 'btn-phone-party'; this.launcher.type = 'button';
        this.launcher.setAttribute('aria-controls', 'phone-party-panel');
        this.launcher.setAttribute('aria-expanded', 'false');
        this.launcher.onclick = () => this.root.hidden ? this.open() : this.close();
        this.root = node('section', '', 'phone-party-panel window');
        this.root.id = 'phone-party-panel'; this.root.hidden = true; this.root._partyOwner = this;
        this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-label', 'Party and ally targets');
        const header = node('header', '', 'phone-party-header');
        this.closeButton = this.button('Close', () => this.close()); this.closeButton.id = 'btn-close-phone-party';
        header.append(node('h2', 'Party'), this.closeButton);
        this.body = node('div', '', 'phone-party-body');
        this.body.tabIndex = 0; this.body.setAttribute('aria-label', 'Party members and actions');
        this.selection = node('p', 'Healing target: yourself.');
        this.hint = node('p', 'Select an ally, then cast Healing Light or Divine Intervention. Attacks keep your enemy target.');
        this.memberList = node('div', '', 'phone-party-members');
        this.empty = node('p', 'Invite another adventurer to form a party.');
        this.ready = this.button('Ready', () => social.onPartyReady?.(!this.myReady));
        this.check = this.button('Ready check', () => social.onPartyReadyCheck?.());
        this.readyStatus = node('p');
        this.loot = node('select'); this.loot.setAttribute('aria-label', 'Party loot rule');
        for (const [value,label] of [['ffa','Free for all'],['master','Master loot']]) {
            const option = node('option',label); option.value = value; this.loot.append(option);
        }
        this.loot.onchange = () => social.onPartyLootRule?.(this.loot.value);
        this.invite = node('input'); this.invite.type = 'text'; this.invite.placeholder = 'Player name';
        this.invite.setAttribute('aria-label', 'Player to invite'); this.invite.autocomplete = 'off';
        const inviteButton = this.button('Invite', () => { const name = this.invite.value.trim(); if (name) social.onPartyInvite?.(name); });
        this.leave = this.button('Leave party', () => social.onPartyLeave?.());
        this.body.append(this.selection,this.hint,this.empty,this.memberList,this.check,this.ready,this.readyStatus,
            node('label','Loot rule'),this.loot,this.invite,inviteButton,this.leave);
        this.root.append(header,this.body);host.append(this.launcher,this.root);
        this.onKey = event => { if (event.key === 'Escape') { event.preventDefault();event.stopImmediatePropagation();this.close(); } };
        this.onOutside = event => {
            if (!this.root.contains(event.target) && event.target?.closest('#mobile-top-right,#chat-box,#btn-phone-status,.window')) this.close(false);
        };
        this.update(null);
    }
    button(label, action) {
        const button = node('button',label);button.type = 'button';button.onclick = action;return button;
    }
    open() {
        this.social.ctx.closePrimaryHudMenus?.();
        this.root.hidden = false;this.launcher.setAttribute('aria-expanded','true');
        window.addEventListener('keydown',this.onKey,true);document.addEventListener('pointerdown',this.onOutside,true);
        this.closeButton.focus({preventScroll:true});
    }
    close(restoreFocus = true) {
        this.root.hidden = true;this.launcher.setAttribute('aria-expanded','false');
        window.removeEventListener('keydown',this.onKey,true);document.removeEventListener('pointerdown',this.onOutside,true);
        if (restoreFocus) this.launcher.focus({preventScroll:true});
    }
    update(data) {
        const members = data?.partyId ? data.members || [] : [];
        const player = this.social.ctx.getLastPlayer?.(), myId = player?.id;
        if (this.partyId !== data?.partyId || this.playerId !== myId) {
            this.selectedId = null;this.close(false);this.body.scrollTop = 0;
        }
        this.partyId = data?.partyId;this.playerId = myId;
        if (this.selectedId && !members.some(member => member.id === this.selectedId)) this.selectedId = null;
        text(this.launcher,members.length ? `Party ${members.length}` : 'Party');
        this.launcher.setAttribute('aria-label',`Party: ${members.length} members`);
        const selected = members.find(member => member.id === this.selectedId);
        text(this.selection,`Healing target: ${selected?.name || 'yourself'}.`);
        const leader = Boolean(data?.partyId && data.leaderId === myId);
        this.myReady = Boolean(members.find(member => member.id === myId)?.ready);
        this.empty.hidden = members.length > 0;this.leave.hidden = !data?.partyId;
        this.check.hidden = !leader;this.ready.hidden = !data?.readyCheckActive;
        text(this.ready,this.myReady ? 'Not ready' : 'Ready');
        text(this.readyStatus,data?.readyCheckActive ? 'Ready check active' : data?.allReady ? 'All ready' : '');
        this.loot.value = data?.lootRule || 'ffa';this.loot.disabled = !leader;
        const present = new Set();
        for (const member of members) {
            present.add(member.id);
            let row = this.rows.get(member.id);
            if (!row) {
                row = {root:node('article','','phone-party-member'),name:node('h3'),health:node('p'),role:node('p')};
                row.select = this.button('Select ally',() => { this.selectedId = member.id;this.update(this.social.partyData);this.close(); });
                row.select.dataset.partyTarget = member.id;
                row.promote = this.button('Make leader',() => this.social.onPartyPromote?.(member.id));
                row.kick = this.button('Remove from party',() => this.social.onPartyKick?.(member.id));
                row.root.append(row.name,row.health,row.role,row.select,row.promote,row.kick);
                this.rows.set(member.id,row);this.memberList.append(row.root);
            }
            text(row.name,member.name || 'Adventurer');
            text(row.health,`${Math.max(0,Number(member.hp)||0)} / ${Math.max(0,Number(member.maxHp)||0)} HP`);
            text(row.role,`${member.class || member.subType || 'Adventurer'} · Level ${member.level || 1}${member.ready ? ' · Ready' : ''}`);
            row.select.disabled = Number(member.hp) <= 0;
            row.select.setAttribute('aria-label',`Select ${member.name} for healing`);
            row.select.setAttribute('aria-pressed',String(this.selectedId === member.id));
            row.promote.hidden = row.kick.hidden = !leader || member.id === myId;
        }
        for (const [id,row] of this.rows) if (!present.has(id)) { row.root.remove();this.rows.delete(id); }
    }
    dispose() { this.close(false);this.launcher.remove();this.root.remove();this.rows.clear(); }
}
