# Preserve accepted Teleport/Phase coverage in1.1

Based on hosted-accepted development8f2c82a4 in a separate worktree; the active
four-role dungeon test remains frozen on its original source. No runtime,
release identity, patch history, production workflow or gameplay balance change.

Ported the exact five native observer/route/spec/unit files from65's66ca3a3d,
including95a78071's occupied-ground correction. The scoped native test already
passed on95a78071 in2.0m, artifact
`/tmp/eidolon-release65-teleport-accepted-B42924`. That is65 source evidence,
not a new native execution of this development branch.

Added explicit owner/observer allowlisting, the no-retry standalone route, and
the full timed gate stage immediately after entrance visibility. Preserved
every existing command, its relative order and the recovery/forge suffix.
Extended the executable stage-order/failure-propagation regression to include
Teleport; it still checks each failure stops later work, preserves exit status,
scans artifacts and performs cleanup.

New gate tests first failed2/2 on the unchanged development script. After the
port,9suites/90tests PASS8.98s, changed-file lint, shell syntax and whitespace
checks PASS. Logs `/tmp/eidolon-1-1-teleport-qa-port-{red,green,lint}-20260912.log`.
These focused checks establish the imported route and gate contracts, not the
full native gate or dungeon, earned progression, balance or milestone acceptance.

Keep this commit separate until the active primary native37629 is terminal;
then integrate without changing that run's recorded source identity. A normal
future1.1 publishing gate must execute this native coverage along with all
other required routes. Release65 publication remains separate.
