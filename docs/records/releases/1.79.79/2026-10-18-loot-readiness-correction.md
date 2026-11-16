# Alpha 1.79.79 loot-readiness correction

Code: `b236ce7772d2b76b0cdc9dec964acadfa020db20`.
Only `tests/e2e/helpers.js` changes. Game runtime, assets, inventory rules,
pickup/persistence assertions, deadlines and configured retries stay unchanged.

Release source `d2aa9037` completed all ten CI run `39083907847` jobs and both deployments.
Fresh normal-TLS verification matched both 1.79.79 identities and all 394 asset pins
at 2026-10-18T01:52:20.437974Z. Its live test first failed manual pickup with the
authoritative bag 25/25 full and the selected item still on the ground. The existing
configured retry passed, leaving ten first-attempt successes, one recovered case
and one skip. The zero-flake acceptance guard refused the release. No acceptance
receipt or overview rewrite was produced; last accepted release remains 1.79.78.
Preserve the 56-file unaccepted inventory, SHA-256
`75b56fb7d12ba10100721c352762a9f19b1faea8d1f2919fe3a5667387261bdc`,
under the owned master's `.qa-release79-wardrobe` directory.

The helper prepared capacity before exercising the primary ability. Incoming
items during that encounter could legitimately consume the slot before the
later loot check. Move existing ordinary vendor/stash preparation after the
ability encounter and before the deterministic loot kill. Its existing encounter
waypoint follows preparation, so a stash fallback returning to town cannot leave
the next fight at a stale position. Full bags continue to reject pickups.

## Controlled native qualification

Two fresh, isolated Wizard accounts start with 24 ordinary spare items and one
owned protected stash item. An ordinary authoritative stash withdrawal fills
the bag 24→25 just before the first combat waypoint; it cannot satisfy the tested
pickup receipt. The old helper reproduces its exact manual-pickup quantity failure
with the item still on the ground. The corrected helper makes room after the
ability and collects the actual mouse-selected item.

Both control cases pass with zero retries in 93.248 seconds on System Chrome/AMD.
The corrected case verifies the exact quantity increase, 23 original spare items,
the protected filler, equipment and 43 EP. It observes saved Mongo logout before
fresh login and verifies the same pickup and filler afterward. Browser errors
remain a failing gate. The level 100 prepared fixture is not earned-progression or
campaign evidence, and the expected negative control is not a gameplay success.
API at 2 CPU/512 MiB and Mongo at 1 CPU/512 MiB run only on owned loopback ports. Actual caps,
credential sanitation and removal of both containers and the owned image pass.

Three earlier setup failures remain frozen: empty credentials from using an
environment-variable suffix as a username suffix; padded stash capacity counted
as item count; and a missing generated geometry worker. No pickup threshold was
relaxed. The canonical ignored worker is copied byte-exact from owned master
(`28b738ea…a95f03`); the generator correctly refused linked artifact inputs.

Eighteen frozen qualification files:
`/home/aeml/.local/share/eidolon-loot-readiness-20261018/.qa-loot-readiness-v4/qualified-evidence-inventory.json`,
SHA-256 `b8616868376253e7440adce1e4193ad9e8377043d9b5a713fee422ababa8d365`.
Its three immutable setup parents each contain twelve files. Do not rerun the
frozen writer or overwrite payloads.

Ordinarily merge the qualified fixture, refresh same-version correction notes and
publication controls in a new namespace, and run the changed source through its
own CI/deployment/live acceptance. Do not relax the zero-flake gate or rerun the
unchanged D2 workflow. Prepared 1.79.80 stays held until that acceptance succeeds.
Renderer experiments remain isolated and unselected. Full original goal and
1.11–1.99 scope remain active; soak/stress and human campaign/phone feedback remain
deferred, not passed.
