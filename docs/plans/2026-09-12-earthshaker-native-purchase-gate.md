# Earthshaker native purchase gate — authored, not executed

Runtime parent `e39599d9`. This is a prepared town/phone purchase-and-rendering
check, not earned leveling, dungeon damage or remote-party combat acceptance.
Those remain separate required evidence before completing 1.1.0.

The `earthshaker-area` isolated route owns one fresh allowlisted Fighter, uses
system Chrome through the existing launch policy and explicitly disables
retries. Full stage timing retains existing Whirlwind and adds this route once
before phone coverage. Do not confuse discovery with native execution.

## Physical workflow

- Only `/level 100` prepares the character. Ordinary phone UI selects branch B,
  buys FTR_14 rank0→1→5, FTR_33 five and FTR_38 five, spends exactly15 points,
  and verifies max-rank buttons disabled. No rank grants, ability calls, effect
  injection, mana resets or cooldown resets are used.
- Ten hotbar casts cover trained circular radius6→6.12→6.6→7.5→8.1, both
  High/Low Fissure, Aftershock, Seismic, actual fresh-document saved login and
  phone portrait/landscape. Normal town mana recovery and cooldowns separate
  casts. Fresh login retains points and the chosen Aftershock rune.
- Read raw accepted origin, heading, shape kind, radius, phase and mana receipt.
  Read actual rendered world matrices for circle radius, Fissure's four strip
  boundaries, length, half-width and heading. Require visible attached
  acknowledged frames, real delayed phase, same original pulse origin and
  eventual effect expiration. Screenshots and JSON observations are attached;
  timeout paths retain their observations too.

The observer forwards production handlers once, retains missing/rejected raw
receipts, never synthesizes accepted geometry, and does not mutate gameplay.
Unit tests deliberately contradict metadata with the actual mesh to prove it
measures rendered geometry, not the desired radius. Reinstallation resets only
observations; exceptions remain exceptions and prediction is not auto-accepted.

## Authoring verification

Six observer tests pass; two initial missing-route tests fail (3.133s). Add
allowlist, no-retry route and full-stage timing enrollment. Final five suites /
74 tests pass in6.949s, full lint, shell syntax and whitespace checks pass.
`npm run prepare:client` prepared this worktree's ignored browser assets.
Playwright `--list --retries=0` discovers one test; no browser was launched.

Logs `/tmp/eidolon-earthshaker-native-{red,focused,lint,prepare,list}-20260912.log`.

Production CI34683452640 still owns the GPU. Execute only after the production
workflow releases it and the higher-priority four-role dungeon attempt has
been handled. Native acceptance, sanitizing/reviewing its artifacts, exact
hardware identity, live acceptance and remaining roadmap scope are unproven.
When combining with the separately authored Whirlwind-area route, retain both
once in the timing arrays/full route; do not discard either during integration.
