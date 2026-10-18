const node = (tag, className = '') => {
    const element = document.createElement(tag); element.className = className; return element;
};
const text = (element, value) => { if (element.textContent !== value) element.textContent = value; };

// Health snapshots must not detach a control while the player is pressing it.
// Keep each row and its action ancestors mounted until its membership changes.
export function renderPartyRoster(owner, members, myId, leaderId) {
    const epoch = owner.partyRosterEpoch;
    const current = () => owner.isPartyRosterCurrent(epoch);
    let clear = owner.supportModeButton;
    if (!clear) {
        clear = node('button', 'party-support-mode'); clear.type = 'button';
        clear.dataset.partySupportTarget = '';
        clear.title = 'Select a party member below to direct Healing Light or Divine Intervention. Clear to use cursor aiming again.';
        clear.onclick = () => {
            if (!current() || !clear.isConnected || owner.supportModeButton !== clear) return;
            owner.selectedSupportTargetId = null; owner.updateParty(owner.partyData);
        };
        owner.supportModeButton = clear; owner.partyList.prepend(clear);
    }
    const selected = members.find(member => member.id === owner.selectedSupportTargetId);
    text(clear, selected ? `Clear healing target · ${selected.name}` : 'Healing: cursor aim');
    const present = new Set(members.map(member => member.id));
    for (const [id, row] of owner.partyRows) if (!present.has(id)) {
        row.root.remove(); owner.partyRows.delete(id); owner.supportTargetButtons.delete(id);
    }
    let cursor = clear.nextSibling;
    for (const member of members) {
        const id = member.id;
        let row = owner.partyRows.get(id);
        if (!row) {
            row = { root: node('div', 'party-member'), info: node('button', 'party-member-info party-support-target'),
                name: node('span'), star: node('span', 'party-leader-icon'), meta: node('span'),
                fill: node('div', 'party-hp-fill'), role: node('span', 'party-member-role') };
            const name = node('div', 'party-name'), hp = node('div', 'party-hp-bar'), meta = node('div', 'party-member-meta');
            row.star.textContent = '★ '; row.meta.style.color = '#aaa'; row.meta.style.fontSize = '10px';
            name.append(row.star, row.name, row.meta); hp.append(row.fill); meta.append(row.role);
            row.info.type = 'button'; row.info.dataset.partySupportTarget = id;
            row.info.title = 'Select for Healing Light and Divine Intervention; does not cast or change your attack target.';
            row.info.append(name, hp, meta); row.root.append(row.info);
            row.info.onclick = () => {
                const latest = owner.partyData?.members?.find(value => value.id === id);
                if (!current() || owner.partyRows.get(id) !== row || !row.info.isConnected || !(latest?.hp > 0)) return;
                owner.selectedSupportTargetId = id; owner.updateParty(owner.partyData);
            };
            owner.partyRows.set(id, row); owner.supportTargetButtons.set(id, row.info);
        }
        row.root.classList.toggle('party-member--ready', Boolean(member.ready));
        row.star.hidden = !member.isLeader;
        text(row.name, member.name);
        text(row.meta, ` (Lvl ${member.level} ${member.class})`);
        row.info.disabled = !(member.hp > 0);
        row.info.setAttribute('aria-label', `Select ${member.name} for healing`);
        row.info.setAttribute('aria-pressed', String(id === owner.selectedSupportTargetId));
        const percent = member.maxHp > 0 ? member.hp / member.maxHp * 100 : 0;
        row.fill.style.width = `${Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0))}%`;
        text(row.role, `${member.role || 'damage'}${member.isLeader ? ' • Leader' : id === myId ? ' • You' : ''}${member.ready ? ' • Ready' : ''}`);
        if (myId === leaderId && id !== myId) {
            if (!row.actions) {
                const actions = node('div', 'party-actions');
                for (const [label, letter, callback] of [['Kick', 'K', 'onPartyKick'], ['Promote', 'P', 'onPartyPromote']]) {
                    const button = node('button', 'party-btn'); button.type = 'button'; button.title = label; button.textContent = letter;
                    button.onclick = () => {
                        if (!current() || row.actions !== actions || !button.isConnected || owner.partyRows.get(id) !== row
                            || owner.partyData?.leaderId !== myId || !owner.partyData.members?.some(value => value.id === id)) return;
                        owner[callback]?.(id);
                    };
                    actions.append(button);
                }
                row.actions = actions; row.root.append(actions);
            }
            row.actions.children[0].setAttribute('aria-label', `Kick ${member.name} from party`);
            row.actions.children[1].setAttribute('aria-label', `Promote ${member.name} to party leader`);
        } else if (row.actions) { row.actions.remove(); row.actions = null; }
        if (row.root !== cursor) owner.partyList.insertBefore(row.root, cursor);
        cursor = row.root.nextSibling;
    }
}
