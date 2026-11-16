# Documentation index

Start with the [root quickstart](../README.md#quickstart), [local development](development/local-development.md), [contributor map](development/contributor-map.md), and [architecture](development/architecture.md). This index separates working guides from release receipts and historical context. See the [repository layout](development/repository-layout.md) for directory ownership.

## Active engineering guides

- [Contributing](../CONTRIBUTING.md): canonical inputs, scoped validation, preservation and handoff expectations.
- [Edit here / test here](development/contributor-map.md): combat, UI, quests, protocol and art entry points.
- [Local development](development/local-development.md): local Mongo/API/client setup and the existing WebSocket override.
- [Architecture](development/architecture.md): ownership, runtime topology and source versus publication.
- [Protocol](development/protocol.md): JSON commands and binary state framing.
- [Movement presentation](development/movement-smoothness.md): prediction/interpolation ownership and validation limits.
- [Server guide](../server/README.md): backend startup, tests and account/QA boundaries.
- [Marketing website](../website/README.md): its independent build and deployment.

## Art and content

- [Equipment assets](art/EQUIPMENT_ASSETS.md): binding, grips, motion, authoring and review.
- [Character delivery](art/UNEQUIPPED_CLASS_BASES.md) and [content provenance](art/CONTENT_PROVENANCE.md).
- [Procedural migration inventory](art/PROCEDURAL_MIGRATION_INVENTORY.md) and [cutover audit](art/FINAL_PROCEDURAL_CUTOVER_AUDIT.md): scope and remaining acceptance, not permission to remove fallback paths.
- [Animation coverage](art/animation-coverage.md): generated inventory; edit the input manifests and regenerate deliberately.
- [Content cadence](content/cadence.md) and [canonical-input table](../CONTRIBUTING.md#content-sources-and-checks).

**A dated file is not necessarily disposable history.** For example, [investigation story content](content/investigation-story.md) is still a generator input. Other canonical content remains under [server/internal/game/content/](../server/internal/game/content/), [src/data/](../src/data/), and the existing asset manifests. Keep generator inputs distinct from evidence records and edit canonical inputs before regenerating their projections.

## Testing and evidence

- [Check selection](development/contributor-map.md#choose-the-right-check) and [package scripts](../package.json).
- [Playwright configuration](../playwright.config.js): local origins, browser policy and credentialed artifact restrictions.
- [Connected System Chrome QA](development/browser-network-qa.md): private browser network and owned-resource cleanup.
- [Copied-client QA fixtures](development/copied-client-qa-fixtures.md): immutable publication versus test-only fixtures.
- [Live browser checklist](qa/live-browser-qa-checklist.md), [manual dungeon checklist](qa/dungeon-manual-qa-checklist.md), and [fresh progression evidence](qa/fresh-progression-evidence.md).
- [CI workflow](../.github/workflows/ci.yml): actual gates and event conditions. A pull-request check is not deployment verification.

Use disposable fixtures for destructive/reward/recovery tests. Keep credentials, production exports, raw private logs and credentialed recordings out of commits and public evidence. Report failed/skipped/unrun checks separately.

## Operations and release evidence

- [Linux deployment and incident procedures](../server/deploy/README_LINUX.md).
- [Administration](operations/administration.md), [beta operations](operations/beta-operations.md), and [monitor documentation](../server/cmd/monitor/README.md).
- [Current remaining-work register](plans/release-readiness.md) and [roadmap](../ROADMAP.md).
- [Feature-freeze review](records/2026/10/20/feature-freeze-review.md).
- [Latest documented Alpha 1.80.5 acceptance](records/releases/1.80.5/2026-11-16-acceptance.md).

Acceptance documents prove the named release and scoped checks at their recorded time. They do not establish current uptime, complete campaign quality, physical-device support, or beta/release approval. Check exact frontend/backend identities when verifying an authorized deployment.

## History and retained context

- [README before the November 15 navigation refresh](history/readme-before-navigation-refresh-2026-11-15.md): former feature overview, long integration guide, QA route explanations and release chronology, with links pinned to its source commit.
- [Architecture before that refresh](history/architecture-before-navigation-refresh-2026-11-15.md): retained earlier descriptions and dated measurements.
- [Earlier plan archive](history/plans/README.md).
- [Full goal and promise record](plans/goal.md) and [plans directory](plans/): preserve decisions and evidence; use the active guides and remaining-work register to determine what still applies.

## Licensing and attribution

[Licensing/fork policy](policies/licensing.md) · [Software license](../LICENSE) · [Asset license](../ASSET-LICENSE) · [Notice](../NOTICE) · [Provenance inventory](art/CONTENT_PROVENANCE.md).
