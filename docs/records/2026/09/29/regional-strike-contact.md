# Regional armed enemy contact — local 1.43 candidate

Extended the legacy review across33 regional enemies and dungeon bosses.
Actual weapon-bound samples found26 armed rigs whose release swept behind
their +Z target direction. Reversing only the right-arm attack X track gives
backward anticipation and a forward release. Explicit reviewed contact times
now align those releases to the existing35% basic-hit delay, using Actor's
existing scaler. No animation key times or other tracks are changed.

Covered: all four Moonfrost enemies; SandstormDjinn, MagmaGolem,
ScorchedWraith, CloudElemental, TempestGiant and CycloneAvatar; all four
Thorncrypt bosses; ScorchedTwins, ForgemasterPyrax, ObsidianGuardian and
LordInfernax; Windshear, Stormcallers, ThunderlordKaelix and Zephyrion;
DrownedChoir, AbyssalGoliath, MaelstromWarden and Thalorath.

Explicitly excluded: InfernalBehemoth, PhoenixSentinel, ThunderRoc, StormHarpy,
Cindermaw, RocMatriarch and TiderendLeviathan. Some have empty weapon nodes;
others use beaks, quadruped jaws or wing-mounted parts. A generic arm flip is
not evidence of a correct bite/wing strike. These need separate authored review.
Unknown/imported actors remain untouched. A missing contact key on a reviewed
rig fails clearly instead of silently selecting another frame.

Verification:188 focused checks across nine suites passed7.823s. They cover
actual weapon-bound anticipation/contact at two intervals and facings, recovery,
movement resume, untouched non-attack tracks, excluded rigs, player/legacy
regressions and six families' geometry/resource/hitbox contracts. Initial test
serialization used an unavailable instance method; corrected to Three's static
KeyframeTrack.toJSON. No production relaxation was needed.

The two existing combat browser cases now sample Rootbound Warden alongside
the Skeleton reference. Final desktop/phone cases passed23.6s. Desktop
windup/contact and phone contact captures inspected in
`/tmp/eidolon-regional-strikes-0929`. They are prepared runtime poses on an
Earth scene, not dungeon mechanics or a server-earned hit. No new browser
cases or long run. Scoped lint/whitespace checks passed.

No damage, cooldown, boss mechanic, geometry, collision or server change.
Local candidate only: no runtime bump/deployment, release-gate waiver or final
visual acceptance. Full roadmap and the remaining distinct creature poses stay open.
