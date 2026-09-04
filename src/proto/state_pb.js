/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-mixed-operators, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars, default-case, jsdoc/require-param*/
const $protobuf = globalThis.protobuf;

if (!$protobuf) {
    throw new Error("protobufjs minimal not found on globalThis.protobuf. Load the pinned local browser runtime before importing state_pb.js.");
}

// Common aliases
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;
const $Object = $util.global.Object, $undefined = $util.global.undefined, $Error = $util.global.Error, $TypeError = $util.global.TypeError, $Number = $util.global.Number, $parseInt = $util.global.parseInt, $String = $util.global.String, $BigInt = $util.global.BigInt, $Array = $util.global.Array, $Boolean = $util.global.Boolean, $isFinite = $util.global.isFinite;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const eidolon = $root.eidolon = (() => {

    /**
     * Namespace eidolon.
     * @exports eidolon
     * @namespace
     */
    const eidolon = {};

    eidolon.state = (function() {

        /**
         * Namespace state.
         * @memberof eidolon
         * @namespace
         */
        const state = {};

        state.StateEnvelope = (function() {

            /**
             * Properties of a StateEnvelope.
             * @typedef {Object} eidolon.state.StateEnvelope.$Properties
             * @property {number|null} [version] StateEnvelope version
             * @property {eidolon.state.StateFull.$Properties|null} [full] StateEnvelope full
             * @property {eidolon.state.StateDelta.$Properties|null} [delta] StateEnvelope delta
             * @property {number|null} [serverTimeMs] StateEnvelope serverTimeMs
             * @property {"full"|"delta"} [payload] StateEnvelope payload
             * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
             */

            /**
             * Properties of a StateEnvelope.
             * @memberof eidolon.state
             * @interface IStateEnvelope
             * @augments eidolon.state.StateEnvelope.$Properties
             * @deprecated Use eidolon.state.StateEnvelope.$Properties instead.
             */

            /**
             * Narrowed shape of a StateEnvelope.
             * @typedef {{
             *   version?: number|null;
             *   full?: eidolon.state.StateFull.$Shape|null;
             *   delta?: eidolon.state.StateDelta.$Shape|null;
             *   serverTimeMs?: number|null;
             *   $unknowns?: Array.<Uint8Array>;
             * } & (
             *   ({ payload?: undefined; full?: null; delta?: null }|{ payload?: "full"; full: eidolon.state.StateFull.$Shape; delta?: null }|{ payload?: "delta"; full?: null; delta: eidolon.state.StateDelta.$Shape })
             * )} eidolon.state.StateEnvelope.$Shape
             */

            /**
             * Constructs a new StateEnvelope.
             * @memberof eidolon.state
             * @classdesc Represents a StateEnvelope.
             * @constructor
             * @param {eidolon.state.StateEnvelope.$Properties=} [properties] Properties to set
             * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
             */
            const StateEnvelope = function (properties) {
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            /**
             * StateEnvelope version.
             * @member {number} version
             * @memberof eidolon.state.StateEnvelope
             * @instance
             */
            StateEnvelope.prototype.version = 0;

            /**
             * StateEnvelope full.
             * @member {eidolon.state.StateFull.$Properties|null|undefined} full
             * @memberof eidolon.state.StateEnvelope
             * @instance
             */
            StateEnvelope.prototype.full = null;

            /**
             * StateEnvelope delta.
             * @member {eidolon.state.StateDelta.$Properties|null|undefined} delta
             * @memberof eidolon.state.StateEnvelope
             * @instance
             */
            StateEnvelope.prototype.delta = null;

            /**
             * StateEnvelope serverTimeMs.
             * @member {number} serverTimeMs
             * @memberof eidolon.state.StateEnvelope
             * @instance
             */
            StateEnvelope.prototype.serverTimeMs = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            // OneOf field names bound to virtual getters and setters
            let $oneOfFields;

            /**
             * StateEnvelope payload.
             * @member {"full"|"delta"|undefined} payload
             * @memberof eidolon.state.StateEnvelope
             * @instance
             */
            $Object.defineProperty(StateEnvelope.prototype, "payload", {
                get: $util.oneOfGetter($oneOfFields = ["full", "delta"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            /**
             * Creates a new StateEnvelope instance using the specified properties.
             * @function create
             * @memberof eidolon.state.StateEnvelope
             * @static
             * @param {eidolon.state.StateEnvelope.$Properties=} [properties] Properties to set
             * @returns {eidolon.state.StateEnvelope} StateEnvelope instance
             * @type {{
             *   (properties: eidolon.state.StateEnvelope.$Shape): eidolon.state.StateEnvelope & eidolon.state.StateEnvelope.$Shape;
             *   (properties?: eidolon.state.StateEnvelope.$Properties): eidolon.state.StateEnvelope;
             * }}
             */
            StateEnvelope.create = function(properties) {
                return new StateEnvelope(properties);
            };

            /**
             * Encodes the specified StateEnvelope message. Does not implicitly {@link eidolon.state.StateEnvelope.verify|verify} messages.
             * @function encode
             * @memberof eidolon.state.StateEnvelope
             * @static
             * @param {eidolon.state.StateEnvelope.$Properties} message StateEnvelope message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            StateEnvelope.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.version != null && $Object.hasOwnProperty.call(message, "version") && message.version !== 0)
                    writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.version);
                if (message.full != null && $Object.hasOwnProperty.call(message, "full"))
                    $root.eidolon.state.StateFull.encode(message.full, writer.uint32(/* id 2, wireType 2 =*/18).fork(), _depth + 1).ldelim();
                if (message.delta != null && $Object.hasOwnProperty.call(message, "delta"))
                    $root.eidolon.state.StateDelta.encode(message.delta, writer.uint32(/* id 3, wireType 2 =*/26).fork(), _depth + 1).ldelim();
                if (message.serverTimeMs != null && $Object.hasOwnProperty.call(message, "serverTimeMs") && (typeof message.serverTimeMs === "object" ? message.serverTimeMs.low || message.serverTimeMs.high : message.serverTimeMs !== 0))
                    writer.uint32(/* id 4, wireType 0 =*/32).uint64(message.serverTimeMs);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            /**
             * Encodes the specified StateEnvelope message, length delimited. Does not implicitly {@link eidolon.state.StateEnvelope.verify|verify} messages.
             * @function encodeDelimited
             * @memberof eidolon.state.StateEnvelope
             * @static
             * @param {eidolon.state.StateEnvelope.$Properties} message StateEnvelope message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            StateEnvelope.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            /**
             * Decodes a StateEnvelope message from the specified reader or buffer.
             * @function decode
             * @memberof eidolon.state.StateEnvelope
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {eidolon.state.StateEnvelope & eidolon.state.StateEnvelope.$Shape} StateEnvelope
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            StateEnvelope.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.eidolon.state.StateEnvelope(), value;
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.uint32())
                                message.version = value;
                            else
                                delete message.version;
                            continue;
                        }
                    case 2: {
                            if (wireType !== 2)
                                break;
                            message.full = $root.eidolon.state.StateFull.decode(reader, reader.uint32(), $undefined, _depth + 1, message.full);
                            message.payload = "full";
                            continue;
                        }
                    case 3: {
                            if (wireType !== 2)
                                break;
                            message.delta = $root.eidolon.state.StateDelta.decode(reader, reader.uint32(), $undefined, _depth + 1, message.delta);
                            message.payload = "delta";
                            continue;
                        }
                    case 4: {
                            if (wireType !== 0)
                                break;
                            if (typeof (value = reader.uint64()) === "object" ? value.low || value.high : value !== 0)
                                message.serverTimeMs = value;
                            else
                                delete message.serverTimeMs;
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            /**
             * Decodes a StateEnvelope message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof eidolon.state.StateEnvelope
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {eidolon.state.StateEnvelope & eidolon.state.StateEnvelope.$Shape} StateEnvelope
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            StateEnvelope.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a StateEnvelope message.
             * @function verify
             * @memberof eidolon.state.StateEnvelope
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            StateEnvelope.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                let properties = {};
                if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
                    if (!$util.isInteger(message.version))
                        return "version: integer expected";
                if (message.full != null && $Object.hasOwnProperty.call(message, "full")) {
                    properties.payload = 1;
                    {
                        let error = $root.eidolon.state.StateFull.verify(message.full, _depth + 1);
                        if (error)
                            return "full." + error;
                    }
                }
                if (message.delta != null && $Object.hasOwnProperty.call(message, "delta")) {
                    if (properties.payload === 1)
                        return "payload: multiple values";
                    properties.payload = 1;
                    {
                        let error = $root.eidolon.state.StateDelta.verify(message.delta, _depth + 1);
                        if (error)
                            return "delta." + error;
                    }
                }
                if (message.serverTimeMs != null && $Object.hasOwnProperty.call(message, "serverTimeMs"))
                    if (!$util.isInteger(message.serverTimeMs) && !(message.serverTimeMs && $util.isInteger(message.serverTimeMs.low) && $util.isInteger(message.serverTimeMs.high)))
                        return "serverTimeMs: integer|Long expected";
                return null;
            };

            /**
             * Creates a StateEnvelope message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof eidolon.state.StateEnvelope
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {eidolon.state.StateEnvelope} StateEnvelope
             */
            StateEnvelope.fromObject = function (object, _depth) {
                if (object instanceof $root.eidolon.state.StateEnvelope)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".eidolon.state.StateEnvelope: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.eidolon.state.StateEnvelope();
                if (object.version != null)
                    if ($Number(object.version) !== 0)
                        message.version = object.version >>> 0;
                if (object.full != null) {
                    if (!$util.isObject(object.full))
                        throw $TypeError(".eidolon.state.StateEnvelope.full: object expected");
                    message.full = $root.eidolon.state.StateFull.fromObject(object.full, _depth + 1);
                }
                if (object.delta != null) {
                    if (!$util.isObject(object.delta))
                        throw $TypeError(".eidolon.state.StateEnvelope.delta: object expected");
                    message.delta = $root.eidolon.state.StateDelta.fromObject(object.delta, _depth + 1);
                }
                if (object.serverTimeMs != null)
                    if (typeof object.serverTimeMs === "object" ? object.serverTimeMs.low || object.serverTimeMs.high : $Number(object.serverTimeMs) !== 0)
                        if ($util.Long)
                            message.serverTimeMs = $util.Long.fromValue(object.serverTimeMs, true);
                        else if (typeof object.serverTimeMs === "string")
                            message.serverTimeMs = $parseInt(object.serverTimeMs, 10);
                        else if (typeof object.serverTimeMs === "number")
                            message.serverTimeMs = object.serverTimeMs;
                        else if (typeof object.serverTimeMs === "object")
                            message.serverTimeMs = new $util.LongBits(object.serverTimeMs.low >>> 0, object.serverTimeMs.high >>> 0).toNumber(true);
                return message;
            };

            /**
             * Creates a plain object from a StateEnvelope message. Also converts values to other types if specified.
             * @function toObject
             * @memberof eidolon.state.StateEnvelope
             * @static
             * @param {eidolon.state.StateEnvelope} message StateEnvelope
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            StateEnvelope.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    object.version = 0;
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.serverTimeMs = options.longs === $String ? long.toString() : options.longs === $Number ? long.toNumber() : typeof $BigInt !== "undefined" && options.longs === $BigInt ? long.toBigInt() : long;
                    } else
                        object.serverTimeMs = options.longs === $String ? "0" : typeof $BigInt !== "undefined" && options.longs === $BigInt ? $BigInt("0") : 0;
                }
                if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
                    object.version = message.version;
                if (message.full != null && $Object.hasOwnProperty.call(message, "full")) {
                    object.full = $root.eidolon.state.StateFull.toObject(message.full, options, _depth + 1);
                    if (options.oneofs)
                        object.payload = "full";
                }
                if (message.delta != null && $Object.hasOwnProperty.call(message, "delta")) {
                    object.delta = $root.eidolon.state.StateDelta.toObject(message.delta, options, _depth + 1);
                    if (options.oneofs)
                        object.payload = "delta";
                }
                if (message.serverTimeMs != null && $Object.hasOwnProperty.call(message, "serverTimeMs"))
                    if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
                        object.serverTimeMs = typeof message.serverTimeMs === "number" ? $BigInt(message.serverTimeMs) : $util.Long.fromBits(message.serverTimeMs.low >>> 0, message.serverTimeMs.high >>> 0, true).toBigInt();
                    else if (typeof message.serverTimeMs === "number")
                        object.serverTimeMs = options.longs === $String ? $String(message.serverTimeMs) : message.serverTimeMs;
                    else
                        object.serverTimeMs = options.longs === $String ? $util.Long.prototype.toString.call(message.serverTimeMs) : options.longs === $Number ? new $util.LongBits(message.serverTimeMs.low >>> 0, message.serverTimeMs.high >>> 0).toNumber(true) : message.serverTimeMs;
                return object;
            };

            /**
             * Converts this StateEnvelope to JSON.
             * @function toJSON
             * @memberof eidolon.state.StateEnvelope
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            StateEnvelope.prototype.toJSON = function() {
                return StateEnvelope.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the type url for StateEnvelope
             * @function getTypeUrl
             * @memberof eidolon.state.StateEnvelope
             * @static
             * @param {string} [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
             * @returns {string} The type url
             */
            StateEnvelope.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/eidolon.state.StateEnvelope";
            };

            return StateEnvelope;
        })();

        state.StateFull = (function() {

            /**
             * Properties of a StateFull.
             * @typedef {Object} eidolon.state.StateFull.$Properties
             * @property {Array.<eidolon.state.Entity.$Properties>|null} [entities] StateFull entities
             * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
             */

            /**
             * Properties of a StateFull.
             * @memberof eidolon.state
             * @interface IStateFull
             * @augments eidolon.state.StateFull.$Properties
             * @deprecated Use eidolon.state.StateFull.$Properties instead.
             */

            /**
             * Shape of a StateFull.
             * @typedef {eidolon.state.StateFull.$Properties} eidolon.state.StateFull.$Shape
             */

            /**
             * Constructs a new StateFull.
             * @memberof eidolon.state
             * @classdesc Represents a StateFull.
             * @constructor
             * @param {eidolon.state.StateFull.$Properties=} [properties] Properties to set
             * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
             */
            const StateFull = function (properties) {
                this.entities = [];
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            /**
             * StateFull entities.
             * @member {Array.<eidolon.state.Entity.$Properties>} entities
             * @memberof eidolon.state.StateFull
             * @instance
             */
            StateFull.prototype.entities = $util.emptyArray;

            /**
             * Creates a new StateFull instance using the specified properties.
             * @function create
             * @memberof eidolon.state.StateFull
             * @static
             * @param {eidolon.state.StateFull.$Properties=} [properties] Properties to set
             * @returns {eidolon.state.StateFull} StateFull instance
             * @type {{
             *   (properties: eidolon.state.StateFull.$Shape): eidolon.state.StateFull & eidolon.state.StateFull.$Shape;
             *   (properties?: eidolon.state.StateFull.$Properties): eidolon.state.StateFull;
             * }}
             */
            StateFull.create = function(properties) {
                return new StateFull(properties);
            };

            /**
             * Encodes the specified StateFull message. Does not implicitly {@link eidolon.state.StateFull.verify|verify} messages.
             * @function encode
             * @memberof eidolon.state.StateFull
             * @static
             * @param {eidolon.state.StateFull.$Properties} message StateFull message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            StateFull.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.entities != null && message.entities.length)
                    for (let i = 0; i < message.entities.length; ++i)
                        $root.eidolon.state.Entity.encode(message.entities[i], writer.uint32(/* id 1, wireType 2 =*/10).fork(), _depth + 1).ldelim();
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            /**
             * Encodes the specified StateFull message, length delimited. Does not implicitly {@link eidolon.state.StateFull.verify|verify} messages.
             * @function encodeDelimited
             * @memberof eidolon.state.StateFull
             * @static
             * @param {eidolon.state.StateFull.$Properties} message StateFull message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            StateFull.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            /**
             * Decodes a StateFull message from the specified reader or buffer.
             * @function decode
             * @memberof eidolon.state.StateFull
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {eidolon.state.StateFull & eidolon.state.StateFull.$Shape} StateFull
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            StateFull.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.eidolon.state.StateFull();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 2)
                                break;
                            if (!(message.entities && message.entities.length))
                                message.entities = [];
                            message.entities.push($root.eidolon.state.Entity.decode(reader, reader.uint32(), $undefined, _depth + 1));
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            /**
             * Decodes a StateFull message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof eidolon.state.StateFull
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {eidolon.state.StateFull & eidolon.state.StateFull.$Shape} StateFull
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            StateFull.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a StateFull message.
             * @function verify
             * @memberof eidolon.state.StateFull
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            StateFull.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.entities != null && $Object.hasOwnProperty.call(message, "entities")) {
                    if (!$Array.isArray(message.entities))
                        return "entities: array expected";
                    for (let i = 0; i < message.entities.length; ++i) {
                        let error = $root.eidolon.state.Entity.verify(message.entities[i], _depth + 1);
                        if (error)
                            return "entities." + error;
                    }
                }
                return null;
            };

            /**
             * Creates a StateFull message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof eidolon.state.StateFull
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {eidolon.state.StateFull} StateFull
             */
            StateFull.fromObject = function (object, _depth) {
                if (object instanceof $root.eidolon.state.StateFull)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".eidolon.state.StateFull: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.eidolon.state.StateFull();
                if (object.entities) {
                    if (!$Array.isArray(object.entities))
                        throw $TypeError(".eidolon.state.StateFull.entities: array expected");
                    message.entities = $Array(object.entities.length);
                    for (let i = 0; i < object.entities.length; ++i) {
                        if (!$util.isObject(object.entities[i]))
                            throw $TypeError(".eidolon.state.StateFull.entities: object expected");
                        message.entities[i] = $root.eidolon.state.Entity.fromObject(object.entities[i], _depth + 1);
                    }
                }
                return message;
            };

            /**
             * Creates a plain object from a StateFull message. Also converts values to other types if specified.
             * @function toObject
             * @memberof eidolon.state.StateFull
             * @static
             * @param {eidolon.state.StateFull} message StateFull
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            StateFull.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.arrays || options.defaults)
                    object.entities = [];
                if (message.entities && message.entities.length) {
                    object.entities = $Array(message.entities.length);
                    for (let j = 0; j < message.entities.length; ++j)
                        object.entities[j] = $root.eidolon.state.Entity.toObject(message.entities[j], options, _depth + 1);
                }
                return object;
            };

            /**
             * Converts this StateFull to JSON.
             * @function toJSON
             * @memberof eidolon.state.StateFull
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            StateFull.prototype.toJSON = function() {
                return StateFull.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the type url for StateFull
             * @function getTypeUrl
             * @memberof eidolon.state.StateFull
             * @static
             * @param {string} [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
             * @returns {string} The type url
             */
            StateFull.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/eidolon.state.StateFull";
            };

            return StateFull;
        })();

        state.StateDelta = (function() {

            /**
             * Properties of a StateDelta.
             * @typedef {Object} eidolon.state.StateDelta.$Properties
             * @property {Array.<eidolon.state.Entity.$Properties>|null} [entities] StateDelta entities
             * @property {Array.<string>|null} [removedIds] StateDelta removedIds
             * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
             */

            /**
             * Properties of a StateDelta.
             * @memberof eidolon.state
             * @interface IStateDelta
             * @augments eidolon.state.StateDelta.$Properties
             * @deprecated Use eidolon.state.StateDelta.$Properties instead.
             */

            /**
             * Shape of a StateDelta.
             * @typedef {eidolon.state.StateDelta.$Properties} eidolon.state.StateDelta.$Shape
             */

            /**
             * Constructs a new StateDelta.
             * @memberof eidolon.state
             * @classdesc Represents a StateDelta.
             * @constructor
             * @param {eidolon.state.StateDelta.$Properties=} [properties] Properties to set
             * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
             */
            const StateDelta = function (properties) {
                this.entities = [];
                this.removedIds = [];
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            /**
             * StateDelta entities.
             * @member {Array.<eidolon.state.Entity.$Properties>} entities
             * @memberof eidolon.state.StateDelta
             * @instance
             */
            StateDelta.prototype.entities = $util.emptyArray;

            /**
             * StateDelta removedIds.
             * @member {Array.<string>} removedIds
             * @memberof eidolon.state.StateDelta
             * @instance
             */
            StateDelta.prototype.removedIds = $util.emptyArray;

            /**
             * Creates a new StateDelta instance using the specified properties.
             * @function create
             * @memberof eidolon.state.StateDelta
             * @static
             * @param {eidolon.state.StateDelta.$Properties=} [properties] Properties to set
             * @returns {eidolon.state.StateDelta} StateDelta instance
             * @type {{
             *   (properties: eidolon.state.StateDelta.$Shape): eidolon.state.StateDelta & eidolon.state.StateDelta.$Shape;
             *   (properties?: eidolon.state.StateDelta.$Properties): eidolon.state.StateDelta;
             * }}
             */
            StateDelta.create = function(properties) {
                return new StateDelta(properties);
            };

            /**
             * Encodes the specified StateDelta message. Does not implicitly {@link eidolon.state.StateDelta.verify|verify} messages.
             * @function encode
             * @memberof eidolon.state.StateDelta
             * @static
             * @param {eidolon.state.StateDelta.$Properties} message StateDelta message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            StateDelta.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.entities != null && message.entities.length)
                    for (let i = 0; i < message.entities.length; ++i)
                        $root.eidolon.state.Entity.encode(message.entities[i], writer.uint32(/* id 1, wireType 2 =*/10).fork(), _depth + 1).ldelim();
                if (message.removedIds != null && message.removedIds.length)
                    for (let i = 0; i < message.removedIds.length; ++i)
                        writer.uint32(/* id 2, wireType 2 =*/18).string(message.removedIds[i]);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            /**
             * Encodes the specified StateDelta message, length delimited. Does not implicitly {@link eidolon.state.StateDelta.verify|verify} messages.
             * @function encodeDelimited
             * @memberof eidolon.state.StateDelta
             * @static
             * @param {eidolon.state.StateDelta.$Properties} message StateDelta message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            StateDelta.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            /**
             * Decodes a StateDelta message from the specified reader or buffer.
             * @function decode
             * @memberof eidolon.state.StateDelta
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {eidolon.state.StateDelta & eidolon.state.StateDelta.$Shape} StateDelta
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            StateDelta.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.eidolon.state.StateDelta();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 2)
                                break;
                            if (!(message.entities && message.entities.length))
                                message.entities = [];
                            message.entities.push($root.eidolon.state.Entity.decode(reader, reader.uint32(), $undefined, _depth + 1));
                            continue;
                        }
                    case 2: {
                            if (wireType !== 2)
                                break;
                            if (!(message.removedIds && message.removedIds.length))
                                message.removedIds = [];
                            message.removedIds.push(reader.stringVerify());
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            /**
             * Decodes a StateDelta message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof eidolon.state.StateDelta
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {eidolon.state.StateDelta & eidolon.state.StateDelta.$Shape} StateDelta
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            StateDelta.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a StateDelta message.
             * @function verify
             * @memberof eidolon.state.StateDelta
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            StateDelta.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.entities != null && $Object.hasOwnProperty.call(message, "entities")) {
                    if (!$Array.isArray(message.entities))
                        return "entities: array expected";
                    for (let i = 0; i < message.entities.length; ++i) {
                        let error = $root.eidolon.state.Entity.verify(message.entities[i], _depth + 1);
                        if (error)
                            return "entities." + error;
                    }
                }
                if (message.removedIds != null && $Object.hasOwnProperty.call(message, "removedIds")) {
                    if (!$Array.isArray(message.removedIds))
                        return "removedIds: array expected";
                    for (let i = 0; i < message.removedIds.length; ++i)
                        if (!$util.isString(message.removedIds[i]))
                            return "removedIds: string[] expected";
                }
                return null;
            };

            /**
             * Creates a StateDelta message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof eidolon.state.StateDelta
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {eidolon.state.StateDelta} StateDelta
             */
            StateDelta.fromObject = function (object, _depth) {
                if (object instanceof $root.eidolon.state.StateDelta)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".eidolon.state.StateDelta: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.eidolon.state.StateDelta();
                if (object.entities) {
                    if (!$Array.isArray(object.entities))
                        throw $TypeError(".eidolon.state.StateDelta.entities: array expected");
                    message.entities = $Array(object.entities.length);
                    for (let i = 0; i < object.entities.length; ++i) {
                        if (!$util.isObject(object.entities[i]))
                            throw $TypeError(".eidolon.state.StateDelta.entities: object expected");
                        message.entities[i] = $root.eidolon.state.Entity.fromObject(object.entities[i], _depth + 1);
                    }
                }
                if (object.removedIds) {
                    if (!$Array.isArray(object.removedIds))
                        throw $TypeError(".eidolon.state.StateDelta.removedIds: array expected");
                    message.removedIds = $Array(object.removedIds.length);
                    for (let i = 0; i < object.removedIds.length; ++i)
                        message.removedIds[i] = $String(object.removedIds[i]);
                }
                return message;
            };

            /**
             * Creates a plain object from a StateDelta message. Also converts values to other types if specified.
             * @function toObject
             * @memberof eidolon.state.StateDelta
             * @static
             * @param {eidolon.state.StateDelta} message StateDelta
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            StateDelta.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.arrays || options.defaults) {
                    object.entities = [];
                    object.removedIds = [];
                }
                if (message.entities && message.entities.length) {
                    object.entities = $Array(message.entities.length);
                    for (let j = 0; j < message.entities.length; ++j)
                        object.entities[j] = $root.eidolon.state.Entity.toObject(message.entities[j], options, _depth + 1);
                }
                if (message.removedIds && message.removedIds.length) {
                    object.removedIds = $Array(message.removedIds.length);
                    for (let j = 0; j < message.removedIds.length; ++j)
                        object.removedIds[j] = message.removedIds[j];
                }
                return object;
            };

            /**
             * Converts this StateDelta to JSON.
             * @function toJSON
             * @memberof eidolon.state.StateDelta
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            StateDelta.prototype.toJSON = function() {
                return StateDelta.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the type url for StateDelta
             * @function getTypeUrl
             * @memberof eidolon.state.StateDelta
             * @static
             * @param {string} [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
             * @returns {string} The type url
             */
            StateDelta.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/eidolon.state.StateDelta";
            };

            return StateDelta;
        })();

        state.Stats = (function() {

            /**
             * Properties of a Stats.
             * @typedef {Object} eidolon.state.Stats.$Properties
             * @property {number|null} [strength] Stats strength
             * @property {number|null} [dexterity] Stats dexterity
             * @property {number|null} [intelligence] Stats intelligence
             * @property {number|null} [wisdom] Stats wisdom
             * @property {number|null} [vitality] Stats vitality
             * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
             */

            /**
             * Properties of a Stats.
             * @memberof eidolon.state
             * @interface IStats
             * @augments eidolon.state.Stats.$Properties
             * @deprecated Use eidolon.state.Stats.$Properties instead.
             */

            /**
             * Shape of a Stats.
             * @typedef {eidolon.state.Stats.$Properties} eidolon.state.Stats.$Shape
             */

            /**
             * Constructs a new Stats.
             * @memberof eidolon.state
             * @classdesc Represents a Stats.
             * @constructor
             * @param {eidolon.state.Stats.$Properties=} [properties] Properties to set
             * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
             */
            const Stats = function (properties) {
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            /**
             * Stats strength.
             * @member {number} strength
             * @memberof eidolon.state.Stats
             * @instance
             */
            Stats.prototype.strength = 0;

            /**
             * Stats dexterity.
             * @member {number} dexterity
             * @memberof eidolon.state.Stats
             * @instance
             */
            Stats.prototype.dexterity = 0;

            /**
             * Stats intelligence.
             * @member {number} intelligence
             * @memberof eidolon.state.Stats
             * @instance
             */
            Stats.prototype.intelligence = 0;

            /**
             * Stats wisdom.
             * @member {number} wisdom
             * @memberof eidolon.state.Stats
             * @instance
             */
            Stats.prototype.wisdom = 0;

            /**
             * Stats vitality.
             * @member {number} vitality
             * @memberof eidolon.state.Stats
             * @instance
             */
            Stats.prototype.vitality = 0;

            /**
             * Creates a new Stats instance using the specified properties.
             * @function create
             * @memberof eidolon.state.Stats
             * @static
             * @param {eidolon.state.Stats.$Properties=} [properties] Properties to set
             * @returns {eidolon.state.Stats} Stats instance
             * @type {{
             *   (properties: eidolon.state.Stats.$Shape): eidolon.state.Stats & eidolon.state.Stats.$Shape;
             *   (properties?: eidolon.state.Stats.$Properties): eidolon.state.Stats;
             * }}
             */
            Stats.create = function(properties) {
                return new Stats(properties);
            };

            /**
             * Encodes the specified Stats message. Does not implicitly {@link eidolon.state.Stats.verify|verify} messages.
             * @function encode
             * @memberof eidolon.state.Stats
             * @static
             * @param {eidolon.state.Stats.$Properties} message Stats message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Stats.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.strength != null && $Object.hasOwnProperty.call(message, "strength") && message.strength !== 0)
                    writer.uint32(/* id 1, wireType 0 =*/8).int32(message.strength);
                if (message.dexterity != null && $Object.hasOwnProperty.call(message, "dexterity") && message.dexterity !== 0)
                    writer.uint32(/* id 2, wireType 0 =*/16).int32(message.dexterity);
                if (message.intelligence != null && $Object.hasOwnProperty.call(message, "intelligence") && message.intelligence !== 0)
                    writer.uint32(/* id 3, wireType 0 =*/24).int32(message.intelligence);
                if (message.wisdom != null && $Object.hasOwnProperty.call(message, "wisdom") && message.wisdom !== 0)
                    writer.uint32(/* id 4, wireType 0 =*/32).int32(message.wisdom);
                if (message.vitality != null && $Object.hasOwnProperty.call(message, "vitality") && message.vitality !== 0)
                    writer.uint32(/* id 5, wireType 0 =*/40).int32(message.vitality);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            /**
             * Encodes the specified Stats message, length delimited. Does not implicitly {@link eidolon.state.Stats.verify|verify} messages.
             * @function encodeDelimited
             * @memberof eidolon.state.Stats
             * @static
             * @param {eidolon.state.Stats.$Properties} message Stats message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Stats.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            /**
             * Decodes a Stats message from the specified reader or buffer.
             * @function decode
             * @memberof eidolon.state.Stats
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {eidolon.state.Stats & eidolon.state.Stats.$Shape} Stats
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Stats.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.eidolon.state.Stats(), value;
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.strength = value;
                            else
                                delete message.strength;
                            continue;
                        }
                    case 2: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.dexterity = value;
                            else
                                delete message.dexterity;
                            continue;
                        }
                    case 3: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.intelligence = value;
                            else
                                delete message.intelligence;
                            continue;
                        }
                    case 4: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.wisdom = value;
                            else
                                delete message.wisdom;
                            continue;
                        }
                    case 5: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.vitality = value;
                            else
                                delete message.vitality;
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            /**
             * Decodes a Stats message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof eidolon.state.Stats
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {eidolon.state.Stats & eidolon.state.Stats.$Shape} Stats
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Stats.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a Stats message.
             * @function verify
             * @memberof eidolon.state.Stats
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            Stats.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.strength != null && $Object.hasOwnProperty.call(message, "strength"))
                    if (!$util.isInteger(message.strength))
                        return "strength: integer expected";
                if (message.dexterity != null && $Object.hasOwnProperty.call(message, "dexterity"))
                    if (!$util.isInteger(message.dexterity))
                        return "dexterity: integer expected";
                if (message.intelligence != null && $Object.hasOwnProperty.call(message, "intelligence"))
                    if (!$util.isInteger(message.intelligence))
                        return "intelligence: integer expected";
                if (message.wisdom != null && $Object.hasOwnProperty.call(message, "wisdom"))
                    if (!$util.isInteger(message.wisdom))
                        return "wisdom: integer expected";
                if (message.vitality != null && $Object.hasOwnProperty.call(message, "vitality"))
                    if (!$util.isInteger(message.vitality))
                        return "vitality: integer expected";
                return null;
            };

            /**
             * Creates a Stats message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof eidolon.state.Stats
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {eidolon.state.Stats} Stats
             */
            Stats.fromObject = function (object, _depth) {
                if (object instanceof $root.eidolon.state.Stats)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".eidolon.state.Stats: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.eidolon.state.Stats();
                if (object.strength != null)
                    if ($Number(object.strength) !== 0)
                        message.strength = object.strength | 0;
                if (object.dexterity != null)
                    if ($Number(object.dexterity) !== 0)
                        message.dexterity = object.dexterity | 0;
                if (object.intelligence != null)
                    if ($Number(object.intelligence) !== 0)
                        message.intelligence = object.intelligence | 0;
                if (object.wisdom != null)
                    if ($Number(object.wisdom) !== 0)
                        message.wisdom = object.wisdom | 0;
                if (object.vitality != null)
                    if ($Number(object.vitality) !== 0)
                        message.vitality = object.vitality | 0;
                return message;
            };

            /**
             * Creates a plain object from a Stats message. Also converts values to other types if specified.
             * @function toObject
             * @memberof eidolon.state.Stats
             * @static
             * @param {eidolon.state.Stats} message Stats
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Stats.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    object.strength = 0;
                    object.dexterity = 0;
                    object.intelligence = 0;
                    object.wisdom = 0;
                    object.vitality = 0;
                }
                if (message.strength != null && $Object.hasOwnProperty.call(message, "strength"))
                    object.strength = message.strength;
                if (message.dexterity != null && $Object.hasOwnProperty.call(message, "dexterity"))
                    object.dexterity = message.dexterity;
                if (message.intelligence != null && $Object.hasOwnProperty.call(message, "intelligence"))
                    object.intelligence = message.intelligence;
                if (message.wisdom != null && $Object.hasOwnProperty.call(message, "wisdom"))
                    object.wisdom = message.wisdom;
                if (message.vitality != null && $Object.hasOwnProperty.call(message, "vitality"))
                    object.vitality = message.vitality;
                return object;
            };

            /**
             * Converts this Stats to JSON.
             * @function toJSON
             * @memberof eidolon.state.Stats
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Stats.prototype.toJSON = function() {
                return Stats.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the type url for Stats
             * @function getTypeUrl
             * @memberof eidolon.state.Stats
             * @static
             * @param {string} [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
             * @returns {string} The type url
             */
            Stats.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/eidolon.state.Stats";
            };

            return Stats;
        })();

        state.Quest = (function() {

            /**
             * Properties of a Quest.
             * @typedef {Object} eidolon.state.Quest.$Properties
             * @property {string|null} [id] Quest id
             * @property {string|null} [type] Quest type
             * @property {string|null} [target] Quest target
             * @property {number|null} [count] Quest count
             * @property {number|null} [maxCount] Quest maxCount
             * @property {number|null} [rewardXp] Quest rewardXp
             * @property {boolean|null} [completed] Quest completed
             * @property {boolean|null} [accepted] Quest accepted
             * @property {string|null} [title] Quest title
             * @property {string|null} [description] Quest description
             * @property {string|null} [lore] Quest lore
             * @property {string|null} [category] Quest category
             * @property {number|null} [chapter] Quest chapter
             * @property {string|null} [objectiveText] Quest objectiveText
             * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
             */

            /**
             * Properties of a Quest.
             * @memberof eidolon.state
             * @interface IQuest
             * @augments eidolon.state.Quest.$Properties
             * @deprecated Use eidolon.state.Quest.$Properties instead.
             */

            /**
             * Shape of a Quest.
             * @typedef {eidolon.state.Quest.$Properties} eidolon.state.Quest.$Shape
             */

            /**
             * Constructs a new Quest.
             * @memberof eidolon.state
             * @classdesc Represents a Quest.
             * @constructor
             * @param {eidolon.state.Quest.$Properties=} [properties] Properties to set
             * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
             */
            const Quest = function (properties) {
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            /**
             * Quest id.
             * @member {string} id
             * @memberof eidolon.state.Quest
             * @instance
             */
            Quest.prototype.id = "";

            /**
             * Quest type.
             * @member {string} type
             * @memberof eidolon.state.Quest
             * @instance
             */
            Quest.prototype.type = "";

            /**
             * Quest target.
             * @member {string} target
             * @memberof eidolon.state.Quest
             * @instance
             */
            Quest.prototype.target = "";

            /**
             * Quest count.
             * @member {number} count
             * @memberof eidolon.state.Quest
             * @instance
             */
            Quest.prototype.count = 0;

            /**
             * Quest maxCount.
             * @member {number} maxCount
             * @memberof eidolon.state.Quest
             * @instance
             */
            Quest.prototype.maxCount = 0;

            /**
             * Quest rewardXp.
             * @member {number} rewardXp
             * @memberof eidolon.state.Quest
             * @instance
             */
            Quest.prototype.rewardXp = 0;

            /**
             * Quest completed.
             * @member {boolean} completed
             * @memberof eidolon.state.Quest
             * @instance
             */
            Quest.prototype.completed = false;

            /**
             * Quest accepted.
             * @member {boolean} accepted
             * @memberof eidolon.state.Quest
             * @instance
             */
            Quest.prototype.accepted = false;

            /**
             * Quest title.
             * @member {string} title
             * @memberof eidolon.state.Quest
             * @instance
             */
            Quest.prototype.title = "";

            /**
             * Quest description.
             * @member {string} description
             * @memberof eidolon.state.Quest
             * @instance
             */
            Quest.prototype.description = "";

            /**
             * Quest lore.
             * @member {string} lore
             * @memberof eidolon.state.Quest
             * @instance
             */
            Quest.prototype.lore = "";

            /**
             * Quest category.
             * @member {string} category
             * @memberof eidolon.state.Quest
             * @instance
             */
            Quest.prototype.category = "";

            /**
             * Quest chapter.
             * @member {number} chapter
             * @memberof eidolon.state.Quest
             * @instance
             */
            Quest.prototype.chapter = 0;

            /**
             * Quest objectiveText.
             * @member {string} objectiveText
             * @memberof eidolon.state.Quest
             * @instance
             */
            Quest.prototype.objectiveText = "";

            /**
             * Creates a new Quest instance using the specified properties.
             * @function create
             * @memberof eidolon.state.Quest
             * @static
             * @param {eidolon.state.Quest.$Properties=} [properties] Properties to set
             * @returns {eidolon.state.Quest} Quest instance
             * @type {{
             *   (properties: eidolon.state.Quest.$Shape): eidolon.state.Quest & eidolon.state.Quest.$Shape;
             *   (properties?: eidolon.state.Quest.$Properties): eidolon.state.Quest;
             * }}
             */
            Quest.create = function(properties) {
                return new Quest(properties);
            };

            /**
             * Encodes the specified Quest message. Does not implicitly {@link eidolon.state.Quest.verify|verify} messages.
             * @function encode
             * @memberof eidolon.state.Quest
             * @static
             * @param {eidolon.state.Quest.$Properties} message Quest message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Quest.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.id != null && $Object.hasOwnProperty.call(message, "id") && message.id !== "")
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
                if (message.type != null && $Object.hasOwnProperty.call(message, "type") && message.type !== "")
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.type);
                if (message.target != null && $Object.hasOwnProperty.call(message, "target") && message.target !== "")
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.target);
                if (message.count != null && $Object.hasOwnProperty.call(message, "count") && message.count !== 0)
                    writer.uint32(/* id 4, wireType 0 =*/32).int32(message.count);
                if (message.maxCount != null && $Object.hasOwnProperty.call(message, "maxCount") && message.maxCount !== 0)
                    writer.uint32(/* id 5, wireType 0 =*/40).int32(message.maxCount);
                if (message.rewardXp != null && $Object.hasOwnProperty.call(message, "rewardXp") && message.rewardXp !== 0)
                    writer.uint32(/* id 6, wireType 0 =*/48).int32(message.rewardXp);
                if (message.completed != null && $Object.hasOwnProperty.call(message, "completed") && message.completed !== false)
                    writer.uint32(/* id 7, wireType 0 =*/56).bool(message.completed);
                if (message.accepted != null && $Object.hasOwnProperty.call(message, "accepted") && message.accepted !== false)
                    writer.uint32(/* id 8, wireType 0 =*/64).bool(message.accepted);
                if (message.title != null && $Object.hasOwnProperty.call(message, "title") && message.title !== "")
                    writer.uint32(/* id 9, wireType 2 =*/74).string(message.title);
                if (message.description != null && $Object.hasOwnProperty.call(message, "description") && message.description !== "")
                    writer.uint32(/* id 10, wireType 2 =*/82).string(message.description);
                if (message.lore != null && $Object.hasOwnProperty.call(message, "lore") && message.lore !== "")
                    writer.uint32(/* id 11, wireType 2 =*/90).string(message.lore);
                if (message.category != null && $Object.hasOwnProperty.call(message, "category") && message.category !== "")
                    writer.uint32(/* id 12, wireType 2 =*/98).string(message.category);
                if (message.chapter != null && $Object.hasOwnProperty.call(message, "chapter") && message.chapter !== 0)
                    writer.uint32(/* id 13, wireType 0 =*/104).int32(message.chapter);
                if (message.objectiveText != null && $Object.hasOwnProperty.call(message, "objectiveText") && message.objectiveText !== "")
                    writer.uint32(/* id 14, wireType 2 =*/114).string(message.objectiveText);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            /**
             * Encodes the specified Quest message, length delimited. Does not implicitly {@link eidolon.state.Quest.verify|verify} messages.
             * @function encodeDelimited
             * @memberof eidolon.state.Quest
             * @static
             * @param {eidolon.state.Quest.$Properties} message Quest message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Quest.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            /**
             * Decodes a Quest message from the specified reader or buffer.
             * @function decode
             * @memberof eidolon.state.Quest
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {eidolon.state.Quest & eidolon.state.Quest.$Shape} Quest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Quest.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.eidolon.state.Quest(), value;
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.id = value;
                            else
                                delete message.id;
                            continue;
                        }
                    case 2: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.type = value;
                            else
                                delete message.type;
                            continue;
                        }
                    case 3: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.target = value;
                            else
                                delete message.target;
                            continue;
                        }
                    case 4: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.count = value;
                            else
                                delete message.count;
                            continue;
                        }
                    case 5: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.maxCount = value;
                            else
                                delete message.maxCount;
                            continue;
                        }
                    case 6: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.rewardXp = value;
                            else
                                delete message.rewardXp;
                            continue;
                        }
                    case 7: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.completed = value;
                            else
                                delete message.completed;
                            continue;
                        }
                    case 8: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.accepted = value;
                            else
                                delete message.accepted;
                            continue;
                        }
                    case 9: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.title = value;
                            else
                                delete message.title;
                            continue;
                        }
                    case 10: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.description = value;
                            else
                                delete message.description;
                            continue;
                        }
                    case 11: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.lore = value;
                            else
                                delete message.lore;
                            continue;
                        }
                    case 12: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.category = value;
                            else
                                delete message.category;
                            continue;
                        }
                    case 13: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.chapter = value;
                            else
                                delete message.chapter;
                            continue;
                        }
                    case 14: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.objectiveText = value;
                            else
                                delete message.objectiveText;
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            /**
             * Decodes a Quest message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof eidolon.state.Quest
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {eidolon.state.Quest & eidolon.state.Quest.$Shape} Quest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Quest.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a Quest message.
             * @function verify
             * @memberof eidolon.state.Quest
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            Quest.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.id != null && $Object.hasOwnProperty.call(message, "id"))
                    if (!$util.isString(message.id))
                        return "id: string expected";
                if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                    if (!$util.isString(message.type))
                        return "type: string expected";
                if (message.target != null && $Object.hasOwnProperty.call(message, "target"))
                    if (!$util.isString(message.target))
                        return "target: string expected";
                if (message.count != null && $Object.hasOwnProperty.call(message, "count"))
                    if (!$util.isInteger(message.count))
                        return "count: integer expected";
                if (message.maxCount != null && $Object.hasOwnProperty.call(message, "maxCount"))
                    if (!$util.isInteger(message.maxCount))
                        return "maxCount: integer expected";
                if (message.rewardXp != null && $Object.hasOwnProperty.call(message, "rewardXp"))
                    if (!$util.isInteger(message.rewardXp))
                        return "rewardXp: integer expected";
                if (message.completed != null && $Object.hasOwnProperty.call(message, "completed"))
                    if (typeof message.completed !== "boolean")
                        return "completed: boolean expected";
                if (message.accepted != null && $Object.hasOwnProperty.call(message, "accepted"))
                    if (typeof message.accepted !== "boolean")
                        return "accepted: boolean expected";
                if (message.title != null && $Object.hasOwnProperty.call(message, "title"))
                    if (!$util.isString(message.title))
                        return "title: string expected";
                if (message.description != null && $Object.hasOwnProperty.call(message, "description"))
                    if (!$util.isString(message.description))
                        return "description: string expected";
                if (message.lore != null && $Object.hasOwnProperty.call(message, "lore"))
                    if (!$util.isString(message.lore))
                        return "lore: string expected";
                if (message.category != null && $Object.hasOwnProperty.call(message, "category"))
                    if (!$util.isString(message.category))
                        return "category: string expected";
                if (message.chapter != null && $Object.hasOwnProperty.call(message, "chapter"))
                    if (!$util.isInteger(message.chapter))
                        return "chapter: integer expected";
                if (message.objectiveText != null && $Object.hasOwnProperty.call(message, "objectiveText"))
                    if (!$util.isString(message.objectiveText))
                        return "objectiveText: string expected";
                return null;
            };

            /**
             * Creates a Quest message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof eidolon.state.Quest
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {eidolon.state.Quest} Quest
             */
            Quest.fromObject = function (object, _depth) {
                if (object instanceof $root.eidolon.state.Quest)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".eidolon.state.Quest: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.eidolon.state.Quest();
                if (object.id != null)
                    if (typeof object.id !== "string" || object.id.length)
                        message.id = $String(object.id);
                if (object.type != null)
                    if (typeof object.type !== "string" || object.type.length)
                        message.type = $String(object.type);
                if (object.target != null)
                    if (typeof object.target !== "string" || object.target.length)
                        message.target = $String(object.target);
                if (object.count != null)
                    if ($Number(object.count) !== 0)
                        message.count = object.count | 0;
                if (object.maxCount != null)
                    if ($Number(object.maxCount) !== 0)
                        message.maxCount = object.maxCount | 0;
                if (object.rewardXp != null)
                    if ($Number(object.rewardXp) !== 0)
                        message.rewardXp = object.rewardXp | 0;
                if (object.completed != null)
                    if (object.completed)
                        message.completed = $Boolean(object.completed);
                if (object.accepted != null)
                    if (object.accepted)
                        message.accepted = $Boolean(object.accepted);
                if (object.title != null)
                    if (typeof object.title !== "string" || object.title.length)
                        message.title = $String(object.title);
                if (object.description != null)
                    if (typeof object.description !== "string" || object.description.length)
                        message.description = $String(object.description);
                if (object.lore != null)
                    if (typeof object.lore !== "string" || object.lore.length)
                        message.lore = $String(object.lore);
                if (object.category != null)
                    if (typeof object.category !== "string" || object.category.length)
                        message.category = $String(object.category);
                if (object.chapter != null)
                    if ($Number(object.chapter) !== 0)
                        message.chapter = object.chapter | 0;
                if (object.objectiveText != null)
                    if (typeof object.objectiveText !== "string" || object.objectiveText.length)
                        message.objectiveText = $String(object.objectiveText);
                return message;
            };

            /**
             * Creates a plain object from a Quest message. Also converts values to other types if specified.
             * @function toObject
             * @memberof eidolon.state.Quest
             * @static
             * @param {eidolon.state.Quest} message Quest
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Quest.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    object.id = "";
                    object.type = "";
                    object.target = "";
                    object.count = 0;
                    object.maxCount = 0;
                    object.rewardXp = 0;
                    object.completed = false;
                    object.accepted = false;
                    object.title = "";
                    object.description = "";
                    object.lore = "";
                    object.category = "";
                    object.chapter = 0;
                    object.objectiveText = "";
                }
                if (message.id != null && $Object.hasOwnProperty.call(message, "id"))
                    object.id = message.id;
                if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                    object.type = message.type;
                if (message.target != null && $Object.hasOwnProperty.call(message, "target"))
                    object.target = message.target;
                if (message.count != null && $Object.hasOwnProperty.call(message, "count"))
                    object.count = message.count;
                if (message.maxCount != null && $Object.hasOwnProperty.call(message, "maxCount"))
                    object.maxCount = message.maxCount;
                if (message.rewardXp != null && $Object.hasOwnProperty.call(message, "rewardXp"))
                    object.rewardXp = message.rewardXp;
                if (message.completed != null && $Object.hasOwnProperty.call(message, "completed"))
                    object.completed = message.completed;
                if (message.accepted != null && $Object.hasOwnProperty.call(message, "accepted"))
                    object.accepted = message.accepted;
                if (message.title != null && $Object.hasOwnProperty.call(message, "title"))
                    object.title = message.title;
                if (message.description != null && $Object.hasOwnProperty.call(message, "description"))
                    object.description = message.description;
                if (message.lore != null && $Object.hasOwnProperty.call(message, "lore"))
                    object.lore = message.lore;
                if (message.category != null && $Object.hasOwnProperty.call(message, "category"))
                    object.category = message.category;
                if (message.chapter != null && $Object.hasOwnProperty.call(message, "chapter"))
                    object.chapter = message.chapter;
                if (message.objectiveText != null && $Object.hasOwnProperty.call(message, "objectiveText"))
                    object.objectiveText = message.objectiveText;
                return object;
            };

            /**
             * Converts this Quest to JSON.
             * @function toJSON
             * @memberof eidolon.state.Quest
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Quest.prototype.toJSON = function() {
                return Quest.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the type url for Quest
             * @function getTypeUrl
             * @memberof eidolon.state.Quest
             * @static
             * @param {string} [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
             * @returns {string} The type url
             */
            Quest.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/eidolon.state.Quest";
            };

            return Quest;
        })();

        state.SocketedGem = (function() {

            /**
             * Properties of a SocketedGem.
             * @typedef {Object} eidolon.state.SocketedGem.$Properties
             * @property {string|null} [type] SocketedGem type
             * @property {string|null} [quality] SocketedGem quality
             * @property {Object.<string,number>|null} [stats] SocketedGem stats
             * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
             */

            /**
             * Properties of a SocketedGem.
             * @memberof eidolon.state
             * @interface ISocketedGem
             * @augments eidolon.state.SocketedGem.$Properties
             * @deprecated Use eidolon.state.SocketedGem.$Properties instead.
             */

            /**
             * Shape of a SocketedGem.
             * @typedef {eidolon.state.SocketedGem.$Properties} eidolon.state.SocketedGem.$Shape
             */

            /**
             * Constructs a new SocketedGem.
             * @memberof eidolon.state
             * @classdesc Represents a SocketedGem.
             * @constructor
             * @param {eidolon.state.SocketedGem.$Properties=} [properties] Properties to set
             * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
             */
            const SocketedGem = function (properties) {
                this.stats = {};
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            /**
             * SocketedGem type.
             * @member {string} type
             * @memberof eidolon.state.SocketedGem
             * @instance
             */
            SocketedGem.prototype.type = "";

            /**
             * SocketedGem quality.
             * @member {string} quality
             * @memberof eidolon.state.SocketedGem
             * @instance
             */
            SocketedGem.prototype.quality = "";

            /**
             * SocketedGem stats.
             * @member {Object.<string,number>} stats
             * @memberof eidolon.state.SocketedGem
             * @instance
             */
            SocketedGem.prototype.stats = $util.emptyObject;

            /**
             * Creates a new SocketedGem instance using the specified properties.
             * @function create
             * @memberof eidolon.state.SocketedGem
             * @static
             * @param {eidolon.state.SocketedGem.$Properties=} [properties] Properties to set
             * @returns {eidolon.state.SocketedGem} SocketedGem instance
             * @type {{
             *   (properties: eidolon.state.SocketedGem.$Shape): eidolon.state.SocketedGem & eidolon.state.SocketedGem.$Shape;
             *   (properties?: eidolon.state.SocketedGem.$Properties): eidolon.state.SocketedGem;
             * }}
             */
            SocketedGem.create = function(properties) {
                return new SocketedGem(properties);
            };

            /**
             * Encodes the specified SocketedGem message. Does not implicitly {@link eidolon.state.SocketedGem.verify|verify} messages.
             * @function encode
             * @memberof eidolon.state.SocketedGem
             * @static
             * @param {eidolon.state.SocketedGem.$Properties} message SocketedGem message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            SocketedGem.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.type != null && $Object.hasOwnProperty.call(message, "type") && message.type !== "")
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.type);
                if (message.quality != null && $Object.hasOwnProperty.call(message, "quality") && message.quality !== "")
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.quality);
                if (message.stats != null && $Object.hasOwnProperty.call(message, "stats"))
                    for (let keys = $Object.keys(message.stats), i = 0; i < keys.length; ++i)
                        writer.uint32(/* id 3, wireType 2 =*/26).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]).uint32(/* id 2, wireType 0 =*/16).int32(message.stats[keys[i]]).ldelim();
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            /**
             * Encodes the specified SocketedGem message, length delimited. Does not implicitly {@link eidolon.state.SocketedGem.verify|verify} messages.
             * @function encodeDelimited
             * @memberof eidolon.state.SocketedGem
             * @static
             * @param {eidolon.state.SocketedGem.$Properties} message SocketedGem message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            SocketedGem.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            /**
             * Decodes a SocketedGem message from the specified reader or buffer.
             * @function decode
             * @memberof eidolon.state.SocketedGem
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {eidolon.state.SocketedGem & eidolon.state.SocketedGem.$Shape} SocketedGem
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            SocketedGem.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.eidolon.state.SocketedGem(), key, value;
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.type = value;
                            else
                                delete message.type;
                            continue;
                        }
                    case 2: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.quality = value;
                            else
                                delete message.quality;
                            continue;
                        }
                    case 3: {
                            if (wireType !== 2)
                                break;
                            if (message.stats === $util.emptyObject)
                                message.stats = {};
                            let end2 = reader.uint32() + reader.pos;
                            key = "";
                            value = 0;
                            while (reader.pos < end2) {
                                let tag2 = reader.tag();
                                wireType = tag2 & 7;
                                switch (tag2 >>>= 3) {
                                case 1:
                                    if (wireType !== 2)
                                        break;
                                    key = reader.stringVerify();
                                    continue;
                                case 2:
                                    if (wireType !== 0)
                                        break;
                                    value = reader.int32();
                                    continue;
                                }
                                reader.skipType(wireType, _depth, tag2);
                            }
                            if (key === "__proto__")
                                $util.makeProp(message.stats, key);
                            message.stats[key] = value;
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            /**
             * Decodes a SocketedGem message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof eidolon.state.SocketedGem
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {eidolon.state.SocketedGem & eidolon.state.SocketedGem.$Shape} SocketedGem
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            SocketedGem.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies a SocketedGem message.
             * @function verify
             * @memberof eidolon.state.SocketedGem
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            SocketedGem.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                    if (!$util.isString(message.type))
                        return "type: string expected";
                if (message.quality != null && $Object.hasOwnProperty.call(message, "quality"))
                    if (!$util.isString(message.quality))
                        return "quality: string expected";
                if (message.stats != null && $Object.hasOwnProperty.call(message, "stats")) {
                    if (!$util.isObject(message.stats))
                        return "stats: object expected";
                    let key = $Object.keys(message.stats);
                    for (let i = 0; i < key.length; ++i)
                        if (!$util.isInteger(message.stats[key[i]]))
                            return "stats: integer{k:string} expected";
                }
                return null;
            };

            /**
             * Creates a SocketedGem message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof eidolon.state.SocketedGem
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {eidolon.state.SocketedGem} SocketedGem
             */
            SocketedGem.fromObject = function (object, _depth) {
                if (object instanceof $root.eidolon.state.SocketedGem)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".eidolon.state.SocketedGem: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.eidolon.state.SocketedGem();
                if (object.type != null)
                    if (typeof object.type !== "string" || object.type.length)
                        message.type = $String(object.type);
                if (object.quality != null)
                    if (typeof object.quality !== "string" || object.quality.length)
                        message.quality = $String(object.quality);
                if (object.stats) {
                    if (!$util.isObject(object.stats))
                        throw $TypeError(".eidolon.state.SocketedGem.stats: object expected");
                    message.stats = {};
                    for (let keys = $Object.keys(object.stats), i = 0; i < keys.length; ++i) {
                        if (keys[i] === "__proto__")
                            $util.makeProp(message.stats, keys[i]);
                        message.stats[keys[i]] = object.stats[keys[i]] | 0;
                    }
                }
                return message;
            };

            /**
             * Creates a plain object from a SocketedGem message. Also converts values to other types if specified.
             * @function toObject
             * @memberof eidolon.state.SocketedGem
             * @static
             * @param {eidolon.state.SocketedGem} message SocketedGem
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            SocketedGem.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.objects || options.defaults)
                    object.stats = {};
                if (options.defaults) {
                    object.type = "";
                    object.quality = "";
                }
                if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                    object.type = message.type;
                if (message.quality != null && $Object.hasOwnProperty.call(message, "quality"))
                    object.quality = message.quality;
                let keys2;
                if (message.stats && (keys2 = $Object.keys(message.stats)).length) {
                    object.stats = {};
                    for (let j = 0; j < keys2.length; ++j) {
                        if (keys2[j] === "__proto__")
                            $util.makeProp(object.stats, keys2[j]);
                        object.stats[keys2[j]] = message.stats[keys2[j]];
                    }
                }
                return object;
            };

            /**
             * Converts this SocketedGem to JSON.
             * @function toJSON
             * @memberof eidolon.state.SocketedGem
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            SocketedGem.prototype.toJSON = function() {
                return SocketedGem.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the type url for SocketedGem
             * @function getTypeUrl
             * @memberof eidolon.state.SocketedGem
             * @static
             * @param {string} [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
             * @returns {string} The type url
             */
            SocketedGem.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/eidolon.state.SocketedGem";
            };

            return SocketedGem;
        })();

        state.Item = (function() {

            /**
             * Properties of an Item.
             * @typedef {Object} eidolon.state.Item.$Properties
             * @property {string|null} [id] Item id
             * @property {string|null} [name] Item name
             * @property {string|null} [type] Item type
             * @property {string|null} [rarity] Item rarity
             * @property {string|null} [slot] Item slot
             * @property {number|null} [level] Item level
             * @property {Object.<string,number>|null} [stats] Item stats
             * @property {number|null} [value] Item value
             * @property {string|null} [icon] Item icon
             * @property {string|null} [description] Item description
             * @property {number|null} [stack] Item stack
             * @property {number|null} [maxStack] Item maxStack
             * @property {number|null} [potency] Item potency
             * @property {number|null} [sockets] Item sockets
             * @property {string|null} [gemType] Item gemType
             * @property {string|null} [gemQuality] Item gemQuality
             * @property {Array.<eidolon.state.SocketedGem.$Properties>|null} [gems] Item gems
             * @property {string|null} [setId] Item setId
             * @property {string|null} [uniqueEffect] Item uniqueEffect
             * @property {number|null} [statScaleVersion] Item statScaleVersion
             * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
             */

            /**
             * Properties of an Item.
             * @memberof eidolon.state
             * @interface IItem
             * @augments eidolon.state.Item.$Properties
             * @deprecated Use eidolon.state.Item.$Properties instead.
             */

            /**
             * Shape of an Item.
             * @typedef {eidolon.state.Item.$Properties} eidolon.state.Item.$Shape
             */

            /**
             * Constructs a new Item.
             * @memberof eidolon.state
             * @classdesc Represents an Item.
             * @constructor
             * @param {eidolon.state.Item.$Properties=} [properties] Properties to set
             * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
             */
            const Item = function (properties) {
                this.stats = {};
                this.gems = [];
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            /**
             * Item id.
             * @member {string} id
             * @memberof eidolon.state.Item
             * @instance
             */
            Item.prototype.id = "";

            /**
             * Item name.
             * @member {string} name
             * @memberof eidolon.state.Item
             * @instance
             */
            Item.prototype.name = "";

            /**
             * Item type.
             * @member {string} type
             * @memberof eidolon.state.Item
             * @instance
             */
            Item.prototype.type = "";

            /**
             * Item rarity.
             * @member {string} rarity
             * @memberof eidolon.state.Item
             * @instance
             */
            Item.prototype.rarity = "";

            /**
             * Item slot.
             * @member {string} slot
             * @memberof eidolon.state.Item
             * @instance
             */
            Item.prototype.slot = "";

            /**
             * Item level.
             * @member {number} level
             * @memberof eidolon.state.Item
             * @instance
             */
            Item.prototype.level = 0;

            /**
             * Item stats.
             * @member {Object.<string,number>} stats
             * @memberof eidolon.state.Item
             * @instance
             */
            Item.prototype.stats = $util.emptyObject;

            /**
             * Item value.
             * @member {number} value
             * @memberof eidolon.state.Item
             * @instance
             */
            Item.prototype.value = 0;

            /**
             * Item icon.
             * @member {string} icon
             * @memberof eidolon.state.Item
             * @instance
             */
            Item.prototype.icon = "";

            /**
             * Item description.
             * @member {string} description
             * @memberof eidolon.state.Item
             * @instance
             */
            Item.prototype.description = "";

            /**
             * Item stack.
             * @member {number} stack
             * @memberof eidolon.state.Item
             * @instance
             */
            Item.prototype.stack = 0;

            /**
             * Item maxStack.
             * @member {number} maxStack
             * @memberof eidolon.state.Item
             * @instance
             */
            Item.prototype.maxStack = 0;

            /**
             * Item potency.
             * @member {number} potency
             * @memberof eidolon.state.Item
             * @instance
             */
            Item.prototype.potency = 0;

            /**
             * Item sockets.
             * @member {number} sockets
             * @memberof eidolon.state.Item
             * @instance
             */
            Item.prototype.sockets = 0;

            /**
             * Item gemType.
             * @member {string} gemType
             * @memberof eidolon.state.Item
             * @instance
             */
            Item.prototype.gemType = "";

            /**
             * Item gemQuality.
             * @member {string} gemQuality
             * @memberof eidolon.state.Item
             * @instance
             */
            Item.prototype.gemQuality = "";

            /**
             * Item gems.
             * @member {Array.<eidolon.state.SocketedGem.$Properties>} gems
             * @memberof eidolon.state.Item
             * @instance
             */
            Item.prototype.gems = $util.emptyArray;

            /**
             * Item setId.
             * @member {string} setId
             * @memberof eidolon.state.Item
             * @instance
             */
            Item.prototype.setId = "";

            /**
             * Item uniqueEffect.
             * @member {string} uniqueEffect
             * @memberof eidolon.state.Item
             * @instance
             */
            Item.prototype.uniqueEffect = "";

            /**
             * Item statScaleVersion.
             * @member {number} statScaleVersion
             * @memberof eidolon.state.Item
             * @instance
             */
            Item.prototype.statScaleVersion = 0;

            /**
             * Creates a new Item instance using the specified properties.
             * @function create
             * @memberof eidolon.state.Item
             * @static
             * @param {eidolon.state.Item.$Properties=} [properties] Properties to set
             * @returns {eidolon.state.Item} Item instance
             * @type {{
             *   (properties: eidolon.state.Item.$Shape): eidolon.state.Item & eidolon.state.Item.$Shape;
             *   (properties?: eidolon.state.Item.$Properties): eidolon.state.Item;
             * }}
             */
            Item.create = function(properties) {
                return new Item(properties);
            };

            /**
             * Encodes the specified Item message. Does not implicitly {@link eidolon.state.Item.verify|verify} messages.
             * @function encode
             * @memberof eidolon.state.Item
             * @static
             * @param {eidolon.state.Item.$Properties} message Item message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Item.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.id != null && $Object.hasOwnProperty.call(message, "id") && message.id !== "")
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
                if (message.name != null && $Object.hasOwnProperty.call(message, "name") && message.name !== "")
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.name);
                if (message.type != null && $Object.hasOwnProperty.call(message, "type") && message.type !== "")
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.type);
                if (message.rarity != null && $Object.hasOwnProperty.call(message, "rarity") && message.rarity !== "")
                    writer.uint32(/* id 4, wireType 2 =*/34).string(message.rarity);
                if (message.slot != null && $Object.hasOwnProperty.call(message, "slot") && message.slot !== "")
                    writer.uint32(/* id 5, wireType 2 =*/42).string(message.slot);
                if (message.level != null && $Object.hasOwnProperty.call(message, "level") && message.level !== 0)
                    writer.uint32(/* id 6, wireType 0 =*/48).int32(message.level);
                if (message.stats != null && $Object.hasOwnProperty.call(message, "stats"))
                    for (let keys = $Object.keys(message.stats), i = 0; i < keys.length; ++i)
                        writer.uint32(/* id 7, wireType 2 =*/58).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]).uint32(/* id 2, wireType 0 =*/16).int32(message.stats[keys[i]]).ldelim();
                if (message.value != null && $Object.hasOwnProperty.call(message, "value") && message.value !== 0)
                    writer.uint32(/* id 8, wireType 0 =*/64).int32(message.value);
                if (message.icon != null && $Object.hasOwnProperty.call(message, "icon") && message.icon !== "")
                    writer.uint32(/* id 9, wireType 2 =*/74).string(message.icon);
                if (message.description != null && $Object.hasOwnProperty.call(message, "description") && message.description !== "")
                    writer.uint32(/* id 10, wireType 2 =*/82).string(message.description);
                if (message.stack != null && $Object.hasOwnProperty.call(message, "stack") && message.stack !== 0)
                    writer.uint32(/* id 11, wireType 0 =*/88).int32(message.stack);
                if (message.maxStack != null && $Object.hasOwnProperty.call(message, "maxStack") && message.maxStack !== 0)
                    writer.uint32(/* id 12, wireType 0 =*/96).int32(message.maxStack);
                if (message.potency != null && $Object.hasOwnProperty.call(message, "potency") && message.potency !== 0)
                    writer.uint32(/* id 13, wireType 0 =*/104).int32(message.potency);
                if (message.sockets != null && $Object.hasOwnProperty.call(message, "sockets") && message.sockets !== 0)
                    writer.uint32(/* id 14, wireType 0 =*/112).int32(message.sockets);
                if (message.gemType != null && $Object.hasOwnProperty.call(message, "gemType") && message.gemType !== "")
                    writer.uint32(/* id 15, wireType 2 =*/122).string(message.gemType);
                if (message.gemQuality != null && $Object.hasOwnProperty.call(message, "gemQuality") && message.gemQuality !== "")
                    writer.uint32(/* id 16, wireType 2 =*/130).string(message.gemQuality);
                if (message.gems != null && message.gems.length)
                    for (let i = 0; i < message.gems.length; ++i)
                        $root.eidolon.state.SocketedGem.encode(message.gems[i], writer.uint32(/* id 17, wireType 2 =*/138).fork(), _depth + 1).ldelim();
                if (message.setId != null && $Object.hasOwnProperty.call(message, "setId") && message.setId !== "")
                    writer.uint32(/* id 18, wireType 2 =*/146).string(message.setId);
                if (message.uniqueEffect != null && $Object.hasOwnProperty.call(message, "uniqueEffect") && message.uniqueEffect !== "")
                    writer.uint32(/* id 19, wireType 2 =*/154).string(message.uniqueEffect);
                if (message.statScaleVersion != null && $Object.hasOwnProperty.call(message, "statScaleVersion") && message.statScaleVersion !== 0)
                    writer.uint32(/* id 20, wireType 0 =*/160).int32(message.statScaleVersion);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            /**
             * Encodes the specified Item message, length delimited. Does not implicitly {@link eidolon.state.Item.verify|verify} messages.
             * @function encodeDelimited
             * @memberof eidolon.state.Item
             * @static
             * @param {eidolon.state.Item.$Properties} message Item message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Item.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            /**
             * Decodes an Item message from the specified reader or buffer.
             * @function decode
             * @memberof eidolon.state.Item
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {eidolon.state.Item & eidolon.state.Item.$Shape} Item
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Item.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.eidolon.state.Item(), key, value;
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.id = value;
                            else
                                delete message.id;
                            continue;
                        }
                    case 2: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.name = value;
                            else
                                delete message.name;
                            continue;
                        }
                    case 3: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.type = value;
                            else
                                delete message.type;
                            continue;
                        }
                    case 4: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.rarity = value;
                            else
                                delete message.rarity;
                            continue;
                        }
                    case 5: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.slot = value;
                            else
                                delete message.slot;
                            continue;
                        }
                    case 6: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.level = value;
                            else
                                delete message.level;
                            continue;
                        }
                    case 7: {
                            if (wireType !== 2)
                                break;
                            if (message.stats === $util.emptyObject)
                                message.stats = {};
                            let end2 = reader.uint32() + reader.pos;
                            key = "";
                            value = 0;
                            while (reader.pos < end2) {
                                let tag2 = reader.tag();
                                wireType = tag2 & 7;
                                switch (tag2 >>>= 3) {
                                case 1:
                                    if (wireType !== 2)
                                        break;
                                    key = reader.stringVerify();
                                    continue;
                                case 2:
                                    if (wireType !== 0)
                                        break;
                                    value = reader.int32();
                                    continue;
                                }
                                reader.skipType(wireType, _depth, tag2);
                            }
                            if (key === "__proto__")
                                $util.makeProp(message.stats, key);
                            message.stats[key] = value;
                            continue;
                        }
                    case 8: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.value = value;
                            else
                                delete message.value;
                            continue;
                        }
                    case 9: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.icon = value;
                            else
                                delete message.icon;
                            continue;
                        }
                    case 10: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.description = value;
                            else
                                delete message.description;
                            continue;
                        }
                    case 11: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.stack = value;
                            else
                                delete message.stack;
                            continue;
                        }
                    case 12: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.maxStack = value;
                            else
                                delete message.maxStack;
                            continue;
                        }
                    case 13: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.potency = value;
                            else
                                delete message.potency;
                            continue;
                        }
                    case 14: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.sockets = value;
                            else
                                delete message.sockets;
                            continue;
                        }
                    case 15: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.gemType = value;
                            else
                                delete message.gemType;
                            continue;
                        }
                    case 16: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.gemQuality = value;
                            else
                                delete message.gemQuality;
                            continue;
                        }
                    case 17: {
                            if (wireType !== 2)
                                break;
                            if (!(message.gems && message.gems.length))
                                message.gems = [];
                            message.gems.push($root.eidolon.state.SocketedGem.decode(reader, reader.uint32(), $undefined, _depth + 1));
                            continue;
                        }
                    case 18: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.setId = value;
                            else
                                delete message.setId;
                            continue;
                        }
                    case 19: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.uniqueEffect = value;
                            else
                                delete message.uniqueEffect;
                            continue;
                        }
                    case 20: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.statScaleVersion = value;
                            else
                                delete message.statScaleVersion;
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            /**
             * Decodes an Item message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof eidolon.state.Item
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {eidolon.state.Item & eidolon.state.Item.$Shape} Item
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Item.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies an Item message.
             * @function verify
             * @memberof eidolon.state.Item
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            Item.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.id != null && $Object.hasOwnProperty.call(message, "id"))
                    if (!$util.isString(message.id))
                        return "id: string expected";
                if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                    if (!$util.isString(message.name))
                        return "name: string expected";
                if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                    if (!$util.isString(message.type))
                        return "type: string expected";
                if (message.rarity != null && $Object.hasOwnProperty.call(message, "rarity"))
                    if (!$util.isString(message.rarity))
                        return "rarity: string expected";
                if (message.slot != null && $Object.hasOwnProperty.call(message, "slot"))
                    if (!$util.isString(message.slot))
                        return "slot: string expected";
                if (message.level != null && $Object.hasOwnProperty.call(message, "level"))
                    if (!$util.isInteger(message.level))
                        return "level: integer expected";
                if (message.stats != null && $Object.hasOwnProperty.call(message, "stats")) {
                    if (!$util.isObject(message.stats))
                        return "stats: object expected";
                    let key = $Object.keys(message.stats);
                    for (let i = 0; i < key.length; ++i)
                        if (!$util.isInteger(message.stats[key[i]]))
                            return "stats: integer{k:string} expected";
                }
                if (message.value != null && $Object.hasOwnProperty.call(message, "value"))
                    if (!$util.isInteger(message.value))
                        return "value: integer expected";
                if (message.icon != null && $Object.hasOwnProperty.call(message, "icon"))
                    if (!$util.isString(message.icon))
                        return "icon: string expected";
                if (message.description != null && $Object.hasOwnProperty.call(message, "description"))
                    if (!$util.isString(message.description))
                        return "description: string expected";
                if (message.stack != null && $Object.hasOwnProperty.call(message, "stack"))
                    if (!$util.isInteger(message.stack))
                        return "stack: integer expected";
                if (message.maxStack != null && $Object.hasOwnProperty.call(message, "maxStack"))
                    if (!$util.isInteger(message.maxStack))
                        return "maxStack: integer expected";
                if (message.potency != null && $Object.hasOwnProperty.call(message, "potency"))
                    if (!$util.isInteger(message.potency))
                        return "potency: integer expected";
                if (message.sockets != null && $Object.hasOwnProperty.call(message, "sockets"))
                    if (!$util.isInteger(message.sockets))
                        return "sockets: integer expected";
                if (message.gemType != null && $Object.hasOwnProperty.call(message, "gemType"))
                    if (!$util.isString(message.gemType))
                        return "gemType: string expected";
                if (message.gemQuality != null && $Object.hasOwnProperty.call(message, "gemQuality"))
                    if (!$util.isString(message.gemQuality))
                        return "gemQuality: string expected";
                if (message.gems != null && $Object.hasOwnProperty.call(message, "gems")) {
                    if (!$Array.isArray(message.gems))
                        return "gems: array expected";
                    for (let i = 0; i < message.gems.length; ++i) {
                        let error = $root.eidolon.state.SocketedGem.verify(message.gems[i], _depth + 1);
                        if (error)
                            return "gems." + error;
                    }
                }
                if (message.setId != null && $Object.hasOwnProperty.call(message, "setId"))
                    if (!$util.isString(message.setId))
                        return "setId: string expected";
                if (message.uniqueEffect != null && $Object.hasOwnProperty.call(message, "uniqueEffect"))
                    if (!$util.isString(message.uniqueEffect))
                        return "uniqueEffect: string expected";
                if (message.statScaleVersion != null && $Object.hasOwnProperty.call(message, "statScaleVersion"))
                    if (!$util.isInteger(message.statScaleVersion))
                        return "statScaleVersion: integer expected";
                return null;
            };

            /**
             * Creates an Item message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof eidolon.state.Item
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {eidolon.state.Item} Item
             */
            Item.fromObject = function (object, _depth) {
                if (object instanceof $root.eidolon.state.Item)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".eidolon.state.Item: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.eidolon.state.Item();
                if (object.id != null)
                    if (typeof object.id !== "string" || object.id.length)
                        message.id = $String(object.id);
                if (object.name != null)
                    if (typeof object.name !== "string" || object.name.length)
                        message.name = $String(object.name);
                if (object.type != null)
                    if (typeof object.type !== "string" || object.type.length)
                        message.type = $String(object.type);
                if (object.rarity != null)
                    if (typeof object.rarity !== "string" || object.rarity.length)
                        message.rarity = $String(object.rarity);
                if (object.slot != null)
                    if (typeof object.slot !== "string" || object.slot.length)
                        message.slot = $String(object.slot);
                if (object.level != null)
                    if ($Number(object.level) !== 0)
                        message.level = object.level | 0;
                if (object.stats) {
                    if (!$util.isObject(object.stats))
                        throw $TypeError(".eidolon.state.Item.stats: object expected");
                    message.stats = {};
                    for (let keys = $Object.keys(object.stats), i = 0; i < keys.length; ++i) {
                        if (keys[i] === "__proto__")
                            $util.makeProp(message.stats, keys[i]);
                        message.stats[keys[i]] = object.stats[keys[i]] | 0;
                    }
                }
                if (object.value != null)
                    if ($Number(object.value) !== 0)
                        message.value = object.value | 0;
                if (object.icon != null)
                    if (typeof object.icon !== "string" || object.icon.length)
                        message.icon = $String(object.icon);
                if (object.description != null)
                    if (typeof object.description !== "string" || object.description.length)
                        message.description = $String(object.description);
                if (object.stack != null)
                    if ($Number(object.stack) !== 0)
                        message.stack = object.stack | 0;
                if (object.maxStack != null)
                    if ($Number(object.maxStack) !== 0)
                        message.maxStack = object.maxStack | 0;
                if (object.potency != null)
                    if ($Number(object.potency) !== 0)
                        message.potency = object.potency | 0;
                if (object.sockets != null)
                    if ($Number(object.sockets) !== 0)
                        message.sockets = object.sockets | 0;
                if (object.gemType != null)
                    if (typeof object.gemType !== "string" || object.gemType.length)
                        message.gemType = $String(object.gemType);
                if (object.gemQuality != null)
                    if (typeof object.gemQuality !== "string" || object.gemQuality.length)
                        message.gemQuality = $String(object.gemQuality);
                if (object.gems) {
                    if (!$Array.isArray(object.gems))
                        throw $TypeError(".eidolon.state.Item.gems: array expected");
                    message.gems = $Array(object.gems.length);
                    for (let i = 0; i < object.gems.length; ++i) {
                        if (!$util.isObject(object.gems[i]))
                            throw $TypeError(".eidolon.state.Item.gems: object expected");
                        message.gems[i] = $root.eidolon.state.SocketedGem.fromObject(object.gems[i], _depth + 1);
                    }
                }
                if (object.setId != null)
                    if (typeof object.setId !== "string" || object.setId.length)
                        message.setId = $String(object.setId);
                if (object.uniqueEffect != null)
                    if (typeof object.uniqueEffect !== "string" || object.uniqueEffect.length)
                        message.uniqueEffect = $String(object.uniqueEffect);
                if (object.statScaleVersion != null)
                    if ($Number(object.statScaleVersion) !== 0)
                        message.statScaleVersion = object.statScaleVersion | 0;
                return message;
            };

            /**
             * Creates a plain object from an Item message. Also converts values to other types if specified.
             * @function toObject
             * @memberof eidolon.state.Item
             * @static
             * @param {eidolon.state.Item} message Item
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Item.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.arrays || options.defaults)
                    object.gems = [];
                if (options.objects || options.defaults)
                    object.stats = {};
                if (options.defaults) {
                    object.id = "";
                    object.name = "";
                    object.type = "";
                    object.rarity = "";
                    object.slot = "";
                    object.level = 0;
                    object.value = 0;
                    object.icon = "";
                    object.description = "";
                    object.stack = 0;
                    object.maxStack = 0;
                    object.potency = 0;
                    object.sockets = 0;
                    object.gemType = "";
                    object.gemQuality = "";
                    object.setId = "";
                    object.uniqueEffect = "";
                    object.statScaleVersion = 0;
                }
                if (message.id != null && $Object.hasOwnProperty.call(message, "id"))
                    object.id = message.id;
                if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                    object.name = message.name;
                if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                    object.type = message.type;
                if (message.rarity != null && $Object.hasOwnProperty.call(message, "rarity"))
                    object.rarity = message.rarity;
                if (message.slot != null && $Object.hasOwnProperty.call(message, "slot"))
                    object.slot = message.slot;
                if (message.level != null && $Object.hasOwnProperty.call(message, "level"))
                    object.level = message.level;
                let keys2;
                if (message.stats && (keys2 = $Object.keys(message.stats)).length) {
                    object.stats = {};
                    for (let j = 0; j < keys2.length; ++j) {
                        if (keys2[j] === "__proto__")
                            $util.makeProp(object.stats, keys2[j]);
                        object.stats[keys2[j]] = message.stats[keys2[j]];
                    }
                }
                if (message.value != null && $Object.hasOwnProperty.call(message, "value"))
                    object.value = message.value;
                if (message.icon != null && $Object.hasOwnProperty.call(message, "icon"))
                    object.icon = message.icon;
                if (message.description != null && $Object.hasOwnProperty.call(message, "description"))
                    object.description = message.description;
                if (message.stack != null && $Object.hasOwnProperty.call(message, "stack"))
                    object.stack = message.stack;
                if (message.maxStack != null && $Object.hasOwnProperty.call(message, "maxStack"))
                    object.maxStack = message.maxStack;
                if (message.potency != null && $Object.hasOwnProperty.call(message, "potency"))
                    object.potency = message.potency;
                if (message.sockets != null && $Object.hasOwnProperty.call(message, "sockets"))
                    object.sockets = message.sockets;
                if (message.gemType != null && $Object.hasOwnProperty.call(message, "gemType"))
                    object.gemType = message.gemType;
                if (message.gemQuality != null && $Object.hasOwnProperty.call(message, "gemQuality"))
                    object.gemQuality = message.gemQuality;
                if (message.gems && message.gems.length) {
                    object.gems = $Array(message.gems.length);
                    for (let j = 0; j < message.gems.length; ++j)
                        object.gems[j] = $root.eidolon.state.SocketedGem.toObject(message.gems[j], options, _depth + 1);
                }
                if (message.setId != null && $Object.hasOwnProperty.call(message, "setId"))
                    object.setId = message.setId;
                if (message.uniqueEffect != null && $Object.hasOwnProperty.call(message, "uniqueEffect"))
                    object.uniqueEffect = message.uniqueEffect;
                if (message.statScaleVersion != null && $Object.hasOwnProperty.call(message, "statScaleVersion"))
                    object.statScaleVersion = message.statScaleVersion;
                return object;
            };

            /**
             * Converts this Item to JSON.
             * @function toJSON
             * @memberof eidolon.state.Item
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Item.prototype.toJSON = function() {
                return Item.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the type url for Item
             * @function getTypeUrl
             * @memberof eidolon.state.Item
             * @static
             * @param {string} [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
             * @returns {string} The type url
             */
            Item.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/eidolon.state.Item";
            };

            return Item;
        })();

        state.Entity = (function() {

            /**
             * Properties of an Entity.
             * @typedef {Object} eidolon.state.Entity.$Properties
             * @property {string|null} [id] Entity id
             * @property {string|null} [instanceId] Entity instanceId
             * @property {string|null} [name] Entity name
             * @property {string|null} [type] Entity type
             * @property {string|null} [subType] Entity subType
             * @property {number|null} [x] Entity x
             * @property {number|null} [y] Entity y
             * @property {number|null} [z] Entity z
             * @property {number|null} [rotation] Entity rotation
             * @property {number|null} [health] Entity health
             * @property {number|null} [maxHealth] Entity maxHealth
             * @property {number|null} [mana] Entity mana
             * @property {number|null} [maxMana] Entity maxMana
             * @property {number|null} [level] Entity level
             * @property {number|null} [experience] Entity experience
             * @property {number|null} [maxExperience] Entity maxExperience
             * @property {number|null} [gold] Entity gold
             * @property {number|null} [skillPoints] Entity skillPoints
             * @property {string|null} [selectedBranch] Entity selectedBranch
             * @property {Array.<string>|null} [unlockedSkills] Entity unlockedSkills
             * @property {eidolon.state.Stats.$Properties|null} [baseStats] Entity baseStats
             * @property {eidolon.state.Stats.$Properties|null} [stats] Entity stats
             * @property {number|null} [damage] Entity damage
             * @property {number|null} [defense] Entity defense
             * @property {number|null} [speed] Entity speed
             * @property {number|null} [attackSpeed] Entity attackSpeed
             * @property {number|null} [cooldownReduction] Entity cooldownReduction
             * @property {number|null} [hpRegen] Entity hpRegen
             * @property {number|null} [manaRegen] Entity manaRegen
             * @property {number|null} [castSpeed] Entity castSpeed
             * @property {number|null} [scale] Entity scale
             * @property {string|null} [state] Entity state
             * @property {Object.<string,eidolon.state.Item.$Properties>|null} [equipment] Entity equipment
             * @property {Array.<eidolon.state.Quest.$Properties>|null} [quests] Entity quests
             * @property {eidolon.state.Item.$Properties|null} [lootItem] Entity lootItem
             * @property {string|null} [ownerId] Entity ownerId
             * @property {number|null} [velX] Entity velX
             * @property {number|null} [velZ] Entity velZ
             * @property {boolean|null} [spiritsActive] Entity spiritsActive
             * @property {boolean|null} [spiritsBoosted] Entity spiritsBoosted
             * @property {boolean|null} [isCharging] Entity isCharging
             * @property {boolean|null} [guardianEmbraceActive] Entity guardianEmbraceActive
             * @property {boolean|null} [blessingResolveActive] Entity blessingResolveActive
             * @property {boolean|null} [divineInterventionActive] Entity divineInterventionActive
             * @property {boolean|null} [arcaneShieldActive] Entity arcaneShieldActive
             * @property {number|null} [arcaneShieldHp] Entity arcaneShieldHp
             * @property {boolean|null} [timeWarpActive] Entity timeWarpActive
             * @property {boolean|null} [spellFocusActive] Entity spellFocusActive
             * @property {boolean|null} [swiftActive] Entity swiftActive
             * @property {boolean|null} [ironFortressActive] Entity ironFortressActive
             * @property {boolean|null} [guardianRoarActive] Entity guardianRoarActive
             * @property {boolean|null} [berserkerModeActive] Entity berserkerModeActive
             * @property {boolean|null} [lastStandActive] Entity lastStandActive
             * @property {boolean|null} [serratedEdgesActive] Entity serratedEdgesActive
             * @property {boolean|null} [poisonCoatingActive] Entity poisonCoatingActive
             * @property {boolean|null} [stealthActive] Entity stealthActive
             * @property {boolean|null} [zealActive] Entity zealActive
             * @property {boolean|null} [stunned] Entity stunned
             * @property {boolean|null} [slowed] Entity slowed
             * @property {boolean|null} [rooted] Entity rooted
             * @property {boolean|null} [bleeding] Entity bleeding
             * @property {boolean|null} [poisoned] Entity poisoned
             * @property {boolean|null} [weakPointMarked] Entity weakPointMarked
             * @property {number|null} [weakPointDuration] Entity weakPointDuration
             * @property {boolean|null} [markWeakness] Entity markWeakness
             * @property {number|null} [markWeaknessDuration] Entity markWeaknessDuration
             * @property {number|null} [spiritDuration] Entity spiritDuration
             * @property {number|null} [blessingResolveDuration] Entity blessingResolveDuration
             * @property {number|null} [timeWarpDuration] Entity timeWarpDuration
             * @property {number|null} [guardianEmbraceDuration] Entity guardianEmbraceDuration
             * @property {number|null} [arcaneShieldDuration] Entity arcaneShieldDuration
             * @property {number|null} [divineInterventionDuration] Entity divineInterventionDuration
             * @property {number|null} [spellFocusDuration] Entity spellFocusDuration
             * @property {number|null} [swiftDuration] Entity swiftDuration
             * @property {number|null} [ironFortressDuration] Entity ironFortressDuration
             * @property {number|null} [guardianRoarDuration] Entity guardianRoarDuration
             * @property {number|null} [berserkerModeDuration] Entity berserkerModeDuration
             * @property {number|null} [lastStandDuration] Entity lastStandDuration
             * @property {number|null} [serratedEdgesDuration] Entity serratedEdgesDuration
             * @property {number|null} [poisonCoatingDuration] Entity poisonCoatingDuration
             * @property {number|null} [stealthDuration] Entity stealthDuration
             * @property {number|null} [zealDuration] Entity zealDuration
             * @property {number|null} [moveSequence] Entity moveSequence
             * @property {number|null} [slowFactor] Entity slowFactor
             * @property {number|null} [rootDuration] Entity rootDuration
             * @property {number|null} [stunDuration] Entity stunDuration
             * @property {number|null} [bleedDuration] Entity bleedDuration
             * @property {number|null} [poisonDuration] Entity poisonDuration
             * @property {number|null} [bleedDamage] Entity bleedDamage
             * @property {number|null} [poisonDamage] Entity poisonDamage
             * @property {number|null} [slowDuration] Entity slowDuration
             * @property {number|null} [talentPoints] Entity talentPoints
             * @property {Array.<string>|null} [unlockedTalents] Entity unlockedTalents
             * @property {Object.<string,number>|null} [talentRanks] Entity talentRanks
             * @property {Object.<string,string>|null} [skillRunes] Entity skillRunes
             * @property {string|null} [partyId] Entity partyId
             * @property {string|null} [socialStatus] Entity socialStatus
             * @property {string|null} [guildId] Entity guildId
             * @property {string|null} [guildTag] Entity guildTag
             * @property {number|null} [jumpStartX] Entity jumpStartX
             * @property {number|null} [jumpStartY] Entity jumpStartY
             * @property {number|null} [jumpStartZ] Entity jumpStartZ
             * @property {number|null} [jumpTargetX] Entity jumpTargetX
             * @property {number|null} [jumpTargetY] Entity jumpTargetY
             * @property {number|null} [jumpTargetZ] Entity jumpTargetZ
             * @property {number|null} [jumpDuration] Entity jumpDuration
             * @property {number|null} [jumpHeight] Entity jumpHeight
             * @property {number|null} [jumpProgress] Entity jumpProgress
             * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
             */

            /**
             * Properties of an Entity.
             * @memberof eidolon.state
             * @interface IEntity
             * @augments eidolon.state.Entity.$Properties
             * @deprecated Use eidolon.state.Entity.$Properties instead.
             */

            /**
             * Shape of an Entity.
             * @typedef {eidolon.state.Entity.$Properties} eidolon.state.Entity.$Shape
             */

            /**
             * Constructs a new Entity.
             * @memberof eidolon.state
             * @classdesc Represents an Entity.
             * @constructor
             * @param {eidolon.state.Entity.$Properties=} [properties] Properties to set
             * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
             */
            const Entity = function (properties) {
                this.unlockedSkills = [];
                this.equipment = {};
                this.quests = [];
                this.unlockedTalents = [];
                this.talentRanks = {};
                this.skillRunes = {};
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            /**
             * Entity id.
             * @member {string} id
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.id = "";

            /**
             * Entity instanceId.
             * @member {string} instanceId
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.instanceId = "";

            /**
             * Entity name.
             * @member {string} name
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.name = "";

            /**
             * Entity type.
             * @member {string} type
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.type = "";

            /**
             * Entity subType.
             * @member {string} subType
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.subType = "";

            /**
             * Entity x.
             * @member {number} x
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.x = 0;

            /**
             * Entity y.
             * @member {number} y
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.y = 0;

            /**
             * Entity z.
             * @member {number} z
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.z = 0;

            /**
             * Entity rotation.
             * @member {number} rotation
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.rotation = 0;

            /**
             * Entity health.
             * @member {number} health
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.health = 0;

            /**
             * Entity maxHealth.
             * @member {number} maxHealth
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.maxHealth = 0;

            /**
             * Entity mana.
             * @member {number} mana
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.mana = 0;

            /**
             * Entity maxMana.
             * @member {number} maxMana
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.maxMana = 0;

            /**
             * Entity level.
             * @member {number} level
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.level = 0;

            /**
             * Entity experience.
             * @member {number} experience
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.experience = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

            /**
             * Entity maxExperience.
             * @member {number} maxExperience
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.maxExperience = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

            /**
             * Entity gold.
             * @member {number} gold
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.gold = 0;

            /**
             * Entity skillPoints.
             * @member {number} skillPoints
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.skillPoints = 0;

            /**
             * Entity selectedBranch.
             * @member {string} selectedBranch
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.selectedBranch = "";

            /**
             * Entity unlockedSkills.
             * @member {Array.<string>} unlockedSkills
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.unlockedSkills = $util.emptyArray;

            /**
             * Entity baseStats.
             * @member {eidolon.state.Stats.$Properties|null|undefined} baseStats
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.baseStats = null;

            /**
             * Entity stats.
             * @member {eidolon.state.Stats.$Properties|null|undefined} stats
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.stats = null;

            /**
             * Entity damage.
             * @member {number} damage
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.damage = 0;

            /**
             * Entity defense.
             * @member {number} defense
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.defense = 0;

            /**
             * Entity speed.
             * @member {number} speed
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.speed = 0;

            /**
             * Entity attackSpeed.
             * @member {number} attackSpeed
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.attackSpeed = 0;

            /**
             * Entity cooldownReduction.
             * @member {number} cooldownReduction
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.cooldownReduction = 0;

            /**
             * Entity hpRegen.
             * @member {number} hpRegen
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.hpRegen = 0;

            /**
             * Entity manaRegen.
             * @member {number} manaRegen
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.manaRegen = 0;

            /**
             * Entity castSpeed.
             * @member {number} castSpeed
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.castSpeed = 0;

            /**
             * Entity scale.
             * @member {number} scale
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.scale = 0;

            /**
             * Entity state.
             * @member {string} state
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.state = "";

            /**
             * Entity equipment.
             * @member {Object.<string,eidolon.state.Item.$Properties>} equipment
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.equipment = $util.emptyObject;

            /**
             * Entity quests.
             * @member {Array.<eidolon.state.Quest.$Properties>} quests
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.quests = $util.emptyArray;

            /**
             * Entity lootItem.
             * @member {eidolon.state.Item.$Properties|null|undefined} lootItem
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.lootItem = null;

            /**
             * Entity ownerId.
             * @member {string} ownerId
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.ownerId = "";

            /**
             * Entity velX.
             * @member {number} velX
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.velX = 0;

            /**
             * Entity velZ.
             * @member {number} velZ
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.velZ = 0;

            /**
             * Entity spiritsActive.
             * @member {boolean} spiritsActive
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.spiritsActive = false;

            /**
             * Entity spiritsBoosted.
             * @member {boolean} spiritsBoosted
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.spiritsBoosted = false;

            /**
             * Entity isCharging.
             * @member {boolean} isCharging
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.isCharging = false;

            /**
             * Entity guardianEmbraceActive.
             * @member {boolean} guardianEmbraceActive
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.guardianEmbraceActive = false;

            /**
             * Entity blessingResolveActive.
             * @member {boolean} blessingResolveActive
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.blessingResolveActive = false;

            /**
             * Entity divineInterventionActive.
             * @member {boolean} divineInterventionActive
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.divineInterventionActive = false;

            /**
             * Entity arcaneShieldActive.
             * @member {boolean} arcaneShieldActive
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.arcaneShieldActive = false;

            /**
             * Entity arcaneShieldHp.
             * @member {number} arcaneShieldHp
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.arcaneShieldHp = 0;

            /**
             * Entity timeWarpActive.
             * @member {boolean} timeWarpActive
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.timeWarpActive = false;

            /**
             * Entity spellFocusActive.
             * @member {boolean} spellFocusActive
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.spellFocusActive = false;

            /**
             * Entity swiftActive.
             * @member {boolean} swiftActive
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.swiftActive = false;

            /**
             * Entity ironFortressActive.
             * @member {boolean} ironFortressActive
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.ironFortressActive = false;

            /**
             * Entity guardianRoarActive.
             * @member {boolean} guardianRoarActive
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.guardianRoarActive = false;

            /**
             * Entity berserkerModeActive.
             * @member {boolean} berserkerModeActive
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.berserkerModeActive = false;

            /**
             * Entity lastStandActive.
             * @member {boolean} lastStandActive
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.lastStandActive = false;

            /**
             * Entity serratedEdgesActive.
             * @member {boolean} serratedEdgesActive
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.serratedEdgesActive = false;

            /**
             * Entity poisonCoatingActive.
             * @member {boolean} poisonCoatingActive
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.poisonCoatingActive = false;

            /**
             * Entity stealthActive.
             * @member {boolean} stealthActive
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.stealthActive = false;

            /**
             * Entity zealActive.
             * @member {boolean} zealActive
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.zealActive = false;

            /**
             * Entity stunned.
             * @member {boolean} stunned
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.stunned = false;

            /**
             * Entity slowed.
             * @member {boolean} slowed
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.slowed = false;

            /**
             * Entity rooted.
             * @member {boolean} rooted
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.rooted = false;

            /**
             * Entity bleeding.
             * @member {boolean} bleeding
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.bleeding = false;

            /**
             * Entity poisoned.
             * @member {boolean} poisoned
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.poisoned = false;

            /**
             * Entity weakPointMarked.
             * @member {boolean} weakPointMarked
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.weakPointMarked = false;

            /**
             * Entity weakPointDuration.
             * @member {number} weakPointDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.weakPointDuration = 0;

            /**
             * Entity markWeakness.
             * @member {boolean} markWeakness
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.markWeakness = false;

            /**
             * Entity markWeaknessDuration.
             * @member {number} markWeaknessDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.markWeaknessDuration = 0;

            /**
             * Entity spiritDuration.
             * @member {number} spiritDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.spiritDuration = 0;

            /**
             * Entity blessingResolveDuration.
             * @member {number} blessingResolveDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.blessingResolveDuration = 0;

            /**
             * Entity timeWarpDuration.
             * @member {number} timeWarpDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.timeWarpDuration = 0;

            /**
             * Entity guardianEmbraceDuration.
             * @member {number} guardianEmbraceDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.guardianEmbraceDuration = 0;

            /**
             * Entity arcaneShieldDuration.
             * @member {number} arcaneShieldDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.arcaneShieldDuration = 0;

            /**
             * Entity divineInterventionDuration.
             * @member {number} divineInterventionDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.divineInterventionDuration = 0;

            /**
             * Entity spellFocusDuration.
             * @member {number} spellFocusDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.spellFocusDuration = 0;

            /**
             * Entity swiftDuration.
             * @member {number} swiftDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.swiftDuration = 0;

            /**
             * Entity ironFortressDuration.
             * @member {number} ironFortressDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.ironFortressDuration = 0;

            /**
             * Entity guardianRoarDuration.
             * @member {number} guardianRoarDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.guardianRoarDuration = 0;

            /**
             * Entity berserkerModeDuration.
             * @member {number} berserkerModeDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.berserkerModeDuration = 0;

            /**
             * Entity lastStandDuration.
             * @member {number} lastStandDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.lastStandDuration = 0;

            /**
             * Entity serratedEdgesDuration.
             * @member {number} serratedEdgesDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.serratedEdgesDuration = 0;

            /**
             * Entity poisonCoatingDuration.
             * @member {number} poisonCoatingDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.poisonCoatingDuration = 0;

            /**
             * Entity stealthDuration.
             * @member {number} stealthDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.stealthDuration = 0;

            /**
             * Entity zealDuration.
             * @member {number} zealDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.zealDuration = 0;

            /**
             * Entity moveSequence.
             * @member {number} moveSequence
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.moveSequence = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

            /**
             * Entity slowFactor.
             * @member {number} slowFactor
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.slowFactor = 0;

            /**
             * Entity rootDuration.
             * @member {number} rootDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.rootDuration = 0;

            /**
             * Entity stunDuration.
             * @member {number} stunDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.stunDuration = 0;

            /**
             * Entity bleedDuration.
             * @member {number} bleedDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.bleedDuration = 0;

            /**
             * Entity poisonDuration.
             * @member {number} poisonDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.poisonDuration = 0;

            /**
             * Entity bleedDamage.
             * @member {number} bleedDamage
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.bleedDamage = 0;

            /**
             * Entity poisonDamage.
             * @member {number} poisonDamage
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.poisonDamage = 0;

            /**
             * Entity slowDuration.
             * @member {number} slowDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.slowDuration = 0;

            /**
             * Entity talentPoints.
             * @member {number} talentPoints
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.talentPoints = 0;

            /**
             * Entity unlockedTalents.
             * @member {Array.<string>} unlockedTalents
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.unlockedTalents = $util.emptyArray;

            /**
             * Entity talentRanks.
             * @member {Object.<string,number>} talentRanks
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.talentRanks = $util.emptyObject;

            /**
             * Entity skillRunes.
             * @member {Object.<string,string>} skillRunes
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.skillRunes = $util.emptyObject;

            /**
             * Entity partyId.
             * @member {string} partyId
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.partyId = "";

            /**
             * Entity socialStatus.
             * @member {string} socialStatus
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.socialStatus = "";

            /**
             * Entity guildId.
             * @member {string} guildId
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.guildId = "";

            /**
             * Entity guildTag.
             * @member {string} guildTag
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.guildTag = "";

            /**
             * Entity jumpStartX.
             * @member {number} jumpStartX
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.jumpStartX = 0;

            /**
             * Entity jumpStartY.
             * @member {number} jumpStartY
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.jumpStartY = 0;

            /**
             * Entity jumpStartZ.
             * @member {number} jumpStartZ
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.jumpStartZ = 0;

            /**
             * Entity jumpTargetX.
             * @member {number} jumpTargetX
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.jumpTargetX = 0;

            /**
             * Entity jumpTargetY.
             * @member {number} jumpTargetY
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.jumpTargetY = 0;

            /**
             * Entity jumpTargetZ.
             * @member {number} jumpTargetZ
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.jumpTargetZ = 0;

            /**
             * Entity jumpDuration.
             * @member {number} jumpDuration
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.jumpDuration = 0;

            /**
             * Entity jumpHeight.
             * @member {number} jumpHeight
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.jumpHeight = 0;

            /**
             * Entity jumpProgress.
             * @member {number} jumpProgress
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.jumpProgress = 0;

            /**
             * Creates a new Entity instance using the specified properties.
             * @function create
             * @memberof eidolon.state.Entity
             * @static
             * @param {eidolon.state.Entity.$Properties=} [properties] Properties to set
             * @returns {eidolon.state.Entity} Entity instance
             * @type {{
             *   (properties: eidolon.state.Entity.$Shape): eidolon.state.Entity & eidolon.state.Entity.$Shape;
             *   (properties?: eidolon.state.Entity.$Properties): eidolon.state.Entity;
             * }}
             */
            Entity.create = function(properties) {
                return new Entity(properties);
            };

            /**
             * Encodes the specified Entity message. Does not implicitly {@link eidolon.state.Entity.verify|verify} messages.
             * @function encode
             * @memberof eidolon.state.Entity
             * @static
             * @param {eidolon.state.Entity.$Properties} message Entity message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Entity.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.id != null && $Object.hasOwnProperty.call(message, "id") && message.id !== "")
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
                if (message.instanceId != null && $Object.hasOwnProperty.call(message, "instanceId") && message.instanceId !== "")
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.instanceId);
                if (message.name != null && $Object.hasOwnProperty.call(message, "name") && message.name !== "")
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.name);
                if (message.type != null && $Object.hasOwnProperty.call(message, "type") && message.type !== "")
                    writer.uint32(/* id 4, wireType 2 =*/34).string(message.type);
                if (message.subType != null && $Object.hasOwnProperty.call(message, "subType") && message.subType !== "")
                    writer.uint32(/* id 5, wireType 2 =*/42).string(message.subType);
                if (message.x != null && $Object.hasOwnProperty.call(message, "x") && !$Object.is(message.x, 0))
                    writer.uint32(/* id 6, wireType 5 =*/53).float(message.x);
                if (message.y != null && $Object.hasOwnProperty.call(message, "y") && !$Object.is(message.y, 0))
                    writer.uint32(/* id 7, wireType 5 =*/61).float(message.y);
                if (message.z != null && $Object.hasOwnProperty.call(message, "z") && !$Object.is(message.z, 0))
                    writer.uint32(/* id 8, wireType 5 =*/69).float(message.z);
                if (message.rotation != null && $Object.hasOwnProperty.call(message, "rotation") && !$Object.is(message.rotation, 0))
                    writer.uint32(/* id 9, wireType 5 =*/77).float(message.rotation);
                if (message.health != null && $Object.hasOwnProperty.call(message, "health") && message.health !== 0)
                    writer.uint32(/* id 10, wireType 0 =*/80).int32(message.health);
                if (message.maxHealth != null && $Object.hasOwnProperty.call(message, "maxHealth") && message.maxHealth !== 0)
                    writer.uint32(/* id 11, wireType 0 =*/88).int32(message.maxHealth);
                if (message.mana != null && $Object.hasOwnProperty.call(message, "mana") && message.mana !== 0)
                    writer.uint32(/* id 12, wireType 0 =*/96).int32(message.mana);
                if (message.maxMana != null && $Object.hasOwnProperty.call(message, "maxMana") && message.maxMana !== 0)
                    writer.uint32(/* id 13, wireType 0 =*/104).int32(message.maxMana);
                if (message.level != null && $Object.hasOwnProperty.call(message, "level") && message.level !== 0)
                    writer.uint32(/* id 14, wireType 0 =*/112).int32(message.level);
                if (message.experience != null && $Object.hasOwnProperty.call(message, "experience") && (typeof message.experience === "object" ? message.experience.low || message.experience.high : message.experience !== 0))
                    writer.uint32(/* id 15, wireType 0 =*/120).int64(message.experience);
                if (message.maxExperience != null && $Object.hasOwnProperty.call(message, "maxExperience") && (typeof message.maxExperience === "object" ? message.maxExperience.low || message.maxExperience.high : message.maxExperience !== 0))
                    writer.uint32(/* id 16, wireType 0 =*/128).int64(message.maxExperience);
                if (message.gold != null && $Object.hasOwnProperty.call(message, "gold") && message.gold !== 0)
                    writer.uint32(/* id 17, wireType 0 =*/136).int32(message.gold);
                if (message.skillPoints != null && $Object.hasOwnProperty.call(message, "skillPoints") && message.skillPoints !== 0)
                    writer.uint32(/* id 18, wireType 0 =*/144).int32(message.skillPoints);
                if (message.selectedBranch != null && $Object.hasOwnProperty.call(message, "selectedBranch") && message.selectedBranch !== "")
                    writer.uint32(/* id 19, wireType 2 =*/154).string(message.selectedBranch);
                if (message.unlockedSkills != null && message.unlockedSkills.length)
                    for (let i = 0; i < message.unlockedSkills.length; ++i)
                        writer.uint32(/* id 20, wireType 2 =*/162).string(message.unlockedSkills[i]);
                if (message.baseStats != null && $Object.hasOwnProperty.call(message, "baseStats"))
                    $root.eidolon.state.Stats.encode(message.baseStats, writer.uint32(/* id 21, wireType 2 =*/170).fork(), _depth + 1).ldelim();
                if (message.stats != null && $Object.hasOwnProperty.call(message, "stats"))
                    $root.eidolon.state.Stats.encode(message.stats, writer.uint32(/* id 22, wireType 2 =*/178).fork(), _depth + 1).ldelim();
                if (message.damage != null && $Object.hasOwnProperty.call(message, "damage") && message.damage !== 0)
                    writer.uint32(/* id 23, wireType 0 =*/184).int32(message.damage);
                if (message.defense != null && $Object.hasOwnProperty.call(message, "defense") && message.defense !== 0)
                    writer.uint32(/* id 24, wireType 0 =*/192).int32(message.defense);
                if (message.speed != null && $Object.hasOwnProperty.call(message, "speed") && !$Object.is(message.speed, 0))
                    writer.uint32(/* id 25, wireType 5 =*/205).float(message.speed);
                if (message.attackSpeed != null && $Object.hasOwnProperty.call(message, "attackSpeed") && !$Object.is(message.attackSpeed, 0))
                    writer.uint32(/* id 26, wireType 5 =*/213).float(message.attackSpeed);
                if (message.cooldownReduction != null && $Object.hasOwnProperty.call(message, "cooldownReduction") && !$Object.is(message.cooldownReduction, 0))
                    writer.uint32(/* id 27, wireType 5 =*/221).float(message.cooldownReduction);
                if (message.hpRegen != null && $Object.hasOwnProperty.call(message, "hpRegen") && !$Object.is(message.hpRegen, 0))
                    writer.uint32(/* id 28, wireType 5 =*/229).float(message.hpRegen);
                if (message.manaRegen != null && $Object.hasOwnProperty.call(message, "manaRegen") && !$Object.is(message.manaRegen, 0))
                    writer.uint32(/* id 29, wireType 5 =*/237).float(message.manaRegen);
                if (message.castSpeed != null && $Object.hasOwnProperty.call(message, "castSpeed") && !$Object.is(message.castSpeed, 0))
                    writer.uint32(/* id 30, wireType 5 =*/245).float(message.castSpeed);
                if (message.scale != null && $Object.hasOwnProperty.call(message, "scale") && !$Object.is(message.scale, 0))
                    writer.uint32(/* id 31, wireType 5 =*/253).float(message.scale);
                if (message.state != null && $Object.hasOwnProperty.call(message, "state") && message.state !== "")
                    writer.uint32(/* id 32, wireType 2 =*/258).string(message.state);
                if (message.equipment != null && $Object.hasOwnProperty.call(message, "equipment"))
                    for (let keys = $Object.keys(message.equipment), i = 0; i < keys.length; ++i) {
                        writer.uint32(/* id 33, wireType 2 =*/266).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]);
                        $root.eidolon.state.Item.encode(message.equipment[keys[i]], writer.uint32(/* id 2, wireType 2 =*/18).fork(), _depth + 1).ldelim().ldelim();
                    }
                if (message.quests != null && message.quests.length)
                    for (let i = 0; i < message.quests.length; ++i)
                        $root.eidolon.state.Quest.encode(message.quests[i], writer.uint32(/* id 34, wireType 2 =*/274).fork(), _depth + 1).ldelim();
                if (message.lootItem != null && $Object.hasOwnProperty.call(message, "lootItem"))
                    $root.eidolon.state.Item.encode(message.lootItem, writer.uint32(/* id 35, wireType 2 =*/282).fork(), _depth + 1).ldelim();
                if (message.ownerId != null && $Object.hasOwnProperty.call(message, "ownerId") && message.ownerId !== "")
                    writer.uint32(/* id 36, wireType 2 =*/290).string(message.ownerId);
                if (message.velX != null && $Object.hasOwnProperty.call(message, "velX") && !$Object.is(message.velX, 0))
                    writer.uint32(/* id 37, wireType 5 =*/301).float(message.velX);
                if (message.velZ != null && $Object.hasOwnProperty.call(message, "velZ") && !$Object.is(message.velZ, 0))
                    writer.uint32(/* id 38, wireType 5 =*/309).float(message.velZ);
                if (message.spiritsActive != null && $Object.hasOwnProperty.call(message, "spiritsActive") && message.spiritsActive !== false)
                    writer.uint32(/* id 39, wireType 0 =*/312).bool(message.spiritsActive);
                if (message.spiritsBoosted != null && $Object.hasOwnProperty.call(message, "spiritsBoosted") && message.spiritsBoosted !== false)
                    writer.uint32(/* id 40, wireType 0 =*/320).bool(message.spiritsBoosted);
                if (message.isCharging != null && $Object.hasOwnProperty.call(message, "isCharging") && message.isCharging !== false)
                    writer.uint32(/* id 41, wireType 0 =*/328).bool(message.isCharging);
                if (message.stunned != null && $Object.hasOwnProperty.call(message, "stunned") && message.stunned !== false)
                    writer.uint32(/* id 42, wireType 0 =*/336).bool(message.stunned);
                if (message.slowed != null && $Object.hasOwnProperty.call(message, "slowed") && message.slowed !== false)
                    writer.uint32(/* id 43, wireType 0 =*/344).bool(message.slowed);
                if (message.rooted != null && $Object.hasOwnProperty.call(message, "rooted") && message.rooted !== false)
                    writer.uint32(/* id 44, wireType 0 =*/352).bool(message.rooted);
                if (message.bleeding != null && $Object.hasOwnProperty.call(message, "bleeding") && message.bleeding !== false)
                    writer.uint32(/* id 45, wireType 0 =*/360).bool(message.bleeding);
                if (message.poisoned != null && $Object.hasOwnProperty.call(message, "poisoned") && message.poisoned !== false)
                    writer.uint32(/* id 46, wireType 0 =*/368).bool(message.poisoned);
                if (message.talentPoints != null && $Object.hasOwnProperty.call(message, "talentPoints") && message.talentPoints !== 0)
                    writer.uint32(/* id 47, wireType 0 =*/376).int32(message.talentPoints);
                if (message.unlockedTalents != null && message.unlockedTalents.length)
                    for (let i = 0; i < message.unlockedTalents.length; ++i)
                        writer.uint32(/* id 48, wireType 2 =*/386).string(message.unlockedTalents[i]);
                if (message.talentRanks != null && $Object.hasOwnProperty.call(message, "talentRanks"))
                    for (let keys = $Object.keys(message.talentRanks), i = 0; i < keys.length; ++i)
                        writer.uint32(/* id 49, wireType 2 =*/394).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]).uint32(/* id 2, wireType 0 =*/16).int32(message.talentRanks[keys[i]]).ldelim();
                if (message.skillRunes != null && $Object.hasOwnProperty.call(message, "skillRunes"))
                    for (let keys = $Object.keys(message.skillRunes), i = 0; i < keys.length; ++i)
                        writer.uint32(/* id 50, wireType 2 =*/402).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]).uint32(/* id 2, wireType 2 =*/18).string(message.skillRunes[keys[i]]).ldelim();
                if (message.guardianEmbraceActive != null && $Object.hasOwnProperty.call(message, "guardianEmbraceActive") && message.guardianEmbraceActive !== false)
                    writer.uint32(/* id 51, wireType 0 =*/408).bool(message.guardianEmbraceActive);
                if (message.blessingResolveActive != null && $Object.hasOwnProperty.call(message, "blessingResolveActive") && message.blessingResolveActive !== false)
                    writer.uint32(/* id 52, wireType 0 =*/416).bool(message.blessingResolveActive);
                if (message.divineInterventionActive != null && $Object.hasOwnProperty.call(message, "divineInterventionActive") && message.divineInterventionActive !== false)
                    writer.uint32(/* id 53, wireType 0 =*/424).bool(message.divineInterventionActive);
                if (message.arcaneShieldActive != null && $Object.hasOwnProperty.call(message, "arcaneShieldActive") && message.arcaneShieldActive !== false)
                    writer.uint32(/* id 54, wireType 0 =*/432).bool(message.arcaneShieldActive);
                if (message.arcaneShieldHp != null && $Object.hasOwnProperty.call(message, "arcaneShieldHp") && message.arcaneShieldHp !== 0)
                    writer.uint32(/* id 55, wireType 0 =*/440).int32(message.arcaneShieldHp);
                if (message.timeWarpActive != null && $Object.hasOwnProperty.call(message, "timeWarpActive") && message.timeWarpActive !== false)
                    writer.uint32(/* id 56, wireType 0 =*/448).bool(message.timeWarpActive);
                if (message.spellFocusActive != null && $Object.hasOwnProperty.call(message, "spellFocusActive") && message.spellFocusActive !== false)
                    writer.uint32(/* id 57, wireType 0 =*/456).bool(message.spellFocusActive);
                if (message.slowFactor != null && $Object.hasOwnProperty.call(message, "slowFactor") && !$Object.is(message.slowFactor, 0))
                    writer.uint32(/* id 58, wireType 5 =*/469).float(message.slowFactor);
                if (message.rootDuration != null && $Object.hasOwnProperty.call(message, "rootDuration") && !$Object.is(message.rootDuration, 0))
                    writer.uint32(/* id 59, wireType 5 =*/477).float(message.rootDuration);
                if (message.stunDuration != null && $Object.hasOwnProperty.call(message, "stunDuration") && !$Object.is(message.stunDuration, 0))
                    writer.uint32(/* id 60, wireType 5 =*/485).float(message.stunDuration);
                if (message.bleedDuration != null && $Object.hasOwnProperty.call(message, "bleedDuration") && !$Object.is(message.bleedDuration, 0))
                    writer.uint32(/* id 61, wireType 5 =*/493).float(message.bleedDuration);
                if (message.poisonDuration != null && $Object.hasOwnProperty.call(message, "poisonDuration") && !$Object.is(message.poisonDuration, 0))
                    writer.uint32(/* id 62, wireType 5 =*/501).float(message.poisonDuration);
                if (message.bleedDamage != null && $Object.hasOwnProperty.call(message, "bleedDamage") && message.bleedDamage !== 0)
                    writer.uint32(/* id 63, wireType 0 =*/504).int32(message.bleedDamage);
                if (message.poisonDamage != null && $Object.hasOwnProperty.call(message, "poisonDamage") && message.poisonDamage !== 0)
                    writer.uint32(/* id 64, wireType 0 =*/512).int32(message.poisonDamage);
                if (message.slowDuration != null && $Object.hasOwnProperty.call(message, "slowDuration") && !$Object.is(message.slowDuration, 0))
                    writer.uint32(/* id 65, wireType 5 =*/525).float(message.slowDuration);
                if (message.weakPointMarked != null && $Object.hasOwnProperty.call(message, "weakPointMarked") && message.weakPointMarked !== false)
                    writer.uint32(/* id 66, wireType 0 =*/528).bool(message.weakPointMarked);
                if (message.weakPointDuration != null && $Object.hasOwnProperty.call(message, "weakPointDuration") && !$Object.is(message.weakPointDuration, 0))
                    writer.uint32(/* id 67, wireType 5 =*/541).float(message.weakPointDuration);
                if (message.markWeakness != null && $Object.hasOwnProperty.call(message, "markWeakness") && message.markWeakness !== false)
                    writer.uint32(/* id 68, wireType 0 =*/544).bool(message.markWeakness);
                if (message.markWeaknessDuration != null && $Object.hasOwnProperty.call(message, "markWeaknessDuration") && !$Object.is(message.markWeaknessDuration, 0))
                    writer.uint32(/* id 69, wireType 5 =*/557).float(message.markWeaknessDuration);
                if (message.spiritDuration != null && $Object.hasOwnProperty.call(message, "spiritDuration") && !$Object.is(message.spiritDuration, 0))
                    writer.uint32(/* id 70, wireType 5 =*/565).float(message.spiritDuration);
                if (message.blessingResolveDuration != null && $Object.hasOwnProperty.call(message, "blessingResolveDuration") && !$Object.is(message.blessingResolveDuration, 0))
                    writer.uint32(/* id 71, wireType 5 =*/573).float(message.blessingResolveDuration);
                if (message.timeWarpDuration != null && $Object.hasOwnProperty.call(message, "timeWarpDuration") && !$Object.is(message.timeWarpDuration, 0))
                    writer.uint32(/* id 72, wireType 5 =*/581).float(message.timeWarpDuration);
                if (message.guardianEmbraceDuration != null && $Object.hasOwnProperty.call(message, "guardianEmbraceDuration") && !$Object.is(message.guardianEmbraceDuration, 0))
                    writer.uint32(/* id 73, wireType 5 =*/589).float(message.guardianEmbraceDuration);
                if (message.arcaneShieldDuration != null && $Object.hasOwnProperty.call(message, "arcaneShieldDuration") && !$Object.is(message.arcaneShieldDuration, 0))
                    writer.uint32(/* id 74, wireType 5 =*/597).float(message.arcaneShieldDuration);
                if (message.divineInterventionDuration != null && $Object.hasOwnProperty.call(message, "divineInterventionDuration") && !$Object.is(message.divineInterventionDuration, 0))
                    writer.uint32(/* id 75, wireType 5 =*/605).float(message.divineInterventionDuration);
                if (message.spellFocusDuration != null && $Object.hasOwnProperty.call(message, "spellFocusDuration") && !$Object.is(message.spellFocusDuration, 0))
                    writer.uint32(/* id 76, wireType 5 =*/613).float(message.spellFocusDuration);
                if (message.swiftActive != null && $Object.hasOwnProperty.call(message, "swiftActive") && message.swiftActive !== false)
                    writer.uint32(/* id 77, wireType 0 =*/616).bool(message.swiftActive);
                if (message.swiftDuration != null && $Object.hasOwnProperty.call(message, "swiftDuration") && !$Object.is(message.swiftDuration, 0))
                    writer.uint32(/* id 78, wireType 5 =*/629).float(message.swiftDuration);
                if (message.partyId != null && $Object.hasOwnProperty.call(message, "partyId") && message.partyId !== "")
                    writer.uint32(/* id 79, wireType 2 =*/634).string(message.partyId);
                if (message.socialStatus != null && $Object.hasOwnProperty.call(message, "socialStatus") && message.socialStatus !== "")
                    writer.uint32(/* id 80, wireType 2 =*/642).string(message.socialStatus);
                if (message.jumpStartX != null && $Object.hasOwnProperty.call(message, "jumpStartX") && !$Object.is(message.jumpStartX, 0))
                    writer.uint32(/* id 81, wireType 5 =*/653).float(message.jumpStartX);
                if (message.jumpStartY != null && $Object.hasOwnProperty.call(message, "jumpStartY") && !$Object.is(message.jumpStartY, 0))
                    writer.uint32(/* id 82, wireType 5 =*/661).float(message.jumpStartY);
                if (message.jumpStartZ != null && $Object.hasOwnProperty.call(message, "jumpStartZ") && !$Object.is(message.jumpStartZ, 0))
                    writer.uint32(/* id 83, wireType 5 =*/669).float(message.jumpStartZ);
                if (message.jumpTargetX != null && $Object.hasOwnProperty.call(message, "jumpTargetX") && !$Object.is(message.jumpTargetX, 0))
                    writer.uint32(/* id 84, wireType 5 =*/677).float(message.jumpTargetX);
                if (message.jumpTargetY != null && $Object.hasOwnProperty.call(message, "jumpTargetY") && !$Object.is(message.jumpTargetY, 0))
                    writer.uint32(/* id 85, wireType 5 =*/685).float(message.jumpTargetY);
                if (message.jumpTargetZ != null && $Object.hasOwnProperty.call(message, "jumpTargetZ") && !$Object.is(message.jumpTargetZ, 0))
                    writer.uint32(/* id 86, wireType 5 =*/693).float(message.jumpTargetZ);
                if (message.jumpDuration != null && $Object.hasOwnProperty.call(message, "jumpDuration") && !$Object.is(message.jumpDuration, 0))
                    writer.uint32(/* id 87, wireType 5 =*/701).float(message.jumpDuration);
                if (message.jumpHeight != null && $Object.hasOwnProperty.call(message, "jumpHeight") && !$Object.is(message.jumpHeight, 0))
                    writer.uint32(/* id 88, wireType 5 =*/709).float(message.jumpHeight);
                if (message.jumpProgress != null && $Object.hasOwnProperty.call(message, "jumpProgress") && !$Object.is(message.jumpProgress, 0))
                    writer.uint32(/* id 89, wireType 5 =*/717).float(message.jumpProgress);
                if (message.ironFortressActive != null && $Object.hasOwnProperty.call(message, "ironFortressActive") && message.ironFortressActive !== false)
                    writer.uint32(/* id 90, wireType 0 =*/720).bool(message.ironFortressActive);
                if (message.guardianRoarActive != null && $Object.hasOwnProperty.call(message, "guardianRoarActive") && message.guardianRoarActive !== false)
                    writer.uint32(/* id 91, wireType 0 =*/728).bool(message.guardianRoarActive);
                if (message.berserkerModeActive != null && $Object.hasOwnProperty.call(message, "berserkerModeActive") && message.berserkerModeActive !== false)
                    writer.uint32(/* id 92, wireType 0 =*/736).bool(message.berserkerModeActive);
                if (message.lastStandActive != null && $Object.hasOwnProperty.call(message, "lastStandActive") && message.lastStandActive !== false)
                    writer.uint32(/* id 93, wireType 0 =*/744).bool(message.lastStandActive);
                if (message.serratedEdgesActive != null && $Object.hasOwnProperty.call(message, "serratedEdgesActive") && message.serratedEdgesActive !== false)
                    writer.uint32(/* id 94, wireType 0 =*/752).bool(message.serratedEdgesActive);
                if (message.poisonCoatingActive != null && $Object.hasOwnProperty.call(message, "poisonCoatingActive") && message.poisonCoatingActive !== false)
                    writer.uint32(/* id 95, wireType 0 =*/760).bool(message.poisonCoatingActive);
                if (message.stealthActive != null && $Object.hasOwnProperty.call(message, "stealthActive") && message.stealthActive !== false)
                    writer.uint32(/* id 96, wireType 0 =*/768).bool(message.stealthActive);
                if (message.zealActive != null && $Object.hasOwnProperty.call(message, "zealActive") && message.zealActive !== false)
                    writer.uint32(/* id 97, wireType 0 =*/776).bool(message.zealActive);
                if (message.ironFortressDuration != null && $Object.hasOwnProperty.call(message, "ironFortressDuration") && !$Object.is(message.ironFortressDuration, 0))
                    writer.uint32(/* id 98, wireType 5 =*/789).float(message.ironFortressDuration);
                if (message.guardianRoarDuration != null && $Object.hasOwnProperty.call(message, "guardianRoarDuration") && !$Object.is(message.guardianRoarDuration, 0))
                    writer.uint32(/* id 99, wireType 5 =*/797).float(message.guardianRoarDuration);
                if (message.berserkerModeDuration != null && $Object.hasOwnProperty.call(message, "berserkerModeDuration") && !$Object.is(message.berserkerModeDuration, 0))
                    writer.uint32(/* id 100, wireType 5 =*/805).float(message.berserkerModeDuration);
                if (message.lastStandDuration != null && $Object.hasOwnProperty.call(message, "lastStandDuration") && !$Object.is(message.lastStandDuration, 0))
                    writer.uint32(/* id 101, wireType 5 =*/813).float(message.lastStandDuration);
                if (message.serratedEdgesDuration != null && $Object.hasOwnProperty.call(message, "serratedEdgesDuration") && !$Object.is(message.serratedEdgesDuration, 0))
                    writer.uint32(/* id 102, wireType 5 =*/821).float(message.serratedEdgesDuration);
                if (message.poisonCoatingDuration != null && $Object.hasOwnProperty.call(message, "poisonCoatingDuration") && !$Object.is(message.poisonCoatingDuration, 0))
                    writer.uint32(/* id 103, wireType 5 =*/829).float(message.poisonCoatingDuration);
                if (message.stealthDuration != null && $Object.hasOwnProperty.call(message, "stealthDuration") && !$Object.is(message.stealthDuration, 0))
                    writer.uint32(/* id 104, wireType 5 =*/837).float(message.stealthDuration);
                if (message.zealDuration != null && $Object.hasOwnProperty.call(message, "zealDuration") && !$Object.is(message.zealDuration, 0))
                    writer.uint32(/* id 105, wireType 5 =*/845).float(message.zealDuration);
                if (message.moveSequence != null && $Object.hasOwnProperty.call(message, "moveSequence") && (typeof message.moveSequence === "object" ? message.moveSequence.low || message.moveSequence.high : message.moveSequence !== 0))
                    writer.uint32(/* id 106, wireType 0 =*/848).uint64(message.moveSequence);
                if (message.guildId != null && $Object.hasOwnProperty.call(message, "guildId") && message.guildId !== "")
                    writer.uint32(/* id 107, wireType 2 =*/858).string(message.guildId);
                if (message.guildTag != null && $Object.hasOwnProperty.call(message, "guildTag") && message.guildTag !== "")
                    writer.uint32(/* id 108, wireType 2 =*/866).string(message.guildTag);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            /**
             * Encodes the specified Entity message, length delimited. Does not implicitly {@link eidolon.state.Entity.verify|verify} messages.
             * @function encodeDelimited
             * @memberof eidolon.state.Entity
             * @static
             * @param {eidolon.state.Entity.$Properties} message Entity message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Entity.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            /**
             * Decodes an Entity message from the specified reader or buffer.
             * @function decode
             * @memberof eidolon.state.Entity
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {eidolon.state.Entity & eidolon.state.Entity.$Shape} Entity
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Entity.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.eidolon.state.Entity(), key, value;
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.id = value;
                            else
                                delete message.id;
                            continue;
                        }
                    case 2: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.instanceId = value;
                            else
                                delete message.instanceId;
                            continue;
                        }
                    case 3: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.name = value;
                            else
                                delete message.name;
                            continue;
                        }
                    case 4: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.type = value;
                            else
                                delete message.type;
                            continue;
                        }
                    case 5: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.subType = value;
                            else
                                delete message.subType;
                            continue;
                        }
                    case 6: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.x = value;
                            else
                                delete message.x;
                            continue;
                        }
                    case 7: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.y = value;
                            else
                                delete message.y;
                            continue;
                        }
                    case 8: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.z = value;
                            else
                                delete message.z;
                            continue;
                        }
                    case 9: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.rotation = value;
                            else
                                delete message.rotation;
                            continue;
                        }
                    case 10: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.health = value;
                            else
                                delete message.health;
                            continue;
                        }
                    case 11: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.maxHealth = value;
                            else
                                delete message.maxHealth;
                            continue;
                        }
                    case 12: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.mana = value;
                            else
                                delete message.mana;
                            continue;
                        }
                    case 13: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.maxMana = value;
                            else
                                delete message.maxMana;
                            continue;
                        }
                    case 14: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.level = value;
                            else
                                delete message.level;
                            continue;
                        }
                    case 15: {
                            if (wireType !== 0)
                                break;
                            if (typeof (value = reader.int64()) === "object" ? value.low || value.high : value !== 0)
                                message.experience = value;
                            else
                                delete message.experience;
                            continue;
                        }
                    case 16: {
                            if (wireType !== 0)
                                break;
                            if (typeof (value = reader.int64()) === "object" ? value.low || value.high : value !== 0)
                                message.maxExperience = value;
                            else
                                delete message.maxExperience;
                            continue;
                        }
                    case 17: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.gold = value;
                            else
                                delete message.gold;
                            continue;
                        }
                    case 18: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.skillPoints = value;
                            else
                                delete message.skillPoints;
                            continue;
                        }
                    case 19: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.selectedBranch = value;
                            else
                                delete message.selectedBranch;
                            continue;
                        }
                    case 20: {
                            if (wireType !== 2)
                                break;
                            if (!(message.unlockedSkills && message.unlockedSkills.length))
                                message.unlockedSkills = [];
                            message.unlockedSkills.push(reader.stringVerify());
                            continue;
                        }
                    case 21: {
                            if (wireType !== 2)
                                break;
                            message.baseStats = $root.eidolon.state.Stats.decode(reader, reader.uint32(), $undefined, _depth + 1, message.baseStats);
                            continue;
                        }
                    case 22: {
                            if (wireType !== 2)
                                break;
                            message.stats = $root.eidolon.state.Stats.decode(reader, reader.uint32(), $undefined, _depth + 1, message.stats);
                            continue;
                        }
                    case 23: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.damage = value;
                            else
                                delete message.damage;
                            continue;
                        }
                    case 24: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.defense = value;
                            else
                                delete message.defense;
                            continue;
                        }
                    case 25: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.speed = value;
                            else
                                delete message.speed;
                            continue;
                        }
                    case 26: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.attackSpeed = value;
                            else
                                delete message.attackSpeed;
                            continue;
                        }
                    case 27: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.cooldownReduction = value;
                            else
                                delete message.cooldownReduction;
                            continue;
                        }
                    case 28: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.hpRegen = value;
                            else
                                delete message.hpRegen;
                            continue;
                        }
                    case 29: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.manaRegen = value;
                            else
                                delete message.manaRegen;
                            continue;
                        }
                    case 30: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.castSpeed = value;
                            else
                                delete message.castSpeed;
                            continue;
                        }
                    case 31: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.scale = value;
                            else
                                delete message.scale;
                            continue;
                        }
                    case 32: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.state = value;
                            else
                                delete message.state;
                            continue;
                        }
                    case 33: {
                            if (wireType !== 2)
                                break;
                            if (message.equipment === $util.emptyObject)
                                message.equipment = {};
                            let end2 = reader.uint32() + reader.pos;
                            key = "";
                            value = null;
                            while (reader.pos < end2) {
                                let tag2 = reader.tag();
                                wireType = tag2 & 7;
                                switch (tag2 >>>= 3) {
                                case 1:
                                    if (wireType !== 2)
                                        break;
                                    key = reader.stringVerify();
                                    continue;
                                case 2:
                                    if (wireType !== 2)
                                        break;
                                    value = $root.eidolon.state.Item.decode(reader, reader.uint32(), $undefined, _depth + 1, value);
                                    continue;
                                }
                                reader.skipType(wireType, _depth, tag2);
                            }
                            if (key === "__proto__")
                                $util.makeProp(message.equipment, key);
                            message.equipment[key] = value || new $root.eidolon.state.Item();
                            continue;
                        }
                    case 34: {
                            if (wireType !== 2)
                                break;
                            if (!(message.quests && message.quests.length))
                                message.quests = [];
                            message.quests.push($root.eidolon.state.Quest.decode(reader, reader.uint32(), $undefined, _depth + 1));
                            continue;
                        }
                    case 35: {
                            if (wireType !== 2)
                                break;
                            message.lootItem = $root.eidolon.state.Item.decode(reader, reader.uint32(), $undefined, _depth + 1, message.lootItem);
                            continue;
                        }
                    case 36: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.ownerId = value;
                            else
                                delete message.ownerId;
                            continue;
                        }
                    case 37: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.velX = value;
                            else
                                delete message.velX;
                            continue;
                        }
                    case 38: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.velZ = value;
                            else
                                delete message.velZ;
                            continue;
                        }
                    case 39: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.spiritsActive = value;
                            else
                                delete message.spiritsActive;
                            continue;
                        }
                    case 40: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.spiritsBoosted = value;
                            else
                                delete message.spiritsBoosted;
                            continue;
                        }
                    case 41: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.isCharging = value;
                            else
                                delete message.isCharging;
                            continue;
                        }
                    case 51: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.guardianEmbraceActive = value;
                            else
                                delete message.guardianEmbraceActive;
                            continue;
                        }
                    case 52: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.blessingResolveActive = value;
                            else
                                delete message.blessingResolveActive;
                            continue;
                        }
                    case 53: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.divineInterventionActive = value;
                            else
                                delete message.divineInterventionActive;
                            continue;
                        }
                    case 54: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.arcaneShieldActive = value;
                            else
                                delete message.arcaneShieldActive;
                            continue;
                        }
                    case 55: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.arcaneShieldHp = value;
                            else
                                delete message.arcaneShieldHp;
                            continue;
                        }
                    case 56: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.timeWarpActive = value;
                            else
                                delete message.timeWarpActive;
                            continue;
                        }
                    case 57: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.spellFocusActive = value;
                            else
                                delete message.spellFocusActive;
                            continue;
                        }
                    case 77: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.swiftActive = value;
                            else
                                delete message.swiftActive;
                            continue;
                        }
                    case 90: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.ironFortressActive = value;
                            else
                                delete message.ironFortressActive;
                            continue;
                        }
                    case 91: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.guardianRoarActive = value;
                            else
                                delete message.guardianRoarActive;
                            continue;
                        }
                    case 92: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.berserkerModeActive = value;
                            else
                                delete message.berserkerModeActive;
                            continue;
                        }
                    case 93: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.lastStandActive = value;
                            else
                                delete message.lastStandActive;
                            continue;
                        }
                    case 94: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.serratedEdgesActive = value;
                            else
                                delete message.serratedEdgesActive;
                            continue;
                        }
                    case 95: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.poisonCoatingActive = value;
                            else
                                delete message.poisonCoatingActive;
                            continue;
                        }
                    case 96: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.stealthActive = value;
                            else
                                delete message.stealthActive;
                            continue;
                        }
                    case 97: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.zealActive = value;
                            else
                                delete message.zealActive;
                            continue;
                        }
                    case 42: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.stunned = value;
                            else
                                delete message.stunned;
                            continue;
                        }
                    case 43: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.slowed = value;
                            else
                                delete message.slowed;
                            continue;
                        }
                    case 44: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.rooted = value;
                            else
                                delete message.rooted;
                            continue;
                        }
                    case 45: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.bleeding = value;
                            else
                                delete message.bleeding;
                            continue;
                        }
                    case 46: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.poisoned = value;
                            else
                                delete message.poisoned;
                            continue;
                        }
                    case 66: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.weakPointMarked = value;
                            else
                                delete message.weakPointMarked;
                            continue;
                        }
                    case 67: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.weakPointDuration = value;
                            else
                                delete message.weakPointDuration;
                            continue;
                        }
                    case 68: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.bool())
                                message.markWeakness = value;
                            else
                                delete message.markWeakness;
                            continue;
                        }
                    case 69: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.markWeaknessDuration = value;
                            else
                                delete message.markWeaknessDuration;
                            continue;
                        }
                    case 70: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.spiritDuration = value;
                            else
                                delete message.spiritDuration;
                            continue;
                        }
                    case 71: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.blessingResolveDuration = value;
                            else
                                delete message.blessingResolveDuration;
                            continue;
                        }
                    case 72: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.timeWarpDuration = value;
                            else
                                delete message.timeWarpDuration;
                            continue;
                        }
                    case 73: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.guardianEmbraceDuration = value;
                            else
                                delete message.guardianEmbraceDuration;
                            continue;
                        }
                    case 74: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.arcaneShieldDuration = value;
                            else
                                delete message.arcaneShieldDuration;
                            continue;
                        }
                    case 75: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.divineInterventionDuration = value;
                            else
                                delete message.divineInterventionDuration;
                            continue;
                        }
                    case 76: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.spellFocusDuration = value;
                            else
                                delete message.spellFocusDuration;
                            continue;
                        }
                    case 78: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.swiftDuration = value;
                            else
                                delete message.swiftDuration;
                            continue;
                        }
                    case 98: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.ironFortressDuration = value;
                            else
                                delete message.ironFortressDuration;
                            continue;
                        }
                    case 99: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.guardianRoarDuration = value;
                            else
                                delete message.guardianRoarDuration;
                            continue;
                        }
                    case 100: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.berserkerModeDuration = value;
                            else
                                delete message.berserkerModeDuration;
                            continue;
                        }
                    case 101: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.lastStandDuration = value;
                            else
                                delete message.lastStandDuration;
                            continue;
                        }
                    case 102: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.serratedEdgesDuration = value;
                            else
                                delete message.serratedEdgesDuration;
                            continue;
                        }
                    case 103: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.poisonCoatingDuration = value;
                            else
                                delete message.poisonCoatingDuration;
                            continue;
                        }
                    case 104: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.stealthDuration = value;
                            else
                                delete message.stealthDuration;
                            continue;
                        }
                    case 105: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.zealDuration = value;
                            else
                                delete message.zealDuration;
                            continue;
                        }
                    case 106: {
                            if (wireType !== 0)
                                break;
                            if (typeof (value = reader.uint64()) === "object" ? value.low || value.high : value !== 0)
                                message.moveSequence = value;
                            else
                                delete message.moveSequence;
                            continue;
                        }
                    case 58: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.slowFactor = value;
                            else
                                delete message.slowFactor;
                            continue;
                        }
                    case 59: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.rootDuration = value;
                            else
                                delete message.rootDuration;
                            continue;
                        }
                    case 60: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.stunDuration = value;
                            else
                                delete message.stunDuration;
                            continue;
                        }
                    case 61: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.bleedDuration = value;
                            else
                                delete message.bleedDuration;
                            continue;
                        }
                    case 62: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.poisonDuration = value;
                            else
                                delete message.poisonDuration;
                            continue;
                        }
                    case 63: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.bleedDamage = value;
                            else
                                delete message.bleedDamage;
                            continue;
                        }
                    case 64: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.poisonDamage = value;
                            else
                                delete message.poisonDamage;
                            continue;
                        }
                    case 65: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.slowDuration = value;
                            else
                                delete message.slowDuration;
                            continue;
                        }
                    case 47: {
                            if (wireType !== 0)
                                break;
                            if (value = reader.int32())
                                message.talentPoints = value;
                            else
                                delete message.talentPoints;
                            continue;
                        }
                    case 48: {
                            if (wireType !== 2)
                                break;
                            if (!(message.unlockedTalents && message.unlockedTalents.length))
                                message.unlockedTalents = [];
                            message.unlockedTalents.push(reader.stringVerify());
                            continue;
                        }
                    case 49: {
                            if (wireType !== 2)
                                break;
                            if (message.talentRanks === $util.emptyObject)
                                message.talentRanks = {};
                            let end2 = reader.uint32() + reader.pos;
                            key = "";
                            value = 0;
                            while (reader.pos < end2) {
                                let tag2 = reader.tag();
                                wireType = tag2 & 7;
                                switch (tag2 >>>= 3) {
                                case 1:
                                    if (wireType !== 2)
                                        break;
                                    key = reader.stringVerify();
                                    continue;
                                case 2:
                                    if (wireType !== 0)
                                        break;
                                    value = reader.int32();
                                    continue;
                                }
                                reader.skipType(wireType, _depth, tag2);
                            }
                            if (key === "__proto__")
                                $util.makeProp(message.talentRanks, key);
                            message.talentRanks[key] = value;
                            continue;
                        }
                    case 50: {
                            if (wireType !== 2)
                                break;
                            if (message.skillRunes === $util.emptyObject)
                                message.skillRunes = {};
                            let end2 = reader.uint32() + reader.pos;
                            key = "";
                            value = "";
                            while (reader.pos < end2) {
                                let tag2 = reader.tag();
                                wireType = tag2 & 7;
                                switch (tag2 >>>= 3) {
                                case 1:
                                    if (wireType !== 2)
                                        break;
                                    key = reader.stringVerify();
                                    continue;
                                case 2:
                                    if (wireType !== 2)
                                        break;
                                    value = reader.stringVerify();
                                    continue;
                                }
                                reader.skipType(wireType, _depth, tag2);
                            }
                            if (key === "__proto__")
                                $util.makeProp(message.skillRunes, key);
                            message.skillRunes[key] = value;
                            continue;
                        }
                    case 79: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.partyId = value;
                            else
                                delete message.partyId;
                            continue;
                        }
                    case 80: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.socialStatus = value;
                            else
                                delete message.socialStatus;
                            continue;
                        }
                    case 107: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.guildId = value;
                            else
                                delete message.guildId;
                            continue;
                        }
                    case 108: {
                            if (wireType !== 2)
                                break;
                            if ((value = reader.stringVerify()).length)
                                message.guildTag = value;
                            else
                                delete message.guildTag;
                            continue;
                        }
                    case 81: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.jumpStartX = value;
                            else
                                delete message.jumpStartX;
                            continue;
                        }
                    case 82: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.jumpStartY = value;
                            else
                                delete message.jumpStartY;
                            continue;
                        }
                    case 83: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.jumpStartZ = value;
                            else
                                delete message.jumpStartZ;
                            continue;
                        }
                    case 84: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.jumpTargetX = value;
                            else
                                delete message.jumpTargetX;
                            continue;
                        }
                    case 85: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.jumpTargetY = value;
                            else
                                delete message.jumpTargetY;
                            continue;
                        }
                    case 86: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.jumpTargetZ = value;
                            else
                                delete message.jumpTargetZ;
                            continue;
                        }
                    case 87: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.jumpDuration = value;
                            else
                                delete message.jumpDuration;
                            continue;
                        }
                    case 88: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.jumpHeight = value;
                            else
                                delete message.jumpHeight;
                            continue;
                        }
                    case 89: {
                            if (wireType !== 5)
                                break;
                            if (!$Object.is(value = reader.float(), 0))
                                message.jumpProgress = value;
                            else
                                delete message.jumpProgress;
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            /**
             * Decodes an Entity message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof eidolon.state.Entity
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {eidolon.state.Entity & eidolon.state.Entity.$Shape} Entity
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Entity.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            /**
             * Verifies an Entity message.
             * @function verify
             * @memberof eidolon.state.Entity
             * @static
             * @param {Object.<string,*>} message Plain object to verify
             * @returns {string|null} `null` if valid, otherwise the reason why it is not
             */
            Entity.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.id != null && $Object.hasOwnProperty.call(message, "id"))
                    if (!$util.isString(message.id))
                        return "id: string expected";
                if (message.instanceId != null && $Object.hasOwnProperty.call(message, "instanceId"))
                    if (!$util.isString(message.instanceId))
                        return "instanceId: string expected";
                if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                    if (!$util.isString(message.name))
                        return "name: string expected";
                if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                    if (!$util.isString(message.type))
                        return "type: string expected";
                if (message.subType != null && $Object.hasOwnProperty.call(message, "subType"))
                    if (!$util.isString(message.subType))
                        return "subType: string expected";
                if (message.x != null && $Object.hasOwnProperty.call(message, "x"))
                    if (typeof message.x !== "number")
                        return "x: number expected";
                if (message.y != null && $Object.hasOwnProperty.call(message, "y"))
                    if (typeof message.y !== "number")
                        return "y: number expected";
                if (message.z != null && $Object.hasOwnProperty.call(message, "z"))
                    if (typeof message.z !== "number")
                        return "z: number expected";
                if (message.rotation != null && $Object.hasOwnProperty.call(message, "rotation"))
                    if (typeof message.rotation !== "number")
                        return "rotation: number expected";
                if (message.health != null && $Object.hasOwnProperty.call(message, "health"))
                    if (!$util.isInteger(message.health))
                        return "health: integer expected";
                if (message.maxHealth != null && $Object.hasOwnProperty.call(message, "maxHealth"))
                    if (!$util.isInteger(message.maxHealth))
                        return "maxHealth: integer expected";
                if (message.mana != null && $Object.hasOwnProperty.call(message, "mana"))
                    if (!$util.isInteger(message.mana))
                        return "mana: integer expected";
                if (message.maxMana != null && $Object.hasOwnProperty.call(message, "maxMana"))
                    if (!$util.isInteger(message.maxMana))
                        return "maxMana: integer expected";
                if (message.level != null && $Object.hasOwnProperty.call(message, "level"))
                    if (!$util.isInteger(message.level))
                        return "level: integer expected";
                if (message.experience != null && $Object.hasOwnProperty.call(message, "experience"))
                    if (!$util.isInteger(message.experience) && !(message.experience && $util.isInteger(message.experience.low) && $util.isInteger(message.experience.high)))
                        return "experience: integer|Long expected";
                if (message.maxExperience != null && $Object.hasOwnProperty.call(message, "maxExperience"))
                    if (!$util.isInteger(message.maxExperience) && !(message.maxExperience && $util.isInteger(message.maxExperience.low) && $util.isInteger(message.maxExperience.high)))
                        return "maxExperience: integer|Long expected";
                if (message.gold != null && $Object.hasOwnProperty.call(message, "gold"))
                    if (!$util.isInteger(message.gold))
                        return "gold: integer expected";
                if (message.skillPoints != null && $Object.hasOwnProperty.call(message, "skillPoints"))
                    if (!$util.isInteger(message.skillPoints))
                        return "skillPoints: integer expected";
                if (message.selectedBranch != null && $Object.hasOwnProperty.call(message, "selectedBranch"))
                    if (!$util.isString(message.selectedBranch))
                        return "selectedBranch: string expected";
                if (message.unlockedSkills != null && $Object.hasOwnProperty.call(message, "unlockedSkills")) {
                    if (!$Array.isArray(message.unlockedSkills))
                        return "unlockedSkills: array expected";
                    for (let i = 0; i < message.unlockedSkills.length; ++i)
                        if (!$util.isString(message.unlockedSkills[i]))
                            return "unlockedSkills: string[] expected";
                }
                if (message.baseStats != null && $Object.hasOwnProperty.call(message, "baseStats")) {
                    let error = $root.eidolon.state.Stats.verify(message.baseStats, _depth + 1);
                    if (error)
                        return "baseStats." + error;
                }
                if (message.stats != null && $Object.hasOwnProperty.call(message, "stats")) {
                    let error = $root.eidolon.state.Stats.verify(message.stats, _depth + 1);
                    if (error)
                        return "stats." + error;
                }
                if (message.damage != null && $Object.hasOwnProperty.call(message, "damage"))
                    if (!$util.isInteger(message.damage))
                        return "damage: integer expected";
                if (message.defense != null && $Object.hasOwnProperty.call(message, "defense"))
                    if (!$util.isInteger(message.defense))
                        return "defense: integer expected";
                if (message.speed != null && $Object.hasOwnProperty.call(message, "speed"))
                    if (typeof message.speed !== "number")
                        return "speed: number expected";
                if (message.attackSpeed != null && $Object.hasOwnProperty.call(message, "attackSpeed"))
                    if (typeof message.attackSpeed !== "number")
                        return "attackSpeed: number expected";
                if (message.cooldownReduction != null && $Object.hasOwnProperty.call(message, "cooldownReduction"))
                    if (typeof message.cooldownReduction !== "number")
                        return "cooldownReduction: number expected";
                if (message.hpRegen != null && $Object.hasOwnProperty.call(message, "hpRegen"))
                    if (typeof message.hpRegen !== "number")
                        return "hpRegen: number expected";
                if (message.manaRegen != null && $Object.hasOwnProperty.call(message, "manaRegen"))
                    if (typeof message.manaRegen !== "number")
                        return "manaRegen: number expected";
                if (message.castSpeed != null && $Object.hasOwnProperty.call(message, "castSpeed"))
                    if (typeof message.castSpeed !== "number")
                        return "castSpeed: number expected";
                if (message.scale != null && $Object.hasOwnProperty.call(message, "scale"))
                    if (typeof message.scale !== "number")
                        return "scale: number expected";
                if (message.state != null && $Object.hasOwnProperty.call(message, "state"))
                    if (!$util.isString(message.state))
                        return "state: string expected";
                if (message.equipment != null && $Object.hasOwnProperty.call(message, "equipment")) {
                    if (!$util.isObject(message.equipment))
                        return "equipment: object expected";
                    let key = $Object.keys(message.equipment);
                    for (let i = 0; i < key.length; ++i) {
                        let error = $root.eidolon.state.Item.verify(message.equipment[key[i]], _depth + 1);
                        if (error)
                            return "equipment." + error;
                    }
                }
                if (message.quests != null && $Object.hasOwnProperty.call(message, "quests")) {
                    if (!$Array.isArray(message.quests))
                        return "quests: array expected";
                    for (let i = 0; i < message.quests.length; ++i) {
                        let error = $root.eidolon.state.Quest.verify(message.quests[i], _depth + 1);
                        if (error)
                            return "quests." + error;
                    }
                }
                if (message.lootItem != null && $Object.hasOwnProperty.call(message, "lootItem")) {
                    let error = $root.eidolon.state.Item.verify(message.lootItem, _depth + 1);
                    if (error)
                        return "lootItem." + error;
                }
                if (message.ownerId != null && $Object.hasOwnProperty.call(message, "ownerId"))
                    if (!$util.isString(message.ownerId))
                        return "ownerId: string expected";
                if (message.velX != null && $Object.hasOwnProperty.call(message, "velX"))
                    if (typeof message.velX !== "number")
                        return "velX: number expected";
                if (message.velZ != null && $Object.hasOwnProperty.call(message, "velZ"))
                    if (typeof message.velZ !== "number")
                        return "velZ: number expected";
                if (message.spiritsActive != null && $Object.hasOwnProperty.call(message, "spiritsActive"))
                    if (typeof message.spiritsActive !== "boolean")
                        return "spiritsActive: boolean expected";
                if (message.spiritsBoosted != null && $Object.hasOwnProperty.call(message, "spiritsBoosted"))
                    if (typeof message.spiritsBoosted !== "boolean")
                        return "spiritsBoosted: boolean expected";
                if (message.isCharging != null && $Object.hasOwnProperty.call(message, "isCharging"))
                    if (typeof message.isCharging !== "boolean")
                        return "isCharging: boolean expected";
                if (message.guardianEmbraceActive != null && $Object.hasOwnProperty.call(message, "guardianEmbraceActive"))
                    if (typeof message.guardianEmbraceActive !== "boolean")
                        return "guardianEmbraceActive: boolean expected";
                if (message.blessingResolveActive != null && $Object.hasOwnProperty.call(message, "blessingResolveActive"))
                    if (typeof message.blessingResolveActive !== "boolean")
                        return "blessingResolveActive: boolean expected";
                if (message.divineInterventionActive != null && $Object.hasOwnProperty.call(message, "divineInterventionActive"))
                    if (typeof message.divineInterventionActive !== "boolean")
                        return "divineInterventionActive: boolean expected";
                if (message.arcaneShieldActive != null && $Object.hasOwnProperty.call(message, "arcaneShieldActive"))
                    if (typeof message.arcaneShieldActive !== "boolean")
                        return "arcaneShieldActive: boolean expected";
                if (message.arcaneShieldHp != null && $Object.hasOwnProperty.call(message, "arcaneShieldHp"))
                    if (!$util.isInteger(message.arcaneShieldHp))
                        return "arcaneShieldHp: integer expected";
                if (message.timeWarpActive != null && $Object.hasOwnProperty.call(message, "timeWarpActive"))
                    if (typeof message.timeWarpActive !== "boolean")
                        return "timeWarpActive: boolean expected";
                if (message.spellFocusActive != null && $Object.hasOwnProperty.call(message, "spellFocusActive"))
                    if (typeof message.spellFocusActive !== "boolean")
                        return "spellFocusActive: boolean expected";
                if (message.swiftActive != null && $Object.hasOwnProperty.call(message, "swiftActive"))
                    if (typeof message.swiftActive !== "boolean")
                        return "swiftActive: boolean expected";
                if (message.ironFortressActive != null && $Object.hasOwnProperty.call(message, "ironFortressActive"))
                    if (typeof message.ironFortressActive !== "boolean")
                        return "ironFortressActive: boolean expected";
                if (message.guardianRoarActive != null && $Object.hasOwnProperty.call(message, "guardianRoarActive"))
                    if (typeof message.guardianRoarActive !== "boolean")
                        return "guardianRoarActive: boolean expected";
                if (message.berserkerModeActive != null && $Object.hasOwnProperty.call(message, "berserkerModeActive"))
                    if (typeof message.berserkerModeActive !== "boolean")
                        return "berserkerModeActive: boolean expected";
                if (message.lastStandActive != null && $Object.hasOwnProperty.call(message, "lastStandActive"))
                    if (typeof message.lastStandActive !== "boolean")
                        return "lastStandActive: boolean expected";
                if (message.serratedEdgesActive != null && $Object.hasOwnProperty.call(message, "serratedEdgesActive"))
                    if (typeof message.serratedEdgesActive !== "boolean")
                        return "serratedEdgesActive: boolean expected";
                if (message.poisonCoatingActive != null && $Object.hasOwnProperty.call(message, "poisonCoatingActive"))
                    if (typeof message.poisonCoatingActive !== "boolean")
                        return "poisonCoatingActive: boolean expected";
                if (message.stealthActive != null && $Object.hasOwnProperty.call(message, "stealthActive"))
                    if (typeof message.stealthActive !== "boolean")
                        return "stealthActive: boolean expected";
                if (message.zealActive != null && $Object.hasOwnProperty.call(message, "zealActive"))
                    if (typeof message.zealActive !== "boolean")
                        return "zealActive: boolean expected";
                if (message.stunned != null && $Object.hasOwnProperty.call(message, "stunned"))
                    if (typeof message.stunned !== "boolean")
                        return "stunned: boolean expected";
                if (message.slowed != null && $Object.hasOwnProperty.call(message, "slowed"))
                    if (typeof message.slowed !== "boolean")
                        return "slowed: boolean expected";
                if (message.rooted != null && $Object.hasOwnProperty.call(message, "rooted"))
                    if (typeof message.rooted !== "boolean")
                        return "rooted: boolean expected";
                if (message.bleeding != null && $Object.hasOwnProperty.call(message, "bleeding"))
                    if (typeof message.bleeding !== "boolean")
                        return "bleeding: boolean expected";
                if (message.poisoned != null && $Object.hasOwnProperty.call(message, "poisoned"))
                    if (typeof message.poisoned !== "boolean")
                        return "poisoned: boolean expected";
                if (message.weakPointMarked != null && $Object.hasOwnProperty.call(message, "weakPointMarked"))
                    if (typeof message.weakPointMarked !== "boolean")
                        return "weakPointMarked: boolean expected";
                if (message.weakPointDuration != null && $Object.hasOwnProperty.call(message, "weakPointDuration"))
                    if (typeof message.weakPointDuration !== "number")
                        return "weakPointDuration: number expected";
                if (message.markWeakness != null && $Object.hasOwnProperty.call(message, "markWeakness"))
                    if (typeof message.markWeakness !== "boolean")
                        return "markWeakness: boolean expected";
                if (message.markWeaknessDuration != null && $Object.hasOwnProperty.call(message, "markWeaknessDuration"))
                    if (typeof message.markWeaknessDuration !== "number")
                        return "markWeaknessDuration: number expected";
                if (message.spiritDuration != null && $Object.hasOwnProperty.call(message, "spiritDuration"))
                    if (typeof message.spiritDuration !== "number")
                        return "spiritDuration: number expected";
                if (message.blessingResolveDuration != null && $Object.hasOwnProperty.call(message, "blessingResolveDuration"))
                    if (typeof message.blessingResolveDuration !== "number")
                        return "blessingResolveDuration: number expected";
                if (message.timeWarpDuration != null && $Object.hasOwnProperty.call(message, "timeWarpDuration"))
                    if (typeof message.timeWarpDuration !== "number")
                        return "timeWarpDuration: number expected";
                if (message.guardianEmbraceDuration != null && $Object.hasOwnProperty.call(message, "guardianEmbraceDuration"))
                    if (typeof message.guardianEmbraceDuration !== "number")
                        return "guardianEmbraceDuration: number expected";
                if (message.arcaneShieldDuration != null && $Object.hasOwnProperty.call(message, "arcaneShieldDuration"))
                    if (typeof message.arcaneShieldDuration !== "number")
                        return "arcaneShieldDuration: number expected";
                if (message.divineInterventionDuration != null && $Object.hasOwnProperty.call(message, "divineInterventionDuration"))
                    if (typeof message.divineInterventionDuration !== "number")
                        return "divineInterventionDuration: number expected";
                if (message.spellFocusDuration != null && $Object.hasOwnProperty.call(message, "spellFocusDuration"))
                    if (typeof message.spellFocusDuration !== "number")
                        return "spellFocusDuration: number expected";
                if (message.swiftDuration != null && $Object.hasOwnProperty.call(message, "swiftDuration"))
                    if (typeof message.swiftDuration !== "number")
                        return "swiftDuration: number expected";
                if (message.ironFortressDuration != null && $Object.hasOwnProperty.call(message, "ironFortressDuration"))
                    if (typeof message.ironFortressDuration !== "number")
                        return "ironFortressDuration: number expected";
                if (message.guardianRoarDuration != null && $Object.hasOwnProperty.call(message, "guardianRoarDuration"))
                    if (typeof message.guardianRoarDuration !== "number")
                        return "guardianRoarDuration: number expected";
                if (message.berserkerModeDuration != null && $Object.hasOwnProperty.call(message, "berserkerModeDuration"))
                    if (typeof message.berserkerModeDuration !== "number")
                        return "berserkerModeDuration: number expected";
                if (message.lastStandDuration != null && $Object.hasOwnProperty.call(message, "lastStandDuration"))
                    if (typeof message.lastStandDuration !== "number")
                        return "lastStandDuration: number expected";
                if (message.serratedEdgesDuration != null && $Object.hasOwnProperty.call(message, "serratedEdgesDuration"))
                    if (typeof message.serratedEdgesDuration !== "number")
                        return "serratedEdgesDuration: number expected";
                if (message.poisonCoatingDuration != null && $Object.hasOwnProperty.call(message, "poisonCoatingDuration"))
                    if (typeof message.poisonCoatingDuration !== "number")
                        return "poisonCoatingDuration: number expected";
                if (message.stealthDuration != null && $Object.hasOwnProperty.call(message, "stealthDuration"))
                    if (typeof message.stealthDuration !== "number")
                        return "stealthDuration: number expected";
                if (message.zealDuration != null && $Object.hasOwnProperty.call(message, "zealDuration"))
                    if (typeof message.zealDuration !== "number")
                        return "zealDuration: number expected";
                if (message.moveSequence != null && $Object.hasOwnProperty.call(message, "moveSequence"))
                    if (!$util.isInteger(message.moveSequence) && !(message.moveSequence && $util.isInteger(message.moveSequence.low) && $util.isInteger(message.moveSequence.high)))
                        return "moveSequence: integer|Long expected";
                if (message.slowFactor != null && $Object.hasOwnProperty.call(message, "slowFactor"))
                    if (typeof message.slowFactor !== "number")
                        return "slowFactor: number expected";
                if (message.rootDuration != null && $Object.hasOwnProperty.call(message, "rootDuration"))
                    if (typeof message.rootDuration !== "number")
                        return "rootDuration: number expected";
                if (message.stunDuration != null && $Object.hasOwnProperty.call(message, "stunDuration"))
                    if (typeof message.stunDuration !== "number")
                        return "stunDuration: number expected";
                if (message.bleedDuration != null && $Object.hasOwnProperty.call(message, "bleedDuration"))
                    if (typeof message.bleedDuration !== "number")
                        return "bleedDuration: number expected";
                if (message.poisonDuration != null && $Object.hasOwnProperty.call(message, "poisonDuration"))
                    if (typeof message.poisonDuration !== "number")
                        return "poisonDuration: number expected";
                if (message.bleedDamage != null && $Object.hasOwnProperty.call(message, "bleedDamage"))
                    if (!$util.isInteger(message.bleedDamage))
                        return "bleedDamage: integer expected";
                if (message.poisonDamage != null && $Object.hasOwnProperty.call(message, "poisonDamage"))
                    if (!$util.isInteger(message.poisonDamage))
                        return "poisonDamage: integer expected";
                if (message.slowDuration != null && $Object.hasOwnProperty.call(message, "slowDuration"))
                    if (typeof message.slowDuration !== "number")
                        return "slowDuration: number expected";
                if (message.talentPoints != null && $Object.hasOwnProperty.call(message, "talentPoints"))
                    if (!$util.isInteger(message.talentPoints))
                        return "talentPoints: integer expected";
                if (message.unlockedTalents != null && $Object.hasOwnProperty.call(message, "unlockedTalents")) {
                    if (!$Array.isArray(message.unlockedTalents))
                        return "unlockedTalents: array expected";
                    for (let i = 0; i < message.unlockedTalents.length; ++i)
                        if (!$util.isString(message.unlockedTalents[i]))
                            return "unlockedTalents: string[] expected";
                }
                if (message.talentRanks != null && $Object.hasOwnProperty.call(message, "talentRanks")) {
                    if (!$util.isObject(message.talentRanks))
                        return "talentRanks: object expected";
                    let key = $Object.keys(message.talentRanks);
                    for (let i = 0; i < key.length; ++i)
                        if (!$util.isInteger(message.talentRanks[key[i]]))
                            return "talentRanks: integer{k:string} expected";
                }
                if (message.skillRunes != null && $Object.hasOwnProperty.call(message, "skillRunes")) {
                    if (!$util.isObject(message.skillRunes))
                        return "skillRunes: object expected";
                    let key = $Object.keys(message.skillRunes);
                    for (let i = 0; i < key.length; ++i)
                        if (!$util.isString(message.skillRunes[key[i]]))
                            return "skillRunes: string{k:string} expected";
                }
                if (message.partyId != null && $Object.hasOwnProperty.call(message, "partyId"))
                    if (!$util.isString(message.partyId))
                        return "partyId: string expected";
                if (message.socialStatus != null && $Object.hasOwnProperty.call(message, "socialStatus"))
                    if (!$util.isString(message.socialStatus))
                        return "socialStatus: string expected";
                if (message.guildId != null && $Object.hasOwnProperty.call(message, "guildId"))
                    if (!$util.isString(message.guildId))
                        return "guildId: string expected";
                if (message.guildTag != null && $Object.hasOwnProperty.call(message, "guildTag"))
                    if (!$util.isString(message.guildTag))
                        return "guildTag: string expected";
                if (message.jumpStartX != null && $Object.hasOwnProperty.call(message, "jumpStartX"))
                    if (typeof message.jumpStartX !== "number")
                        return "jumpStartX: number expected";
                if (message.jumpStartY != null && $Object.hasOwnProperty.call(message, "jumpStartY"))
                    if (typeof message.jumpStartY !== "number")
                        return "jumpStartY: number expected";
                if (message.jumpStartZ != null && $Object.hasOwnProperty.call(message, "jumpStartZ"))
                    if (typeof message.jumpStartZ !== "number")
                        return "jumpStartZ: number expected";
                if (message.jumpTargetX != null && $Object.hasOwnProperty.call(message, "jumpTargetX"))
                    if (typeof message.jumpTargetX !== "number")
                        return "jumpTargetX: number expected";
                if (message.jumpTargetY != null && $Object.hasOwnProperty.call(message, "jumpTargetY"))
                    if (typeof message.jumpTargetY !== "number")
                        return "jumpTargetY: number expected";
                if (message.jumpTargetZ != null && $Object.hasOwnProperty.call(message, "jumpTargetZ"))
                    if (typeof message.jumpTargetZ !== "number")
                        return "jumpTargetZ: number expected";
                if (message.jumpDuration != null && $Object.hasOwnProperty.call(message, "jumpDuration"))
                    if (typeof message.jumpDuration !== "number")
                        return "jumpDuration: number expected";
                if (message.jumpHeight != null && $Object.hasOwnProperty.call(message, "jumpHeight"))
                    if (typeof message.jumpHeight !== "number")
                        return "jumpHeight: number expected";
                if (message.jumpProgress != null && $Object.hasOwnProperty.call(message, "jumpProgress"))
                    if (typeof message.jumpProgress !== "number")
                        return "jumpProgress: number expected";
                return null;
            };

            /**
             * Creates an Entity message from a plain object. Also converts values to their respective internal types.
             * @function fromObject
             * @memberof eidolon.state.Entity
             * @static
             * @param {Object.<string,*>} object Plain object
             * @returns {eidolon.state.Entity} Entity
             */
            Entity.fromObject = function (object, _depth) {
                if (object instanceof $root.eidolon.state.Entity)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".eidolon.state.Entity: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.eidolon.state.Entity();
                if (object.id != null)
                    if (typeof object.id !== "string" || object.id.length)
                        message.id = $String(object.id);
                if (object.instanceId != null)
                    if (typeof object.instanceId !== "string" || object.instanceId.length)
                        message.instanceId = $String(object.instanceId);
                if (object.name != null)
                    if (typeof object.name !== "string" || object.name.length)
                        message.name = $String(object.name);
                if (object.type != null)
                    if (typeof object.type !== "string" || object.type.length)
                        message.type = $String(object.type);
                if (object.subType != null)
                    if (typeof object.subType !== "string" || object.subType.length)
                        message.subType = $String(object.subType);
                if (object.x != null)
                    if (!$Object.is($Number(object.x), 0))
                        message.x = $Number(object.x);
                if (object.y != null)
                    if (!$Object.is($Number(object.y), 0))
                        message.y = $Number(object.y);
                if (object.z != null)
                    if (!$Object.is($Number(object.z), 0))
                        message.z = $Number(object.z);
                if (object.rotation != null)
                    if (!$Object.is($Number(object.rotation), 0))
                        message.rotation = $Number(object.rotation);
                if (object.health != null)
                    if ($Number(object.health) !== 0)
                        message.health = object.health | 0;
                if (object.maxHealth != null)
                    if ($Number(object.maxHealth) !== 0)
                        message.maxHealth = object.maxHealth | 0;
                if (object.mana != null)
                    if ($Number(object.mana) !== 0)
                        message.mana = object.mana | 0;
                if (object.maxMana != null)
                    if ($Number(object.maxMana) !== 0)
                        message.maxMana = object.maxMana | 0;
                if (object.level != null)
                    if ($Number(object.level) !== 0)
                        message.level = object.level | 0;
                if (object.experience != null)
                    if (typeof object.experience === "object" ? object.experience.low || object.experience.high : $Number(object.experience) !== 0)
                        if ($util.Long)
                            message.experience = $util.Long.fromValue(object.experience, false);
                        else if (typeof object.experience === "string")
                            message.experience = $parseInt(object.experience, 10);
                        else if (typeof object.experience === "number")
                            message.experience = object.experience;
                        else if (typeof object.experience === "object")
                            message.experience = new $util.LongBits(object.experience.low >>> 0, object.experience.high >>> 0).toNumber();
                if (object.maxExperience != null)
                    if (typeof object.maxExperience === "object" ? object.maxExperience.low || object.maxExperience.high : $Number(object.maxExperience) !== 0)
                        if ($util.Long)
                            message.maxExperience = $util.Long.fromValue(object.maxExperience, false);
                        else if (typeof object.maxExperience === "string")
                            message.maxExperience = $parseInt(object.maxExperience, 10);
                        else if (typeof object.maxExperience === "number")
                            message.maxExperience = object.maxExperience;
                        else if (typeof object.maxExperience === "object")
                            message.maxExperience = new $util.LongBits(object.maxExperience.low >>> 0, object.maxExperience.high >>> 0).toNumber();
                if (object.gold != null)
                    if ($Number(object.gold) !== 0)
                        message.gold = object.gold | 0;
                if (object.skillPoints != null)
                    if ($Number(object.skillPoints) !== 0)
                        message.skillPoints = object.skillPoints | 0;
                if (object.selectedBranch != null)
                    if (typeof object.selectedBranch !== "string" || object.selectedBranch.length)
                        message.selectedBranch = $String(object.selectedBranch);
                if (object.unlockedSkills) {
                    if (!$Array.isArray(object.unlockedSkills))
                        throw $TypeError(".eidolon.state.Entity.unlockedSkills: array expected");
                    message.unlockedSkills = $Array(object.unlockedSkills.length);
                    for (let i = 0; i < object.unlockedSkills.length; ++i)
                        message.unlockedSkills[i] = $String(object.unlockedSkills[i]);
                }
                if (object.baseStats != null) {
                    if (!$util.isObject(object.baseStats))
                        throw $TypeError(".eidolon.state.Entity.baseStats: object expected");
                    message.baseStats = $root.eidolon.state.Stats.fromObject(object.baseStats, _depth + 1);
                }
                if (object.stats != null) {
                    if (!$util.isObject(object.stats))
                        throw $TypeError(".eidolon.state.Entity.stats: object expected");
                    message.stats = $root.eidolon.state.Stats.fromObject(object.stats, _depth + 1);
                }
                if (object.damage != null)
                    if ($Number(object.damage) !== 0)
                        message.damage = object.damage | 0;
                if (object.defense != null)
                    if ($Number(object.defense) !== 0)
                        message.defense = object.defense | 0;
                if (object.speed != null)
                    if (!$Object.is($Number(object.speed), 0))
                        message.speed = $Number(object.speed);
                if (object.attackSpeed != null)
                    if (!$Object.is($Number(object.attackSpeed), 0))
                        message.attackSpeed = $Number(object.attackSpeed);
                if (object.cooldownReduction != null)
                    if (!$Object.is($Number(object.cooldownReduction), 0))
                        message.cooldownReduction = $Number(object.cooldownReduction);
                if (object.hpRegen != null)
                    if (!$Object.is($Number(object.hpRegen), 0))
                        message.hpRegen = $Number(object.hpRegen);
                if (object.manaRegen != null)
                    if (!$Object.is($Number(object.manaRegen), 0))
                        message.manaRegen = $Number(object.manaRegen);
                if (object.castSpeed != null)
                    if (!$Object.is($Number(object.castSpeed), 0))
                        message.castSpeed = $Number(object.castSpeed);
                if (object.scale != null)
                    if (!$Object.is($Number(object.scale), 0))
                        message.scale = $Number(object.scale);
                if (object.state != null)
                    if (typeof object.state !== "string" || object.state.length)
                        message.state = $String(object.state);
                if (object.equipment) {
                    if (!$util.isObject(object.equipment))
                        throw $TypeError(".eidolon.state.Entity.equipment: object expected");
                    message.equipment = {};
                    for (let keys = $Object.keys(object.equipment), i = 0; i < keys.length; ++i) {
                        if (keys[i] === "__proto__")
                            $util.makeProp(message.equipment, keys[i]);
                        if (!$util.isObject(object.equipment[keys[i]]))
                            throw $TypeError(".eidolon.state.Entity.equipment: object expected");
                        message.equipment[keys[i]] = $root.eidolon.state.Item.fromObject(object.equipment[keys[i]], _depth + 1);
                    }
                }
                if (object.quests) {
                    if (!$Array.isArray(object.quests))
                        throw $TypeError(".eidolon.state.Entity.quests: array expected");
                    message.quests = $Array(object.quests.length);
                    for (let i = 0; i < object.quests.length; ++i) {
                        if (!$util.isObject(object.quests[i]))
                            throw $TypeError(".eidolon.state.Entity.quests: object expected");
                        message.quests[i] = $root.eidolon.state.Quest.fromObject(object.quests[i], _depth + 1);
                    }
                }
                if (object.lootItem != null) {
                    if (!$util.isObject(object.lootItem))
                        throw $TypeError(".eidolon.state.Entity.lootItem: object expected");
                    message.lootItem = $root.eidolon.state.Item.fromObject(object.lootItem, _depth + 1);
                }
                if (object.ownerId != null)
                    if (typeof object.ownerId !== "string" || object.ownerId.length)
                        message.ownerId = $String(object.ownerId);
                if (object.velX != null)
                    if (!$Object.is($Number(object.velX), 0))
                        message.velX = $Number(object.velX);
                if (object.velZ != null)
                    if (!$Object.is($Number(object.velZ), 0))
                        message.velZ = $Number(object.velZ);
                if (object.spiritsActive != null)
                    if (object.spiritsActive)
                        message.spiritsActive = $Boolean(object.spiritsActive);
                if (object.spiritsBoosted != null)
                    if (object.spiritsBoosted)
                        message.spiritsBoosted = $Boolean(object.spiritsBoosted);
                if (object.isCharging != null)
                    if (object.isCharging)
                        message.isCharging = $Boolean(object.isCharging);
                if (object.guardianEmbraceActive != null)
                    if (object.guardianEmbraceActive)
                        message.guardianEmbraceActive = $Boolean(object.guardianEmbraceActive);
                if (object.blessingResolveActive != null)
                    if (object.blessingResolveActive)
                        message.blessingResolveActive = $Boolean(object.blessingResolveActive);
                if (object.divineInterventionActive != null)
                    if (object.divineInterventionActive)
                        message.divineInterventionActive = $Boolean(object.divineInterventionActive);
                if (object.arcaneShieldActive != null)
                    if (object.arcaneShieldActive)
                        message.arcaneShieldActive = $Boolean(object.arcaneShieldActive);
                if (object.arcaneShieldHp != null)
                    if ($Number(object.arcaneShieldHp) !== 0)
                        message.arcaneShieldHp = object.arcaneShieldHp | 0;
                if (object.timeWarpActive != null)
                    if (object.timeWarpActive)
                        message.timeWarpActive = $Boolean(object.timeWarpActive);
                if (object.spellFocusActive != null)
                    if (object.spellFocusActive)
                        message.spellFocusActive = $Boolean(object.spellFocusActive);
                if (object.swiftActive != null)
                    if (object.swiftActive)
                        message.swiftActive = $Boolean(object.swiftActive);
                if (object.ironFortressActive != null)
                    if (object.ironFortressActive)
                        message.ironFortressActive = $Boolean(object.ironFortressActive);
                if (object.guardianRoarActive != null)
                    if (object.guardianRoarActive)
                        message.guardianRoarActive = $Boolean(object.guardianRoarActive);
                if (object.berserkerModeActive != null)
                    if (object.berserkerModeActive)
                        message.berserkerModeActive = $Boolean(object.berserkerModeActive);
                if (object.lastStandActive != null)
                    if (object.lastStandActive)
                        message.lastStandActive = $Boolean(object.lastStandActive);
                if (object.serratedEdgesActive != null)
                    if (object.serratedEdgesActive)
                        message.serratedEdgesActive = $Boolean(object.serratedEdgesActive);
                if (object.poisonCoatingActive != null)
                    if (object.poisonCoatingActive)
                        message.poisonCoatingActive = $Boolean(object.poisonCoatingActive);
                if (object.stealthActive != null)
                    if (object.stealthActive)
                        message.stealthActive = $Boolean(object.stealthActive);
                if (object.zealActive != null)
                    if (object.zealActive)
                        message.zealActive = $Boolean(object.zealActive);
                if (object.stunned != null)
                    if (object.stunned)
                        message.stunned = $Boolean(object.stunned);
                if (object.slowed != null)
                    if (object.slowed)
                        message.slowed = $Boolean(object.slowed);
                if (object.rooted != null)
                    if (object.rooted)
                        message.rooted = $Boolean(object.rooted);
                if (object.bleeding != null)
                    if (object.bleeding)
                        message.bleeding = $Boolean(object.bleeding);
                if (object.poisoned != null)
                    if (object.poisoned)
                        message.poisoned = $Boolean(object.poisoned);
                if (object.weakPointMarked != null)
                    if (object.weakPointMarked)
                        message.weakPointMarked = $Boolean(object.weakPointMarked);
                if (object.weakPointDuration != null)
                    if (!$Object.is($Number(object.weakPointDuration), 0))
                        message.weakPointDuration = $Number(object.weakPointDuration);
                if (object.markWeakness != null)
                    if (object.markWeakness)
                        message.markWeakness = $Boolean(object.markWeakness);
                if (object.markWeaknessDuration != null)
                    if (!$Object.is($Number(object.markWeaknessDuration), 0))
                        message.markWeaknessDuration = $Number(object.markWeaknessDuration);
                if (object.spiritDuration != null)
                    if (!$Object.is($Number(object.spiritDuration), 0))
                        message.spiritDuration = $Number(object.spiritDuration);
                if (object.blessingResolveDuration != null)
                    if (!$Object.is($Number(object.blessingResolveDuration), 0))
                        message.blessingResolveDuration = $Number(object.blessingResolveDuration);
                if (object.timeWarpDuration != null)
                    if (!$Object.is($Number(object.timeWarpDuration), 0))
                        message.timeWarpDuration = $Number(object.timeWarpDuration);
                if (object.guardianEmbraceDuration != null)
                    if (!$Object.is($Number(object.guardianEmbraceDuration), 0))
                        message.guardianEmbraceDuration = $Number(object.guardianEmbraceDuration);
                if (object.arcaneShieldDuration != null)
                    if (!$Object.is($Number(object.arcaneShieldDuration), 0))
                        message.arcaneShieldDuration = $Number(object.arcaneShieldDuration);
                if (object.divineInterventionDuration != null)
                    if (!$Object.is($Number(object.divineInterventionDuration), 0))
                        message.divineInterventionDuration = $Number(object.divineInterventionDuration);
                if (object.spellFocusDuration != null)
                    if (!$Object.is($Number(object.spellFocusDuration), 0))
                        message.spellFocusDuration = $Number(object.spellFocusDuration);
                if (object.swiftDuration != null)
                    if (!$Object.is($Number(object.swiftDuration), 0))
                        message.swiftDuration = $Number(object.swiftDuration);
                if (object.ironFortressDuration != null)
                    if (!$Object.is($Number(object.ironFortressDuration), 0))
                        message.ironFortressDuration = $Number(object.ironFortressDuration);
                if (object.guardianRoarDuration != null)
                    if (!$Object.is($Number(object.guardianRoarDuration), 0))
                        message.guardianRoarDuration = $Number(object.guardianRoarDuration);
                if (object.berserkerModeDuration != null)
                    if (!$Object.is($Number(object.berserkerModeDuration), 0))
                        message.berserkerModeDuration = $Number(object.berserkerModeDuration);
                if (object.lastStandDuration != null)
                    if (!$Object.is($Number(object.lastStandDuration), 0))
                        message.lastStandDuration = $Number(object.lastStandDuration);
                if (object.serratedEdgesDuration != null)
                    if (!$Object.is($Number(object.serratedEdgesDuration), 0))
                        message.serratedEdgesDuration = $Number(object.serratedEdgesDuration);
                if (object.poisonCoatingDuration != null)
                    if (!$Object.is($Number(object.poisonCoatingDuration), 0))
                        message.poisonCoatingDuration = $Number(object.poisonCoatingDuration);
                if (object.stealthDuration != null)
                    if (!$Object.is($Number(object.stealthDuration), 0))
                        message.stealthDuration = $Number(object.stealthDuration);
                if (object.zealDuration != null)
                    if (!$Object.is($Number(object.zealDuration), 0))
                        message.zealDuration = $Number(object.zealDuration);
                if (object.moveSequence != null)
                    if (typeof object.moveSequence === "object" ? object.moveSequence.low || object.moveSequence.high : $Number(object.moveSequence) !== 0)
                        if ($util.Long)
                            message.moveSequence = $util.Long.fromValue(object.moveSequence, true);
                        else if (typeof object.moveSequence === "string")
                            message.moveSequence = $parseInt(object.moveSequence, 10);
                        else if (typeof object.moveSequence === "number")
                            message.moveSequence = object.moveSequence;
                        else if (typeof object.moveSequence === "object")
                            message.moveSequence = new $util.LongBits(object.moveSequence.low >>> 0, object.moveSequence.high >>> 0).toNumber(true);
                if (object.slowFactor != null)
                    if (!$Object.is($Number(object.slowFactor), 0))
                        message.slowFactor = $Number(object.slowFactor);
                if (object.rootDuration != null)
                    if (!$Object.is($Number(object.rootDuration), 0))
                        message.rootDuration = $Number(object.rootDuration);
                if (object.stunDuration != null)
                    if (!$Object.is($Number(object.stunDuration), 0))
                        message.stunDuration = $Number(object.stunDuration);
                if (object.bleedDuration != null)
                    if (!$Object.is($Number(object.bleedDuration), 0))
                        message.bleedDuration = $Number(object.bleedDuration);
                if (object.poisonDuration != null)
                    if (!$Object.is($Number(object.poisonDuration), 0))
                        message.poisonDuration = $Number(object.poisonDuration);
                if (object.bleedDamage != null)
                    if ($Number(object.bleedDamage) !== 0)
                        message.bleedDamage = object.bleedDamage | 0;
                if (object.poisonDamage != null)
                    if ($Number(object.poisonDamage) !== 0)
                        message.poisonDamage = object.poisonDamage | 0;
                if (object.slowDuration != null)
                    if (!$Object.is($Number(object.slowDuration), 0))
                        message.slowDuration = $Number(object.slowDuration);
                if (object.talentPoints != null)
                    if ($Number(object.talentPoints) !== 0)
                        message.talentPoints = object.talentPoints | 0;
                if (object.unlockedTalents) {
                    if (!$Array.isArray(object.unlockedTalents))
                        throw $TypeError(".eidolon.state.Entity.unlockedTalents: array expected");
                    message.unlockedTalents = $Array(object.unlockedTalents.length);
                    for (let i = 0; i < object.unlockedTalents.length; ++i)
                        message.unlockedTalents[i] = $String(object.unlockedTalents[i]);
                }
                if (object.talentRanks) {
                    if (!$util.isObject(object.talentRanks))
                        throw $TypeError(".eidolon.state.Entity.talentRanks: object expected");
                    message.talentRanks = {};
                    for (let keys = $Object.keys(object.talentRanks), i = 0; i < keys.length; ++i) {
                        if (keys[i] === "__proto__")
                            $util.makeProp(message.talentRanks, keys[i]);
                        message.talentRanks[keys[i]] = object.talentRanks[keys[i]] | 0;
                    }
                }
                if (object.skillRunes) {
                    if (!$util.isObject(object.skillRunes))
                        throw $TypeError(".eidolon.state.Entity.skillRunes: object expected");
                    message.skillRunes = {};
                    for (let keys = $Object.keys(object.skillRunes), i = 0; i < keys.length; ++i) {
                        if (keys[i] === "__proto__")
                            $util.makeProp(message.skillRunes, keys[i]);
                        message.skillRunes[keys[i]] = $String(object.skillRunes[keys[i]]);
                    }
                }
                if (object.partyId != null)
                    if (typeof object.partyId !== "string" || object.partyId.length)
                        message.partyId = $String(object.partyId);
                if (object.socialStatus != null)
                    if (typeof object.socialStatus !== "string" || object.socialStatus.length)
                        message.socialStatus = $String(object.socialStatus);
                if (object.guildId != null)
                    if (typeof object.guildId !== "string" || object.guildId.length)
                        message.guildId = $String(object.guildId);
                if (object.guildTag != null)
                    if (typeof object.guildTag !== "string" || object.guildTag.length)
                        message.guildTag = $String(object.guildTag);
                if (object.jumpStartX != null)
                    if (!$Object.is($Number(object.jumpStartX), 0))
                        message.jumpStartX = $Number(object.jumpStartX);
                if (object.jumpStartY != null)
                    if (!$Object.is($Number(object.jumpStartY), 0))
                        message.jumpStartY = $Number(object.jumpStartY);
                if (object.jumpStartZ != null)
                    if (!$Object.is($Number(object.jumpStartZ), 0))
                        message.jumpStartZ = $Number(object.jumpStartZ);
                if (object.jumpTargetX != null)
                    if (!$Object.is($Number(object.jumpTargetX), 0))
                        message.jumpTargetX = $Number(object.jumpTargetX);
                if (object.jumpTargetY != null)
                    if (!$Object.is($Number(object.jumpTargetY), 0))
                        message.jumpTargetY = $Number(object.jumpTargetY);
                if (object.jumpTargetZ != null)
                    if (!$Object.is($Number(object.jumpTargetZ), 0))
                        message.jumpTargetZ = $Number(object.jumpTargetZ);
                if (object.jumpDuration != null)
                    if (!$Object.is($Number(object.jumpDuration), 0))
                        message.jumpDuration = $Number(object.jumpDuration);
                if (object.jumpHeight != null)
                    if (!$Object.is($Number(object.jumpHeight), 0))
                        message.jumpHeight = $Number(object.jumpHeight);
                if (object.jumpProgress != null)
                    if (!$Object.is($Number(object.jumpProgress), 0))
                        message.jumpProgress = $Number(object.jumpProgress);
                return message;
            };

            /**
             * Creates a plain object from an Entity message. Also converts values to other types if specified.
             * @function toObject
             * @memberof eidolon.state.Entity
             * @static
             * @param {eidolon.state.Entity} message Entity
             * @param {$protobuf.IConversionOptions} [options] Conversion options
             * @returns {Object.<string,*>} Plain object
             */
            Entity.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.arrays || options.defaults) {
                    object.unlockedSkills = [];
                    object.quests = [];
                    object.unlockedTalents = [];
                }
                if (options.objects || options.defaults) {
                    object.equipment = {};
                    object.talentRanks = {};
                    object.skillRunes = {};
                }
                if (options.defaults) {
                    object.id = "";
                    object.instanceId = "";
                    object.name = "";
                    object.type = "";
                    object.subType = "";
                    object.x = 0;
                    object.y = 0;
                    object.z = 0;
                    object.rotation = 0;
                    object.health = 0;
                    object.maxHealth = 0;
                    object.mana = 0;
                    object.maxMana = 0;
                    object.level = 0;
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, false);
                        object.experience = options.longs === $String ? long.toString() : options.longs === $Number ? long.toNumber() : typeof $BigInt !== "undefined" && options.longs === $BigInt ? long.toBigInt() : long;
                    } else
                        object.experience = options.longs === $String ? "0" : typeof $BigInt !== "undefined" && options.longs === $BigInt ? $BigInt("0") : 0;
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, false);
                        object.maxExperience = options.longs === $String ? long.toString() : options.longs === $Number ? long.toNumber() : typeof $BigInt !== "undefined" && options.longs === $BigInt ? long.toBigInt() : long;
                    } else
                        object.maxExperience = options.longs === $String ? "0" : typeof $BigInt !== "undefined" && options.longs === $BigInt ? $BigInt("0") : 0;
                    object.gold = 0;
                    object.skillPoints = 0;
                    object.selectedBranch = "";
                    object.baseStats = null;
                    object.stats = null;
                    object.damage = 0;
                    object.defense = 0;
                    object.speed = 0;
                    object.attackSpeed = 0;
                    object.cooldownReduction = 0;
                    object.hpRegen = 0;
                    object.manaRegen = 0;
                    object.castSpeed = 0;
                    object.scale = 0;
                    object.state = "";
                    object.lootItem = null;
                    object.ownerId = "";
                    object.velX = 0;
                    object.velZ = 0;
                    object.spiritsActive = false;
                    object.spiritsBoosted = false;
                    object.isCharging = false;
                    object.stunned = false;
                    object.slowed = false;
                    object.rooted = false;
                    object.bleeding = false;
                    object.poisoned = false;
                    object.talentPoints = 0;
                    object.guardianEmbraceActive = false;
                    object.blessingResolveActive = false;
                    object.divineInterventionActive = false;
                    object.arcaneShieldActive = false;
                    object.arcaneShieldHp = 0;
                    object.timeWarpActive = false;
                    object.spellFocusActive = false;
                    object.slowFactor = 0;
                    object.rootDuration = 0;
                    object.stunDuration = 0;
                    object.bleedDuration = 0;
                    object.poisonDuration = 0;
                    object.bleedDamage = 0;
                    object.poisonDamage = 0;
                    object.slowDuration = 0;
                    object.weakPointMarked = false;
                    object.weakPointDuration = 0;
                    object.markWeakness = false;
                    object.markWeaknessDuration = 0;
                    object.spiritDuration = 0;
                    object.blessingResolveDuration = 0;
                    object.timeWarpDuration = 0;
                    object.guardianEmbraceDuration = 0;
                    object.arcaneShieldDuration = 0;
                    object.divineInterventionDuration = 0;
                    object.spellFocusDuration = 0;
                    object.swiftActive = false;
                    object.swiftDuration = 0;
                    object.partyId = "";
                    object.socialStatus = "";
                    object.jumpStartX = 0;
                    object.jumpStartY = 0;
                    object.jumpStartZ = 0;
                    object.jumpTargetX = 0;
                    object.jumpTargetY = 0;
                    object.jumpTargetZ = 0;
                    object.jumpDuration = 0;
                    object.jumpHeight = 0;
                    object.jumpProgress = 0;
                    object.ironFortressActive = false;
                    object.guardianRoarActive = false;
                    object.berserkerModeActive = false;
                    object.lastStandActive = false;
                    object.serratedEdgesActive = false;
                    object.poisonCoatingActive = false;
                    object.stealthActive = false;
                    object.zealActive = false;
                    object.ironFortressDuration = 0;
                    object.guardianRoarDuration = 0;
                    object.berserkerModeDuration = 0;
                    object.lastStandDuration = 0;
                    object.serratedEdgesDuration = 0;
                    object.poisonCoatingDuration = 0;
                    object.stealthDuration = 0;
                    object.zealDuration = 0;
                    if ($util.Long) {
                        let long = new $util.Long(0, 0, true);
                        object.moveSequence = options.longs === $String ? long.toString() : options.longs === $Number ? long.toNumber() : typeof $BigInt !== "undefined" && options.longs === $BigInt ? long.toBigInt() : long;
                    } else
                        object.moveSequence = options.longs === $String ? "0" : typeof $BigInt !== "undefined" && options.longs === $BigInt ? $BigInt("0") : 0;
                    object.guildId = "";
                    object.guildTag = "";
                }
                if (message.id != null && $Object.hasOwnProperty.call(message, "id"))
                    object.id = message.id;
                if (message.instanceId != null && $Object.hasOwnProperty.call(message, "instanceId"))
                    object.instanceId = message.instanceId;
                if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                    object.name = message.name;
                if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                    object.type = message.type;
                if (message.subType != null && $Object.hasOwnProperty.call(message, "subType"))
                    object.subType = message.subType;
                if (message.x != null && $Object.hasOwnProperty.call(message, "x"))
                    object.x = options.json && !$isFinite(message.x) ? $String(message.x) : message.x;
                if (message.y != null && $Object.hasOwnProperty.call(message, "y"))
                    object.y = options.json && !$isFinite(message.y) ? $String(message.y) : message.y;
                if (message.z != null && $Object.hasOwnProperty.call(message, "z"))
                    object.z = options.json && !$isFinite(message.z) ? $String(message.z) : message.z;
                if (message.rotation != null && $Object.hasOwnProperty.call(message, "rotation"))
                    object.rotation = options.json && !$isFinite(message.rotation) ? $String(message.rotation) : message.rotation;
                if (message.health != null && $Object.hasOwnProperty.call(message, "health"))
                    object.health = message.health;
                if (message.maxHealth != null && $Object.hasOwnProperty.call(message, "maxHealth"))
                    object.maxHealth = message.maxHealth;
                if (message.mana != null && $Object.hasOwnProperty.call(message, "mana"))
                    object.mana = message.mana;
                if (message.maxMana != null && $Object.hasOwnProperty.call(message, "maxMana"))
                    object.maxMana = message.maxMana;
                if (message.level != null && $Object.hasOwnProperty.call(message, "level"))
                    object.level = message.level;
                if (message.experience != null && $Object.hasOwnProperty.call(message, "experience"))
                    if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
                        object.experience = typeof message.experience === "number" ? $BigInt(message.experience) : $util.Long.fromBits(message.experience.low >>> 0, message.experience.high >>> 0, false).toBigInt();
                    else if (typeof message.experience === "number")
                        object.experience = options.longs === $String ? $String(message.experience) : message.experience;
                    else
                        object.experience = options.longs === $String ? $util.Long.prototype.toString.call(message.experience) : options.longs === $Number ? new $util.LongBits(message.experience.low >>> 0, message.experience.high >>> 0).toNumber() : message.experience;
                if (message.maxExperience != null && $Object.hasOwnProperty.call(message, "maxExperience"))
                    if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
                        object.maxExperience = typeof message.maxExperience === "number" ? $BigInt(message.maxExperience) : $util.Long.fromBits(message.maxExperience.low >>> 0, message.maxExperience.high >>> 0, false).toBigInt();
                    else if (typeof message.maxExperience === "number")
                        object.maxExperience = options.longs === $String ? $String(message.maxExperience) : message.maxExperience;
                    else
                        object.maxExperience = options.longs === $String ? $util.Long.prototype.toString.call(message.maxExperience) : options.longs === $Number ? new $util.LongBits(message.maxExperience.low >>> 0, message.maxExperience.high >>> 0).toNumber() : message.maxExperience;
                if (message.gold != null && $Object.hasOwnProperty.call(message, "gold"))
                    object.gold = message.gold;
                if (message.skillPoints != null && $Object.hasOwnProperty.call(message, "skillPoints"))
                    object.skillPoints = message.skillPoints;
                if (message.selectedBranch != null && $Object.hasOwnProperty.call(message, "selectedBranch"))
                    object.selectedBranch = message.selectedBranch;
                if (message.unlockedSkills && message.unlockedSkills.length) {
                    object.unlockedSkills = $Array(message.unlockedSkills.length);
                    for (let j = 0; j < message.unlockedSkills.length; ++j)
                        object.unlockedSkills[j] = message.unlockedSkills[j];
                }
                if (message.baseStats != null && $Object.hasOwnProperty.call(message, "baseStats"))
                    object.baseStats = $root.eidolon.state.Stats.toObject(message.baseStats, options, _depth + 1);
                if (message.stats != null && $Object.hasOwnProperty.call(message, "stats"))
                    object.stats = $root.eidolon.state.Stats.toObject(message.stats, options, _depth + 1);
                if (message.damage != null && $Object.hasOwnProperty.call(message, "damage"))
                    object.damage = message.damage;
                if (message.defense != null && $Object.hasOwnProperty.call(message, "defense"))
                    object.defense = message.defense;
                if (message.speed != null && $Object.hasOwnProperty.call(message, "speed"))
                    object.speed = options.json && !$isFinite(message.speed) ? $String(message.speed) : message.speed;
                if (message.attackSpeed != null && $Object.hasOwnProperty.call(message, "attackSpeed"))
                    object.attackSpeed = options.json && !$isFinite(message.attackSpeed) ? $String(message.attackSpeed) : message.attackSpeed;
                if (message.cooldownReduction != null && $Object.hasOwnProperty.call(message, "cooldownReduction"))
                    object.cooldownReduction = options.json && !$isFinite(message.cooldownReduction) ? $String(message.cooldownReduction) : message.cooldownReduction;
                if (message.hpRegen != null && $Object.hasOwnProperty.call(message, "hpRegen"))
                    object.hpRegen = options.json && !$isFinite(message.hpRegen) ? $String(message.hpRegen) : message.hpRegen;
                if (message.manaRegen != null && $Object.hasOwnProperty.call(message, "manaRegen"))
                    object.manaRegen = options.json && !$isFinite(message.manaRegen) ? $String(message.manaRegen) : message.manaRegen;
                if (message.castSpeed != null && $Object.hasOwnProperty.call(message, "castSpeed"))
                    object.castSpeed = options.json && !$isFinite(message.castSpeed) ? $String(message.castSpeed) : message.castSpeed;
                if (message.scale != null && $Object.hasOwnProperty.call(message, "scale"))
                    object.scale = options.json && !$isFinite(message.scale) ? $String(message.scale) : message.scale;
                if (message.state != null && $Object.hasOwnProperty.call(message, "state"))
                    object.state = message.state;
                let keys2;
                if (message.equipment && (keys2 = $Object.keys(message.equipment)).length) {
                    object.equipment = {};
                    for (let j = 0; j < keys2.length; ++j) {
                        if (keys2[j] === "__proto__")
                            $util.makeProp(object.equipment, keys2[j]);
                        object.equipment[keys2[j]] = $root.eidolon.state.Item.toObject(message.equipment[keys2[j]], options, _depth + 1);
                    }
                }
                if (message.quests && message.quests.length) {
                    object.quests = $Array(message.quests.length);
                    for (let j = 0; j < message.quests.length; ++j)
                        object.quests[j] = $root.eidolon.state.Quest.toObject(message.quests[j], options, _depth + 1);
                }
                if (message.lootItem != null && $Object.hasOwnProperty.call(message, "lootItem"))
                    object.lootItem = $root.eidolon.state.Item.toObject(message.lootItem, options, _depth + 1);
                if (message.ownerId != null && $Object.hasOwnProperty.call(message, "ownerId"))
                    object.ownerId = message.ownerId;
                if (message.velX != null && $Object.hasOwnProperty.call(message, "velX"))
                    object.velX = options.json && !$isFinite(message.velX) ? $String(message.velX) : message.velX;
                if (message.velZ != null && $Object.hasOwnProperty.call(message, "velZ"))
                    object.velZ = options.json && !$isFinite(message.velZ) ? $String(message.velZ) : message.velZ;
                if (message.spiritsActive != null && $Object.hasOwnProperty.call(message, "spiritsActive"))
                    object.spiritsActive = message.spiritsActive;
                if (message.spiritsBoosted != null && $Object.hasOwnProperty.call(message, "spiritsBoosted"))
                    object.spiritsBoosted = message.spiritsBoosted;
                if (message.isCharging != null && $Object.hasOwnProperty.call(message, "isCharging"))
                    object.isCharging = message.isCharging;
                if (message.stunned != null && $Object.hasOwnProperty.call(message, "stunned"))
                    object.stunned = message.stunned;
                if (message.slowed != null && $Object.hasOwnProperty.call(message, "slowed"))
                    object.slowed = message.slowed;
                if (message.rooted != null && $Object.hasOwnProperty.call(message, "rooted"))
                    object.rooted = message.rooted;
                if (message.bleeding != null && $Object.hasOwnProperty.call(message, "bleeding"))
                    object.bleeding = message.bleeding;
                if (message.poisoned != null && $Object.hasOwnProperty.call(message, "poisoned"))
                    object.poisoned = message.poisoned;
                if (message.talentPoints != null && $Object.hasOwnProperty.call(message, "talentPoints"))
                    object.talentPoints = message.talentPoints;
                if (message.unlockedTalents && message.unlockedTalents.length) {
                    object.unlockedTalents = $Array(message.unlockedTalents.length);
                    for (let j = 0; j < message.unlockedTalents.length; ++j)
                        object.unlockedTalents[j] = message.unlockedTalents[j];
                }
                if (message.talentRanks && (keys2 = $Object.keys(message.talentRanks)).length) {
                    object.talentRanks = {};
                    for (let j = 0; j < keys2.length; ++j) {
                        if (keys2[j] === "__proto__")
                            $util.makeProp(object.talentRanks, keys2[j]);
                        object.talentRanks[keys2[j]] = message.talentRanks[keys2[j]];
                    }
                }
                if (message.skillRunes && (keys2 = $Object.keys(message.skillRunes)).length) {
                    object.skillRunes = {};
                    for (let j = 0; j < keys2.length; ++j) {
                        if (keys2[j] === "__proto__")
                            $util.makeProp(object.skillRunes, keys2[j]);
                        object.skillRunes[keys2[j]] = message.skillRunes[keys2[j]];
                    }
                }
                if (message.guardianEmbraceActive != null && $Object.hasOwnProperty.call(message, "guardianEmbraceActive"))
                    object.guardianEmbraceActive = message.guardianEmbraceActive;
                if (message.blessingResolveActive != null && $Object.hasOwnProperty.call(message, "blessingResolveActive"))
                    object.blessingResolveActive = message.blessingResolveActive;
                if (message.divineInterventionActive != null && $Object.hasOwnProperty.call(message, "divineInterventionActive"))
                    object.divineInterventionActive = message.divineInterventionActive;
                if (message.arcaneShieldActive != null && $Object.hasOwnProperty.call(message, "arcaneShieldActive"))
                    object.arcaneShieldActive = message.arcaneShieldActive;
                if (message.arcaneShieldHp != null && $Object.hasOwnProperty.call(message, "arcaneShieldHp"))
                    object.arcaneShieldHp = message.arcaneShieldHp;
                if (message.timeWarpActive != null && $Object.hasOwnProperty.call(message, "timeWarpActive"))
                    object.timeWarpActive = message.timeWarpActive;
                if (message.spellFocusActive != null && $Object.hasOwnProperty.call(message, "spellFocusActive"))
                    object.spellFocusActive = message.spellFocusActive;
                if (message.slowFactor != null && $Object.hasOwnProperty.call(message, "slowFactor"))
                    object.slowFactor = options.json && !$isFinite(message.slowFactor) ? $String(message.slowFactor) : message.slowFactor;
                if (message.rootDuration != null && $Object.hasOwnProperty.call(message, "rootDuration"))
                    object.rootDuration = options.json && !$isFinite(message.rootDuration) ? $String(message.rootDuration) : message.rootDuration;
                if (message.stunDuration != null && $Object.hasOwnProperty.call(message, "stunDuration"))
                    object.stunDuration = options.json && !$isFinite(message.stunDuration) ? $String(message.stunDuration) : message.stunDuration;
                if (message.bleedDuration != null && $Object.hasOwnProperty.call(message, "bleedDuration"))
                    object.bleedDuration = options.json && !$isFinite(message.bleedDuration) ? $String(message.bleedDuration) : message.bleedDuration;
                if (message.poisonDuration != null && $Object.hasOwnProperty.call(message, "poisonDuration"))
                    object.poisonDuration = options.json && !$isFinite(message.poisonDuration) ? $String(message.poisonDuration) : message.poisonDuration;
                if (message.bleedDamage != null && $Object.hasOwnProperty.call(message, "bleedDamage"))
                    object.bleedDamage = message.bleedDamage;
                if (message.poisonDamage != null && $Object.hasOwnProperty.call(message, "poisonDamage"))
                    object.poisonDamage = message.poisonDamage;
                if (message.slowDuration != null && $Object.hasOwnProperty.call(message, "slowDuration"))
                    object.slowDuration = options.json && !$isFinite(message.slowDuration) ? $String(message.slowDuration) : message.slowDuration;
                if (message.weakPointMarked != null && $Object.hasOwnProperty.call(message, "weakPointMarked"))
                    object.weakPointMarked = message.weakPointMarked;
                if (message.weakPointDuration != null && $Object.hasOwnProperty.call(message, "weakPointDuration"))
                    object.weakPointDuration = options.json && !$isFinite(message.weakPointDuration) ? $String(message.weakPointDuration) : message.weakPointDuration;
                if (message.markWeakness != null && $Object.hasOwnProperty.call(message, "markWeakness"))
                    object.markWeakness = message.markWeakness;
                if (message.markWeaknessDuration != null && $Object.hasOwnProperty.call(message, "markWeaknessDuration"))
                    object.markWeaknessDuration = options.json && !$isFinite(message.markWeaknessDuration) ? $String(message.markWeaknessDuration) : message.markWeaknessDuration;
                if (message.spiritDuration != null && $Object.hasOwnProperty.call(message, "spiritDuration"))
                    object.spiritDuration = options.json && !$isFinite(message.spiritDuration) ? $String(message.spiritDuration) : message.spiritDuration;
                if (message.blessingResolveDuration != null && $Object.hasOwnProperty.call(message, "blessingResolveDuration"))
                    object.blessingResolveDuration = options.json && !$isFinite(message.blessingResolveDuration) ? $String(message.blessingResolveDuration) : message.blessingResolveDuration;
                if (message.timeWarpDuration != null && $Object.hasOwnProperty.call(message, "timeWarpDuration"))
                    object.timeWarpDuration = options.json && !$isFinite(message.timeWarpDuration) ? $String(message.timeWarpDuration) : message.timeWarpDuration;
                if (message.guardianEmbraceDuration != null && $Object.hasOwnProperty.call(message, "guardianEmbraceDuration"))
                    object.guardianEmbraceDuration = options.json && !$isFinite(message.guardianEmbraceDuration) ? $String(message.guardianEmbraceDuration) : message.guardianEmbraceDuration;
                if (message.arcaneShieldDuration != null && $Object.hasOwnProperty.call(message, "arcaneShieldDuration"))
                    object.arcaneShieldDuration = options.json && !$isFinite(message.arcaneShieldDuration) ? $String(message.arcaneShieldDuration) : message.arcaneShieldDuration;
                if (message.divineInterventionDuration != null && $Object.hasOwnProperty.call(message, "divineInterventionDuration"))
                    object.divineInterventionDuration = options.json && !$isFinite(message.divineInterventionDuration) ? $String(message.divineInterventionDuration) : message.divineInterventionDuration;
                if (message.spellFocusDuration != null && $Object.hasOwnProperty.call(message, "spellFocusDuration"))
                    object.spellFocusDuration = options.json && !$isFinite(message.spellFocusDuration) ? $String(message.spellFocusDuration) : message.spellFocusDuration;
                if (message.swiftActive != null && $Object.hasOwnProperty.call(message, "swiftActive"))
                    object.swiftActive = message.swiftActive;
                if (message.swiftDuration != null && $Object.hasOwnProperty.call(message, "swiftDuration"))
                    object.swiftDuration = options.json && !$isFinite(message.swiftDuration) ? $String(message.swiftDuration) : message.swiftDuration;
                if (message.partyId != null && $Object.hasOwnProperty.call(message, "partyId"))
                    object.partyId = message.partyId;
                if (message.socialStatus != null && $Object.hasOwnProperty.call(message, "socialStatus"))
                    object.socialStatus = message.socialStatus;
                if (message.jumpStartX != null && $Object.hasOwnProperty.call(message, "jumpStartX"))
                    object.jumpStartX = options.json && !$isFinite(message.jumpStartX) ? $String(message.jumpStartX) : message.jumpStartX;
                if (message.jumpStartY != null && $Object.hasOwnProperty.call(message, "jumpStartY"))
                    object.jumpStartY = options.json && !$isFinite(message.jumpStartY) ? $String(message.jumpStartY) : message.jumpStartY;
                if (message.jumpStartZ != null && $Object.hasOwnProperty.call(message, "jumpStartZ"))
                    object.jumpStartZ = options.json && !$isFinite(message.jumpStartZ) ? $String(message.jumpStartZ) : message.jumpStartZ;
                if (message.jumpTargetX != null && $Object.hasOwnProperty.call(message, "jumpTargetX"))
                    object.jumpTargetX = options.json && !$isFinite(message.jumpTargetX) ? $String(message.jumpTargetX) : message.jumpTargetX;
                if (message.jumpTargetY != null && $Object.hasOwnProperty.call(message, "jumpTargetY"))
                    object.jumpTargetY = options.json && !$isFinite(message.jumpTargetY) ? $String(message.jumpTargetY) : message.jumpTargetY;
                if (message.jumpTargetZ != null && $Object.hasOwnProperty.call(message, "jumpTargetZ"))
                    object.jumpTargetZ = options.json && !$isFinite(message.jumpTargetZ) ? $String(message.jumpTargetZ) : message.jumpTargetZ;
                if (message.jumpDuration != null && $Object.hasOwnProperty.call(message, "jumpDuration"))
                    object.jumpDuration = options.json && !$isFinite(message.jumpDuration) ? $String(message.jumpDuration) : message.jumpDuration;
                if (message.jumpHeight != null && $Object.hasOwnProperty.call(message, "jumpHeight"))
                    object.jumpHeight = options.json && !$isFinite(message.jumpHeight) ? $String(message.jumpHeight) : message.jumpHeight;
                if (message.jumpProgress != null && $Object.hasOwnProperty.call(message, "jumpProgress"))
                    object.jumpProgress = options.json && !$isFinite(message.jumpProgress) ? $String(message.jumpProgress) : message.jumpProgress;
                if (message.ironFortressActive != null && $Object.hasOwnProperty.call(message, "ironFortressActive"))
                    object.ironFortressActive = message.ironFortressActive;
                if (message.guardianRoarActive != null && $Object.hasOwnProperty.call(message, "guardianRoarActive"))
                    object.guardianRoarActive = message.guardianRoarActive;
                if (message.berserkerModeActive != null && $Object.hasOwnProperty.call(message, "berserkerModeActive"))
                    object.berserkerModeActive = message.berserkerModeActive;
                if (message.lastStandActive != null && $Object.hasOwnProperty.call(message, "lastStandActive"))
                    object.lastStandActive = message.lastStandActive;
                if (message.serratedEdgesActive != null && $Object.hasOwnProperty.call(message, "serratedEdgesActive"))
                    object.serratedEdgesActive = message.serratedEdgesActive;
                if (message.poisonCoatingActive != null && $Object.hasOwnProperty.call(message, "poisonCoatingActive"))
                    object.poisonCoatingActive = message.poisonCoatingActive;
                if (message.stealthActive != null && $Object.hasOwnProperty.call(message, "stealthActive"))
                    object.stealthActive = message.stealthActive;
                if (message.zealActive != null && $Object.hasOwnProperty.call(message, "zealActive"))
                    object.zealActive = message.zealActive;
                if (message.ironFortressDuration != null && $Object.hasOwnProperty.call(message, "ironFortressDuration"))
                    object.ironFortressDuration = options.json && !$isFinite(message.ironFortressDuration) ? $String(message.ironFortressDuration) : message.ironFortressDuration;
                if (message.guardianRoarDuration != null && $Object.hasOwnProperty.call(message, "guardianRoarDuration"))
                    object.guardianRoarDuration = options.json && !$isFinite(message.guardianRoarDuration) ? $String(message.guardianRoarDuration) : message.guardianRoarDuration;
                if (message.berserkerModeDuration != null && $Object.hasOwnProperty.call(message, "berserkerModeDuration"))
                    object.berserkerModeDuration = options.json && !$isFinite(message.berserkerModeDuration) ? $String(message.berserkerModeDuration) : message.berserkerModeDuration;
                if (message.lastStandDuration != null && $Object.hasOwnProperty.call(message, "lastStandDuration"))
                    object.lastStandDuration = options.json && !$isFinite(message.lastStandDuration) ? $String(message.lastStandDuration) : message.lastStandDuration;
                if (message.serratedEdgesDuration != null && $Object.hasOwnProperty.call(message, "serratedEdgesDuration"))
                    object.serratedEdgesDuration = options.json && !$isFinite(message.serratedEdgesDuration) ? $String(message.serratedEdgesDuration) : message.serratedEdgesDuration;
                if (message.poisonCoatingDuration != null && $Object.hasOwnProperty.call(message, "poisonCoatingDuration"))
                    object.poisonCoatingDuration = options.json && !$isFinite(message.poisonCoatingDuration) ? $String(message.poisonCoatingDuration) : message.poisonCoatingDuration;
                if (message.stealthDuration != null && $Object.hasOwnProperty.call(message, "stealthDuration"))
                    object.stealthDuration = options.json && !$isFinite(message.stealthDuration) ? $String(message.stealthDuration) : message.stealthDuration;
                if (message.zealDuration != null && $Object.hasOwnProperty.call(message, "zealDuration"))
                    object.zealDuration = options.json && !$isFinite(message.zealDuration) ? $String(message.zealDuration) : message.zealDuration;
                if (message.moveSequence != null && $Object.hasOwnProperty.call(message, "moveSequence"))
                    if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
                        object.moveSequence = typeof message.moveSequence === "number" ? $BigInt(message.moveSequence) : $util.Long.fromBits(message.moveSequence.low >>> 0, message.moveSequence.high >>> 0, true).toBigInt();
                    else if (typeof message.moveSequence === "number")
                        object.moveSequence = options.longs === $String ? $String(message.moveSequence) : message.moveSequence;
                    else
                        object.moveSequence = options.longs === $String ? $util.Long.prototype.toString.call(message.moveSequence) : options.longs === $Number ? new $util.LongBits(message.moveSequence.low >>> 0, message.moveSequence.high >>> 0).toNumber(true) : message.moveSequence;
                if (message.guildId != null && $Object.hasOwnProperty.call(message, "guildId"))
                    object.guildId = message.guildId;
                if (message.guildTag != null && $Object.hasOwnProperty.call(message, "guildTag"))
                    object.guildTag = message.guildTag;
                return object;
            };

            /**
             * Converts this Entity to JSON.
             * @function toJSON
             * @memberof eidolon.state.Entity
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Entity.prototype.toJSON = function() {
                return Entity.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the type url for Entity
             * @function getTypeUrl
             * @memberof eidolon.state.Entity
             * @static
             * @param {string} [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
             * @returns {string} The type url
             */
            Entity.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/eidolon.state.Entity";
            };

            return Entity;
        })();

        return state;
    })();

    return eidolon;
})();

export {
  $root as default
};
