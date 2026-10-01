import { applyProceduralEquipment, clearProceduralEquipment } from './ProceduralEquipment.js';
import { applyAuthoredFighterEquipment, clearAuthoredFighterEquipment } from './AuthoredFighterEquipment.js';
import { applyFittedEquipment, clearFittedEquipment } from './FittedEquipment.js';

export function applyEquipmentVisuals(root, equipment, options) {
    if (root?.userData.fittedEquipment) return applyFittedEquipment(root, equipment, options);
    return root?.userData.authoredClass === 'Fighter'
        ? applyAuthoredFighterEquipment(root, equipment, options)
        : applyProceduralEquipment(root, equipment, options);
}

export function clearEquipmentVisuals(root) {
    if (root?.userData.fittedEquipment) return clearFittedEquipment(root);
    return root?.userData.authoredClass === 'Fighter'
        ? clearAuthoredFighterEquipment(root)
        : clearProceduralEquipment(root);
}
