# Private beta invitation preparation

This feature is prepared for the later, owner-approved closed beta. Publishing
the code does **not** activate beta or close alpha registration. The default is
`EIDOLON_REGISTRATION_MODE=open`. Existing login, characters, session recovery
and email recovery work in either mode. No invitation grants a game role,
currency, QA access or an existing account's password.

An invitation is signed, expires at an explicit operator-chosen time and binds
to one exact, chosen immutable account name. Obtain that choice before issuing
the link. Names preserve case, spaces, Unicode and punctuation; the existing
case-insensitive public-name namespace still prevents account collisions. The
private roster allows 1–100 names at a time. This is an admission bound, **not**
a measured simultaneous-player capacity or a limit on all historical accounts.

## Prepare files without changing admission

Run the repository's operator tool from a trusted machine. It writes new files
with mode0600, never overwrites them, never sends messages and never changes a
server. Keep the key separate from the recipient links. Never commit these
files, paste credentials into logs/chat, or include the signing key with links.

```bash
go -C server run ./cmd/beta-invite -generate-key /private/beta/signing-key
go -C server run ./cmd/beta-invite \
  -key-file /private/beta/signing-key \
  -roster /private/beta/roster.json \
  -cohort chosen-cohort-id \
  -expires "$beta_invitation_expires_at" \
  -output /private/beta/invitations.json
```

`roster.json` is a JSON array of the chosen names, not a comma-separated list.
Expiration is required RFC3339 with a time zone, for example a date/time the
owner explicitly chooses; there is no automatic lifetime. The issuer rejects
duplicate names in the existing public-name namespace, invalid names and more
than100 entries. The output manifest contains each account name, invitation ID,
expiration and URL. Its version1 format is private operator data. Only send the
intended recipient's URL when distribution is explicitly authorized.

The default link target is `https://play.eidolonrealms.com/`. `-base-url` accepts
another HTTPS frontend, or explicit loopback HTTP for isolated QA. Tokens use
`#invite=...`, never a query parameter. Opening a link only prefills the form;
the recipient must explicitly register. The blocking head script removes the
code before analytics runs; sensitive pages suppress analytics even if browser
history is blocked. Codes are not saved in browser storage and are cleared from
the form after successful registration/login. Malformed/query/duplicate/mixed
recovery links fail closed. The server verifies every token independently of
the untrusted browser account-name hint.

## Private configuration

Settings are read at startup. All four invitation settings are ignored only
when `open` mode is **explicit**. Partial invitation settings without an explicit
mode fail before database startup. Invitation mode requires:

| Setting | Value |
| --- | --- |
| `EIDOLON_REGISTRATION_MODE` | `invitation` after approval; `open` during preparation |
| `EIDOLON_INVITATION_KEY` | Key file's canonical unpadded base64url value, 32 random bytes |
| `EIDOLON_INVITATION_COHORT` | Same 1–64-character ASCII identifier used by the issuer |
| `EIDOLON_INVITATION_ROSTER_BASE64` | Canonical unpadded base64url of the JSON name array |
| `EIDOLON_INVITATION_REVOKED_BASE64` | Optional base64url JSON array of revoked invitation IDs |

Encoding the arrays preserves exact account names through both shell sourcing
and Compose's dotenv parser. Do not put raw names, shell expressions or a JSON
array directly in those two settings. JSON before encoding is bounded to128KiB;
the roster remains limited to100 names and revocations to1000 IDs. Rotate the
cohort/key rather than growing an unbounded revocation list.

This offline example prepares a new private fragment for review. It leaves mode
**open**, writes no production file and prints no secrets. Replace the paths
and chosen cohort locally. It does not validate the account choices; the issuer
and server perform that validation.

```python
import base64, json, os
from pathlib import Path

encode = lambda data: base64.urlsafe_b64encode(data).decode().rstrip('=')
roster = json.loads(Path('/private/beta/roster.json').read_text())
key = Path('/private/beta/signing-key').read_text().strip()
lines = [
    'EIDOLON_REGISTRATION_MODE=open',
    'EIDOLON_INVITATION_KEY=' + key,
    'EIDOLON_INVITATION_COHORT=chosen-cohort-id',
    'EIDOLON_INVITATION_ROSTER_BASE64=' + encode(json.dumps(roster).encode()),
    'EIDOLON_INVITATION_REVOKED_BASE64=' + encode(b'[]'),
]
fd = os.open('/private/beta/admission.env', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as output:
    output.write('\n'.join(lines) + '\n')
```

## Approved activation and rollback

Activation waits for the whole game to be nearly complete, the owner's access
approval and the remaining beta/support/capacity gates. Do not activate it as a
side effect of a normal alpha deployment. At that approved point, retain the
existing production `.env` and merge only the reviewed private admission
settings; preserve all unrelated settings and existing accounts.

Copy `server/deploy/invitation-guard.compose.yml` byte-for-byte to
`server/logs/invitation-guard.compose.yml`. Set these two values in the server's
private `.env` as part of the approved activation:

```dotenv
EIDOLON_REGISTRATION_MODE=invitation
COMPOSE_FILE=docker-compose.yml:logs/invitation-guard.compose.yml
```

The persistent override adds `--require-invitation-admission` to the full API
command. Old binaries reject this unknown flag before touching storage, instead
of silently reopening registration. Both `.env` and `logs/` survive the existing
deployment cleanup. The deployment helper refuses missing, edited or stale
guards before service replacement, passes the same guard to schema/journal
preflights and requires health to explicitly report
`"registrationMode":"invitation"`. Review guard changes against the full current
Compose command before replacing the persistent copy on future releases.

Roll back to an invitation-capable release with the guard and private settings
retained. Rolling back to an older alpha binary can keep the API unavailable;
it cannot serve open registration while the guard remains installed. Restore a
compatible release to recover. Do not remove the guard or choose `open` merely
to make a rollback start. Returning to public registration requires an explicit
owner decision and explicit removal of the persistent override/COMPOSE_FILE.

Remove a name from the roster to withdraw all its unused invitations, revoke a
specific manifest ID to withdraw one link, or rotate cohort/key to withdraw all
old links. Restart through the ordinary reviewed deployment procedure. These
actions do not disable or erase existing accounts. A replacement link gets a
new random ID; retire the previous ID when replacing an exposed link.

Replay/concurrent-use protection relies on the retained account's existing
unique username/public-name indexes. Account erasure remains disabled. Before
any future approved deletion, name reuse, or restore to an older account
snapshot, retire affected invitation IDs/names or rotate the cohort/key; the
signed token alone is not a consumption ledger across destructive restores.
Keep the private issuance inventory with the operator's approved recovery
records. No new schema migration, account wipe, retention change or automated
distribution is part of this feature.
