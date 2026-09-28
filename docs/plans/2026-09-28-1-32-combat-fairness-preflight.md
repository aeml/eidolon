# Alpha 1.32 — combat fairness review

Local implementation review, not versioned or deployed.1.30 is accepted live;
1.31 is published at36c82ebd awaiting CI and exact public verification. Keep
later build, bag, Forge and economy changes separate from this milestone.

## Offline summon stun correction

Offline Seraph AI runs before Actor's status update. It could launch Smite while
stunned, before the base class reached its stun gate. A focused reproduction
failed before the fix. The summon now stops movement and skips attack selection
while stunned, but continues lifetime cleanup and the normal status update.
Attacks resume on the next update after stun expires; stun cannot extend summon
lifetime. Server-owned replicas and damage amounts are unchanged.

OfflineSeraph and AvengingSeraphEffectSceneGuard passed 28 checks in 1.025s;
scoped ESLint and whitespace checks passed. Existing server enemy-impact reach,
dungeon pattern boundary and projectile wall/doorway checks passed in 0.637s.
The server selection did not match a Seraph stun test: it is not evidence of
server summon crowd-control coverage.

Further fairness review and release integration remain. This correction does
not establish that every encounter, visual footprint or supported view is fair.
No campaign, raid replay, tuning curve or live account mutation was needed.

## Warning transport correction

The live event adapter copied only part of TelegraphEvent into TelegraphPayload:
it dropped the authored movement hint and additional-circle silence flag. It
also broadcast every warning globally with no cast-time instance identity.
The client accepted all warnings, including those delayed across a transition.
Three new wrong-instance client cases failed before correction (4 controls passed).

The wire type now shares the event contract, retaining hints, silent circles and
an explicit instance ID. Boss windups and all Meteor variants capture their
original instance. The hub restricts warning recipients to that instance,
including the empty overworld scope; other global broadcasts remain global.
The client independently rejects queued warnings from a different instance.
Legacy payloads without a scope remain accepted for rolling compatibility.
No radius, damage, timing, monster health or currency change.

The actual production broadcast encoder is tested for complete round-trip fields
and empty/nonempty scope. Real boss windup and paid Apocalypse emitter checks
verify instance retention. Server wire checks passed 0.025s; selected game
emitter checks passed 7.168s. Seven client warning cases passed 1.265s. Scoped
ESLint and whitespace checks passed.

Separate existing impact/wall/all-realm-projectile/party-escape tests and the
expanded server Seraph stun/resume lifecycle check passed 2.863s. Five client
geometry/telegraph/summon suites passed 51 checks in 2.491s before the six new
warning cases. These are bounded mechanics checks, not a new dungeon-clear or
phone playtest receipt. The four-player escape fixture confirms an actual
telegraphed hit can be avoided and overlapping circles do not stack damage.

Packaging note: the earlier 1.31 friendly recipient guard was separately staged
and committed in d3c978a2. The remaining ability_helpers.go diff is the 1.32
telegraph signature/scope; keep it with ability_wizard.go's updated callers.

## Shared-overworld relevance

Instance filtering alone is insufficient in the shared overworld: a boss in
another realm could still overwrite the local combat warning. The client now
ignores circles wholly outside the locally loaded square, with a full chunk
margin and the warning's radius included. Large distant circles that overlap
the local area are retained; dungeon warning scope is unchanged. It uses the
current chunk manager's size/distance, falling back to the canonical constants.
The remote-overworld repro failed before correction. Three affected warning
suites passed 28 checks in 2.108s afterward; scoped lint/whitespace passed.
This avoids irrelevant feedback; it is not a server bandwidth optimization or
a claim of measured maximum-population performance.
