import { socialSafetyActions } from './SocialSafetyUI.js';

export class GroupFinderUI {
    constructor(container, { action, safety, meeting }) {
        this.container = container;
        this.action = action;
        this.meeting = meeting;
        this.safety = safety;
        this.data = { activities: [], listings: [], meetingPoints: [] };
        container.classList.add('group-finder');
        const guidance = document.createElement('p');
        guidance.textContent = 'Find companions, agree on a public meeting place, then invite and run a fresh ready check. Listings last 20 minutes while online and available; requests last 5 minutes. A changed listing needs a new application. Plans never teleport you, reserve a seat or bypass entry rules. Use the guild calendar for events more than 20 minutes away.';
        this.toolbar = document.createElement('div');
        this.toolbar.className = 'group-finder__controls';
        this.filter = this.select('Activity filter', [['', 'All activities']], this.toolbar);
        this.filter.onchange = () => {
            this.requestedActivity = null; this.context.hidden = true;
            this.renderListings();
        };
        this.joinRole = this.select('Join as', ['flexible', 'tank', 'healer', 'damage'].map(value => [value, value]), this.toolbar);
        this.toolbar.append(this.button('Refresh', () => action({ action: 'list' })));
        const editor = document.createElement('details');
        this.editor = editor;
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
        this.meetingPoint = this.select('Meet in Lanternhold', [], form);
        this.start = document.createElement('input'); this.start.type = 'datetime-local'; this.start.step = '60';
        this.label('Planned start (local time, optional)', this.start, form);
        this.activity.onchange = () => { this.minimum.value = String(this.data.activities.find(a => a.id === this.activity.value)?.minLevel || 1); };
        const post = this.button('Publish for 20 minutes', () => {});
        post.type = 'submit';
        form.append(post);
        form.onsubmit = event => {
            event.preventDefault();
            const plan = { meetingPointId: this.meetingPoint.value };
            if (this.start.value) {
                const start = new Date(this.start.value);
                if (!Number.isFinite(start.getTime())) return;
                plan.startsAt = start.toISOString();
            }
            action({ action: 'post', mode: this.mode.value, activity: this.activity.value, role: this.role.value,
                minLevel: Number(this.minimum.value), note: this.note.value.trim(), plan });
        };
        editor.append(summary, form);
        this.list = document.createElement('div');
        this.list.className = 'group-finder__list';
        this.context = document.createElement('p');
        this.context.setAttribute('role', 'status'); this.context.hidden = true;
        container.append(guidance, this.context, this.toolbar, editor, this.list);
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
        if (this.active === active) return;
        clearTimeout(this.refresh);
        this.active = active;
        if (active) this.action({ action: 'list' });
    }

    focusActivity(activityId) {
        this.requestedActivity = activityId;
        this.applyRequestedActivity();
        this.renderListings();
        this.filter.focus({ preventScroll: true });
    }

    applyRequestedActivity() {
        if (!this.requestedActivity) return;
        const activity = this.data.activities.find(entry => entry.id === this.requestedActivity);
        this.context.hidden = false;
        if (!activity) {
            this.context.textContent = this.data.activities.length
                ? 'This activity is unavailable in the current recruitment catalogue. Choose another activity.'
                : 'Loading the recruitment catalogue for your selected activity…';
            return;
        }
        this.filter.value = this.activity.value = activity.id;
        this.activity.onchange();
        this.context.textContent = `${activity.name}: browse real players or publish your own listing. No listing has been posted automatically.`;
        this.requestedActivity = null;
    }

    update(data) {
        const catalogChanged = JSON.stringify(data.activities) !== JSON.stringify(this.data.activities);
        const pointsChanged = JSON.stringify(data.meetingPoints) !== JSON.stringify(this.data.meetingPoints);
        this.data = { activities: [], listings: [], meetingPoints: [], ...data };
        if (pointsChanged) {
            const selected = this.meetingPoint.value || 'dungeon-guide';
            this.meetingPoint.replaceChildren();
            for (const point of this.data.meetingPoints) this.meetingPoint.add(new Option(point.name, point.id));
            if ([...this.meetingPoint.options].some(option => option.value === selected)) this.meetingPoint.value = selected;
        }
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
        this.applyRequestedActivity();
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
            const plan = document.createElement('p');
            const point = this.data.meetingPoints.find(point => point.id === listing.plan?.meetingPointId);
            const start = listing.plan?.startsAt ? new Date(listing.plan.startsAt).toLocaleTimeString() : 'When everyone is ready';
            plan.textContent = `Start: ${start} · Meet: ${point ? `${point.name}, Lanternhold (${point.x}, ${point.z})` : 'Refresh for the current meeting point'}. This is a plan, not instance entry.`;
            const readiness = document.createElement('p');
            const roles = listing.roles || {};
            readiness.textContent = `Class roles: ${roles.tank || 0} tank · ${roles.healer || 0} healer · ${roles.damage || 0} damage · ${roles.flexible || 0} flexible. ${listing.ready || 0}/${listing.members} ready${listing.checking ? ' · Check active' : ''}. Offered roles are player preferences, not guarantees about their build.`;
            card.append(title, details, plan, readiness, note, deadline);
            if (point && this.meeting) card.append(this.button('View meeting point on map', () => this.meeting(point.id)));
            if (listing.ownerId === this.data.viewerId) {
                card.append(this.button('Remove my listing', () => this.actOnListing(listing, { action: 'remove' })));
                for (const applicant of listing.applicants || []) {
                    const row = document.createElement('div');
                    row.textContent = `${applicant.name} · ${applicant.class} ${applicant.level} · ${applicant.role} `;
                    row.append(this.button(`Invite ${applicant.name}`, () => this.actOnListing(listing, { action: 'invite', applicantId: applicant.playerId, applicationId: applicant.id })));
                    row.append(this.button(`Decline ${applicant.name}`, () => this.actOnListing(listing, { action: 'decline', applicantId: applicant.playerId, applicationId: applicant.id })));
                    row.append(socialSafetyActions(applicant.playerId?.startsWith('player-') ? applicant.playerId.slice(7) : applicant.name, `Group application: ${listing.activity}`, (...args) => this.safety?.(...args), applicant.name));
                    card.append(row);
                }
            } else if (listing.mode === 'looking') {
                card.append(this.button(`Invite ${listing.name}`, () => this.actOnListing(listing, { action: 'invite', applicantId: listing.ownerId })));
            } else {
                const request = this.button(listing.requested ? 'Cancel join request' : 'Ask to join', () => this.actOnListing(listing,
                    listing.requested ? { action: 'cancel', applicationId: listing.requestId } : { action: 'request', role: this.joinRole.value }));
                card.append(request);
            }
            if (listing.ownerId !== this.data.viewerId) card.append(socialSafetyActions(listing.ownerId?.startsWith('player-') ? listing.ownerId.slice(7) : listing.name,
                `Group listing (${listing.ownerId}): ${listing.activity}\nListing note: ${listing.note || ''}`, (...args) => this.safety?.(...args), listing.name));
            this.list.append(card);
        }
        if (!this.list.children.length) {
            const empty = document.createElement('p');
            empty.textContent = 'No available listings for this activity. Publish a listing, invite a friend, or return later. Only real players fill groups; posting does not create a party or start a run. Continue overworld quests or prepare gear while waiting. Raids still require 5–10 players and their normal entry requirements.';
            const post = this.button('Prepare my listing', () => {
                if (this.filter.value) { this.activity.value = this.filter.value; this.activity.onchange(); }
                this.editor.open = true;
                this.mode.focus({ preventScroll: true });
                this.editor.scrollIntoView?.({ block: 'nearest' });
            });
            this.list.append(empty, post);
        }
    }

    actOnListing(listing, payload) {
        const current = this.data.listings.find(entry => entry.id === listing.id && entry.ownerId === listing.ownerId);
        const applicationCurrent = !payload.applicationId || (payload.action === 'cancel'
            ? current?.requestId === payload.applicationId
            : current?.applicants?.some(entry => entry.id === payload.applicationId && entry.playerId === payload.applicantId));
        if (!current || !listing.id || !applicationCurrent) {
            this.context.hidden = false;
            this.context.textContent = 'That plan or application changed. Refreshing Groups; please review the current listing.';
            this.action({ action: 'list' });
            return;
        }
        this.action({ ...payload, ownerId: listing.ownerId, listingId: listing.id });
    }
}
