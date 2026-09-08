# Target levels and appropriate earned encounters — isolated, not released

Corrected enemy-impact source aa905ae passed full server race69976:
root18.490s/game417.772s/all packages. Actual uninterrupted18050 then failed6.1m,
but with **zero deaths**, at2/40 Watch credit after its unchanged120s combat
watchdog. The level-three Wizard remained122/150HP and19/130mana in the failure
image; selected target Skeleton-237 was level7 with26HP remaining. Ninety-two
retreats and two accepted Fireballs were observed during the hunt. This is
survival evidence, not a completed or well-paced first hour.

Opening completed86s/zero deaths/36retreats; diary completed138s. Checkpoints
did not reconnect (mana15/115 then21/130). Scan0sanitizations, owned cleanup and
independent exact-container absence passed. Failure image was viewed and archived
alongside the diary image in `/tmp/eidolon-impact-reach-evidence-64LFWU/`.
Actual log: `/tmp/eidolon-earned-impact-reach-gameplay.log`. No browser remains.

The player-facing target card previously omitted enemy level. It now displays
the replicated positive integer level alongside enemy type and distance, with
both engine/UI caches invalidated when the level changes. Missing/invalid levels
are omitted instead of invented. The existing card is shared by pointer and
selected touch targets; actual desktop/phone rendering remains to be verified.

The earned hunt driver previously selected the nearest quest-eligible enemy
regardless of player level, and its fallback for a low-level Skeleton hunt lay
in level-ten territory. It now seeks enemies from the real quest minimum through
the greater of that minimum and player-level-plus-one, walking toward the starter
band when none are replicated for an early Skeleton hunt. Later Skeleton hunts
retain their original higher-level fallback. Immediate pursuers can still be
fought regardless of their level; server quest credit remains authoritative.
No grant, teleport, enemy alteration, kill-count reduction, resource refill or
watchdog/death-limit extension is used. This improves the driver's choice of
ordinary encounters, not the production quest eligibility rules.

Focused client24329 passes24tests/four suites/2.842s before the final fallback
split. Full client/lint and actual rendering/play remain due. Server runtime is
unchanged from aa905ae's full pass. The extended class driver still lacks Rogue
and Cleric support; Wizard evidence must not become an all-class approval.

Proposed patch note, pending packaging: “Target cards now show enemy levels,
helping you judge a fight before committing.”

Final af82670 verification: focused14389 passes24tests/2.238s, full lint and
diff checks. Full client35898 passes230suites/3401tests/151.663s. Actual component
browser74979 passes three desktop/portrait/landscape cases in10.9s. All three
card PNGs were viewed and retained in `/tmp/eidolon-target-level-evidence-tBVMI9/`.
Phone metadata is hidden by existing CSS, so phone titles prefix the enemy level;
desktop retains it in metadata. This is rendered component evidence, not physical
phone testing or an actual earned-route success. All these handles are closed.
The changed travel selection still needs its next actual uninterrupted run.
