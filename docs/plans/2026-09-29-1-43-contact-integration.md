# 1.43 contact-presentation integration — September 29

Status: local candidate only; not a release or final visual acceptance.

Base: `1c4c2d24`, the clean combat candidate descended from the 1.42
environment and 1.41 actor candidates. Runtime identity deliberately remains
1.38.0 until ordered publication is authorized and ready.

## Integrated changes

- Annotated basic-attack contact times for Fighter, Rogue, Wizard and Cleric.
  Local, remote and offline playback reaches contact at the existing 35% damage
  time. Unannotated/imported rigs retain the existing fallback.
- Confirmed direct damage produces a brief source-facing body contact and
  bounded rig recoil. Gameplay position, selection, cooldowns, damage and
  animation state remain unchanged.
- Shared short-lived contact cuts/sparks replace decorative ground seals for
  direct strikes. Low uses four parts, High six. Reduced motion suppresses
  spark travel and recoil. Healing, periodic damage and hazards retain their
  own presentation.
- Updated only the contact-related animation-gallery assertion. Architecture
  and entrance expectations remain matched to this candidate's actual geometry.

## Dependency and regression boundary

Transferred reviewed hunks, not the root working tree. The root has an older
version identity and lacks some already-shipped files retained by the candidate.
Server, login/version history, package identity and lockfile are unchanged from
the candidate base. No source deletions.

Terrain grounding, terrain-profile negotiation, rock navigation, audio changes,
humanoid render batching and the latest environment/entrance follow-ups are
deliberately not included in this contact transfer. They need their own
dependency-complete integration; this is not the fully connected reference build.

## Verification

- 109 tests in six focused suites passed in 1.989s: basic-contact timing,
  ActorHitReaction, ActorAnimationState, ProceduralHumanoid,
  ProceduralCombatFeedback and GameEngineCombatFeedbackVisuals.
- Three existing browser regressions passed in 14.9s: floor-visible combat
  fields and crowded boss warnings under normal/reduced motion.
  Artifacts: `/tmp/eidolon-143-combat-integration-0929`.
- Scoped ESLint and whitespace checks passed. Server and release-identity
  paths are byte-for-byte unchanged against the candidate base.
- Reuse the earlier actual-input contact/recoil and controlled-render evidence
  recorded in the playable-slice document for the unchanged presentation code.
  The browser run above does not newly prove authenticated combat or enjoyment.
- No campaign/raid soak, backend services, live mutation or deployment.

Next: integrate the environment/approach follow-ups with their actual shared
placement and shader dependencies, then review the complete reference build.
High performance and overall modern-ARPG visual acceptance remain open.
The pending 1.39/1.40 release decision is not assumed.
