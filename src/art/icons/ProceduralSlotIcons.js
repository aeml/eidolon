// Code-native vector symbols, consistent with Eidolon's procedural icon family.
const palettes = { earth: ['193925', 'a8d78b'], fire: ['4a221c', 'ffb46e'], water: ['15394d', '91ddf2'], air: ['292748', 'c3b5ff'] };
const emblems = {
    earth: '<path d="M32 51V18m0 14C10 32 15 12 29 19m3 19c20 0 20-19 6-19M32 45l-13 9m13-9 13 9"/>',
    fire: '<path d="M32 8c4 17 19 18 17 33-2 19-33 19-34 0-1-9 7-14 9-22 2 7 3 11 8 13 5-8 4-15 0-24Z"/>',
    water: '<path d="M32 9 17 31c-16 28 43 31 30 0ZM20 42q12 12 24-1"/>',
    air: '<path d="M11 25h29c22 0 14-23 1-13M9 34h35c23 0 15 26 1 17M19 43h11"/>'
};
const motifs = [
    '<path d="M32 10 50 29 44 50 20 50 14 29ZM14 29h36M32 10v40M14 29l18 21 18-21"/>',
    '<circle cx="32" cy="32" r="19"/><path d="M34 16c-18 5-18 26 0 31-27-1-27-32 0-31Z"/>',
    '<path d="M13 23h38l-8 12H29v11h13v7H18v-7h5V35L13 30ZM25 12h15v11H25Z"/>',
    '<path d="M32 18 9 11l9 21-6 11 18-6 2 17 3-17 17 6-6-11 9-21ZM26 25h12l-6 9Z"/>',
    '<path d="m12 21 12 10 8-19 8 19 12-10-5 27H17ZM17 42h30"/>',
    '<path d="m32 9 19 11-4 26-15 10-15-10-4-26ZM20 26l10 4m14-4-10 4m-2-8v17m-8 5 8 4 8-4"/>',
    '',
    '<circle cx="25" cy="23" r="12"/><path d="m33 32 18 19m-6-6 7-7m-14 0 6-6"/>'
];
const cache = new Map();
export function getSlotSymbolIcon(theme, symbol) {
    if (!palettes[theme]) theme = 'earth';
    const index = Number.isInteger(symbol) && symbol >= 0 && symbol < 8 ? symbol : 0;
    const key = `${theme}:${index}`;
    if (cache.has(key)) return cache.get(key);
    const [base, accent] = palettes[theme];
    const motif = index === 6 ? emblems[theme] : motifs[index];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="g"><stop stop-color="#${base}"/><stop offset="1" stop-color="#0d141e"/></radialGradient></defs><rect x="1" y="1" width="62" height="62" rx="10" fill="url(#g)" stroke="#${accent}" stroke-opacity=".5"/><g fill="none" stroke="#${accent}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${motif}</g>${index === 4 ? `<g transform="translate(19 24) scale(.4)" fill="none" stroke="#fff4d7" stroke-width="3">${emblems[theme]}</g>` : ''}</svg>`;
    const uri = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`; cache.set(key, uri); return uri;
}
