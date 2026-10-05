// Source-backed explanatory text, not a consent system or legal certification.
// Rendering never reads account/browser state, queries a server or adds telemetry.
const sections = Object.freeze([
    ['Accounts and saved play', 'Eidolon stores account identifiers, public name, submitted email, verified recovery address when configured, password hashes and recovery-token digests. Saved characters include progression, equipment/inventory, Gold/EP, quests, skills, appearances, location and eligible dungeon/run state. A registration email alone is not account-ownership proof.'],
    ['Shared play and support', 'Guilds, friendships, marketplace/trades, casino settlements, drops and dungeon/raid rewards use shared records and recovery/replay identities. Private reports, staff reviews and administration history are stored separately. Login/resume/disconnect history can include a recorded connection start; connection duration is not active-play or AFK measurement.'],
    ['Your browser and providers', 'The browser keeps game preferences, downloaded asset caches and session/resume credentials. The optional playtest timer stays local until you explicitly attach a summary. The normal production website/game uses Google Analytics. Recovery email, when enabled, is delivered through Postmark; provider and mailbox copies are outside the in-game request system. Opening this notice does not collect extra information or change those settings.'],
    ['Retention and copies', 'Current retention settings are unchanged. Activity history defaults to 90 days and is configurable within 7–365 days; session files state the cutoff used for their read. Database expiry is asynchronous. Accounts, reports and operation-replay records have no generic account-deletion timer. Logs, save journals, backups and provider copies follow their existing configuration; a token/link validity window is not proof of physical erasure.'],
    ['Request your own data', 'While signed in, use Account help before entering the world, or Menu → Report Bug / Feature in the game, and select Account Data Export or Account Removal Request. Administrators review these private cases. Privacy requests attach no automatic diagnostics. Describe only what is needed; never include passwords, recovery links, session tokens or identity documents. You can check your own request reference.'],
    ['Approved section downloads', 'An export approval is separate from ordinary case review. In private account support, check your approved reference and prove current ownership with your current password. The download control lists supported account/gameplay/report/session/social/market/guild/invitation/competitive/weekly-raid sections. Prepare and Save are separate clicks; pages require deliberate continuation. Files carry coverage/consistency limits and do not claim complete account exports or restore images. Unsupported, oversized, historical and shared-operation data needs staff handling. Protect any file you choose to save.'],
    ['Removal is a separate reviewed action', 'Submitting or resolving a removal case does not delete an account or authorize irreversible erasure. There is no automatic deletion. Shared custody, pending rewards/transactions, durable replay identities and journal/backup restoration must be reconciled before a separately authorized removal. Staff must explain the scope and any retained/provider/archive copies; case resolution alone is not proof of delivery or removal.'],
    ['Private support mode', 'The private support page reloads the game and prevents its analytics tag from loading. Its link contains no account, proof or export artifact. Recovery-link pages use the same sensitive-page guard. This does not protect against browser extensions, device recording or copies you save/share, and does not erase existing provider data.']
]);

export function mountDataPrivacyNotices(root = document) {
    for (const host of root.querySelectorAll('[data-eidolon-data-notice]')) {
        if (host.dataset.eidolonDataNoticeMounted === '1') continue;
        const doc = host.ownerDocument;
        const details = doc.createElement('details');
        details.className = host.dataset.noticeStyle === 'login' ? 'auth-session-help' : 'report-context-preview';
        details.classList.add('data-privacy-notice');
        const summary = doc.createElement('summary'); summary.textContent = 'Your data & privacy requests'; details.append(summary);
        for (const [heading, text] of sections) {
            const paragraph = doc.createElement('p'), title = doc.createElement('strong');
            title.textContent = `${heading}. `; paragraph.append(title, doc.createTextNode(text)); details.append(paragraph);
        }
        const link = doc.createElement('a'); link.textContent = 'Open private account support (reloads the game)';
        // Query navigation creates a fresh document; a fragment would retain an
        // already initialized analytics tag. The bootstrap scrubs this marker.
        link.href = `${doc.defaultView.location.pathname}?eidolon-private=account`;
        details.append(link); host.replaceChildren(details); host.dataset.eidolonDataNoticeMounted = '1';
    }
}
