# Eidolon Live Browser QA Checklist

Last refreshed: July 20, 2026

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
- Add only dedicated primary/secondary QA usernames to the server `EIDOLON_QA_USERNAMES` allowlist. `/level`, fixed `/qa-waypoint` destinations, `/qa-loot-next`, and `/qa-disconnect` all use that same server-side gate.
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
npm run test:e2e:isolated

cd server
go test ./...
go build ./...
```

Pass only when the install is lockfile-clean, audit reports no vulnerability, client/server gates pass, system Chrome completes the anonymous route without console/page/request failures, and the temporary local stack completes the full character route. The isolated command creates uniquely suffixed `eidolon-isolated-qa-*` Docker resources, tracks ownership, removes only what it created, and refuses collisions.

## Gate 2: anonymous browser surface

Automated in `tests/e2e/anonymous.spec.js`:

1. Main document returns 200, `EIDOLON ONLINE` renders, and the client module publishes its complete-boot marker.
2. Visible Alpha version exists.
3. Locked protobuf and Three.js vendor manifest loads.
4. Patch Notes opens from the login screen and closes with Escape.
5. No first-party request failure, HTTP error, page exception, or console error is observed.
6. A browser WebSocket connects when `EIDOLON_E2E_WS_URL` configures a game server. Predeploy static smoke omits that external dependency; the isolated character route and post-deploy suite require real sockets.
7. In post-deploy mode, client `/release.json` and server `/healthz` both equal the expected SHA; server status is `ok` and database is `ready`.

The live path uses bounded retries for transient edge 5xx responses, JSON identity requests, and initial WebSocket handshakes. A later complete boot or successful handshake may reconcile that abandoned attempt; an unrecovered final attempt, application exception, 4xx response, or functional mismatch still fails the gate.

## Gate 3: persistent-character smoke

Automated when primary credentials exist:

1. Log in through visible inputs and enter the saved character (or create the configured class on a dedicated empty account).
2. Wait for the first authoritative state frame.
3. Click a projected ground destination with the real mouse and verify authoritative position changes. If randomized town props occupy every projected click, use a bounded real WASD fallback and require the same server-authoritative displacement.
4. Open and Escape-close Character (`C`), Inventory (`I`), Journal (`J`), Skills (`K`), Map (`M`), Social (`O`), and Abilities (`P`).
5. Submit `/qa-disconnect` through visible chat input, then verify the browser's real resume path opens a new socket and preserves player identity. The server closes the transport and page code remains read-only during this check.

## Gate 4: extended gameplay route

Automated only with `EIDOLON_E2E_FULL_GAMEPLAY=1` and an allowlisted dedicated account:

1. Use chat DOM input for `/level 100` only if the character is below 100.
2. Select Low graphics and disable Auto-Loot through the visible Settings controls so the route proves both real UI configuration and mouse-driven pickup.
3. Submit `/qa-waypoint combat` through chat. This fixed allowlisted waypoint avoids randomized town-prop navigation, grants five minutes of bounded protection, and briefly rejects stale movement queued at the old position while the authoritative state reaches the browser; it does not perform combat.
4. Submit `/qa-loot-next` through chat so the next accepted basic attack kills its normal-enemy target and the regular server-owned drop path guarantees equipment without relying on random damage or a 50% drop chance.
5. Use projected read-only coordinates for real mouse targeting and right-click the hostile for the primary ability.
6. Verify ability cooldown, intermediate damage or a one-shot death, and the authoritative kill. All repeated attacks remain real mouse clicks.
7. Approach and click the replicated loot with the real mouse. If the killing click also acquires the newly spawned overlapping loot, accept only an authoritative inventory increase while Auto-Loot is explicitly off.
8. Submit `/qa-waypoint verdant` through chat. The destination is fixed near the portal because a fresh QA character cannot safely traverse the endgame zone.
9. Zoom with real wheel events, click the real portal, choose Normal, and start the run through visible DOM controls.
10. Verify the authoritative instance type changes to `verdant_bastion_catacombs`.
11. Recall with `B` and verify return to `overworld`.
12. Exercise reconnect/session resume through the allowlisted server-originated transport close.
13. Reload, log in again, and verify level and inventory persistence.

Any inventory-full state, missing QA authorization, navigation softlock, kill/loot failure, incorrect instance transition, or lost persistence fails the gate.

## Gate 5: two-browser multiplayer

Automated when secondary credentials exist:

1. Log both dedicated characters in with separate system-Chrome processes, select Low graphics through each visible Settings screen, and use the fixed allowlisted combat waypoint through chat so persistent characters begin within the replication radius.
2. Set primary presence to Looking for Party and verify the secondary Social roster sees it.
3. Invite through party UI; accept through the secondary modal.
4. Verify both party panels and replicated `partyId` agree.
5. Move the primary with a real ground click and verify the secondary observes remote displacement.
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

1. Run client tests/lint/audit and server tests/build on GitHub-hosted workers, then run the anonymous surface in pinned Playwright Chromium.
2. Dispatch the disposable full-character route to the repository-scoped `eidolon-live-browser` runner and require `/usr/bin/google-chrome` before any deployment. This push-only gate generates its own temporary account and receives no production credentials.
3. Validate dedicated QA secrets and update the server allowlist from those username secrets during deployment.
4. Deploy Pages and the Docker server.
5. Poll cache-busted `https://eidolon.mendola.tech/release.json` and `https://eserver.mendola.tech/healthz` until both equal the workflow SHA.
6. Dispatch the post-deploy job to the same runner and run system Google Chrome with:

```text
EIDOLON_E2E_BASE_URL=https://eidolon.mendola.tech
EIDOLON_E2E_WS_URL=wss://eserver.mendola.tech/ws
EIDOLON_E2E_HEALTH_URL=https://eserver.mendola.tech/healthz
EIDOLON_E2E_BROWSER_PATH=/usr/bin/google-chrome
EIDOLON_E2E_BACKEND_ORIGIN_IP=<live origin IP secret>
EIDOLON_EXPECTED_COMMIT=<pushed SHA>
```

The Chrome-only origin override keeps the public production hostname and valid TLS certificate while preventing Cloudflare edge faults from starving the 30 Hz gameplay stream. Public client and server identities are still polled through their normal URLs before Chrome starts, and the frontend itself still loads through the public production URL.

7. Upload the HTML report and anonymous failure screenshots/video/traces. Credentialed recordings remain off. Both character jobs are selected only by push-gated dependencies; pull-request browser work stays on GitHub-hosted infrastructure and receives neither runner access nor production credentials.

The current runner host stores the official repository registration under `/home/aeml/.local/share/eidolon-actions-runner`. The runner account must belong to `render` and `video`; both character jobs fail before gameplay unless Chrome reports a hardware WebGL renderer. It must remain online with the `eidolon-live-browser` label; an offline runner deliberately leaves the post-deploy gate queued rather than silently skipping gameplay. After a host restart, `scripts/start-live-browser-runner.sh` starts the configured runner under the `render` group in the detached `eidolon-actions-runner` tmux session without reading or writing QA credentials.

## Release evidence record

Fill this in after the live run; do not pre-check it based on local results.

Current release evidence on July 20, 2026:

- Node `24.18.0`: fresh `npm ci`, zero-vulnerability `npm audit`, 83 Jest suites / 965 tests, and ESLint passed.
- Go toolchain `1.24.5`: `go test -race ./...` and `go build -trimpath ./...` passed.
- Google Chrome `150.0.7871.124`: anonymous smoke passed; the combined isolated character suite passed both smoke/reconnect and extended gameplay/persistence tests with a hardware AMD Vulkan renderer in 1.2 minutes.
- The focused portal route also passed, credential scanning passed, and no uniquely suffixed QA container, network, or image remained after cleanup.
- The isolated route is locally browser-tested evidence. The matching live evidence for the released code SHA is recorded below.

| Evidence | Result |
|---|---|
| Pushed commit | `634280a551e40eb3016b5b50991178e1d04c75ac` on `master` |
| Client reported commit | `634280a551e40eb3016b5b50991178e1d04c75ac` |
| Server reported commit | `634280a551e40eb3016b5b50991178e1d04c75ac`; status `ok`, database `ready` |
| GitHub Actions run | [CI run 29708438440](https://github.com/aeml/eidolon/actions/runs/29708438440), passed |
| Browser/version | Google Chrome `150.0.7871.124`, hardware AMD Vulkan/RADV renderer |
| Live anonymous route | Passed against the matching production client/server SHA |
| Live primary character route | Passed movement, menu hotkeys, server-originated disconnect, session resume, and identity preservation |
| Live extended gameplay route | Passed visible Low graphics/Auto-Loot settings, ability and basic-attack combat, authoritative kill/drop/pickup/equip, dungeon entry/exit, reconnect, and fresh-login persistence |
| Live secondary multiplayer route | Passed presence, party invite/accept, shared party state, remote movement/jump/combat presentation, position convergence, and cleanup |
| Failure artifacts/issues | No product failure in the final same-SHA run; sanitized evidence upload passed. A GitHub Actions outage and an infrastructure-only Docker proxy denial delayed the successful predeploy rerun. |
| Final worktree/origin state | Evidence changes committed directly to `master`; clean `HEAD == origin/master` verified at handoff |

## Failure policy

1. Capture SHA, URL, browser, route step, screenshot/video, and observable state without credentials.
2. Add or tighten the smallest regression test that reproduces the failure.
3. Fix forward, push, wait for both release identities, and rerun the affected route plus anonymous smoke.
4. If fix-forward is unsafe, revert only the release commit, deploy the revert, and verify both public SHAs and anonymous smoke.
