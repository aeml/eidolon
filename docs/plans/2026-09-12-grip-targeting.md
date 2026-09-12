# Unbreakable Grip Technique and target admission — 1.1.0 candidate

Builds on the separate FTR_15 Mastery correction. This completes the identified
Technique range consumer and offline target-selection implementation, not the
remaining native/full-regression/dungeon acceptance gates.

FTR_16 retains +3% cooldown reduction per rank and now applies its +2% to the
single-target cast range (10 to 11 units), rather than an unused area bonus.
Generic area talents do not enlarge this single-target range. Server targeting
uses a normalized temporary rank map, retaining saved state and rank caps.
The client controller uses the same trained range and planar distance minus
target body radius, so raised terrain does not force extra chasing.

Offline casts select an active, living hostile in the current instance within
both body-padded range and the existing three-unit body-padded cursor tolerance,
with a continuous walkable segment. Invalid, missing, locked, malformed, remote,
other-instance, friendly or blocked selections fail before mana, cooldown or
presentation. Selecting an immune enemy still spends the valid cast normally,
but respects control immunity and immovability. Pulls never push a close target
outward, and roots do not inflict damage or silence ordinary attacks. Multiplayer
does not predict the server-owned pull or root.

Both target selectors choose the nearest eligible center; a farther large body
cannot steal a closer eligible target. The accepted event publishes the selected
enemy's original location, not a nearby cursor coordinate or its pulled landing.
No new protocol fields are required. Offline initial presentation uses that same
selected enemy rather than an unrelated cursor location.

## Evidence

Paid server RED2.987s: four trained edge casts rejected and one accepted endpoint
misrepresented. Rank0 and exterior rejection controls remained. Offline RED
13fail/4pass1.005s. Corrected initial client5suites83PASS5.501s and serverrace
18.120s; expanded client5suites84PASS4.788s and serverrace16.702s include actual
paid casts, trained edges/exteriors, controller floor/body distance, invalid
selection without resource use, walls, nearest-center selection, prior Mastery,
immunity, near-target and duration checks. Additional ordinary Technique
purchases through five one-point ranks, rejected sixth, malformed cap/foreign
exclusion and immutable saved map pass with race checking in1.771s.

Full lint and whitespace pass. Logs
`/tmp/eidolon-grip-targeting-{server-red,client-red,server-green,client-green,server-final,client-final,purchases,lint}-20260912.log`.
Hosted full regression and native real purchased range/visual/party combat are
pending. The separate four-role dungeon run is frozen at e39599d9 and does NOT
contain these changes. No retrospective claim for that run or live release65.

Proposed 1.1.0 patch note: “Unbreakable Grip's range upgrades now work, and
targeting consistently respects enemy bodies, walls and elevated terrain.
Offline invalid targets no longer consume mana or cooldown.”
