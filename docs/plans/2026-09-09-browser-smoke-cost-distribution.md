# Browser smoke cost distribution — evidence before changing the gate

Inspected September9 during recovery58 CI34361293407, ef9a638. The active
release is frozen; this is a follow-up plan, not a deployed optimization.

## Measured completed jobs

The three required anonymous jobs ran80tests, all passed, no retries observed:

| Job | Anonymous cases | Anonymous elapsed | Additional work |
| --- | ---: | ---: | --- |
|102501457840, shard1|29|11.8m|6nameplate cases55.0s;3resource-HUD cases6.2s|
|102501457814, shard2|26|2.1m|None in58|
|102501457596, shard3|25|6.9m|None in58|

Source: completed job logs in
[CI34361293407](https://github.com/aeml/eidolon/actions/runs/34361293407).
Job setup/upload time is not included in the anonymous elapsed column.

Shard1's ten `entrance-visibility.spec.js` cases occupy14:14:42.321–14:23:52.780,
approximately550.5s/9m10.5s from first case start to the next spec start. They
verify real occluded-character pixels for four entrances atHigh/Low and two
phone views. Preserve these cases, screenshots and assertions.
Shard3 also has expensive real-render tests: offlineSeraph native/8fps/lifecycle,
phoneencounter composition and respawnappearance. Simply moving all entrance
work onto shard3 would make another overloaded job.

## A simple flag does not solve this distribution

[Playwright's official sharding documentation](https://playwright.dev/docs/test-sharding)
describes file-level versus individual-test sharding. Test-count balance is not
a guarantee of balanced runtime for heterogeneous cases.

Actual pinned1.61.1 `--list --reporter=json` discovery was run in the clean58
worktree with Node24 for all three shards, with and without `--fully-parallel`.
No browser/server was launched. Session75592 completed successfully.
Default counts29/26/25 become27/27/26, but **all ten entrance cases remain on
shard1 in both configurations**. The same expensive Seraph/respawn/encounter
families remain onshard3. Do not present the flag as an evidenced speedup.

## Bounded follow-up implementation and acceptance

Separate expensive rendering families from lightweight DOM/layout cases, then
distribute their independent cases across the existing hosted jobs. A dedicated
render-family command can use case-level sharding; the overall anonymous
umbrella command must still cover every existing case for local users.
Keep one browser worker per job, avoiding new contention on the GPU-backed
predeploy/live runner. Do not change active58 or restart its checks.

Before publishing a partition change:

1. Compare discovered case identities against the unchanged80-case anonymous
   baseline plus6nameplate/3resource cases. Require exact union, no omissions,
   duplicates or empty required groups; include later journal/card additions.
2. Preserve serial dependencies/fixtures, assertion and timeout semantics, all
   failure exit codes, and predeploy's dependency on every group.
3. Retain separate reports/artifacts for each command; the current sequential
   commands can overwrite an earlier HTML report even when its log survives.
4. Run every proposed group with the same CI browser mode, compare rendered
   evidence and actual elapsed times, then measure a complete remote CI run.
5. Do not claim a speedup from discovery alone. The45–60m full-character gate
   remains a separate dominant cost; its gameplay coverage is not replaced.

No workflow/runtime changes or reduction in release gates has been made here.
