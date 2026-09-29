# Presentation integration and equipment-readout correctness

Local follow-up to eaa388a4. No deployment or milestone completion claimed.

## Integration

Client dependency preparation and full repository ESLint pass. This is a static
ES-module client, not a bundled frontend; there is no npm build script.

Added desktop combat dock, item inspection and minimap readability to the
existing required hosted interface stage: four new browser cases, no new job
or queue. Exact discovery verifies199 required cases with no omissions or
duplicates across the existing three hosted jobs. This does not mean every
test file in the repository belongs to that required set.

Added five previously unregistered visual-reference files (12 discovered cases:
humanoid/skeleton batching, moving casts, town court, Verdant room, elevation
preview) to the existing opt-in full-stabilization animation command. They were
not rerun en masse. Authenticated desktop/Bastion routes stay in their explicit
disposable QA workflows, not the anonymous hosted job.

## Correctness gaps fixed

Item hover and inspection now count only active supported equipment toward set
bonuses, matching Actor recalculation and the comparison panel. Inactive legacy
items remain saved and recoverable. Comparing a replacement no longer subtracts
stats that an inactive stored item never granted; the panel identifies that
item and says its stats are excluded. No combat/stat/save changes.

Known special effects use their player-facing names, with unknown identifiers
retaining a text fallback. An initial assertion expected the old lowercase
guardian identifier; updated it to the actual Guardian display name.

## Checks and limits

- Initial52 selected checks had one expected-text failure above; the other51
  passed. Final21 inspection/comparison/inventory tests pass8.382s, including
  legacy-slot/mismatched-slot set counts, inactive comparison and unchanged saves.
- Integrated four new required browser cases pass37.4s; final strengthened
  inspection pair passes15.2s after active-gear handling. Artifacts:
  /tmp/eidolon-interface-integrated-0929 and
  /tmp/eidolon-inspection-active-gear-0929.
- Full lint passed before the last small comparison correction; final scoped
  lint/whitespace pass. Package version remains1.38.0 in the candidate; root's
  older version remains untouched when mirroring script keys.

1.45 remains partial: journal, trading, forge, notifications and complete
loading/error/focus/interaction review still need consolidation. Earlier1.39/
1.40 human-evidence policy question remains unanswered; no gate waiver inferred.
No new campaign soak, numeric tuning, backend mutation, push or deployment.
