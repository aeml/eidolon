# Verdant expedition boss budget — 1.1.0 candidate

## Evidence and design decision

Repeated Normal Verdant runs used four level30 roles, production-created Common
gear, normal paid skills, real input and town recovery between rooms. They failed
at the first boss after the party exhausted its mana. The latest automation-only
run39948 lasted7.8minutes overall, with226.5seconds in the Warden encounter:
last boss reading1465/15000HP, tank dead, healer12mana and both damage dealers
near10mana. The tank recorded14early warning escapes; the fatal warning was
still late. This is not a perfect-play proof that the boss is impossible, nor
does it justify changing combat rules merely to satisfy a test. It does show
an overly tight introductory encounter budget for this intended party setup.

The candidate reduces health for all four Verdant bosses by40%, preserving
relative depth, damage, attack cadence, movement, telegraphs, full room sequence,
reward/credit handling and difficulty ratios. At level30 Normal:

| Boss | Previous HP | Candidate HP |
|---|---:|---:|
| Rootbound Warden | 15,000 | 9,000 |
| Briar Matron | 16,800 | 10,080 |
| Rustbound Colossus | 18,750 | 11,250 |
| Hollow Sentinel | 21,750 | 13,050 |

This is a provisional expedition budget, not accepted balance. It aims to end
the introductory fights before they become long mana-starved cleanup while
leaving lethal mistakes and a meaningful healer/tank role. The final boss remains
45% tougher in health than the first. Heroic/Mythic retain their existing health
and damage multipliers relative to Normal. All other dungeon families, raids,
Dark Realm, overworld enemies, players and equipment are unchanged. In particular,
outside regeneration stays .01 and town recovery remains the intended loop.

## Verification and acceptance

- RED reproduced the old health budget in all four named bosses. Scope checks
  span every catalogued boss, levels30/60/70/100, all three difficulties, and
  unchanged trash/elite profiles. These are configuration checks, not a clear.
- Candidate also includes the already accepted primary class fixes and latest
  party control observations; no fixture stats, grant, clock, timeout, mortality,
  per-member credit or manual turn-in assertions are relaxed.
- Required: focused/full CI, native full four-role clear, individual quest/XP/
  gold credit and manual Water handoff. Record town-rest burden, role healing/
  damage and per-boss time/resources. Check multiple seeds and relevant difficulty
  progression before claiming this closes broader balance gates.
- Re-evaluate rewards per minute alongside the wider first-hour reward audit.
  Shorter encounters alone are not evidence of a sustainable economy.

Logs use `/tmp/eidolon-verdant-budget-*-20260912.log`. No production deployment
or accepted full clear is claimed by this document.

Focused verification: server race27.169s PASS, including budget/scoping,
rank/difficulty, recalculation, dungeon boss/room/resume and reward audit tests.
Client6suites64tests PASS1.504s, prepared assets, full ESLint and diff checks pass.
The complete hosted regression and native party run remain required.

## Draft 1.1.0 patch note

- Rebalanced the four Verdant Bastion bosses for an introductory tank/healer/DPS
  party: shorter health budgets, with their attacks and mechanics preserved.
  Town recovery between encounters remains important.
