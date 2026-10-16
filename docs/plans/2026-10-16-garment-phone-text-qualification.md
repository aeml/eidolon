# Phone garment-row text preference

Source `127febd23` makes the character garment labels and selected names follow
the existing phone menu-text preference. The centered three-slot row stays below
the portrait. Appearance ownership, selection callbacks and real gear are intact.

The actual390px baseline fails at125%/20px because the old labels stay11/10px.
Three corrected software-rendered System Chrome cases pass at1280/900/390px,
workers1/retries0,42.2s. The phone case uses the real setting and verifies all
six text spans at20px before the existing alignment, overflow, keyboard,
appearance refresh and unchanged-gear checks. The enlarged phone capture was
visually reviewed. Scoped fixture lint and diff checks pass.

[Receipt and original failure](2026-10-16-garment-phone-text-qualification.json).
This is browser layout/interaction proof, not native GPU/art/physical-device or
whole-menu acceptance. Ready for master selection; not delivered in accepted61.
No server/account/economy/access/schema change or soak/stress.
