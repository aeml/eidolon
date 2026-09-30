import { applyProceduralEquipment, clearProceduralEquipment } from './ProceduralEquipment.js';
import { applyAuthoredFighterEquipment, clearAuthoredFighterEquipment } from './AuthoredFighterEquipment.js';

export function applyEquipmentVisuals(root, equipment, options) {
    return root?.userData.authoredClass === 'Fighter'
        ? applyAuthoredFighterEquipment(root, equipment, options)
        : applyProceduralEquipment(root, equipment, options);
}

export function clearEquipmentVisuals(root) {
    return root?.userData.authoredClass === 'Fighter'
        ? clearAuthoredFighterEquipment(root)
        : clearProceduralEquipment(root);
}
