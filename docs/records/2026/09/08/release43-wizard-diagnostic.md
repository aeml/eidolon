# Release 43 predeploy failure — unresolved

CI **34178050891**, source **39620a0**, failed Predeploy Character QA. Client,
server and anonymous browser passed; deployment and live validation were
skipped. The first full-character attempt logged `ERR_NETWORK_CHANGED` asset
errors. The restarted full-character sequence passed Fighter and Rogue, then
failed Wizard's Inferno Cataclysm presentation; the animation test's own retry
failed Dragonfire Lance. Both failed the existing eight-second real-input
presentation predicate. These observations do not establish one common cause.

The only code change here adds noncredential diagnostic state if that exact
predicate fails: state/resources, cooldowns, selected hotbar, last presentation,
focus, pending interaction, animation and readiness sequence. Production code,
input actions, expected presentation and timeout remain unchanged. No retry,
skip or gate bypass has been added.

Isolated real-input System Chrome results on39620a0 plus diagnostic:

- **18831 PASS**, Wizard only, 1.3m.
- **96050 PASS**, Fighter 1.3m, Rogue 1.7m, Wizard 1.3m, Cleric 1.4m.
- Artifact credential scans pass; temporary owned containers/data are cleaned.

Logs `/tmp/eidolon-release43-wizard-diagnostic.log` and
`/tmp/eidolon-release43-allclass-diagnostic.log`. Final indentation-only cleanup
follows those browser runs. These passes do not reproduce the failed CI state
or prove that it is fixed. Release43 remains unpublished, no44 may follow until
the complete release gate and fresh exact public identity pass. No new push or
CI rerun occurred during this diagnostic pass.
