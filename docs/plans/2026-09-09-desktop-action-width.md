# Bounded long desktop action labels — later polish candidate

Separate from recovery58. The retained real Fighter duel screenshot
`/tmp/eidolon-rest58-duel-mana-failure-BMUpaP/test-results/pvp-cadence-gameplay-Fight-9a5fa-acks-without-ranked-rewards/arena-combat.png`
shows a long account-name/action label stretching across the combatants. Those
QA names are unusually long, so this is not a claim that every ordinary name
causes the same amount of clutter. The renderer nevertheless allowed any desktop
player label to remain a single enlarged unbounded line.

The candidate routes labels longer than32UTF-16 code units through the existing
compact identity/action treatment used by phones and Seraphs. It retains the
complete string in accessibility text and the full source in the DOM; only the
visible source row ellipsizes. Short desktop labels retain their inline style.
Local long-name feedback keeps its action without a redundant source row. The
existing192pixel card, bounded1.12pop scale, above-model anchor, viewport clamp,
non-interactive pointer policy, text pooling, event throttles and expiry remain
unchanged. No name, network event, combat rule or numeric damage text is changed.

47586 behavioral baseline failed four new long-name dispatch cases while68
existing checks passed. After the small dispatch change and two exact32/33
boundary cases,9427 passed74tests/2suites/1.275s plus lint. Logs
`/tmp/eidolon-desktop-long-action-{before,after,lint}.log`.

Prepared `desktop-action-readability.spec.js` uses real Cleric/model/text/render
components at1280×720 and1920×1080. It saves measured bounds/screenshots before
asserting width, complete source/action/accessibility text, readable font,
viewport containment, non-interception and cleanup. Optional
EIDOLON_E2E_DESKTOP_ACTION_BASELINE=1 loads exact pre-change2505b3 dispatch for a
controlled before comparison.49710 lint/discovery passed, two cases discovered;
neither baseline nor corrected browser scene has run yet. A component fixture is
not live PvP/group readability or physical-device acceptance.

Full client regression, actual rendered comparison and broader party/raid visual
review remain due. Do not import this into58 or publish inherited1.0.57metadata.
