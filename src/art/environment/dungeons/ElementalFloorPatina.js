// Large, stationary mineral weathering crosses every UV repeat and room
// partition. Existing maps provide the stone joints; this adds no texture,
// displacement, emissive hazard, animation clock or extra render pass.
const profiles = {
    dark_realm: { frequency: [.023, .017, -.019, .031], phase: 1.9, roughness: [.005, .015] },
    molten_core: { frequency: [.043, .031, -.019, .057], phase: .4, roughness: [.03, .035] },
    tempest_spire: { frequency: [.029, .061, -.047, .023], phase: 1.2, roughness: [.015, .025] },
    abyssal_well: { frequency: [.023, .037, -.051, .017], phase: 2.1, roughness: [-.03, .035] },
    umbral_nexus: { frequency: [.037, .019, -.023, .049], phase: 2.8, roughness: [.02, .03] }
};

export function applyElementalFloorPatina(material, type) {
    const profile = profiles[type];
    if (!profile) throw new TypeError(`Unsupported elemental floor: ${type}`);
    const previous = material.onBeforeCompile, key = material.customProgramCacheKey();
    const [x, z, u, v] = profile.frequency, [base, range] = profile.roughness;
    material.onBeforeCompile = function(shader, renderer) {
        previous.call(this, shader, renderer);
        shader.vertexShader = 'varying vec2 vElementalFloorWorld;\n' + shader.vertexShader.replace(
            '#include <worldpos_vertex>', '#include <worldpos_vertex>\nvElementalFloorWorld = (modelMatrix * vec4(transformed, 1.0)).xz;');
        shader.fragmentShader = 'varying vec2 vElementalFloorWorld;\n' + shader.fragmentShader.replace(
            '#include <color_fragment>', `#include <color_fragment>
            float elementalFloorWeather = sin(dot(vElementalFloorWorld, vec2(${x}, ${z})))
                * sin(dot(vElementalFloorWorld, vec2(${u}, ${v})) + ${profile.phase});
            diffuseColor.rgb *= .99 + .14 * elementalFloorWeather;`).replace(
            '#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
            roughnessFactor = clamp(roughnessFactor + ${base} + ${range} * elementalFloorWeather, .70, .98);`);
    };
    material.customProgramCacheKey = () => `${key}:elemental-floor-patina-v1:${type}`;
    material.userData.elementalFloorPatina = type;
    return material;
}
