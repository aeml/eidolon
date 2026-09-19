# September 19 — roadmap resumption

The interrupted permission-check turn made no progress; access is now restored.
Reconciled current files and external results before resuming old tests:

- Root is clean `work/fighter-charge-20260915`, based on production
  `5c714e19460bf53b59c81afabf7aa61567608dd1`, not the archived ledger-only master.
- Alpha1.9.15 added administration;1.9.16 doubled Fighter Charge impact.
  CI35036376369 for1.9.16 succeeded in all ten jobs, including live character QA.
  Both public domains report that exact SHA/Alpha1.9.16; database ready.
- The September14 public-event run27229 is gone and its log records terminal
  failure after22.92s (one prepared Wizard died). Do not restart that old test.
  The September15 recovery report and corrected test record a later full Air
  event acceptance with four geared characters, all waves/champion and saved
  progression. Retain that narrower scope, not an all-realm balance claim.
- Nightly35418625861 is an independently scheduled100-client soak, not a stuck
  release pipeline. Leave it alone. No local browser/QA containers were active.
- The user explicitly chose to keep the15-minute dungeon logout rule. Source
  `server/client_dispatch.go` still implements it. No runtime change needed.

Next concrete unfinished acceptance is the actual five-player Rootheart raid:
ordinary formation/readiness, assault/guardian, three repair waves, individual
manual turn-ins and saved re-login. Use the existing legal5Rare/9Uncommon role
fixtures; do not increase stats/rarity or grant completion to make the test pass.
The corrected Maelin hostility and boss-identity driver are already inherited.

Full1.10 is not complete: remaining regional dungeon/raid and earned-campaign
integration, finale and the outstanding cross-feature/mobile checks remain as
tracked in the final integration audit. Phone Brave/Chrome general UI feedback
does not prove phone dungeon/party play. Reuse accepted evidence; do not repeat
whole matrices, accepted releases, or public-event preparation unnecessarily.
