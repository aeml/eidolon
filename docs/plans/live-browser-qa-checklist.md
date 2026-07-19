# Eidolon Live Browser QA Checklist

Last refreshed: July 19, 2026

Purpose: provide one durable release gate from local build through deployed real-character verification. This checklist consolidates the useful live portions of the dungeon, first-hour, retention, and repro workflows without treating the deterministic repro sandbox as proof of networked gameplay.

## Evidence vocabulary

- **Implemented:** present in code.
- **Unit-tested:** exercised by Jest or Go tests.
- **Locally browser-tested:** exercised through Playwright in a real local browser against the selected server.
- **Live-tested:** exercised against the deployed client and server reporting the intended Git SHA.

Do not promote a claim between categories without the corresponding run.

## Safety and account requirements

- Use only dedicated QA accounts from environment variables or GitHub secrets.
- Never place usernames/passwords in commands that will be committed, logs, screenshots, traces, or markdown evidence.
- The extended route may set a dedicated character to level 100, gain XP/items, change position, create/leave a party, and create/reset a dungeon instance.
- Add only the primary QA username to the server `EIDOLON_QA_USERNAMES` allowlist when `/level` acceleration is required.
- Do not run the extended route against a normal player character.
- Credentialed traces, screenshots, video, and the automatic input-valued failure snapshot stay disabled because recordings can contain account identifiers or passwords. CI also redacts and scans the supplied values before upload. The anonymous gate retains all three failure artifact types.

Required primary variables:

```text
EIDOLON_E2E_USERNAME
EIDOLON_E2E_PASSWORD
EIDOLON_E2E_CLASS             # optional, defaults to Wizard for a new character
EIDOLON_E2E_FULL_GAMEPLAY=1   # enables mutation-heavy extended route
```

Optional two-account variables:

```text
EIDOLON_E2E_USERNAME_SECONDARY
EIDOLON_E2E_PASSWORD_SECONDARY
EIDOLON_E2E_CLASS_SECONDARY
```

## Gate 1: local reproducibility

From a clean checkout at the intended release SHA:

```bash
npm ci
npm audit --audit-level=low
npm test -- --runInBand
npm run lint
npm run test:e2e:anonymous

cd server
go test ./...
go build ./...
```

Pass only when the install is lockfile-clean, audit reports no vulnerability, client/server gates pass, and system Chrome completes the anonymous route without console/page/request failures.

## Gate 2: anonymous browser surface

Automated in `tests/e2e/anonymous.spec.js`:

1. Main document returns 200 and `EIDOLON ONLINE` renders.
2. Visible Alpha version exists.
3. Locked protobuf and Three.js vendor manifest loads.
4. Patch Notes opens from the login screen and closes with Escape.
5. No first-party request failure, HTTP error, page exception, or console error is observed.
6. A browser WebSocket connects to the configured game server.
7. In post-deploy mode, client `/release.json` and server `/healthz` both equal the expected SHA; server status is `ok` and database is `ready`.

## Gate 3: persistent-character smoke

Automated when primary credentials exist:

1. Log in through visible inputs and enter the saved character (or create the configured class on a dedicated empty account).
2. Wait for the first authoritative state frame.
3. Hold a real movement key and verify authoritative position changes.
4. Open and Escape-close Character (`C`), Inventory (`I`), Journal (`J`), Skills (`K`), Map (`M`), Social (`O`), and Abilities (`P`).
5. Close the active WebSocket as a fault injection, then verify resume opens a new socket and preserves player identity.

## Gate 4: extended gameplay route

Automated only with `EIDOLON_E2E_FULL_GAMEPLAY=1` and an allowlisted dedicated account:

1. Use chat DOM input for `/level 100` only if the character is below 100.
2. Leave town through real WASD input until a hostile is visible.
3. Use projected read-only coordinates for real mouse targeting; press real hotbar keys for abilities.
4. Kill an overworld enemy. Repeat up to five encounters if random loot does not drop.
5. Click dropped loot with the real mouse and verify authoritative inventory count increases.
6. Recall to town with `B`.
7. Hold the isometric east chord (`S+D`) until the Verdant Bastion portal is reached.
8. Click the real portal, choose Normal, and start the run through visible DOM controls.
9. Verify the authoritative instance type changes to `verdant_bastion_catacombs`.
10. Recall with `B` and verify return to `overworld`.
11. Exercise reconnect/session resume.
12. Reload, log in again, and verify level and inventory persistence.

Any inventory-full state, missing QA authorization, navigation softlock, kill/loot failure, incorrect instance transition, or lost persistence fails the gate.

## Gate 5: two-browser multiplayer

Automated when secondary credentials exist:

1. Log both dedicated characters in with separate browser contexts.
2. Set primary presence to Looking for Party and verify the secondary Social roster sees it.
3. Invite through party UI; accept through the secondary modal.
4. Verify both party panels and replicated `partyId` agree.
5. Move the primary with real keys and verify the secondary observes remote displacement.
6. Ctrl-click a real canvas destination and verify the secondary observes jump state/progress.
7. Move both toward a shared hostile; attack/cast through primary input and verify remote combat presentation.
8. Verify the secondary's remote primary position converges with the primary's authoritative position.
9. Leave the party during cleanup, including failure cleanup when possible.

## Gate 6: targeted manual follow-up

Automation covers release mechanics, not the full product-quality surface. For a release touching these areas, append the corresponding manual pass.

### First-hour/onboarding

- Use a fresh dedicated account.
- Follow only start flow, objective tracker, Journal, Map, Help, and town signage.
- Visit Quest Giver, Forge, Vendor, Stash, and Trading House.
- Recover after closing menus, death/respawn, recall, and town return.
- Record any silent route, contradictory instruction, or unclear keep/vendor decision.

### Dungeon geometry and pacing

- Run every dungeon type and at least three generated layouts when geometry changes.
- Check spawn, center/edge doorway traversal, corridor turns, wall seams, blink/charge/jump boundaries, room-state/minimap/objective updates, boss-room edges, recall, and re-entry.
- Preserve server authority when diagnosing: distinguish a visual-only issue from an accepted illegal position.

### Retention/economy

- Validate Journal repeatable ladder and live reset countdown.
- Compare Dungeon Guide, party reward copy, daily state, and Trading House outcomes.
- Complete/turn in a ready daily and confirm the next route remains visible.

### Repro sandbox

- Use `repro.html` for a two-minute rendering/VFX/menu/dungeon-beat preview before a full run.
- Do not cite it as live gameplay, authentication, persistence, networking, or server-authority evidence.

## Deployment and production run

The production workflow performs these steps after a push to `master`:

1. Run client tests/lint/audit, server tests/build, and local anonymous Playwright.
2. Deploy Pages and the Docker server.
3. Poll cache-busted `https://eidolon.mendola.tech/release.json` and `https://eserver.mendola.tech/healthz` until both equal the workflow SHA.
4. Run Playwright with:

```text
EIDOLON_E2E_BASE_URL=https://eidolon.mendola.tech
EIDOLON_E2E_WS_URL=wss://eserver.mendola.tech/ws
EIDOLON_E2E_HEALTH_URL=https://eserver.mendola.tech/healthz
EIDOLON_EXPECTED_COMMIT=<pushed SHA>
```

5. Upload the HTML report and anonymous failure screenshots/video/traces. Credentialed recordings remain off.

## Release evidence record

Fill this in after the live run; do not pre-check it based on local results.

| Evidence | Result |
|---|---|
| Pushed commit | Pending |
| Client reported commit | Pending |
| Server reported commit | Pending |
| GitHub Actions run | Pending |
| Browser/version | Pending |
| Live anonymous route | Pending |
| Live primary character route | Pending |
| Live extended gameplay route | Pending |
| Live secondary multiplayer route | Not required unless credentials supplied |
| Failure artifacts/issues | Pending |
| Final worktree/origin state | Pending |

## Failure policy

1. Capture SHA, URL, browser, route step, screenshot/video, and observable state without credentials.
2. Add or tighten the smallest regression test that reproduces the failure.
3. Fix forward, push, wait for both release identities, and rerun the affected route plus anonymous smoke.
4. If fix-forward is unsafe, revert only the release commit, deploy the revert, and verify both public SHAs and anonymous smoke.
