# Public-ready town recovery verification

The earned rest journey previously imported `/tests/collectionCombatReceipts.js`
inside the browser. Pages publishes index/assets/src/vendor and the service
worker, not the tests directory, so that observer could not run on the public
deployment. It now injects only the trusted self-contained read-only counter.
A VM regression verifies the serialized counter has no module dependencies.
No game actor, resource, clock or quest state is changed by observation.

The native journey now rejects all `/tests/**` network requests even against
the disposable server. It requires full starting resources, an actual hostile
damage event and below-maximum living HP, an accepted Fireball with spent mana,
normal Recall, both pools returning to their actual maxima, and earned rest
and aura persisting across login. A lowered maximum when Well Rested expires
cannot substitute for incoming combat damage. No shared localhost/server clock
comparison is used, and no test timeout is extended.

This strengthens, rather than replaces, the existing natural departure/bank
countdown, enemy hit, aura and reconnect checks. Ordinary registrations only:
no preparation commands, resource grants or forced kills. Separate expiry and
party journeys remain required. Exact public release identity checks and a real
public run remain mandatory before reporting production recovery delivered.

Initial Node24.18.0 checks passed26 tests in1.565s, lint and actual Playwright
test discovery. Discovery does not run the journey. Browser verification is
still outstanding at this commit; run it before carrying this test into release
acceptance. Logs `/tmp/eidolon-primary-public-rest-{tests,lint,discovery}.log`.
