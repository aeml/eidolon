import { AUTHORED_ASSETS } from '../assets/authoredEquipment.generated.js';
import { createAuthoredFighterInstance } from './AuthoredFighter.js';

export const isAuthoredPlayerClass = type => Boolean(AUTHORED_ASSETS.characters[type]);
export const authoredCharacterPath = (type, quality) => AUTHORED_ASSETS.characters[type][quality === 'low' ? 'low' : 'high'];
export async function createAuthoredCharacter(type, quality, loader) {
    const gltf = await loader(authoredCharacterPath(type, quality), 8000);
    // A missing optional bank must not discard an otherwise usable actor.
    let bank;
    try { bank = await loader(AUTHORED_ASSETS.characters[type].motionBank, 8000); }
    catch (error) { console.warn(`Authored ${type}: using delivered default motions`, error); }
    return createAuthoredFighterInstance(gltf, { quality, actorClass: type, equipmentLoader: loader, motionAnimations: bank?.animations });
}
