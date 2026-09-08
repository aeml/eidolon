export const WELL_RESTED_CAP_SECONDS = 7200;

// Never infer sanctuary membership or award time on the network client. The
// server owns both fields, including explicit zero/empty resets on departure.
export function syncWellRested(actor, payload) {
    if (payload.wellRestedSeconds !== undefined) {
        const seconds = Number(payload.wellRestedSeconds);
        actor.wellRestedSeconds = Number.isFinite(seconds)
            ? Math.min(WELL_RESTED_CAP_SECONDS, Math.max(0, seconds)) : 0;
    }
    if (payload.safeZoneId !== undefined) {
        actor.safeZoneId = typeof payload.safeZoneId === 'string' ? payload.safeZoneId : '';
    }
}

export function wellRestedBuff(actor) {
    const seconds = Math.min(WELL_RESTED_CAP_SECONDS, Math.max(0, Number(actor.wellRestedSeconds) || 0));
    const safe = Boolean(actor.safeZoneId);
    const whole = Math.ceil(seconds);
    const hours = Math.floor(whole / 3600);
    const minutes = Math.floor((whole % 3600) / 60);
    const remainder = whole % 60;
    const clock = hours > 0
        ? `${hours}h ${String(minutes).padStart(2, '0')}m`
        : `${minutes}m ${String(remainder).padStart(2, '0')}s`;
    const dead = actor.state === 'DEAD' || actor.stats?.hp === 0;
    const state = safe
        ? (dead ? 'Paused in sanctuary' : (seconds >= WELL_RESTED_CAP_SECONDS ? 'Fully rested' : 'Resting · +1s each second'))
        : 'Counts down outside sanctuary';
    return {
        id: 'well_rested', active: Number.isFinite(seconds) && seconds > 0,
        icon: '☀️', name: 'Well Rested', durationSeconds: seconds,
        timeLabel: `${clock} / 2h · ${state}`,
        detail: '+10% all stats · +25% enemy-kill XP only. Safe zones restore 10% health and mana per second. No time earned or spent while offline.',
        isDebuff: false
    };
}
