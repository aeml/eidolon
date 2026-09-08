# Opening reward — a smaller first step

Isolated candidate **d911162**, based on local 50; not merged to root, versioned,
or published. Part of the coordinated progression pass, not a replacement XP
curve or full economy approval. The verified opening payout audit shows the
three-kill quest's reward alone taking every class from level 1 to level 4.

New unaccepted opening offers now promise **100 XP instead of 500 XP** and the
same **100 gold**. One initial level of XP is the provisional starter turn-in
budget: reward-only level 1 → 2, rather than three levels at once. Ordinary kill
XP remains separate; this is not a claim that a real player finishes at level 2.
The three-kill objective, initial survival tuning and subsequent quests remain
unchanged. Reducing the campaign by 400 XP does not solve the later level gates,
large collection payouts, personal two-million-XP boss bonus or late XP wall.

Accepted/ready/completed opening contracts keep their saved XP/gold quote,
including explicit zero quotes, progress and already-paid receipts. An unaccepted
old offer adopts the new reward. No earned levels, XP, gold, equipment or access
are clawed back. Refresh/save tests use the production snapshot → BSON → login
mapper → daily/Chronicle refresh path. Legacy 500-XP manual completion still
grants exactly 500 XP once; new completion grants 100 once. Cap conversion remains
the existing gold plus Resonance rule, covered by the repeated reward checks.

Red regression **10617 FAIL / root 0.177s / game 0.200s** reproduces the old
level-4 payout in all four classes, offered reward mismatch and overwritten zero
quote. Corrected reward/quote/turn-in/cap/pacing checks pass three race runs
**18348 / root 2.128s / game 3.796s**. After adding the explicit legacy manual
payout case, full server **82436 PASS / root 9.147s / game 211.826s**, other
packages pass. Logs `/tmp/eidolon-opening-reward-{before,after,full-server}.log`.
All handles are closed. Source is gofmt/diff clean. QA-only release ancestry is
merged at **c46a43f** without changing this runtime.

Earned Wizard opening plus collection **89727 PASS / one / 1.8m** on clean
**571bf86**, with zero deaths and no level/gear/quest grants. The opening earns
three actual quest kills, shows **100 gold · 100 XP** before acceptance and
turn-in, credits exactly those amounts, presents the receipt and preserves it
after fresh login. Opening finishes at **level 2 / 30s / two normal retreats**.
Collection then earns eight fragments after **12 observed target deaths**
(area attacks can defeat additional enemies), reaches level 5 through combat,
and manually receives the still-unchanged 8,000 XP/100 gold, reaching level 16.
Its actual Guide still correctly locks level-30 entry. Collection takes 76s.
Five earned gear pieces have 170 total vendor value **not realized sale income**;
gold moves 135 → 471 through combat. The ready-conversation screenshot is
inspected. Log `/tmp/eidolon-opening-reward-earned-collection.log`; credential
scan finds zero sanitizations and disposable cleanup passes. This demonstrates
the remaining large collection jump, not approval of overall pacing.

Still required: broader class/pacing review of the modest later progress difference,
integration with the expansion's reward split, release packaging/patch notes
and sequential CI/live verification. Do not advertise this as live or as the
complete first-hour/campaign balance pass.
