# Combat-effect hierarchy integration — September 29

Local reference candidate based on `01be9903`, not deployed. Runtime1.38.0
identity and the full ordered roadmap remain unchanged.

Integrated only presentation hunks from the root: thin/broken personal-buff
decoration, softer projectile-impact echoes, exact complete impact perimeters,
and feathered Guardian Embrace/Spirit Guardians boundaries. Bright contact
cores, debuffs, Well Rested aura/motes, cherubs and gameplay timing remain.
The shared persistent-aura material supports cached shader uniforms without
per-frame material clones. Spirit Guardians updates its inner-width uniform
when the exact gameplay radius changes.

No terrain consumers were partially imported: elevation imports, lifted motes,
ground-ring deformation and projectile grounding remain with the outstanding
terrain transfer. No server, version, login-history or dependency changes.

100 checks passed in five effect/event suites (3.119s). The first command also
named a nonexistent BossTelegraphEffect test; corrected the selection, then
35 actual telegraph/dispatch checks passed1.098s. Total135 checks across seven
existing suites. Scoped lint and whitespace passed.

Five browser checks passed37.5s:
- Exact ground effects remain visible above dungeon floors.
- Crowded warning sequence at High/Low, with normal/reduced motion.
- Populated Earth/town at desktop High and phone-sized Low, including the
  prepared production basic-contact/recoil sequence.

Artifacts: /tmp/eidolon-effects-integrated-0929.
Inspected crowded High phase.75 and phone Low basic impact. Boss warning
retains priority, while surrounding boundaries remain visible. This is prepared
presentation evidence, not a legal single-build loadout, connected party,
performance acceptance or human judgment of combat feel.

Next: terrain/elevation and rock integration as a dependency-complete client/
server change, followed by remaining audio and a consolidated reference/release
review. The current world still looks procedural and has not reached the final
modern-ARPG quality bar. Pending1.39/1.40 release decision remains unassumed.
No campaign soak, production mutation, push or deployment.
