import { TextDecoder, TextEncoder } from 'node:util';

// jsdom does not expose Node's encoding globals, but protobufjs 8 uses them
// during module initialization.
globalThis.TextDecoder ??= TextDecoder;
globalThis.TextEncoder ??= TextEncoder;
