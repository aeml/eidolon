// Constructor/quality-change opt-in for code-owned foliage. Remember the exact
// inputs used to declare its bounds; swaps, buffer uploads and vertex shader
// changes revoke the declaration until the builder computes bounds again.
const declarations = new WeakMap();

export function declareStaticFoliageBounds(mesh) {
    const material = mesh.material;
    if (!mesh.isInstancedMesh || Array.isArray(material) || !mesh.boundingBox ||
        !mesh.geometry.attributes.position) return;
    const position = mesh.geometry.attributes.position, storage = position.data || position;
    declarations.set(mesh, { geometry: mesh.geometry, position, storage,
        positionVersion: storage.version, instances: mesh.instanceMatrix,
        instanceVersion: mesh.instanceMatrix.version, count: mesh.count, material,
        compile: material.onBeforeCompile, update: material.onBeforeRender,
        beforeRender: mesh.onBeforeRender, beforeShadow: mesh.onBeforeShadow });
}

export function hasStaticFoliageBounds(mesh) {
    const entry = declarations.get(mesh), material = mesh.material;
    return Boolean(entry && mesh.isInstancedMesh && !mesh.children.length &&
        entry.geometry === mesh.geometry && entry.position === mesh.geometry.attributes.position &&
        entry.storage === (entry.position.data || entry.position) && entry.positionVersion === entry.storage.version && entry.instances === mesh.instanceMatrix &&
        entry.instanceVersion === mesh.instanceMatrix.version && entry.count === mesh.count &&
        entry.material === material && entry.compile === material.onBeforeCompile && entry.update === material.onBeforeRender &&
        entry.beforeRender === mesh.onBeforeRender && entry.beforeShadow === mesh.onBeforeShadow &&
        !material.userData.woodlandWind && !material.displacementMap && !Object.keys(mesh.geometry.morphAttributes).length &&
        !mesh.customDepthMaterial && !mesh.customDistanceMaterial);
}
