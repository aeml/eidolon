# Game Server Locking

The authoritative game state uses three ownership levels:

1. `World.Mu` protects the entity, party, and other world registries.
2. `World.InstanceMu` protects only the dungeon-instance registry map.
3. `DungeonInstance.Mu` protects one instance's layout metadata, room state,
   player summaries, and lifecycle timestamps. `Entity.Mu` protects one entity.

Code that needs more than one level acquires locks in this order:

`World.Mu` / `World.InstanceMu` -> `DungeonInstance.Mu` -> `Entity.Mu`

Never acquire a world or instance-registry lock while holding an instance or
entity lock. Snapshot pointers from a registry, release the registry lock, and
then work under the narrower lock whenever atomic registry membership is not
required. Layout slices are immutable after instance creation; APIs still
return cloned slices so callers cannot mutate authoritative layout data.

The instance registry lock is deliberately separate from instance state. A
busy room-clear or simulation operation in one dungeon must not pause reads or
updates in another dungeon. `dungeon_instance_concurrency_test.go` exercises
that isolation and is also run under the race detector.
