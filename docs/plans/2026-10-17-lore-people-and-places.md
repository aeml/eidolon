# Earned people and places in the Lore Book

The Lore Book requirements include navigable people and places as well as
chapters and discoveries. The current deployed book provides the latter two.
This candidate adds People and Places filters with references to the original
personal memories, preserving the existing All memories search and list.

An index entry exists only when a completed chapter, personally recorded
discovery or earned restoration account supplies its evidence. Pending quests,
completion counts, unrecorded sites and static catalog availability do not
unlock it. Names identify matching earned words; pages quote those words rather
than inventing biographies or revealing future descriptions. A surname appears
only after a recorded account uses it, with a stable identity across updates.
Recorded realm metadata supplies place context; unread places stay out.

Read opens the original account. Return restores the previous person/place,
filter, search and list scroll, and focuses the reading heading. Refresh keeps
the reader's context; switching characters or removing the underlying personal
evidence clears it. Original manual acceptance, reward claiming, saved receipts,
current tasks and story recap remain unchanged. Shared44px filter/action sizing
and wrapping support keyboard, mouse and phone touch layouts.

All30focused cases across the existing LoreBook and new LoreMemoryIndex suites
pass, including twelve new privacy/reference/navigation cases. Scoped lint passes.
The first run exposed duplicate index entries under All memories and an invalid
one-site test assumption. Original inputs and its three failures are retained;
the implementation preserves the original memory-only list and the fixture now
uses actual sparse multi-site evidence. Existing UI count/focus assertions were
retained. Twelve new cases do not replace the original eighteen.

The two existing desktop/phone earned-memory browser cases are extended with
people/place navigation and read/return interactions. The two returning-story
cases retain their coverage. Their first four native executions pass in13.1seconds.
Two subsequent targeted cases expose a lost Read focus and stale Return label
when new personal evidence rebuilds the page. Stable action identities now
preserve focus through the existing journal owner; return-label changes update
the page signature. Both negative cases and their inputs remain preserved.
Final-source native execution and reviewed captures are pending; this isolated
candidate is not yet selected, merged or published. Final physical
device, whole-game usability and owner art review remain open. The full original
goal stays active; no campaign, soak or server stress run is introduced.


## Final-source native qualification

Source `50e0e2d05a23117c5a6e6ea48934bcf1b0072157` passes all30focused cases, full lint and all four native
desktop/phone browser cases in12.6seconds, with retries0. The final native flows
exercise newly acknowledged memories while both Read and Return are focused;
they preserve the correct action, update a personally learned surname, and
restore the original saved presentation afterward. No production progress is
manufactured. Existing current-task, finale, search, close/reopen and returning
contracts remain covered. High/phone captures were reviewed for readable pages,
reachable actions and horizontal overflow. Physical-device review stays deferred.

Closed18-file qualification inventory SHA-256:`d22c5b28e81a5bf0af9daa21e14f8c62fb99c475cc1d342dd79b01b6b3cc8ec9`. Original initial
three-case failure, two-case focus finding and first four native passes remain
separately verified. Repeat executions are not added to the final30/4counts.
This component is selected for the next coherent milestone after exact73
acceptance; it is not yet merged or deployed. Full owner/visual/device/game/
operations/beta/1.99scope remains active.
