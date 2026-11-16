// Reviewed weapon-bearing rigs only. Birds, quadrupeds and future imported
// models need their own contact poses; never infer them from a track index.
const CONTACT = Object.freeze({
    MountainTroll: .7, AquaGolem: .7, Siren: .7, FrostGuardian: .7,
    SandstormDjinn: .72, MagmaGolem: .72, ScorchedWraith: .72,
    CloudElemental: .72, TempestGiant: .72, CycloneAvatar: .72,
    RootboundWarden: .78, BriarMatron: .78, RustboundColossus: .78, HollowSentinel: .78,
    ScorchedTwins: .78, ForgemasterPyrax: .78, ObsidianGuardian: .78, LordInfernax: .78,
    Windshear: .76, Stormcallers: .76, ThunderlordKaelix: .76, Zephyrion: .76,
    DrownedChoir: .76, AbyssalGoliath: .76, MaelstromWarden: .76, Thalorath: .76
});

export function configureEnemyStrikeContact(root, type, clips) {
    const contact = CONTACT[type];
    if (contact === undefined) return;
    const attack = clips.find(clip => clip.name === 'Attack');
    const arm = attack?.tracks.find(track => track.name === `Rig_${type}ArmRight.rotation[x]`);
    if (!arm || ![...arm.times].some(time => Math.abs(time - contact) < 1e-6)) {
        throw new Error(`Missing reviewed strike contact: ${type}`);
    }
    // These downward arms used the opposite X sign: the release swept behind
    // the +Z-facing target. Change only that attack track, not gait, death,
    // root transforms, other limbs or gameplay hit volumes.
    arm.values = arm.values.map(value => -value);
    root.userData.basicAttackContactTime = contact;
}
