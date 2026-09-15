# Administration

## Account role

Administrator access is an explicit durable account role in MongoDB. It is not represented by character level, equipment, QA access, or a client-side flag. Server-side authorization must query the durable role for every privileged operation.

The initial bootstrap allowlist is configured with `EIDOLON_ADMIN_BOOTSTRAP_USERNAMES` or `--admin-bootstrap-usernames`. It is exact and case-sensitive. The production Compose default contains only `donveetz`.

An allowlisted authenticated player can type `/relevel` in chat. The server consumes the command without publishing it, records the `admin` account role, and leaves character level and progression unchanged. Once granted, the durable role remains authoritative even if the account is later removed from the bootstrap list.

QA authorization is independent. `EIDOLON_QA_USERNAMES` does not grant administrator access, and the administrator role does not grant QA commands.

## Future operations

Item creation, gold grants, player or self teleportation, and audit viewing should use dedicated bounded WebSocket message types rather than free-form chat arguments. Every operation must:

- derive the actor from the authenticated connection;
- recheck the durable admin role;
- validate strict payload and value bounds;
- use an idempotent request ID;
- run under the target account's character-work lock;
- persist the resulting character before reporting success;
- write a structured audit record containing actor, target, action, request ID, timestamp, and result.

Do not expose raw server log files to the game client. Login/logout and admin activity should be written to and queried from a bounded structured audit collection with pagination and retention.
