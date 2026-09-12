// Each real browser owns one serial input loop. A slow movement on one member
// must not delay another member's next safety observation. stop() joins every
// in-flight operation before travel, snapshots, or browser cleanup can proceed.
export function startPartyCombatWorkers(roles, step, pause) {
    let stopped = false, failure = null;
    const check = () => { if (failure) throw failure; };
    const workers = roles.map(async role => {
        try {
            while (!stopped) {
                await step(role);
                if (!stopped) await pause(role);
            }
        } catch (error) {
            failure ||= error;
            stopped = true;
        }
    });
    return { check, async stop() {
        stopped = true;
        await Promise.all(workers);
        check();
    } };
}
