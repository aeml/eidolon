# Legacy enemy strike direction and timing — 1.43 candidate

Reviewed Skeleton, DemonOrc, Imp, Construct and InfernoTitan basic attacks.
Their authored release key played at about62–65% of the cooldown, while
server and offline damage lands at35%. Weapon-bound sampling also showed the
release sweeping behind the actor's +Z facing, not toward its target.

Corrected the right shoulder/elbow X tracks so anticipation draws back and
release swings forward. Each reviewed model now identifies its contact key;
the existing Actor contact-time scaler aligns it with35% of the unchanged
attack interval. Recovery finishes within that interval and holds without
restarting the swing. Position, collision, damage, cooldowns, server hit delay,
death/movement clips and unreviewed/imported model playback are unchanged.

Evidence: five new runtime-mixer regressions first failed against the old
timing. Final39 focused enemy/player contact, animation-state and hit-reaction
checks passed2.714s;22 existing family geometry/clip/resource/hitbox checks
passed1.39s. The new checks sample actual weapon bounds behind during windup
and ahead at contact, at1s/4.2s intervals and two actor orientations, then
verify recovery and return to movement. Scoped lint/whitespace checks pass.

Two existing desktop/phone combat browser cases now capture Skeleton windup,
contact with player recoil, and recovery alongside their health/death checks.
Initial desktop review failed because screenshot latency consumed the real
recovery timer between samples. Each prepared pose now starts independently;
runtime timers are not modified. Final cases passed20.5s. Desktop windup/contact
and phone contact captures inspected in `/tmp/eidolon-enemy-strikes-reviewed-0929`.
These are prepared runtime scenes, not a server-earned hit or full combat-feel
acceptance. Other enemy families still require their own pose/timing review.

No new browser cases, long encounter run, runtime version bump or deployment.
Ordered release gates and the full roadmap remain open.
