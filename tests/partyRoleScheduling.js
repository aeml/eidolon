// Complete one ordinary-input round for each independent browser role.
export async function runPartyRoleInputs(roles, avoidWarnings, act) {
    // Another player's dodge cannot hold up this player's safe heal/cast.
    // Never overlap inputs within a role, and join every role before the caller
    // inspects results or closes browsers, including when one input fails.
    const results = await Promise.allSettled(roles.map(async role => {
        const policy = await avoidWarnings(role);
        if (policy.allowCasts) await act(role, policy);
        return policy;
    }));
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
    return results.map(result => result.value);
}
