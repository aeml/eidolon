import { socialSafetyActions } from './SocialSafetyUI.js';

export class GroupFinderUI {
    constructor(container, { action, invite, safety }) {
        this.container = container;
        this.action = action;
        this.invite = invite;
        this.safety = safety;
        this.data = { activities: [], listings: [] };
        container.classList.add('group-finder');
        const guidance = document.createElement('p');
        guidance.textContent = 'Find companions, then use the normal invitation and ready check. Listings last 20 minutes while online and available; requests last 5 minutes. Listings do not bypass dungeon levels, story gates, raid conversion or entry rules.';
        this.toolbar = document.createElement('div');
        this.toolbar.className = 'group-finder__controls';
        this.filter = this.select('Activity filter', [['', 'All activities']], this.toolbar);
        this.filter.onchange = () => this.renderListings();
        this.joinRole = this.select('Join as', ['flexible', 'tank', 'healer', 'damage'].map(value => [value, value]), this.toolbar);
        this.toolbar.append(this.button('Refresh', () => action({ action: 'list' })));
        const editor = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'Post or update my listing';
        const form = document.createElement('form');
        form.className = 'group-finder__controls';
        this.mode = this.select('Listing type', [['looking', 'Looking for a group'], ['recruit', 'Recruiting companions']], form);
        this.activity = this.select('Activity', [], form);
        this.role = this.select('Role offered / needed', ['flexible', 'tank', 'healer', 'damage'].map(value => [value, value]), form);
        this.minimum = document.createElement('input');
        this.minimum.type = 'number'; this.minimum.min = '1'; this.minimum.max = '100'; this.minimum.value = '1';
        this.label('Minimum level', this.minimum, form);
        this.note = document.createElement('input');
        this.note.maxLength = 160; this.note.placeholder = 'What are you planning?';
        this.label('Short note', this.note, form);
        this.activity.onchange = () => { this.minimum.value = String(this.data.activities.find(a => a.id === this.activity.value)?.minLevel || 1); };
        const post = this.button('Publish for 20 minutes', () => {});
        post.type = 'submit';
        form.append(post);
        form.onsubmit = event => {
            event.preventDefault();
            action({ action: 'post', mode: this.mode.value, activity: this.activity.value, role: this.role.value,
                minLevel: Number(this.minimum.value), note: this.note.value.trim() });
        };
        editor.append(summary, form);
        this.list = document.createElement('div');
        this.list.className = 'group-finder__list';
        container.append(guidance, this.toolbar, editor, this.list);
    }

    label(text, control, parent) {
        const label = document.createElement('label');
        label.append(document.createTextNode(text), control);
        parent.append(label);
    }

    select(label, choices, parent) {
        const control = document.createElement('select');
        for (const [value, text] of choices) control.add(new Option(text, value));
        this.label(label, control, parent);
        return control;
    }

    button(text, callback) {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = text;
        button.onclick = callback;
        return button;
    }

    setActive(active) {
        clearTimeout(this.refresh);
        this.active = active;
        if (active) this.action({ action: 'list' });
    }

    update(data) {
        const catalogChanged = JSON.stringify(data.activities) !== JSON.stringify(this.data.activities);
        this.data = { activities: [], listings: [], ...data };
        if (catalogChanged) {
            for (const select of [this.filter, this.activity]) {
                const selected = select.value;
                select.replaceChildren();
                if (select === this.filter) select.add(new Option('All activities', ''));
                for (const activity of this.data.activities) select.add(new Option(`${activity.name} · ${activity.minLevel}+`, activity.id));
                if ([...select.options].some(option => option.value === selected)) select.value = selected;
            }
            this.activity.onchange();
        }
        this.renderListings();
        clearTimeout(this.refresh);
        if (this.active) this.refresh = setTimeout(() => {
            const window = this.container.closest('.social-window');
            if (this.active && this.container.style.display !== 'none' && window?.style.display !== 'none') this.action({ action: 'list' });
        }, 15000);
    }

    renderListings() {
        this.list.replaceChildren();
        for (const listing of this.data.listings) {
            if (this.filter.value && listing.activity !== this.filter.value) continue;
            const card = document.createElement('article');
            card.className = 'group-finder__card';
            const title = document.createElement('h3');
            title.textContent = `${listing.name} · ${listing.mode === 'looking' ? 'Looking for a group' : 'Recruiting'}`;
            const details = document.createElement('p');
            const activity = this.data.activities.find(a => a.id === listing.activity)?.name || listing.activity;
            details.textContent = `${activity} · ${listing.minLevel}+ · ${listing.mode === 'looking' ? 'Offers' : 'Needs'} ${listing.role} · ${listing.members}/${listing.capacity} grouped · ${listing.class} level ${listing.level}`;
            const note = document.createElement('p'); note.textContent = listing.note;
            const deadline = document.createElement('small');
            deadline.textContent = `Expires ${new Date(listing.expiresAt).toLocaleTimeString()}`;
            card.append(title, details, note, deadline);
            if (listing.ownerId === this.data.viewerId) {
                card.append(this.button('Remove my listing', () => this.action({ action: 'remove' })));
                for (const applicant of listing.applicants || []) {
                    const row = document.createElement('div');
                    row.textContent = `${applicant.name} · ${applicant.class} ${applicant.level} · ${applicant.role} `;
                    row.append(this.button(`Invite ${applicant.name}`, () => this.invite(applicant.name)));
                    row.append(this.button(`Decline ${applicant.name}`, () => this.action({ action: 'decline', applicantId: applicant.playerId })));
                    row.append(socialSafetyActions(applicant.name, `Group application: ${listing.activity}`, (...args) => this.safety?.(...args)));
                    card.append(row);
                }
            } else if (listing.mode === 'looking') {
                card.append(this.button(`Invite ${listing.name}`, () => this.invite(listing.name)));
            } else {
                const request = this.button(listing.requested ? 'Cancel join request' : 'Ask to join', () => this.action({ action: listing.requested ? 'cancel' : 'request', ownerId: listing.ownerId, role: this.joinRole.value }));
                card.append(request);
            }
            if (listing.ownerId !== this.data.viewerId) card.append(socialSafetyActions(listing.name,
                `Group listing (${listing.ownerId}): ${listing.activity}\nListing note: ${listing.note || ''}`, (...args) => this.safety?.(...args)));
            this.list.append(card);
        }
        if (!this.list.children.length) {
            const empty = document.createElement('p');
            empty.textContent = 'No available listings for this activity. Post yours or refresh later.';
            this.list.append(empty);
        }
    }
}
