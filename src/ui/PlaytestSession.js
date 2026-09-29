export const PLAYTEST_ACTIVITIES = Object.freeze(['exploring', 'fighting', 'recovering', 'grouping', 'lost', 'idle']);
const CATEGORIES = [...PLAYTEST_ACTIVITIES, 'hidden', 'disconnected', 'unobserved'];
const levelOf = value => Number.isInteger(value) && value >= 1 && value <= 100 ? value : null;
const LEVEL_BANDS = ['1–29', '30–59', '60–99', '100', 'unknown'];
const bandOf = value => levelOf(value) === null ? 'unknown' : value < 30 ? '1–29' : value < 60 ? '30–59' : value < 100 ? '60–99' : '100';
const partyOf = value => Number.isInteger(value) && value >= 1 && value <= 5 ? String(value) : 'unknown';
const MAX_SESSION_MS = 8 * 60 * 60 * 1000;

// Voluntary, page-local aggregate timing. No identity, input contents, position,
// storage or network access. Labels are self-reported, not inferred gameplay.
export class PlaytestSession {
    constructor() { this.clear(); }

    clear() {
        this.running = false;
        this.started = false;
        this.activity = 'exploring';
        this.assisted = false;
        this.totals = Object.fromEntries(CATEGORIES.map(key => [key, 0]));
        this.assistedMs = 0;
        this.className = null;
        this.activeByLevelBand = Object.fromEntries(LEVEL_BANDS.map(key => [key, 0]));
        this.activeByPartySize = Object.fromEntries(['1', '2', '3', '4', '5', 'unknown'].map(key => [key, 0]));
        this.startLevel = this.endLevel = this.level30 = null;
        this.previous = null;
    }

    start(now, context = {}) {
        if (this.started || !Number.isFinite(now)) return false;
        this.started = this.running = true;
        this.startLevel = this.endLevel = levelOf(context.level);
        this.className = ['Fighter', 'Rogue', 'Wizard', 'Cleric'].includes(context.className) ? context.className : null;
        this.previous = { now, ...this.classify(context) };
        return true;
    }

    classify(context) {
        const category = context.connected !== true ? 'disconnected'
            : context.hidden === true ? 'hidden'
                : context.idle === true ? 'idle' : this.activity;
        return { category, assisted: this.assisted && PLAYTEST_ACTIVITIES.includes(category) && category !== 'idle',
            levelBand: bandOf(context.level), partySize: partyOf(context.partySize) };
    }

    tick(now, context = {}) {
        if (!this.running || !Number.isFinite(now) || now < this.previous.now) return;
        const elapsed = this.elapsed();
        const gap = now - this.previous.now;
        const delta = Math.min(gap, MAX_SESSION_MS - elapsed);
        // Suspended/throttled pages cannot prove what happened in their gap.
        const category = gap > 5000 ? 'unobserved' : this.previous.category;
        this.totals[category] += delta;
        if (category !== 'unobserved' && this.previous.assisted) this.assistedMs += delta;
        if (PLAYTEST_ACTIVITIES.includes(category) && category !== 'idle') {
            this.activeByLevelBand[this.previous.levelBand] += delta;
            this.activeByPartySize[this.previous.partySize] += delta;
        }
        // A late wake after the cap cannot date a level change inside the
        // recorded window. Leave its last observed level/milestone unchanged.
        const level = gap <= MAX_SESSION_MS - elapsed ? levelOf(context.level) : null;
        if (level !== null) this.endLevel = level;
        if (this.level30 === null && this.startLevel !== null && this.startLevel < 30 && level >= 30) {
            this.level30 = { elapsedMs: this.elapsed(), activeMs: this.active() };
        }
        this.previous = { now, ...this.classify(context) };
        if (this.elapsed() >= MAX_SESSION_MS) this.running = false;
    }

    elapsed() { return Object.values(this.totals).reduce((sum, value) => sum + value, 0); }
    active() { return PLAYTEST_ACTIVITIES.filter(key => key !== 'idle').reduce((sum, key) => sum + this.totals[key], 0); }
    stop(now, context) { this.tick(now, context); this.running = false; }

    summary() {
        const minutes = ms => `${(ms / 60000).toFixed(1)} min`;
        return [
            'Voluntary playtest summary (self-reported activity; page-local only)',
            `Levels: ${this.startLevel ?? 'unknown'} → ${this.endLevel ?? 'unknown'}`,
            `Class: ${this.className ?? 'unknown'}`,
            `Observed session: ${minutes(this.elapsed())}; active labels: ${minutes(this.active())}`,
            ...CATEGORIES.map(key => `${key}: ${minutes(this.totals[key])}`),
            `Active time marked assisted: ${minutes(this.assistedMs)}`,
            `Active time by level band: ${LEVEL_BANDS.map(key => `${key}: ${minutes(this.activeByLevelBand[key])}`).join('; ')}`,
            `Active time by party roster size: ${Object.entries(this.activeByPartySize).map(([key, ms]) => `${key === '1' ? 'solo' : key === 'unknown' ? key : key + ' players'}: ${minutes(ms)}`).join('; ')}`,
            this.level30 ? `Level 30 observed: ${minutes(this.level30.elapsedMs)} session / ${minutes(this.level30.activeMs)} active`
                : this.startLevel >= 30 ? 'Started at/above level 30; not a fresh level-30 timing.' : 'Level 30 not observed.',
            'Hidden, disconnected and unobserved time is excluded from active time. Closed-page time is not measured.',
            'Activity and assistance labels are player estimates. Party roster size does not prove participation.'
        ].join('\n');
    }
}
