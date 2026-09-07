# Alpha 1.0.39 — your party within reach

Local candidate after preserved Alpha 1.0.38 source
`add49409a0b6fd845ebd7995aa462731b2a29271`. Not published. Keep separate ordered
release gates; do not push this work over a predecessor's live verification.

Implements the [shared camera/party prototype](2026-09-07-phone-camera-party.md):
CSS-owned encounter reservations and both-axis camera framing, a short-landscape
2×2 skill group, readable scrolling party controls, deliberate ally selection
for two direct support spells, accessible expanded chat and compact touch-through
combo notices. Desktop framing and enemy targeting remain separate.

The login label, package/lockfile, release metadata, Go/container/deploy/CI/QA
defaults and presentation checks advance to 1.0.39. Its patch notes precede the
unchanged 1.0.38 history. Populated camera/quest/party/chat regression fixtures join
the anonymous suite; two-disposable-account ally healing joins full predeploy QA.

## Verification

Earlier implementation evidence and retained failures are in the companion file.
Fresh versioned checks completed:

- Full client: **197 suites / 2,915 tests, 118.224s**,
  `/tmp/eidolon-release39-full-client.log`.
- Camera/HUD/status/populated encounter layouts: **10 tests, 1.2 minutes**,
  `/tmp/eidolon-release39-layout.log`. Short-landscape combo capture inspected:
  it sits below the hero, outside the thumb controls, and remains touch-through.
- Lint, shell syntax and whitespace pass. Server race suite passes (root
  **9.929s**, unchanged game package cached),
  `/tmp/eidolon-release39-server.log`.

The first full anonymous run completed **47 passed / 3 failed in 6.2 minutes**,
`/tmp/eidolon-release39-anonymous.log`. The three phone Menu fixtures still tried
to read the bounding box of the deliberately removed duplicate ability icon.
They now check the replacement Party launcher's 44px size and status separation,
the primary Skill button's actual hit target, and Party → Close → Menu handoff. They also
collect browser errors and dispose the new party surface. No runtime behavior or
unrelated assertion was changed to accommodate these failures.

The first corrected repeat was deliberately interrupted (exit 130, 18 passed /
one interrupted / 31 unrun, 3.9 minutes) after identifying a new fixture mistake:
it tried to tap the HUD Menu button behind the full-screen Party panel. The actual
phone path is its visible Close button, then Menu. That correction and a 12-second
action timeout pass all **3 layouts in 26.3s**;
`/tmp/eidolon-release39-menu-corrected.log`. Retain the interrupted log
`/tmp/eidolon-release39-anonymous-final.log`; it is not a full-suite pass.

Final normal two-thumb enemy combat passes **2 tests in 18.7s**, checking deliberate
selection, actual damage, movement/casting together, pursuit takeover and target
clearing in portrait/landscape. Final two-account support passes **18.9s**, checking
both spells in all three sizes, with normal invite/accept/leave. Browser errors,
credential scans and exact temporary-service cleanup all pass. Logs:
`/tmp/eidolon-release39-combat.log` and `/tmp/eidolon-release39-party.log`.
Inspected actual 390×844 and 568×320 support captures confirm the compact combo
placement. Long remote-actor floating names can still overrun the portrait view;
that retained finding needs a separate nameplate/attribution pass, not a claim
that group readability is finished. The visible performance overlay is QA context.

A final full anonymous pass is running before this candidate can be considered
locally verified. No game runtime changed during the fixture corrections. Final
lint after those corrections also passes.

That current full repeat encountered a separate module-load failure in the
360px Menu fixture. Its trace records many `net::ERR_NETWORK_CHANGED` failures
at **08:34:46 UTC**, before the fixture could import UIManager; the 844px and
568px Menu cases then passed. Retain
`/tmp/eidolon-release39-browser-network-change.zip`. This is not another layout
assertion failure, and the source of the host/browser network notification is
not established. That run finished **49 passed / 1 failed in 5.0 minutes**;
`/tmp/eidolon-release39-anonymous-verified.log`. The unchanged full rerun passes
**all 50 tests in 5.0 minutes**;
`/tmp/eidolon-release39-anonymous-network-rerun.log`. Its process is terminal and
successful. The read-only network-link monitor recorded Docker bridge/veth events
during this passing run, `/tmp/eidolon-release39-network-links.log`; it did not
alter interfaces or filter browser errors. Those events alone do not establish
the earlier failure's cause. The monitor was stopped after browser completion.

All candidate verification is now complete locally after the retained fixture
corrections and unchanged network rerun. Ready to commit and preserve separately;
publication remains behind 1.0.34–38, after 1.0.33's full live verification.

## Scope still open

This is not the full 1.1 phone gate or 1.2 visual redesign. Physical iOS/Android
default-view play, two-thumb party/dungeon pressure, keyboard and interruption
handling, remaining town/social menus, broad class/talent parity and the rest of
the 1.1–1.10 roadmap still need their own evidence.
