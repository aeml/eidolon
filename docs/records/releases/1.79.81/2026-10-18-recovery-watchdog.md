# Alpha 1.79.81 recovery watchdog alignment

CI39117603664 at18df556d9 fails the ordinary token-resume/death-recovery fixture
on its global45second watchdog. It reaches the last Cleric/dead case, whose
third login is still inside its unchanged ten-second socket deadline. No
resource, token or recovery assertion fails before the global timer expires.
The preceding8183bc048pipeline passes the same server code, including this
fixture and all coverage/race steps; the original failure remains retained.

The fixture exercises all four classes alive and dead. Each living route now
includes a mandatory three-second Recall introduced by this release, adding
12seconds to the eight-case run. Its former global watchdog predates those
casts. The correction preserves45seconds for the original work and adds only
the12required cast seconds:57seconds total. Every individual socket deadline,
test case, cast rule and resource/token/save assertion remains unchanged. This
does not change a player performance target or shorten a production cast.

One bounded actual Go-race attempt runs the unchanged eight cases against one
owned race-built server and a loopback Mongo capped at one CPU/512MiB. All eight
pass without retries or skips:52.23s test time,53.480s package time. The successful
run itself exceeds the old aggregate45second cap. All eight synthetic-account
credential scans pass; the owned process group/container closes, Mongo port
returns free and protected inputs remain unchanged. Production is untouched.
The workflow guard's15focused client checks pass in1.055s.

Qualified source6a28a9bf3; subsequent comment/documentation wording changes do
not alter the command or game code. Private evidence remains in the owned
correction tree's `.qa-resume-watchdog`. This is a focused fixture result; a fresh
full current pipeline and verified deployment are still required. Current
accepted production remains Alpha1.79.80. The same81candidate retains the phone
cast layout correction, all516patch-note entries and synchronized versions.

Full game/art/performance/device/operations/beta scope remains active.
Soak/stress and human campaign/phone feedback remain deferred.
