# Earned merchant repeat-visit recovery

Prepared functional Earth39733 on9d01157 ended FAILED6.3m while opening the shop
on a later bag-management visit. The terminal ARIA context shows Ink That Walks
39/60, level100, full2997HP/1974MP, Gold7633, inventoryvisible/shophidden. Earlier
opening, diary,40Skeleton hunt and actualSeeds/manualconsumption completed far
enough to reach this Imp prerequisite. This is prepared-level functional evidence,
not fresh progression or full Earth completion.

One earlier real merchant visit PASSED: equipped2earned items, sold three spare
Common items for10+10+80Gold, balance6841→6941, free slots3→8 in17.366s. The helper
verified exact individual item removals/Gold receipts and preserved the level,
quests, worn equipment and all other bag items. Another earlier visit equipped9
pieces without a sale. Do not claim every repeated merchant visit is reliable.

The failed helper had waited for the real merchant hover, clicked, then found the
shop hidden. Runtime DwarfSalesman interaction calls toggleShop; closing that
window keeps its inventory companion visible. Its approach still used ordinary
clicks, permitting an incidental interaction before the final explicit click.
The terminal state is consistent with a second toggle closing an already-open
shop, but there is no prior shop-state receipt/screenshot to prove that sequence.

Correction: use the existing move-only, no-jump approach and retain a shop that
is already visibly open instead of blindly toggling it again. If closed, perform
exactly one normal merchant interaction and require BOTH shop and bag visible.
Failed interactions still fail; no blind repeated clicks, UI state assignment,
sale callbacks, remote currency mutation or hidden grant replaces actual input.
Log the actual opened/already-open branch and add a complete world screenshot
and read-only quest/bag/player receipt to future prepared-route failures.

Archive `/tmp/eidolon-functional-merchant-failure-ZXNcRk` contains the original
report/context; no screenshot existed in that run. Wrapper sanitized2files,
archive rescan0, exact services18560/18561/41960 absent after terminal cleanup.
Log `/tmp/eidolon-earth-functional-2346.log` retained.

Focused helper session10870 passed28tests/4suites0.685s+lint. Full51243, including
the additional wiring/DwarfSalesman checks, PASS284suites3989tests96.093s+lint.
Logs `/tmp/eidolon-merchant-repeat-full-{client,lint}.log`.
Actual corrected repeated visits and the full functional/fresh routes remain due.
