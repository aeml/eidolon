# Recover a login interrupted before its reply

Inspection during the separate party setup investigation found an independent
runtime defect: sending a login immediately cleared pendingAuthRequest. A
transport loss before login_success then had no request to reconnect/retry.
This is reproduced through the actual main module's UI with controlled sockets,
not established as the cause of native87251's unfinished Cleric setup.

The client now retains an in-flight login until success or an explicit server
error. Transport close/error can recover it on a replacement socket, with at
most six reconnects per submitted request. Merely opening a socket no longer
resets that budget. Exhaustion clears retained requests and asks for another
explicit login. Completed/rejected requests clear their timer and retained
credentials. Replaced sockets cannot overwrite current status or character
selection. Superseded transport sockets are closed when the replacement starts.

Sent registration requests are not automatically replayed because the server
may already have created the account. Existing pending-before-send registration
recovery is unchanged. Authentication checks, tokens and the wire protocol are
unchanged; all attempts still go through the ordinary server authentication.

## Evidence

- Initial real-main-module tests reproduced both close/error after send: only
  one socket existed where a replacement was required. Nine existing checks
  still passed. Initial green11tests2.234s.
- Expanded auth/menu/address suites91PASS9.071s. Tests cover explicit server
  rejection, no replay of sent registrations, six-reconnect cap despite repeated
  opens, corrected credentials on a later manual attempt, success stopping all
  retries and stale socket events. Final auth14PASS2.318s; route/auth32PASS1.404s
  before adding the final route enrollment assertion.
- Logs `/tmp/eidolon-auth-inflight-{red,green,expanded,final,route}-20260912.log`.
- The authored native auth-recovery route forwards to the real disposable
  server, drops the first actual login_success and closes the transport. One
  UI login click must produce exactly two login requests and a delivered
  authenticated class-selection screen. No synthetic login packet or helper
  retry can conceal failure. It records counts only, disables credentialed
  recordings, and is enrolled in the full isolated gate without retries.

Native interruption verification and hosted regression remain pending. The
single native slot is occupied by the unchanged party opener run. No production
deployment or claim that the existing party stall is repaired is made here.
