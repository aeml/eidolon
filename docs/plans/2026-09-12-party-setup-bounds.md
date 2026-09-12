# Bound party setup actions and retain stage progress

The native opener run87251 remains active at this preparation checkpoint.
Its log confirms Fighter setup, and a read-only query of its exact disposable
database confirms Fighter and Cleric characters. The API healthz response is
healthy at bfa908c8. This does not establish Cleric world entry or a dungeon
clear; it narrows the unfinished setup to login/world entry or build checks.
The running source and process are not changed or restarted.

Standalone party browser contexts do not inherit test-runner fixture settings.
The route's whole-test allowance is125minutes and there was no per-action
default. A hidden login button could therefore consume an expedition-sized
allowance. Each role's page now sets30second default action/navigation waits,
while explicit longer loading-screen and recovery expectations remain intact.
The party combat/traversal/survival/credit requirements and whole-run budget
are unchanged. Phase logs identify registration loading, database seeding,
login/world entry and replicated-build verification using only the class name;
no credentials or gameplay state are printed.

This is diagnostic/bounded-wait preparation, not proof of the active run's
cause and not a workaround granting progress. Native execution remains pending
behind87251. Full lint and whitespace checks are required before handoff.
