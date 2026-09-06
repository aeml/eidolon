import { CONSTANTS } from '../core/Constants.js';

const modes = ['skills', 'talents', 'runes', 'combos'];
const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
};

// Phone composition is deliberately separate from the desktop tree. Neither
// reading a card nor showing a pending action mutates the shared player build.
export class MobileSkillTree {
    constructor(owner) {
        this.owner = owner;
        this.reading = new Map();
        this.pending = null;
        this.feedback = '';
        owner.skillTreeWindow.querySelector('.phone-build-tabs')?.remove();
        owner.skillTreeWindow.querySelector('.phone-build-feedback')?.remove();
        this.tabs = el('nav', '', 'phone-build-tabs');
        this.tabs.setAttribute('aria-label', 'Build sections');
        for (const mode of modes) {
            const button = el('button', mode[0].toUpperCase() + mode.slice(1));
            button.type = 'button'; button.dataset.mode = mode;
            button.onclick = () => { this.saveReading(); owner.skillTreeMode = mode; this.render(this.classType); };
            this.tabs.append(button);
        }
        this.notice = el('div', '', 'phone-build-feedback');
        this.notice.setAttribute('role', 'status');
        this.notice.setAttribute('aria-live', 'polite');
        owner.skillTreeWindow.insertBefore(this.tabs, owner.skillTreeContent);
        owner.skillTreeWindow.append(this.notice);
    }

    saveReading() {
        if (!this.route) return;
        this.reading.set(this.route, { scroll: this.owner.skillTreeContent.scrollTop,
            focus: this.owner.skillTreeContent.contains(document.activeElement) ? document.activeElement.dataset.buildAction : null });
    }

    request(key, label, confirmed, callback) {
        if (this.pending || this.disconnected || !callback) return;
        const requestId = crypto.randomUUID();
        this.pending = { key, label, confirmed, requestId, acknowledged: false };
        this.feedback = '';
        this.render(this.classType);
        callback(requestId);
    }

    receive(payload) {
        if (!this.pending || payload?.requestId !== this.pending.requestId) return;
        if (payload.ok === true) this.pending.acknowledged = true;
        else { this.pending = null; this.feedback = payload.message || 'The change was rejected. Review your build and try again.'; }
        this.render(this.classType);
    }

    connection(state) {
        this.disconnected = true;
        this.waitForSnapshot = state === 'connected';
        if (this.classType) this.render(this.classType);
    }

    synchronizeAfterReconnect() {
        if (!this.waitForSnapshot) return;
        this.waitForSnapshot = false; this.disconnected = false;
        if (this.pending) {
            this.feedback = this.pending.confirmed(this.owner.ctx.getLastPlayer())
                ? `Confirmed: ${this.pending.label}, restored after reconnect.`
                : 'Connection restored. The previous change was not confirmed; review your build before trying again.';
            this.pending = null;
        }
        if (this.classType) this.render(this.classType);
    }

    button(parent, key, label, callback, disabled = false) {
        const button = el('button', this.pending?.key === key ? 'Waiting for confirmation…' : label);
        button.type = 'button'; button.dataset.buildAction = key;
        button.disabled = disabled || Boolean(this.pending) || Boolean(this.disconnected);
        button.onclick = callback;
        parent.append(button);
        return button;
    }

    card(parent, title, description) {
        const card = el('article', '', 'phone-build-card');
        card.append(el('h3', title), el('p', description)); parent.append(card); return card;
    }

    render(classType) {
        const owner = this.owner, player = owner.ctx.getLastPlayer();
        if (!player) return;
        if (this.playerId && this.playerId !== player.id) {
            this.pending = null; this.feedback = ''; this.confirmReset = false;
        }
        this.playerId = player.id;
        const nextRoute = `${player.id || ''}:${classType}:${owner.skillTreeMode}`;
        if (nextRoute === this.route) this.saveReading();
        this.classType = classType; this.route = nextRoute;
        if (this.pending?.acknowledged && this.pending.confirmed(player)) {
            this.feedback = `Confirmed: ${this.pending.label}.`; this.pending = null;
        }
        const content = owner.skillTreeContent;
        content.replaceChildren(); content.classList.add('phone-build-content');
        for (const button of this.tabs.children) button.setAttribute('aria-pressed', String(button.dataset.mode === owner.skillTreeMode));
        this.notice.textContent = this.disconnected ? 'Connection interrupted. Waiting for your current build from the server.'
            : this.pending ? 'Waiting for the server. Your build has not been changed locally.' : this.feedback;
        this.notice.hidden = !this.notice.textContent;
        this.notice.setAttribute('role', this.feedback && !this.feedback.startsWith('Confirmed:') ? 'alert' : 'status');
        if (owner.skillTreeMode === 'skills') this.skills(content, player);
        if (owner.skillTreeMode === 'talents') this.talents(content, player);
        if (owner.skillTreeMode === 'runes') this.runes(content, player);
        if (owner.skillTreeMode === 'combos') this.combos(content);
        const saved = this.reading.get(nextRoute);
        content.scrollTop = saved?.scroll || 0;
        if (saved?.focus) [...content.querySelectorAll('[data-build-action]')]
            .find(button => button.dataset.buildAction === saved.focus)?.focus({ preventScroll: true });
    }

    skills(content, player) {
        const tree = CONSTANTS.SKILL_TREES[this.classType];
        if (!tree) return;
        content.append(el('h2', `${this.classType} specializations`),
            el('p', 'Choose a specialization. Its skills unlock automatically at levels 10, 20, 30 and 40 and fill your combat bar. Switching specializations is free.'));
        this.card(content, tree.Tier1.name, tree.Tier1.desc).append(el('p', 'Starting ability · Always available', 'phone-build-meta'));
        const identity = this.owner.getClassIdentityCopy(this.classType);
        for (const key of ['A', 'B', 'C']) {
            const branch = tree[`Branch${key}`];
            const selected = player.selectedBranch === key;
            const section = el('section', '', 'phone-build-branch'); section.dataset.branch = key;
            section.append(el('h3', branch.name + (selected ? ' · Active' : '')), el('p', identity.branchRoles?.[key]?.role));
            this.button(section, `branch:${key}`, selected ? 'Active specialization' : `Choose ${branch.name}`, () =>
                this.request(`branch:${key}`, branch.name, p => p.selectedBranch === key,
                    this.owner.onSelectBranch && (id => this.owner.onSelectBranch(key, id))), selected);
            for (let tier = 2; tier <= 5; tier++) {
                const skill = branch[`Tier${tier}`];
                if (!skill) continue;
                const level = (tier - 1) * 10;
                const state = player.level < level ? `Requires level ${level}` : selected ? 'Available in your active specialization' : 'Available when you choose this specialization';
                this.card(section, skill.name, skill.desc).append(el('p', state, 'phone-build-meta'));
            }
            content.append(section);
        }
    }

    talents(content, player) {
        const ranks = player.talentRanks || {};
        const total = Math.floor((player.level || 0) / 5);
        const spent = Object.values(ranks).reduce((sum, rank) => sum + Math.max(0, Number(rank) || 0), 0);
        const points = Math.max(0, total - spent);
        content.append(el('h2', 'Talent training'), el('p', `${points} points available · ${spent} spent · One point earned every five levels.`));
        const reset = el('section', '', 'phone-build-reset');
        if (this.confirmReset) {
            reset.append(el('p', 'Reset all talent ranks and refund their points? Your specialization and runes stay unchanged.'));
            this.button(reset, 'reset:confirm', 'Confirm reset', () => {
                this.confirmReset = false;
                this.request('reset:confirm', 'Talent reset', p => !Object.values(p.talentRanks || {}).some(n => n > 0),
                    this.owner.onResetTalents && (id => this.owner.onResetTalents(id)));
            });
            this.button(reset, 'reset:cancel', 'Cancel reset', () => { this.confirmReset = false; this.render(this.classType); });
        } else this.button(reset, 'reset:open', 'Reset talents', () => { this.confirmReset = true; this.render(this.classType); }, spent === 0);
        content.append(reset);
        const tree = CONSTANTS.SKILL_TREES[this.classType];
        const branch = tree?.[`Branch${player.selectedBranch}`];
        const skills = new Set([tree?.Tier1?.name, ...[2, 3, 4, 5].map(t => branch?.[`Tier${t}`]?.name)]);
        const talents = (CONSTANTS.PASSIVE_TALENTS[this.classType] || []).filter(t => !branch ||
            ((t.name.endsWith(' - Mastery') || t.name.endsWith(' - Technique')) && skills.has(t.name.slice(0, t.name.lastIndexOf(' - ')))));
        for (const talent of talents) {
            const rank = ranks[talent.id] || 0, max = talent.maxRank || 1;
            const card = this.card(content, talent.name, talent.desc);
            card.append(el('p', `Rank ${rank} / ${max}`, 'phone-build-meta'));
            this.button(card, `talent:${talent.id}`, rank >= max ? 'Maximum rank' : points ? 'Add rank · 1 point' : 'No points available', () =>
                this.request(`talent:${talent.id}`, `${talent.name}, rank ${rank + 1}`, p => (p.talentRanks?.[talent.id] || 0) >= rank + 1,
                    this.owner.onUnlockTalent && (id => this.owner.onUnlockTalent(talent.id, id))), rank >= max || !points);
        }
    }

    runes(content, player) {
        content.append(el('h2', 'Skill runes'), el('p', 'Choose an ability with available runes. Equip one rune at a time for each unlocked ability. Rune tiers require levels 50, 70 and 90.'));
        const unlocked = new Set(player.unlockedSkills || []);
        unlocked.add(CONSTANTS.SKILL_TREES[this.classType]?.Tier1?.name);
        const runes = CONSTANTS.SKILL_RUNES[this.classType] || [];
        const skills = [...new Set(runes.map(rune => rune.skill))];
        if (!skills.includes(this.runeSkill)) this.runeSkill = skills.find(skill => unlocked.has(skill)) || skills[0];
        const label = el('label', 'Choose an ability'); label.htmlFor = 'phone-rune-skill';
        const select = el('select'); select.id = label.htmlFor; select.dataset.buildAction = 'rune:skill-filter';
        for (const skill of skills) {
            const option = el('option', skill + (unlocked.has(skill) ? '' : ' · Locked'));
            option.value = skill; select.append(option);
        }
        select.value = this.runeSkill;
        select.onchange = () => {
            this.runeSkill = select.value; this.render(this.classType);
            content.scrollTop = 0;
        };
        content.append(label, select);
        for (const rune of runes.filter(rune => rune.skill === this.runeSkill)) {
            const selected = player.skillRunes?.[rune.skill] === rune.id;
            const usable = unlocked.has(rune.skill) && player.level >= rune.unlockLevel;
            const card = this.card(content, `${rune.skill} · ${rune.name}`, rune.description);
            card.append(el('p', `Level ${rune.unlockLevel}${selected ? ' · Equipped' : ''}`, 'phone-build-meta'));
            const label = selected ? 'Remove rune' : !unlocked.has(rune.skill) ? 'Choose this skill’s specialization first' : !usable ? `Requires level ${rune.unlockLevel}` : 'Equip rune';
            const desired = selected ? '' : rune.id;
            this.button(card, `rune:${rune.id}`, label, () => this.request(`rune:${rune.id}`, `${rune.name} ${selected ? 'removed' : 'equipped'}`,
                p => (p.skillRunes?.[rune.skill] || '') === desired,
                this.owner.onSelectRune && (id => this.owner.onSelectRune(rune.skill, desired, id))), !selected && !usable);
        }
    }

    combos(content) {
        content.append(el('h2', 'Combat combinations'), el('p', 'Use these skills in order within three seconds to trigger their combined effect.'));
        for (const combo of CONSTANTS.SKILL_COMBOS[this.classType] || []) {
            this.card(content, combo.name, combo.description).append(el('p', `${combo.firstSkill} → ${combo.secondSkill}`, 'phone-build-meta'));
        }
    }
}
