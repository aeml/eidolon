# Earned campaign continuation with a real party

Active: `earnedparty0920c`, clean3b163421, native63326,
`/tmp/eidolon-earned-party-20260920-r3-2CzUJB/`, Luna-monitored. Same verified
pre-dungeon level31 archive, Low, zero retries, full dungeon and claim checks.
Do not overlap native browser runs or alter loaded files while it is active.

Next-region preparation: detached commit733621eb in
`/tmp/eidolon-earned-continuation-20260920-0VmRVz/` extends the existing hunt
search to Water's authored Troll/Aqua Golem bands. Missing Ferry still searches
western Earth; later Water hunts require an explicit ordinary town-departure
callback, reused for recovery.26 focused target/travel tests pass in1.267s;
lint/diff pass. No connected Water acceptance is claimed. Merge only after the
active dungeon ends; checkpoint capture and actual regional travel remain next.

`earnedparty0920b` is terminal exit1 after2.8minutes on cleanee9a1ddd.
Native52518 and the log footer confirm termination; reports/results are retained
in `/tmp/eidolon-earned-party-20260920-r2-XoHW0R/`, owned services are gone.
The actual saved-handoff check passed at31/12448XP/9047Gold, and all four entered
the same dungeon. Initial combat passed with everyone alive; a formation check
stopped traversal before the next pull. No full clear or claim is accepted.

The recorded Cleric/Rogue positions were just beyond the five-unit gathering
boundary. The planner offered valid final steps shorter than one unit, but the
new visible-prefix filter rejected them. A focused reproduction using those
exact coordinates, actor collision checks and real projection failed before the
fix. The strict-arrival caller now admits steps down to its0.25unit tolerance;
ordinary displacement-only callers retain the one-unit minimum. The original
five-unit gathering limit,15second deadline and precise arrival checks remain.
The reproduction and81 related tests pass in0.881s; lint/diff pass.
Use the verified pre-dungeon level31 checkpoint for the corrected route; the
failed partial dungeon is not claimed as a successful or resumable clear.
Its private archive is `/tmp/eidolon-party-checkpoint-earnedparty0920b-d4iF9Q/save.archive.gz`,
SHA256`d2354439975cc985bcc0cf83be239b7888d2cfdef2ccd1a4186392f096c0478b`.

## September20 saved-read correction

`earnedparty0920a` is terminal exit1 after3.5minutes, before dungeon entry.
Native35451 and `PARTY_PROCESS_EXIT=1` agree. Results/report are preserved in
`/tmp/eidolon-earned-party-20260920-2zClmS/`; owned services are gone.
The four remaining kills and manual reward **are saved this time**:
Wizard31/12448XP/9047Gold, Orc50/50 completed, dungeon accepted at0/1.
An isolated real Mongo restore confirms these exact fields and the correct
account save key. This is not the earlier unsaved level31 attempt.

The verification reader threw `TypeError: "this" is null or not defined` in
mongosh when optional chaining followed the database call. Separating the
lookup from field access fixes the real reproduction.32 focused isolation,
transfer and cleanup tests pass in1.057s; lint/diff checks pass. The latest full
archive contains prepared teammates too, so the transfer now selects exactly
one Wizard document and still requires its checksum and exact earned fields.
Actual restore/whole-character copy/readback into a new QA account also passes.
No gameplay, rewards, inventory or logout timestamp is synthesized.

New valid private continuation archive:
`/tmp/eidolon-party-checkpoint-earnedparty0920a-JV9eGg/save.archive.gz`, SHA256
`c3cca5c86852d354fc13b3e8f4c48513c5ff083153608866a45c5afdb358c673`.
Use this level31 save next; do not repeat the four kills or manual reward.
Full party dungeon clear and post-claim save remain unproven.

## Earlier continuation record

The September14 Earth readiness result remains accepted. Its private full save
at level30/7170XP/8539Gold, Orc46/50 is retained with verified SHA256
`be0c40ad5c8ff6cc42cb2dbb42e23bb07ad721814959f3f8e518b21ecaeb765c`:
`/tmp/eidolon-earned-earth-r2-20260914-1c1qRm/earned-earth-r2-level30.archive.gz`.
Do not substitute the older build-only JSON fixture or replay the opening.

September20 attempts revealed a disposable-account identity mistake. The first
finished the four kills and claimed level31 in memory, but preserving the old
character name prevented normal saves to the new account. Its Mongo archive is
still level30; a second attempt correctly refused to call it level31. Both runs
are terminal, their reports retained. These are not new saved-readiness passes.

The fix remaps only the character name to the new account's required save key.
Inventory, equipment, currency, XP, quest progress, resources and logout times
remain the original snapshot. Normal Leave Party controls remove the old
account's solo-party association. Real isolated Mongo restore/copy passed;
focused isolation, save-transfer and cleanup checks passed. Readiness must now
match actual saved Mongo level/XP/Gold and quest state, not only a warm reconnect.

The next route is `earned-party-dungeon`: restore the Wizard, finish the four
unsaved kills/manual handoff, verify its saved readiness, then form a normal
four-player party with prepared level30 Fighter, Cleric and Rogue. Those three
retain the approved class-appropriate Rare/Uncommon equipment; the Wizard keeps
only its actual earned build. Complete the full Normal30 Verdant dungeon,
individual manual claims, next Water offer and the Wizard's actual database
receipt. No forced deaths, additional rewards, stat scaling or instance-expiry
changes. This is earned Wizard progression with prepared support, **not** four
independently earned characters or acceptance of the party leveling curve.

Implementation merged asbd96dfe0/b038eb98 after Fire ended. The53 focused
fixture/isolation checks pass in3.405s, lint/Bash/diff checks pass.
`earnedparty0920a` ran on cleanb038eb98, native35451, launcher/log directory
`/tmp/eidolon-earned-party-20260920-2zClmS/`, monitored by Luna. It uses the
original private archive above, Low graphics and zero retries. The wrapper
preserves the final full save. Never overlap it with Fire or deployment browser
QA; it ended with the saved-reader failure described above, not a full clear.
