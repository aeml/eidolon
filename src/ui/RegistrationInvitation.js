// A transient password-style field only: never storage, URL or automatic retry.
export function registrationInvitationPayload(root = document) {
    const code = root.getElementById('auth-invitation')?.value;
    return code ? { inviteCode: code } : {};
}

export function clearRegistrationInvitation(root = document) {
    const input = root.getElementById('auth-invitation');
    if (input) input.value = '';
}
