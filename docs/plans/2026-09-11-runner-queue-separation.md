# Independent soak and deployment runner queues

User-approved operational change; no game version or gameplay changes.

| Work | Runner |
| --- | --- |
| Client/server tests, three anonymous browser shards, build/publish orchestration | Standard GitHub-hosted `ubuntu-latest` |
| Predeploy and postdeploy hardware-GPU browser QA | Existing `eidolon-codex-chrome`, label `eidolon-live-browser` |
| Uninterrupted 100-client, 24-hour soak | New `eidolon-soak`, label `eidolon-soak` |

Do not put either custom label on the other runner. A job's labels must all match;
GitHub does not automatically spill self-hosted jobs onto hosted runners. Public
repositories can use standard hosted runners without minutes charges, but their
six-hour job limit cannot accommodate this uninterrupted soak. No paid runner is
introduced and no GPU/soak acceptance is bypassed.

## Setup evidence — September 11

Downloaded official runner v2.337.0; its SHA-256 matched the GitHub runner-download
API checksum before extraction. Registered `eidolon-soak` without replacing the
existing runner. The owner installed/started its service at 03:24 UTC; systemd
reported active/enabled and the GitHub API independently reported online/idle
with only its soak custom label. Chrome remained online/busy on the existing soak.

Focused routing/isolation/browser-sharding checks passed: 8 tests in 3 suites,
0.908 seconds; focused ESLint, both workflow YAML parses, service shell syntax
and `git diff --check` passed. Initial new-test job IDs and regex lint were
corrected before this successful rerun. This is configuration validation, not
yet an actual job on the new service.

The new runner is registered specifically to `aeml/eidolon`, with a separate
installation and `_work` directory at
`/home/aeml/.local/share/eidolon-soak-actions-runner`. It does not copy credentials,
environment snapshots or workspaces from the Chrome runner. The services still
share CPU, RAM, Docker and the `aeml` account: independent scheduling is not
hardware or security isolation. The existing dynamic Mongo/API ports and unique
temporary evidence directories remain mandatory. Monitor contention before
increasing local parallel workload; especially keep GPU jobs serialized.

## One-time systemd installation

After unprivileged registration, run as the machine owner:

```bash
cd /home/aeml/.local/share/eidolon-soak-actions-runner
sudo ./svc.sh install aeml
sudo ./svc.sh start
systemctl is-active actions.runner.aeml-eidolon.eidolon-soak.service
systemctl is-enabled actions.runner.aeml-eidolon.eidolon-soak.service
```

Expected: `active` and `enabled`. Check GitHub also reports `eidolon-soak` online
with its unique label. Do not reinstall or stop the existing Chrome service.
Use narrow status checks; full logs/environment/process arguments may expose
credentials. Registration tokens and runner credentials never belong in Git.

## Rollout and validation

The workflow change applies only after publication. Already-created jobs keep
their original workflow/labels; installation alone cannot move the current soak
or queued deployment. Let the active soak finish normally. Preserve canonical
release acceptance; do not push the unrelated root ledger or unaccepted gameplay.
After service-online and workflow publication, run a short disposable soak to
verify scheduling, container ports, evidence upload and cleanup; a short smoke
does **not** replace the full 24-hour stability evidence. Confirm GPU QA is still
assigned to Chrome while soak jobs use the new runner.

Keep fork/PR jobs on hosted runners. Manual soak dispatch is restricted to this
repository's master/main branches, and schedules run the default branch. These
conditions do not sandbox untrusted code or replace repository access controls;
never approve untrusted changes for execution on this production-adjacent host.

References: [GitHub service setup](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/configure-the-application),
[runner selection](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job),
[Actions limits](https://docs.github.com/en/actions/reference/limits),
[billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions),
[self-hosted security](https://docs.github.com/en/actions/reference/security/secure-use).
