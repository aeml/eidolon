# Guardian Roar — consistent incoming protection

Unreleased1.1.0 candidate from primary506e3200. Main-agent inspection of the
accepted purchase/duration native screenshot exposed a0%damage-reduction card.
The underlying discrepancy was real: offline Fighter applies30%damage reduction,
but online RecalculateStats substituted20%armor; the network effect tracker only
set the timer, leaving the status card's offline strength field at zero. Earlier
Mastery/area acceptance explicitly did not establish equivalent protection.

Normalize on the existing offline30%incoming reduction, **replacing** the online
20%armor approximation, not adding another armor bonus. Caster, nearby friendly
players and eligible NPC recipients share that strength; duration/area ranks,
cost35mana, cooldown30seconds, taunt/boss permission and combo remain unchanged.
This is a deliberate protection balance/parity correction. It does not claim the
four-role dungeon is now balanced or alter the requested .01outside regeneration.

Server protection checks the actual end time at impact, following Fortress and
before shields. Environmental/reflected damage share the same protection step
without introducing absorption or recursive retaliation. Offline Roar uses
matching integral rounding and subframe impact expiry; periodic ticks now carry
their frame offset when Roar is active. Replicated effects set/clear the fixed
display strength, never changing authoritative HP/armor. The skill description
states30%protection and10seconds base duration. Expiry clears the display value.

RED: client5failed/4passed1.936s (owner/remote display, expiry, rounding, periodic
boundary); server0.620s reproduced absent mitigation/shield ordering and armor
substitution. First correction exposed the periodic helper's omitted Roar tick
offset and old armor-only area contracts. Fixed the actual offset path; updated
area/party/NPC/Mastery checks to assert real70-of100incoming damage instead of
an armor increase, retaining all range/body/deadline/point/taunt assertions.
Final focused client7suites81tests PASS4.313s; server race22.644s includes paid
caster/party actual attacks, area/missing/exact expiry, NPC support, hazards,
reflection, Fortress composition and shield order. Full lint/gofmt/diff pass.

The existing receiving-damage native helper/observer now also accepts a named
Roar profile, preserving Fortress defaults and evidence names. The Roar route
checks actual30%status text and adds ordinary Skeleton baseline→paid protection
→natural expiry hits after its normal/saved High/Low purchase checks. All input,
damage, armor and effects are observed; no injected hits, HP, timers or training.
Observer/regression2suites17PASS1.606s. Native and full CI still required before
integration. Low Skeleton damage can prove protection on/off without uniquely
identifying30%from integer rounding; exact strength comes from receiving tests.
Logs `/tmp/eidolon-roar-protection-*-20260912.log`.

## Native result

52996 on frozenbe6b1193 PASSED2.5minutes, zero retries. All normal/saved High/Low
area, trained duration/expiry and30%status checks passed. Ordinary Skeleton hits
were2/2/2 before,1/1/1 while protected, then2/2/2 after natural expiry; armor
stayed0 and the aura appeared/disappeared with the real buff. Exact35mana paid,
living town return. This establishes real receiving protection on/off; these
small integral hits do not independently distinguish30%from other reductions.
Archive `/tmp/eidolon-roar-protection-pass-fFwx65`; native log
`/tmp/eidolon-roar-protection-native-20260912.log`. Credential scan sanitized0;
owned containers/image and ports cleared after terminal completion. Main agent
viewed Low status screenshot and confirmed30%text. Its incidental4FPS snapshot
is not a performance pass or a demonstrated cause; performance remains open.
Full CI34712906594 is still running at this entry (client passed). Do not
integrate/publish based only on this scoped native success.

## Draft 1.1.0 patch note

- Guardian Roar now consistently reduces incoming damage by30%for its protected
  recipients, replacing the online armor-only effect. Its status card shows the
  correct protection, and damage-over-time respects the exact expiry boundary.
