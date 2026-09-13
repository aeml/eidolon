export class GuildEventsUI {
    constructor({ action, invite, ready, getPlayer }) {
        this.action = action;
        this.invite = invite;
        this.ready = ready;
        this.getPlayer = getPlayer;
        this.element = document.createElement('section');
        this.element.className = 'guild-card guild-events';
        this.element.innerHTML = '<h3>Guild calendar</h3><p>Times are shown in your local time zone. Sign-ups are plans, not party membership or entry permission. Invite companions, then run a party ready check. Tentative sign-ups do not reserve a seat. Editing an event makes all sign-ups tentative again.</p>';
        this.editor = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'Schedule an event';
        this.form = document.createElement('form');
        this.form.className = 'guild-events__form';
        this.title = this.input('Event title', 'text');
        this.title.maxLength = 80; this.title.minLength = 3;
        this.activity = this.select('Event activity', [], this.form);
        this.starts = this.input('Start time (local)', 'datetime-local');
        this.duration = this.input('Duration (minutes)', 'number', '120');
        this.duration.min = '30'; this.duration.max = '360';
        this.capacity = this.input('Sign-up capacity', 'number', '4');
        this.capacity.min = '2'; this.capacity.max = '100';
        this.save = this.button('Schedule', () => {});
        this.save.type = 'submit';
        this.feedback = document.createElement('p');
        this.feedback.setAttribute('role', 'status');
        this.form.append(this.save, this.button('New event / clear edit', () => this.resetEditor()));
        this.form.onsubmit = event => {
            event.preventDefault();
            const starts = new Date(this.starts.value);
            if (!this.form.reportValidity() || !Number.isFinite(starts.getTime())) return;
            if (this.pending) return;
            this.pending = { ids: [...(this.knownIDs || [])], title: this.title.value.trim(), startsAt: starts.toISOString(), editing: this.editing };
            this.save.disabled = true;
            this.feedback.textContent = 'Saving event…';
            this.action({ action: this.editing ? 'edit' : 'create', eventId: this.editing?.id,
                revision: this.editing?.revision, title: this.title.value.trim(), activity: this.activity.value,
                startsAt: starts.toISOString(), durationMinutes: Number(this.duration.value), capacity: Number(this.capacity.value) });
        };
        this.editor.append(summary, this.form);
        this.list = document.createElement('div');
        this.list.className = 'guild-events__list';
        this.element.append(this.editor, this.feedback, this.button('Check current party readiness', () => this.ready()), this.list);
    }

    label(text, control, parent) {
        const label = document.createElement('label');
        label.append(document.createTextNode(text), control);
        parent.append(label);
    }

    input(label, type, value = '') {
        const control = document.createElement('input');
        control.type = type; control.value = value; control.required = true;
        this.label(label, control, this.form);
        return control;
    }

    select(label, options, parent) {
        const control = document.createElement('select');
        for (const [value, text] of options) control.add(new Option(text, value));
        this.label(label, control, parent);
        return control;
    }

    button(text, action) {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = text; button.onclick = action;
        return button;
    }

    resetEditor() {
        this.editing = null; this.form.reset(); this.save.textContent = 'Schedule';
        this.pending = null; this.save.disabled = false;
        this.duration.value = '120'; this.capacity.value = '4';
    }

    edit(event) {
        this.editing = { id: event.id, revision: event.revision };
        this.title.value = event.title; this.activity.value = event.activity;
        const local = new Date(event.startsAt);
        local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
        this.starts.value = local.toISOString().slice(0, 16);
        this.duration.value = String(event.durationMinutes); this.capacity.value = String(event.capacity);
        this.save.textContent = 'Save changes (sign-ups become tentative)';
        this.editor.open = true; this.title.focus();
    }

    update(guild) {
        if (this.guildID !== guild.id) { this.resetEditor(); this.guildID = guild.id; }
        if (this.pending) {
            const pending = this.pending;
            const saved = (guild.events || []).some(event => event.title === pending.title && new Date(event.startsAt).toISOString() === pending.startsAt &&
                (pending.editing ? event.id === pending.editing.id && event.revision > pending.editing.revision : !pending.ids.includes(event.id)));
            this.pending = null; this.save.disabled = false;
            this.feedback.textContent = saved ? 'Event saved.' : 'Review any server message before retrying.';
            if (saved) this.resetEditor();
        }
        this.knownIDs = (guild.events || []).map(event => event.id);
        this.editor.hidden = !guild.permissions?.manage_events;
        const selection = this.activity.value;
        this.activity.replaceChildren();
        for (const activity of guild.activities || []) this.activity.add(new Option(activity.name, activity.id));
        if ([...this.activity.options].some(option => option.value === selection)) this.activity.value = selection;
        this.list.replaceChildren();
        const self = (guild.members || []).find(member => member.username === this.getPlayer?.()?.name);
        if (!guild.events?.length) {
            const empty = document.createElement('p'); empty.textContent = 'No scheduled events yet.'; this.list.append(empty);
        }
        for (const event of guild.events || []) {
            const card = document.createElement('article'); card.className = 'guild-events__event';
            const heading = document.createElement('h4'); heading.textContent = event.title;
            const info = document.createElement('p');
            const finished = Date.now() >= new Date(event.startsAt).getTime() + event.durationMinutes * 60000;
            const going = (event.rsvps || []).filter(rsvp => rsvp.status === 'going').length;
            const activity = (guild.activities || []).find(activity => activity.id === event.activity);
            info.textContent = `${activity?.name || event.activity} · ${new Date(event.startsAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · ${event.durationMinutes} min · ${going}/${event.capacity} confirmed${event.cancelled ? ' · CANCELLED' : finished ? ' · Finished' : ''}`;
            card.append(heading, info);
            const active = !event.cancelled && !finished;
            const controls = document.createElement('div'); controls.className = 'guild-events__controls';
            if (active) {
                const mine = (event.rsvps || []).find(rsvp => rsvp.playerId === self?.playerId);
                const role = this.select('My role', ['tank', 'healer', 'damage', 'flexible'].map(role => [role, role]), controls);
                role.value = mine?.role || 'flexible';
                for (const [status, title] of [['going', 'Going'], ['tentative', 'Tentative']]) {
                    const button = this.button(title, () => this.action({ action: 'rsvp', eventId: event.id, revision: event.revision, role: role.value, status }));
                    button.setAttribute('aria-pressed', String(mine?.status === status));
                    controls.append(button);
                }
                if (mine) controls.append(this.button('Withdraw', () => this.action({ action: 'withdraw', eventId: event.id })));
                if (guild.permissions?.manage_events) {
                    controls.append(this.button('Edit event', () => this.edit(event)));
                    const cancel = this.button('Cancel event', () => {
                        cancel.replaceWith(this.button('Confirm cancellation', () => this.action({ action: 'cancel', eventId: event.id, revision: event.revision })));
                    });
                    controls.append(cancel);
                }
            }
            card.append(controls);
            const roster = document.createElement('details');
            const summary = document.createElement('summary'); summary.textContent = `Sign-ups (${event.rsvps?.length || 0})`;
            roster.append(summary);
            for (const rsvp of event.rsvps || []) {
                const member = (guild.members || []).find(member => member.playerId === rsvp.playerId);
                if (!member) continue;
                const row = document.createElement('div'); row.className = 'guild-events__controls';
                const text = document.createElement('span'); text.textContent = `${member.username} · ${rsvp.role} · ${rsvp.status} · ${member.online ? `${member.class || 'Adventurer'} ${member.level || ''} · Online` : 'Offline'}`;
                row.append(text);
                if (active && member.online && member.playerId !== self?.playerId) row.append(this.button('Invite to party', () => this.invite(member.username)));
                roster.append(row);
            }
            card.append(roster); this.list.append(card);
        }
    }
}
