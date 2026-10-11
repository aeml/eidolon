// Slow world-space variation crosses UV partitions and the24-unit repeat.
// No texture fetch, clock, displaced geometry or additional render pass.
export function applyVerdantFloorPatina(material) {
    const previous = material.onBeforeCompile, key = material.customProgramCacheKey();
    material.onBeforeCompile = function(shader, renderer) {
        previous.call(this, shader, renderer);
        shader.vertexShader = 'varying vec2 vVerdantFloorWorld;\n' + shader.vertexShader.replace(
            '#include <worldpos_vertex>', '#include <worldpos_vertex>\nvVerdantFloorWorld = (modelMatrix * vec4(transformed, 1.0)).xz;');
        shader.fragmentShader = 'varying vec2 vVerdantFloorWorld;\n' + shader.fragmentShader.replace(
            '#include <color_fragment>', `#include <color_fragment>
            float verdantWeather = sin(dot(vVerdantFloorWorld, vec2(.071, .043)))
                * sin(dot(vVerdantFloorWorld, vec2(-.029, .053)) + .7);
            diffuseColor.rgb *= .98 + .065 * verdantWeather;`);
    };
    material.customProgramCacheKey = () => `${key}:verdant-floor-patina-v1`;
    material.userData.verdantFloorPatina = true;
    return material;
}
