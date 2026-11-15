# Contributor edit-here / test-here map

Read [CONTRIBUTING.md](../../CONTRIBUTING.md), then use the domain below to find the owner of the behavior. [Architecture](../ARCHITECTURE.md) explains the boundaries; [local development](local-development.md) keeps testing off production. These are starting points, not permission to bypass existing gates or an exhaustive test inventory.

## Find the owner

| Change | Edit here | Test here first |
| --- | --- | --- |
| Combat, abilities, damage and rewards | Server rules in [server/internal/game/](../../server/internal/game/) and [world.go](../../server/internal/game/world.go); client targeting in [AbilityController.js](../../src/core/AbilityController.js), presentation in [src/skills/](../../src/skills/) and [src/entities/](../../src/entities/) | [GameEngineCombatIntent.test.js](../../tests/GameEngineCombatIntent.test.js), [CombatFeedbackProtocolCoverage.test.js](../../tests/CombatFeedbackProtocolCoverage.test.js), server combat/reward tests beside the changed rules; browser skill/class specs under [tests/e2e/](../../tests/e2e/) |
| UI, HUD, forms and responsive layout | Feature modules in [src/ui/](../../src/ui/), shared coordination in [UIManager.js](../../src/ui/UIManager.js), [src/styles/](../../src/styles/), and boot markup in [index.html](../../index.html) | Matching feature Jest tests; [keyboard-settings.spec.js](../../tests/e2e/keyboard-settings.spec.js), [phone-session-input.spec.js](../../tests/e2e/phone-session-input.spec.js), or the relevant layout spec. Exercise close/cancel, keyboard focus and repeated navigation |
| Quests, Chronicle, dialogue and geography | Canonical [server content](../../server/internal/game/content/), [investigation story input](../plans/2026-09-07-investigation-story-content.md), [src/data/](../../src/data/), plus authoritative quest logic. Use the [canonical-input table](../../CONTRIBUTING.md#content-sources-and-checks) | [ChronicleInvestigationContent.test.js](../../tests/ChronicleInvestigationContent.test.js), [QuestConversation.test.js](../../tests/QuestConversation.test.js), server Chronicle/quest tests; matching journal/quest browser routes |
| Network protocol, reconnect and session handling | [proto/](../../proto/), [NetworkManager.js](../../src/core/NetworkManager.js), [server/main.go](../../server/main.go), protocol helpers and handlers. See [PROTOCOL.md](../PROTOCOL.md) before changing the contract | [NetworkManager.test.js](../../tests/NetworkManager.test.js), relevant server protocol/session tests and browser reconnect cases. Verify both peers and generated protocol outputs |
| Characters, equipment, effects and assets | [src/art/](../../src/art/), [src/assets/](../../src/assets/), original asset manifests and the [equipment contract](../art/EQUIPMENT_ASSETS.md). Find editable sources through that guide | [AuthoredFighter.test.js](../../tests/AuthoredFighter.test.js), [ProceduralArtMigrationGuard.test.js](../../tests/ProceduralArtMigrationGuard.test.js), [AssetVersioning.test.js](../../tests/AssetVersioning.test.js), scoped native High/Low views and asset validators |

Keep server-owned IDs, progress, ownership, eligibility and currency rules on the server. Display text and art metadata are not substitutes for those rules. Edit canonical inputs and deliberately regenerate their projections together; do not move dated input documents simply because they live under plans/.

## Choose the right check

Run these from the repository root after npm ci unless stated otherwise.

**One client behavior:** select the real tests relevant to the change, for example:

~~~sh
npm test -- --runInBand --runTestsByPath tests/NetworkManager.test.js
~~~

**Canonical/generated content:** npm run check:content checks 17 groups without repairing output. If a generator must run in write mode, review its changes alongside the input. Installation does not replace this check.

**Client baseline:** npm run test:smoke, npm test, npm run lint and node scripts/audit-dependencies.mjs are distinct checks. The [audit policy](ci-dependency-audits.md) documents the exact rejected-CVE handling. A focused subset is not a full-suite pass. See [package.json](../../package.json) for maintained route lists rather than duplicating them in another script.

**Server rules:** from server/, choose an existing test by its actual Go test name; the complete checks are:

~~~sh
go test ./...
go test -race ./...
go build -trimpath ./...
~~~

Integration tests can need disposable Mongo fixtures and platform dependencies. Read their setup before running; never substitute a production database.

**Browser UI:** install the matching Playwright browser where needed and run the relevant spec. Example:

~~~sh
npx playwright install chromium
npx playwright test tests/e2e/keyboard-settings.spec.js
~~~

The [Playwright config](../../playwright.config.js) chooses the browser and local server. Set EIDOLON_E2E_WS_URL to an isolated backend for routes that connect; explicitly select the intended browser with EIDOLON_E2E_BROWSER_PATH when needed. The anonymous suite is npm run test:e2e:anonymous. Tests using prepared scenes do not prove earned progression or human usability.

**Native/gameplay/art:** scripts/run-isolated-character-qa.sh and scripts/run-native-visual-qa.sh need their documented Linux/Docker/system-Chrome environment. Hardware checks must not be reported as passed from software rendering. See [browser network QA](browser-network-qa.md), [copied-publication fixtures](copied-client-qa-fixtures.md), and the [live checklist](../plans/live-browser-qa-checklist.md). Full soak/stress is not implied by a local test request and retains its recorded deferral.

## Evidence and review

- Keep generated output, credentials, private logs, database exports and account-bearing recordings out of Git. Follow [Playwright's artifact policy](../../playwright.config.js) and [sanitization wrapper](../../scripts/qa-evidence.sh).
- Credentialed runs disable automatic screenshots/traces/video and input-valued failure context. Explicit post-login visual artifacts need separate review; a text scan cannot certify pixels or compressed recordings.
- Preserve failed attempts and skipped/unrun stages. Describe prepared fixtures, real gameplay, runtime-byte verification and human/device acceptance separately.
- A copied or exported model is not a visual acceptance pass. Preserve original sources, hashes and [provenance](../art/CONTENT_PROVENANCE.md).
- The [CI workflow](../../.github/workflows/ci.yml) is the source of truth for required jobs. PR checks do not deploy. Publishing, merging and production verification are separate steps; follow the owner's instructions for the current review.
