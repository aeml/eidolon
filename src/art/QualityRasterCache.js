// Immutable code-owned world fields have exactly two supported resolutions.
// Retain only CPU bytes, never textures or renderer state. Every caller gets
// its own upload buffer so edits/disposal cannot poison a returning session.
export function createQualityRasterCache(highSize, lowSize, rasterize) {
    const fields = new Map();
    return quality => {
        const size = quality === 'low' ? lowSize : highSize;
        let source = fields.get(size);
        if (!source) {
            source = rasterize(size);
            fields.set(size, source);
        }
        return { size, data: source.slice() };
    };
}
