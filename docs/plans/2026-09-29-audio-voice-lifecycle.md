# Cue ownership, warning priority and audio recovery

Local work after6ef5db90. Prior turn was progress: connected desktop/HUD review.
Earliest1.39/1.40 release acceptance still awaits the existing owner decision;
this closes independent1.44 code gaps without asserting those gates passed.

Generated one-shot cues now own at most24 pending/playing oscillator voices.
Ordinary cues may occupy22, reserving room for a two-tone danger warning.
Under contention, warnings retire whole older ordinary cues first, then older
warnings if necessary. Ordinary cues are admitted whole or skipped before node
allocation; they cannot displace warnings. Delayed notes count toward ownership.
The budget excludes the separately bounded two-layer ambience system and the
optional authored-media path, which reuses one media object per manifest cue.
Production currently has no authored-media factory.

Hidden tabs, lost audio focus, master mute/zero volume and zeroed individual
buses retire relevant one-shots; authored media is paused too. Context-state
listeners restore eligible ambience but never replay old effects. Suspended
live contexts reject new cues, while OfflineAudioContext retains intentional
pre-render scheduling. Context listeners detach during session disposal.
Failed compound cues release all allocated/started tones. Cooldowns are recorded
only for accepted playback, so rejected suspended/budget attempts cannot block
the first valid sound after recovery. Existing visual warnings are untouched.

Verification:
- Final41 unit checks passed1.672s across AudioManager, WorldAmbience,
  AbilityCastAudio and DangerAudioSpatial. Includes saturation, complete-cue
  preemption, delayed tones, hidden media, independent mute, listener ownership,
  suspended/recovered contexts and partial start/panner failures.
- Three browser checks passed19.3s: real AudioContext activation/voice budget/
  suspend/resume, OfflineAudioContext warning stereo/mute samples, and existing
  phone sound settings/activation at390x844.
- Strengthened final recovery fixture queues six delayed jackpot notes before
  actual context suspension, proves they are retired, rejects suspended playback,
  resumes by gesture and accepts the same cue without advancing its test clock.
  Final targeted browser1 passed6.8s.
- Artifacts:/tmp/eidolon-audio-voice-lifecycle-0929 and
  /tmp/eidolon-audio-resume-final-0929. Scoped ESLint/diff checks pass.

This proves bounded ownership and signal/lifecycle behavior, not human listening
approval, final sound design/mastering or all-device interruption coverage.
No audio downloads, new visual effects, gameplay/reward changes or per-frame
budget loop. No live deployment, version bump or campaign/encounter soak.
