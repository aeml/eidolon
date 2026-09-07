# Alpha 1.0.40 predeployment correction — short Shadow Lunge

Corrected-combo candidate `1106228`, CI `34152138480`, passes unit/race and
anonymous browser checks but fails predeploy character gameplay. Rogue's mark
is accepted, then Shadow Lunge is accepted with no visible position change.
The retry also cannot hover the intended target. Every deployment is skipped;
Alpha 1.0.39 remains public. Do not bypass the failed gameplay gate.

## Runtime correction

The server moves the Rogue behind the target, but the local client ignores
ordinary position corrections inside its three-unit deadband. Teleport already
has an explicit landing contract; Lunge only emitted its aim point, so the
client could ignore a short movement and subsequently send its old position.

Lunge now emits its resolved target ID and a separate optional `landing` point.
Its target coordinates remain the aim point. The network payload mapper copies
the landing; explicit zeros remain present. The local client commits that
accepted point and clears stale movement/combat intent. Missing/invalid legacy
landings do not reposition the client. Other abilities keep their event behavior.
Range, dungeon walls, costs, cooldowns, bleed and runes are unchanged.

The gameplay test attempts multiple real hitbox points when an approaching
actor obscures the target's projected center. It still requires ordinary game
hover and keyboard casts, never assigns a target or bypasses casting. It adds
an exact client-versus-server landing assertion, retaining real movement,
attributed bleed and talent reconnect checks.

## Evidence and remaining release gate

- Original client regression: **4 failures / 1.520s**. Corrected Teleport/Lunge
  and malformed/legacy event cases: **15 / 0.989s**.
- Original authoritative event regression: **6.246s failure**. Corrected Rogue
  range/rune/bleed and dungeon movement-wall checks: race **16.036s**.
- First actual browser attempt finds the omitted production payload mapper;
  the mapper is corrected and its wire/zero-coordinate/copy-isolation tests pass
  three race repetitions **1.042s**.
- Corrected actual direct-skills route passes: Rogue **21.4s total**, Cleric
  **14.1s total**, credential scan (zero sanitized files) and disposable cleanup.
  Lunge's client landing exactly equals the accepted server point, and an
  attributed bleed tick occurs. This is prepared functional QA, not earned
  progression or physical-phone evidence.

Logs: `/tmp/eidolon-release40-lunge-client-before.log`,
`/tmp/eidolon-release40-lunge-server-before.log`,
`/tmp/eidolon-release40-lunge-server-after.log`,
`/tmp/eidolon-release40-lunge-gameplay.log` (mapper failure),
`/tmp/eidolon-release40-lunge-gameplay-final.log` (passing actual rerun).

Full final client/server/browser verification, sequential publication and exact
live verification are still required. Carry this correction forward through
41–48 only after it is verified; preserve the previous candidate branches.
The broader balancing and playable-investigation goal remains open.
