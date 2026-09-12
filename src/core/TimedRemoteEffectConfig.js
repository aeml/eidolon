// Shared replica state transitions. Timers describe presentation only; gameplay
// authority remains on the server. Callbacks carry each effect's extra state.
export function createTimedRemoteEffectConfig({
    payloadKey,
    durationKey,
    activeProperty = payloadKey,
    timerProperty,
    fallbackDuration,
    extraPayloadKeys = [],
    onActivate,
    onDeactivate
}) {
    const isActive = (entity) => Boolean(entity[activeProperty]) && Number(entity[timerProperty] || 0) > 0;
    return {
        payloadKey,
        payloadKeys: [payloadKey, durationKey, ...extraPayloadKeys],
        // The replicated active bit is the transition authority. A local
        // display timer may reach zero just before the server's explicit
        // inactive snapshot; requiring both here suppresses the DOWN cue and
        // makes the final authoritative edge invisible.
        getPreviousActive: (entity) => Boolean(entity[activeProperty]),
        applyPayload: (entity, value, payload) => {
            if (value !== undefined) entity[activeProperty] = Boolean(value);
            if (payload[durationKey] !== undefined) {
                entity[timerProperty] = Math.max(0, Number(payload[durationKey] || 0));
            } else if (value === true) {
                entity[timerProperty] = Math.max(Number(entity[timerProperty] || 0), fallbackDuration);
            }

            if (Boolean(entity[activeProperty]) && Number(entity[timerProperty] || 0) > 0) {
                onActivate?.(entity, payload);
            } else {
                entity[activeProperty] = false;
                entity[timerProperty] = 0;
                onDeactivate?.(entity, payload);
            }
        },
        getNextActive: isActive,
    };
}
