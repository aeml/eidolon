# Root/slow integration candidate

Based on accepted primary06ec65fe; runtime candidatea6b37b36 carries only the
root/slow reproduction and repair fromab8252b3/7d648488. It does not carry the
unfinished714bb815 Shield Slam talent-duration runtime/client/copy work.

The diagnostic cherry-pick conflicted because primary lacked the later Shield
Slam duration probe. Kept the new root/slow probe only and retained primary's
existing diagnostics. No passing test was removed or weakened. The promoted
paid root/slow cases remain in the normal server suite as well.

An accidentally started focused check67015 ran before this integration finished;
it is only older-source evidence, not root/slow acceptance. After resolving and
committing,32848 ran the focused race selection againsta6b37b36 and passed8.505s:
root/slow paid casts, overlap/expiry, Seraph follow/lifetime, immunity, stun/impact,
and dungeon movement checks. Log `/tmp/eidolon-root-slow-current-focused-final.log`.

Full server race is still required before advancing primary. Avoid competing
with the active1.0.61 full regression49482. Native four-role full dungeon clear,
saved claims and earned campaign progression remain open; this integration does
not supply them. Existing client/browser evidence applies only to unchanged
client behavior, not to gameplay balance after corrected enemy control expiry.
