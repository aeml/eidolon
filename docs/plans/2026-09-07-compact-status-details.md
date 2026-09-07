# Phone status details — a reading panel, not a blank window

Independent follow-up `work/status-compact-20260907`, based on the local 1.0.44
Shield package; not a packaged or published successor yet. The actual Shield
capture exposes a 496px-tall portrait panel for a single short effect. Its blank
area obscures the player while a reading surface need not occupy that space.

Three new rendered regressions fail before the CSS correction: empty panels
measure **496 / 258 / 188px**, versus content budgets **129 / 105 / 177px** at
390×844, 844×390 and 568×320. Failures complete in **1.8 / 1.8 / 1.9s**;
log `/tmp/eidolon-status-compact-before.log`.

Short panels now size to their content. Long portrait lists are limited to 38%
of the dynamic viewport and the existing control reservation; landscape keeps
its existing control-safe maximum. Effect kind and time share a row, while full
names and descriptions retain readable wrapping. No text or effect is removed,
and long lists still scroll independently. The new compact test joins anonymous
CI alongside the existing populated-list touch checks.

Combined compact and 30-effect scrolling/control checks pass **7 / 26.5s**;
all three compact layouts plus four established phone viewports are covered.
The inspected portrait one-shield panel ends above the encounter center and
retains a 44px Close control. Status lifecycle checks pass **9 / 0.508s** and
lint passes. Logs: `/tmp/eidolon-status-compact-after.log`,
`/tmp/eidolon-status-compact-client.log`, `/tmp/eidolon-status-compact-lint.log`.

Actual Shield gameplay passes **44.8s** on `54f4195`, with baseline/trained/saved
capacities **695 / 834 / 834**, normal expiry and **310** absorbed from a real
hostile hit. Zero-sanitization scan and exact disposable cleanup finish. The
inspected trained portrait capture shows the readable compact details above the
actual visible shielded Wizard, instead of the old blank panel over the hero.
Log: `/tmp/eidolon-status-compact-gameplay.log`. All local handles are closed.

Separate successor version/patch notes, final package checks and sequential
deployment remain open. This does not fix entrance occlusion or establish
physical-phone playability; keep those broader visual gates open.
