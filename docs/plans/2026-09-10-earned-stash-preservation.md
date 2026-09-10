# Preserve earned spare gear when conservative sales are insufficient

Serial route78199 on e32d37a ended FAILED after8.8minutes: stage1 passed2.7m,
stage2 passed4.4m, and stage3 reached19/50DemonOrcs before the bag policy stopped.
All earlier authored objectives, manual claims and phase-boundary saved-state
checks passed. Three merchant visits verified160,720 and720Gold respectively;
the initial equipping-only visit freed11slots. No daily quests were accepted.

The final failure was `sales.length`2 versus required3, after equipping had left
5bag slots. The remaining carried loot contained many rare upgrades and gems;
the old helper refused to proceed without selling enough Common/Uncommon spare
gear. Screenshot shows a healthy character back in town, no stuck dialogue or
combat failure. This is a limitation of the automated town routine, not evidence
that the game's stash or quest rules are broken.

Archive `/tmp/eidolon-earth-stash-gap-proof-RQhBr1`, wrapper sanitized0files,
supplemental scan0, whole-world failure image inspected and exact disposable
services/18560/18561/41960cleaned. Log `/tmp/eidolon-earth-stages-0032.log`.

## Follow-up

Keep the conservative sale policy, all existing item protection,5minimum/8target
free slots, unchanged progression, drop odds and150requiredhunt kills. After
ordinary sales, use actual town storage for enough spare non-stackable equipment
to reach the existing target. Rare and future-level upgrades are preserved, not
sold or discarded. Quest fragments, crafting items and gems stay carried; worn
items and equipment for empty slots are not selected for storage.

Walk normally to the replicated stash with move-only input, hover/click its real
mesh, require the stash and bag visible and shop hidden, then right-click each
selected item. Check every entire item moved from bag to stash, unchanged Gold,
quests and equipment, and exact conservation of all other bag/stash items. The
real stash capacity is enforced; no storage grants, network commands or item
state assignments. Close storage and restore auto-loot before ordinary departure.
The serial phase reloads additionally compare full saved stash contents.

Focused18225 passed25tests/4suites0.597s plus lint/diff. Unit policy checks retain
all sale protection and exercise the observed low-rarity shortage, conservative
storage eligibility, future-upgrade preservation, target bounds and input purity.
Source checks verify the normal UI path and complete-item conservation assertions.
These are not a substitute for an actual successful storage visit.

- [x] Full client regression after the storage extension.
- [ ] Actual normal storage transfers and saved items in the complete serial replay.
- [ ] Separate fresh-character/class/group pacing and actual dungeon/raid gates.

Full85092 on4e7bc8d passed284suites3995tests88.258s and lint. Logs
`/tmp/eidolon-earned-stash-full-{client,lint}.log`. The corrected complete serial
replay is next; no successful stash visit is claimed from these unit checks.
