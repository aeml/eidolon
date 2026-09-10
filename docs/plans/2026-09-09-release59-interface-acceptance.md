# Alpha 1.0.59 — clearer quest and combat interface

Status: local candidate, **not pushed or deployed**. Parent is accepted production
ef9a638 (Alpha1.0.58). Recovery, save schema, rewards, quest catalog, drop rates,
leveling and combat formulas remain unchanged. This is a staged interface release
within the full roadmap, not completion of the campaign/balance/visual goal.

Includes collapsible optional daily guidance with ready/accepted-first ordering,
independent archive/focus state, phone-stacked daily labels/rewards and readable
target names; target levels, honest attack-power/configured-MP information, and
bounded long desktop action labels. Daily summary offers collapse by default with
an active story; accepted contracts default open unless the player closed them.

Ports9b168be and4bb3bd1, plus the target-level engine/UI portion ofaf82670 required
by the card's existing phone test. No earned-encounter selection changes imported.
Portc854f8e with only its independent plural-label/phone-row dependencies; do not
import expanded investigation rendering, optional-legacy quest handling or new
quest data. Presentation fixture uses the existing Seeds of the First Grove
chapter, not the unshipped diary. Fixture rewards are illustrative UI inputs, not
an assertion of actual server payouts.

The source conflicts were limited to engine-card tests and journal/tests. Preserve
both new cache/target-level tests and existing tracking focus behavior. Focused
97511 passed128tests/5suites3.279s. Login/package/manifest/build/deploy defaults and
patch notes now identify59; the prior recovery notes remain intact. CI runs all
six interface browser cases on shard2 in addition to every existing gate.

Required before release acceptance:

- [x] Full client tests/lint, generated-client preparation and full server race tests.
- [x] Six actual interface browser cases, inspected desktop/phone screenshots and
  retained/sanitized report; focused tests are not rendering evidence.
- [x] Review exact diff against58, including no server gameplay/economy changes.
- [ ] Normal push from this canonical release branch only after local gates;
  verify all CI, full predeploy, deployment and final native live QA stages.
- [ ] Fresh matching public manifest/login/runtime GET and healthy backend identity;
  inspect live quest/combat interface without grants to ordinary player accounts.

Do not borrow acceptance from the primary prototype or declare58's current
production identity to be59. The full expanded-story route remains independently
under test in the primary worktree.

## Local release evidence — September9,22:55UTC

On code2ee769e, full71211 PASS253suites3595tests122.349s plus lint and prepare;
full98362 server-race PASS root19.679/game331.636/database1.122/lifecycle1.043s.
Logs `/tmp/eidolon-release59-full-{client,lint,server}.log`, prepare log separate.
Focused version40528 PASS234tests1.409s+lint; earlier interface97511 PASS128/5.

Hardware browser97435 PASS6/19.6s. Visual review found an incomplete presentation
fixture: it omitted collection type/objective and displayed "Defeat" seeds.
Corrected only that fixture with the actual catalog objective/type, added an
assertion against that misleading text, and reran lint plus all six cases.
67774 PASS6/19.9s; `/tmp/eidolon-release59-interface-final.log`, archive
`/tmp/eidolon-release59-interface-proof-xvxcgY`, scanner0/port41961absent. Desktop
and phone cards/journals and both desktop label sizes inspected. Original proof
retained at `/tmp/eidolon-release59-first-interface-proof-z5L3I1`. These are real
browser presentation fixtures, not earned gameplay or physical-phone sign-off.

Server diff against58 contains only version defaults; all server game/economy
code remains identical. No runtime changes followed fullclient/server proof.
The release also carries the user's planned casino scope, with no casino code or
new currency, and corrects stale roadmap recovery status. Full roadmap stays open.
Previous release34361293407 freshly confirmed alltenSUCCESS; public client/backend
still58/ef9/ready before this successor push. New CI/deploy/live proof remains due.
