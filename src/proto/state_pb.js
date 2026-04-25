/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
const $protobuf = globalThis.protobuf;

if (!$protobuf) {
    throw new Error("protobufjs minimal not found on globalThis.protobuf. Load the protobuf runtime before importing state_pb.js.");
}

// Common aliases
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

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
             * @memberof eidolon.state
             * @interface IStateEnvelope
             * @property {number|null} [version] StateEnvelope version
             * @property {eidolon.state.IStateFull|null} [full] StateEnvelope full
             * @property {eidolon.state.IStateDelta|null} [delta] StateEnvelope delta
             */

            /**
             * Constructs a new StateEnvelope.
             * @memberof eidolon.state
             * @classdesc Represents a StateEnvelope.
             * @implements IStateEnvelope
             * @constructor
             * @param {eidolon.state.IStateEnvelope=} [properties] Properties to set
             */
            function StateEnvelope(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * StateEnvelope version.
             * @member {number} version
             * @memberof eidolon.state.StateEnvelope
             * @instance
             */
            StateEnvelope.prototype.version = 0;

            /**
             * StateEnvelope full.
             * @member {eidolon.state.IStateFull|null|undefined} full
             * @memberof eidolon.state.StateEnvelope
             * @instance
             */
            StateEnvelope.prototype.full = null;

            /**
             * StateEnvelope delta.
             * @member {eidolon.state.IStateDelta|null|undefined} delta
             * @memberof eidolon.state.StateEnvelope
             * @instance
             */
            StateEnvelope.prototype.delta = null;

            // OneOf field names bound to virtual getters and setters
            let $oneOfFields;

            /**
             * StateEnvelope payload.
             * @member {"full"|"delta"|undefined} payload
             * @memberof eidolon.state.StateEnvelope
             * @instance
             */
            Object.defineProperty(StateEnvelope.prototype, "payload", {
                get: $util.oneOfGetter($oneOfFields = ["full", "delta"]),
                set: $util.oneOfSetter($oneOfFields)
            });

            /**
             * Creates a new StateEnvelope instance using the specified properties.
             * @function create
             * @memberof eidolon.state.StateEnvelope
             * @static
             * @param {eidolon.state.IStateEnvelope=} [properties] Properties to set
             * @returns {eidolon.state.StateEnvelope} StateEnvelope instance
             */
            StateEnvelope.create = function create(properties) {
                return new StateEnvelope(properties);
            };

            /**
             * Encodes the specified StateEnvelope message. Does not implicitly {@link eidolon.state.StateEnvelope.verify|verify} messages.
             * @function encode
             * @memberof eidolon.state.StateEnvelope
             * @static
             * @param {eidolon.state.IStateEnvelope} message StateEnvelope message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            StateEnvelope.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.version != null && Object.hasOwnProperty.call(message, "version"))
                    writer.uint32(/* id 1, wireType 0 =*/8).uint32(message.version);
                if (message.full != null && Object.hasOwnProperty.call(message, "full"))
                    $root.eidolon.state.StateFull.encode(message.full, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
                if (message.delta != null && Object.hasOwnProperty.call(message, "delta"))
                    $root.eidolon.state.StateDelta.encode(message.delta, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
                return writer;
            };

            /**
             * Encodes the specified StateEnvelope message, length delimited. Does not implicitly {@link eidolon.state.StateEnvelope.verify|verify} messages.
             * @function encodeDelimited
             * @memberof eidolon.state.StateEnvelope
             * @static
             * @param {eidolon.state.IStateEnvelope} message StateEnvelope message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            StateEnvelope.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a StateEnvelope message from the specified reader or buffer.
             * @function decode
             * @memberof eidolon.state.StateEnvelope
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {eidolon.state.StateEnvelope} StateEnvelope
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            StateEnvelope.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.eidolon.state.StateEnvelope();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.version = reader.uint32();
                            break;
                        }
                    case 2: {
                            message.full = $root.eidolon.state.StateFull.decode(reader, reader.uint32());
                            break;
                        }
                    case 3: {
                            message.delta = $root.eidolon.state.StateDelta.decode(reader, reader.uint32());
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a StateEnvelope message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof eidolon.state.StateEnvelope
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {eidolon.state.StateEnvelope} StateEnvelope
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            StateEnvelope.decodeDelimited = function decodeDelimited(reader) {
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
            StateEnvelope.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                let properties = {};
                if (message.version != null && message.hasOwnProperty("version"))
                    if (!$util.isInteger(message.version))
                        return "version: integer expected";
                if (message.full != null && message.hasOwnProperty("full")) {
                    properties.payload = 1;
                    {
                        let error = $root.eidolon.state.StateFull.verify(message.full);
                        if (error)
                            return "full." + error;
                    }
                }
                if (message.delta != null && message.hasOwnProperty("delta")) {
                    if (properties.payload === 1)
                        return "payload: multiple values";
                    properties.payload = 1;
                    {
                        let error = $root.eidolon.state.StateDelta.verify(message.delta);
                        if (error)
                            return "delta." + error;
                    }
                }
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
            StateEnvelope.fromObject = function fromObject(object) {
                if (object instanceof $root.eidolon.state.StateEnvelope)
                    return object;
                let message = new $root.eidolon.state.StateEnvelope();
                if (object.version != null)
                    message.version = object.version >>> 0;
                if (object.full != null) {
                    if (typeof object.full !== "object")
                        throw TypeError(".eidolon.state.StateEnvelope.full: object expected");
                    message.full = $root.eidolon.state.StateFull.fromObject(object.full);
                }
                if (object.delta != null) {
                    if (typeof object.delta !== "object")
                        throw TypeError(".eidolon.state.StateEnvelope.delta: object expected");
                    message.delta = $root.eidolon.state.StateDelta.fromObject(object.delta);
                }
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
            StateEnvelope.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.defaults)
                    object.version = 0;
                if (message.version != null && message.hasOwnProperty("version"))
                    object.version = message.version;
                if (message.full != null && message.hasOwnProperty("full")) {
                    object.full = $root.eidolon.state.StateFull.toObject(message.full, options);
                    if (options.oneofs)
                        object.payload = "full";
                }
                if (message.delta != null && message.hasOwnProperty("delta")) {
                    object.delta = $root.eidolon.state.StateDelta.toObject(message.delta, options);
                    if (options.oneofs)
                        object.payload = "delta";
                }
                return object;
            };

            /**
             * Converts this StateEnvelope to JSON.
             * @function toJSON
             * @memberof eidolon.state.StateEnvelope
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            StateEnvelope.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for StateEnvelope
             * @function getTypeUrl
             * @memberof eidolon.state.StateEnvelope
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            StateEnvelope.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/eidolon.state.StateEnvelope";
            };

            return StateEnvelope;
        })();

        state.StateFull = (function() {

            /**
             * Properties of a StateFull.
             * @memberof eidolon.state
             * @interface IStateFull
             * @property {Array.<eidolon.state.IEntity>|null} [entities] StateFull entities
             */

            /**
             * Constructs a new StateFull.
             * @memberof eidolon.state
             * @classdesc Represents a StateFull.
             * @implements IStateFull
             * @constructor
             * @param {eidolon.state.IStateFull=} [properties] Properties to set
             */
            function StateFull(properties) {
                this.entities = [];
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * StateFull entities.
             * @member {Array.<eidolon.state.IEntity>} entities
             * @memberof eidolon.state.StateFull
             * @instance
             */
            StateFull.prototype.entities = $util.emptyArray;

            /**
             * Creates a new StateFull instance using the specified properties.
             * @function create
             * @memberof eidolon.state.StateFull
             * @static
             * @param {eidolon.state.IStateFull=} [properties] Properties to set
             * @returns {eidolon.state.StateFull} StateFull instance
             */
            StateFull.create = function create(properties) {
                return new StateFull(properties);
            };

            /**
             * Encodes the specified StateFull message. Does not implicitly {@link eidolon.state.StateFull.verify|verify} messages.
             * @function encode
             * @memberof eidolon.state.StateFull
             * @static
             * @param {eidolon.state.IStateFull} message StateFull message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            StateFull.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.entities != null && message.entities.length)
                    for (let i = 0; i < message.entities.length; ++i)
                        $root.eidolon.state.Entity.encode(message.entities[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                return writer;
            };

            /**
             * Encodes the specified StateFull message, length delimited. Does not implicitly {@link eidolon.state.StateFull.verify|verify} messages.
             * @function encodeDelimited
             * @memberof eidolon.state.StateFull
             * @static
             * @param {eidolon.state.IStateFull} message StateFull message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            StateFull.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a StateFull message from the specified reader or buffer.
             * @function decode
             * @memberof eidolon.state.StateFull
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {eidolon.state.StateFull} StateFull
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            StateFull.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.eidolon.state.StateFull();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            if (!(message.entities && message.entities.length))
                                message.entities = [];
                            message.entities.push($root.eidolon.state.Entity.decode(reader, reader.uint32()));
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a StateFull message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof eidolon.state.StateFull
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {eidolon.state.StateFull} StateFull
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            StateFull.decodeDelimited = function decodeDelimited(reader) {
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
            StateFull.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.entities != null && message.hasOwnProperty("entities")) {
                    if (!Array.isArray(message.entities))
                        return "entities: array expected";
                    for (let i = 0; i < message.entities.length; ++i) {
                        let error = $root.eidolon.state.Entity.verify(message.entities[i]);
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
            StateFull.fromObject = function fromObject(object) {
                if (object instanceof $root.eidolon.state.StateFull)
                    return object;
                let message = new $root.eidolon.state.StateFull();
                if (object.entities) {
                    if (!Array.isArray(object.entities))
                        throw TypeError(".eidolon.state.StateFull.entities: array expected");
                    message.entities = [];
                    for (let i = 0; i < object.entities.length; ++i) {
                        if (typeof object.entities[i] !== "object")
                            throw TypeError(".eidolon.state.StateFull.entities: object expected");
                        message.entities[i] = $root.eidolon.state.Entity.fromObject(object.entities[i]);
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
            StateFull.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.arrays || options.defaults)
                    object.entities = [];
                if (message.entities && message.entities.length) {
                    object.entities = [];
                    for (let j = 0; j < message.entities.length; ++j)
                        object.entities[j] = $root.eidolon.state.Entity.toObject(message.entities[j], options);
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
            StateFull.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for StateFull
             * @function getTypeUrl
             * @memberof eidolon.state.StateFull
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            StateFull.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/eidolon.state.StateFull";
            };

            return StateFull;
        })();

        state.StateDelta = (function() {

            /**
             * Properties of a StateDelta.
             * @memberof eidolon.state
             * @interface IStateDelta
             * @property {Array.<eidolon.state.IEntity>|null} [entities] StateDelta entities
             * @property {Array.<string>|null} [removedIds] StateDelta removedIds
             */

            /**
             * Constructs a new StateDelta.
             * @memberof eidolon.state
             * @classdesc Represents a StateDelta.
             * @implements IStateDelta
             * @constructor
             * @param {eidolon.state.IStateDelta=} [properties] Properties to set
             */
            function StateDelta(properties) {
                this.entities = [];
                this.removedIds = [];
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

            /**
             * StateDelta entities.
             * @member {Array.<eidolon.state.IEntity>} entities
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
             * @param {eidolon.state.IStateDelta=} [properties] Properties to set
             * @returns {eidolon.state.StateDelta} StateDelta instance
             */
            StateDelta.create = function create(properties) {
                return new StateDelta(properties);
            };

            /**
             * Encodes the specified StateDelta message. Does not implicitly {@link eidolon.state.StateDelta.verify|verify} messages.
             * @function encode
             * @memberof eidolon.state.StateDelta
             * @static
             * @param {eidolon.state.IStateDelta} message StateDelta message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            StateDelta.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.entities != null && message.entities.length)
                    for (let i = 0; i < message.entities.length; ++i)
                        $root.eidolon.state.Entity.encode(message.entities[i], writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
                if (message.removedIds != null && message.removedIds.length)
                    for (let i = 0; i < message.removedIds.length; ++i)
                        writer.uint32(/* id 2, wireType 2 =*/18).string(message.removedIds[i]);
                return writer;
            };

            /**
             * Encodes the specified StateDelta message, length delimited. Does not implicitly {@link eidolon.state.StateDelta.verify|verify} messages.
             * @function encodeDelimited
             * @memberof eidolon.state.StateDelta
             * @static
             * @param {eidolon.state.IStateDelta} message StateDelta message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            StateDelta.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a StateDelta message from the specified reader or buffer.
             * @function decode
             * @memberof eidolon.state.StateDelta
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {eidolon.state.StateDelta} StateDelta
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            StateDelta.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.eidolon.state.StateDelta();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            if (!(message.entities && message.entities.length))
                                message.entities = [];
                            message.entities.push($root.eidolon.state.Entity.decode(reader, reader.uint32()));
                            break;
                        }
                    case 2: {
                            if (!(message.removedIds && message.removedIds.length))
                                message.removedIds = [];
                            message.removedIds.push(reader.string());
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a StateDelta message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof eidolon.state.StateDelta
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {eidolon.state.StateDelta} StateDelta
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            StateDelta.decodeDelimited = function decodeDelimited(reader) {
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
            StateDelta.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.entities != null && message.hasOwnProperty("entities")) {
                    if (!Array.isArray(message.entities))
                        return "entities: array expected";
                    for (let i = 0; i < message.entities.length; ++i) {
                        let error = $root.eidolon.state.Entity.verify(message.entities[i]);
                        if (error)
                            return "entities." + error;
                    }
                }
                if (message.removedIds != null && message.hasOwnProperty("removedIds")) {
                    if (!Array.isArray(message.removedIds))
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
            StateDelta.fromObject = function fromObject(object) {
                if (object instanceof $root.eidolon.state.StateDelta)
                    return object;
                let message = new $root.eidolon.state.StateDelta();
                if (object.entities) {
                    if (!Array.isArray(object.entities))
                        throw TypeError(".eidolon.state.StateDelta.entities: array expected");
                    message.entities = [];
                    for (let i = 0; i < object.entities.length; ++i) {
                        if (typeof object.entities[i] !== "object")
                            throw TypeError(".eidolon.state.StateDelta.entities: object expected");
                        message.entities[i] = $root.eidolon.state.Entity.fromObject(object.entities[i]);
                    }
                }
                if (object.removedIds) {
                    if (!Array.isArray(object.removedIds))
                        throw TypeError(".eidolon.state.StateDelta.removedIds: array expected");
                    message.removedIds = [];
                    for (let i = 0; i < object.removedIds.length; ++i)
                        message.removedIds[i] = String(object.removedIds[i]);
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
            StateDelta.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.arrays || options.defaults) {
                    object.entities = [];
                    object.removedIds = [];
                }
                if (message.entities && message.entities.length) {
                    object.entities = [];
                    for (let j = 0; j < message.entities.length; ++j)
                        object.entities[j] = $root.eidolon.state.Entity.toObject(message.entities[j], options);
                }
                if (message.removedIds && message.removedIds.length) {
                    object.removedIds = [];
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
            StateDelta.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for StateDelta
             * @function getTypeUrl
             * @memberof eidolon.state.StateDelta
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            StateDelta.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/eidolon.state.StateDelta";
            };

            return StateDelta;
        })();

        state.Stats = (function() {

            /**
             * Properties of a Stats.
             * @memberof eidolon.state
             * @interface IStats
             * @property {number|null} [strength] Stats strength
             * @property {number|null} [dexterity] Stats dexterity
             * @property {number|null} [intelligence] Stats intelligence
             * @property {number|null} [wisdom] Stats wisdom
             * @property {number|null} [vitality] Stats vitality
             */

            /**
             * Constructs a new Stats.
             * @memberof eidolon.state
             * @classdesc Represents a Stats.
             * @implements IStats
             * @constructor
             * @param {eidolon.state.IStats=} [properties] Properties to set
             */
            function Stats(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

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
             * @param {eidolon.state.IStats=} [properties] Properties to set
             * @returns {eidolon.state.Stats} Stats instance
             */
            Stats.create = function create(properties) {
                return new Stats(properties);
            };

            /**
             * Encodes the specified Stats message. Does not implicitly {@link eidolon.state.Stats.verify|verify} messages.
             * @function encode
             * @memberof eidolon.state.Stats
             * @static
             * @param {eidolon.state.IStats} message Stats message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Stats.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.strength != null && Object.hasOwnProperty.call(message, "strength"))
                    writer.uint32(/* id 1, wireType 0 =*/8).int32(message.strength);
                if (message.dexterity != null && Object.hasOwnProperty.call(message, "dexterity"))
                    writer.uint32(/* id 2, wireType 0 =*/16).int32(message.dexterity);
                if (message.intelligence != null && Object.hasOwnProperty.call(message, "intelligence"))
                    writer.uint32(/* id 3, wireType 0 =*/24).int32(message.intelligence);
                if (message.wisdom != null && Object.hasOwnProperty.call(message, "wisdom"))
                    writer.uint32(/* id 4, wireType 0 =*/32).int32(message.wisdom);
                if (message.vitality != null && Object.hasOwnProperty.call(message, "vitality"))
                    writer.uint32(/* id 5, wireType 0 =*/40).int32(message.vitality);
                return writer;
            };

            /**
             * Encodes the specified Stats message, length delimited. Does not implicitly {@link eidolon.state.Stats.verify|verify} messages.
             * @function encodeDelimited
             * @memberof eidolon.state.Stats
             * @static
             * @param {eidolon.state.IStats} message Stats message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Stats.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a Stats message from the specified reader or buffer.
             * @function decode
             * @memberof eidolon.state.Stats
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {eidolon.state.Stats} Stats
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Stats.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.eidolon.state.Stats();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.strength = reader.int32();
                            break;
                        }
                    case 2: {
                            message.dexterity = reader.int32();
                            break;
                        }
                    case 3: {
                            message.intelligence = reader.int32();
                            break;
                        }
                    case 4: {
                            message.wisdom = reader.int32();
                            break;
                        }
                    case 5: {
                            message.vitality = reader.int32();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a Stats message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof eidolon.state.Stats
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {eidolon.state.Stats} Stats
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Stats.decodeDelimited = function decodeDelimited(reader) {
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
            Stats.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.strength != null && message.hasOwnProperty("strength"))
                    if (!$util.isInteger(message.strength))
                        return "strength: integer expected";
                if (message.dexterity != null && message.hasOwnProperty("dexterity"))
                    if (!$util.isInteger(message.dexterity))
                        return "dexterity: integer expected";
                if (message.intelligence != null && message.hasOwnProperty("intelligence"))
                    if (!$util.isInteger(message.intelligence))
                        return "intelligence: integer expected";
                if (message.wisdom != null && message.hasOwnProperty("wisdom"))
                    if (!$util.isInteger(message.wisdom))
                        return "wisdom: integer expected";
                if (message.vitality != null && message.hasOwnProperty("vitality"))
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
            Stats.fromObject = function fromObject(object) {
                if (object instanceof $root.eidolon.state.Stats)
                    return object;
                let message = new $root.eidolon.state.Stats();
                if (object.strength != null)
                    message.strength = object.strength | 0;
                if (object.dexterity != null)
                    message.dexterity = object.dexterity | 0;
                if (object.intelligence != null)
                    message.intelligence = object.intelligence | 0;
                if (object.wisdom != null)
                    message.wisdom = object.wisdom | 0;
                if (object.vitality != null)
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
            Stats.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.defaults) {
                    object.strength = 0;
                    object.dexterity = 0;
                    object.intelligence = 0;
                    object.wisdom = 0;
                    object.vitality = 0;
                }
                if (message.strength != null && message.hasOwnProperty("strength"))
                    object.strength = message.strength;
                if (message.dexterity != null && message.hasOwnProperty("dexterity"))
                    object.dexterity = message.dexterity;
                if (message.intelligence != null && message.hasOwnProperty("intelligence"))
                    object.intelligence = message.intelligence;
                if (message.wisdom != null && message.hasOwnProperty("wisdom"))
                    object.wisdom = message.wisdom;
                if (message.vitality != null && message.hasOwnProperty("vitality"))
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
            Stats.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for Stats
             * @function getTypeUrl
             * @memberof eidolon.state.Stats
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            Stats.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/eidolon.state.Stats";
            };

            return Stats;
        })();

        state.Quest = (function() {

            /**
             * Properties of a Quest.
             * @memberof eidolon.state
             * @interface IQuest
             * @property {string|null} [id] Quest id
             * @property {string|null} [type] Quest type
             * @property {string|null} [target] Quest target
             * @property {number|null} [count] Quest count
             * @property {number|null} [maxCount] Quest maxCount
             * @property {number|null} [rewardXp] Quest rewardXp
             * @property {boolean|null} [completed] Quest completed
             * @property {boolean|null} [accepted] Quest accepted
             */

            /**
             * Constructs a new Quest.
             * @memberof eidolon.state
             * @classdesc Represents a Quest.
             * @implements IQuest
             * @constructor
             * @param {eidolon.state.IQuest=} [properties] Properties to set
             */
            function Quest(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

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
             * Creates a new Quest instance using the specified properties.
             * @function create
             * @memberof eidolon.state.Quest
             * @static
             * @param {eidolon.state.IQuest=} [properties] Properties to set
             * @returns {eidolon.state.Quest} Quest instance
             */
            Quest.create = function create(properties) {
                return new Quest(properties);
            };

            /**
             * Encodes the specified Quest message. Does not implicitly {@link eidolon.state.Quest.verify|verify} messages.
             * @function encode
             * @memberof eidolon.state.Quest
             * @static
             * @param {eidolon.state.IQuest} message Quest message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Quest.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
                if (message.type != null && Object.hasOwnProperty.call(message, "type"))
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.type);
                if (message.target != null && Object.hasOwnProperty.call(message, "target"))
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.target);
                if (message.count != null && Object.hasOwnProperty.call(message, "count"))
                    writer.uint32(/* id 4, wireType 0 =*/32).int32(message.count);
                if (message.maxCount != null && Object.hasOwnProperty.call(message, "maxCount"))
                    writer.uint32(/* id 5, wireType 0 =*/40).int32(message.maxCount);
                if (message.rewardXp != null && Object.hasOwnProperty.call(message, "rewardXp"))
                    writer.uint32(/* id 6, wireType 0 =*/48).int32(message.rewardXp);
                if (message.completed != null && Object.hasOwnProperty.call(message, "completed"))
                    writer.uint32(/* id 7, wireType 0 =*/56).bool(message.completed);
                if (message.accepted != null && Object.hasOwnProperty.call(message, "accepted"))
                    writer.uint32(/* id 8, wireType 0 =*/64).bool(message.accepted);
                return writer;
            };

            /**
             * Encodes the specified Quest message, length delimited. Does not implicitly {@link eidolon.state.Quest.verify|verify} messages.
             * @function encodeDelimited
             * @memberof eidolon.state.Quest
             * @static
             * @param {eidolon.state.IQuest} message Quest message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Quest.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a Quest message from the specified reader or buffer.
             * @function decode
             * @memberof eidolon.state.Quest
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {eidolon.state.Quest} Quest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Quest.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.eidolon.state.Quest();
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.id = reader.string();
                            break;
                        }
                    case 2: {
                            message.type = reader.string();
                            break;
                        }
                    case 3: {
                            message.target = reader.string();
                            break;
                        }
                    case 4: {
                            message.count = reader.int32();
                            break;
                        }
                    case 5: {
                            message.maxCount = reader.int32();
                            break;
                        }
                    case 6: {
                            message.rewardXp = reader.int32();
                            break;
                        }
                    case 7: {
                            message.completed = reader.bool();
                            break;
                        }
                    case 8: {
                            message.accepted = reader.bool();
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a Quest message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof eidolon.state.Quest
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {eidolon.state.Quest} Quest
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Quest.decodeDelimited = function decodeDelimited(reader) {
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
            Quest.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.id != null && message.hasOwnProperty("id"))
                    if (!$util.isString(message.id))
                        return "id: string expected";
                if (message.type != null && message.hasOwnProperty("type"))
                    if (!$util.isString(message.type))
                        return "type: string expected";
                if (message.target != null && message.hasOwnProperty("target"))
                    if (!$util.isString(message.target))
                        return "target: string expected";
                if (message.count != null && message.hasOwnProperty("count"))
                    if (!$util.isInteger(message.count))
                        return "count: integer expected";
                if (message.maxCount != null && message.hasOwnProperty("maxCount"))
                    if (!$util.isInteger(message.maxCount))
                        return "maxCount: integer expected";
                if (message.rewardXp != null && message.hasOwnProperty("rewardXp"))
                    if (!$util.isInteger(message.rewardXp))
                        return "rewardXp: integer expected";
                if (message.completed != null && message.hasOwnProperty("completed"))
                    if (typeof message.completed !== "boolean")
                        return "completed: boolean expected";
                if (message.accepted != null && message.hasOwnProperty("accepted"))
                    if (typeof message.accepted !== "boolean")
                        return "accepted: boolean expected";
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
            Quest.fromObject = function fromObject(object) {
                if (object instanceof $root.eidolon.state.Quest)
                    return object;
                let message = new $root.eidolon.state.Quest();
                if (object.id != null)
                    message.id = String(object.id);
                if (object.type != null)
                    message.type = String(object.type);
                if (object.target != null)
                    message.target = String(object.target);
                if (object.count != null)
                    message.count = object.count | 0;
                if (object.maxCount != null)
                    message.maxCount = object.maxCount | 0;
                if (object.rewardXp != null)
                    message.rewardXp = object.rewardXp | 0;
                if (object.completed != null)
                    message.completed = Boolean(object.completed);
                if (object.accepted != null)
                    message.accepted = Boolean(object.accepted);
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
            Quest.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
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
                }
                if (message.id != null && message.hasOwnProperty("id"))
                    object.id = message.id;
                if (message.type != null && message.hasOwnProperty("type"))
                    object.type = message.type;
                if (message.target != null && message.hasOwnProperty("target"))
                    object.target = message.target;
                if (message.count != null && message.hasOwnProperty("count"))
                    object.count = message.count;
                if (message.maxCount != null && message.hasOwnProperty("maxCount"))
                    object.maxCount = message.maxCount;
                if (message.rewardXp != null && message.hasOwnProperty("rewardXp"))
                    object.rewardXp = message.rewardXp;
                if (message.completed != null && message.hasOwnProperty("completed"))
                    object.completed = message.completed;
                if (message.accepted != null && message.hasOwnProperty("accepted"))
                    object.accepted = message.accepted;
                return object;
            };

            /**
             * Converts this Quest to JSON.
             * @function toJSON
             * @memberof eidolon.state.Quest
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Quest.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for Quest
             * @function getTypeUrl
             * @memberof eidolon.state.Quest
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            Quest.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/eidolon.state.Quest";
            };

            return Quest;
        })();

        state.SocketedGem = (function() {

            /**
             * Properties of a SocketedGem.
             * @memberof eidolon.state
             * @interface ISocketedGem
             * @property {string|null} [type] SocketedGem type
             * @property {string|null} [quality] SocketedGem quality
             * @property {Object.<string,number>|null} [stats] SocketedGem stats
             */

            /**
             * Constructs a new SocketedGem.
             * @memberof eidolon.state
             * @classdesc Represents a SocketedGem.
             * @implements ISocketedGem
             * @constructor
             * @param {eidolon.state.ISocketedGem=} [properties] Properties to set
             */
            function SocketedGem(properties) {
                this.stats = {};
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

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
             * @param {eidolon.state.ISocketedGem=} [properties] Properties to set
             * @returns {eidolon.state.SocketedGem} SocketedGem instance
             */
            SocketedGem.create = function create(properties) {
                return new SocketedGem(properties);
            };

            /**
             * Encodes the specified SocketedGem message. Does not implicitly {@link eidolon.state.SocketedGem.verify|verify} messages.
             * @function encode
             * @memberof eidolon.state.SocketedGem
             * @static
             * @param {eidolon.state.ISocketedGem} message SocketedGem message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            SocketedGem.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.type != null && Object.hasOwnProperty.call(message, "type"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.type);
                if (message.quality != null && Object.hasOwnProperty.call(message, "quality"))
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.quality);
                if (message.stats != null && Object.hasOwnProperty.call(message, "stats"))
                    for (let keys = Object.keys(message.stats), i = 0; i < keys.length; ++i)
                        writer.uint32(/* id 3, wireType 2 =*/26).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]).uint32(/* id 2, wireType 0 =*/16).int32(message.stats[keys[i]]).ldelim();
                return writer;
            };

            /**
             * Encodes the specified SocketedGem message, length delimited. Does not implicitly {@link eidolon.state.SocketedGem.verify|verify} messages.
             * @function encodeDelimited
             * @memberof eidolon.state.SocketedGem
             * @static
             * @param {eidolon.state.ISocketedGem} message SocketedGem message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            SocketedGem.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes a SocketedGem message from the specified reader or buffer.
             * @function decode
             * @memberof eidolon.state.SocketedGem
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {eidolon.state.SocketedGem} SocketedGem
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            SocketedGem.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.eidolon.state.SocketedGem(), key, value;
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.type = reader.string();
                            break;
                        }
                    case 2: {
                            message.quality = reader.string();
                            break;
                        }
                    case 3: {
                            if (message.stats === $util.emptyObject)
                                message.stats = {};
                            let end2 = reader.uint32() + reader.pos;
                            key = "";
                            value = 0;
                            while (reader.pos < end2) {
                                let tag2 = reader.uint32();
                                switch (tag2 >>> 3) {
                                case 1:
                                    key = reader.string();
                                    break;
                                case 2:
                                    value = reader.int32();
                                    break;
                                default:
                                    reader.skipType(tag2 & 7);
                                    break;
                                }
                            }
                            message.stats[key] = value;
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes a SocketedGem message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof eidolon.state.SocketedGem
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {eidolon.state.SocketedGem} SocketedGem
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            SocketedGem.decodeDelimited = function decodeDelimited(reader) {
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
            SocketedGem.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.type != null && message.hasOwnProperty("type"))
                    if (!$util.isString(message.type))
                        return "type: string expected";
                if (message.quality != null && message.hasOwnProperty("quality"))
                    if (!$util.isString(message.quality))
                        return "quality: string expected";
                if (message.stats != null && message.hasOwnProperty("stats")) {
                    if (!$util.isObject(message.stats))
                        return "stats: object expected";
                    let key = Object.keys(message.stats);
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
            SocketedGem.fromObject = function fromObject(object) {
                if (object instanceof $root.eidolon.state.SocketedGem)
                    return object;
                let message = new $root.eidolon.state.SocketedGem();
                if (object.type != null)
                    message.type = String(object.type);
                if (object.quality != null)
                    message.quality = String(object.quality);
                if (object.stats) {
                    if (typeof object.stats !== "object")
                        throw TypeError(".eidolon.state.SocketedGem.stats: object expected");
                    message.stats = {};
                    for (let keys = Object.keys(object.stats), i = 0; i < keys.length; ++i)
                        message.stats[keys[i]] = object.stats[keys[i]] | 0;
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
            SocketedGem.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
                let object = {};
                if (options.objects || options.defaults)
                    object.stats = {};
                if (options.defaults) {
                    object.type = "";
                    object.quality = "";
                }
                if (message.type != null && message.hasOwnProperty("type"))
                    object.type = message.type;
                if (message.quality != null && message.hasOwnProperty("quality"))
                    object.quality = message.quality;
                let keys2;
                if (message.stats && (keys2 = Object.keys(message.stats)).length) {
                    object.stats = {};
                    for (let j = 0; j < keys2.length; ++j)
                        object.stats[keys2[j]] = message.stats[keys2[j]];
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
            SocketedGem.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for SocketedGem
             * @function getTypeUrl
             * @memberof eidolon.state.SocketedGem
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            SocketedGem.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/eidolon.state.SocketedGem";
            };

            return SocketedGem;
        })();

        state.Item = (function() {

            /**
             * Properties of an Item.
             * @memberof eidolon.state
             * @interface IItem
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
             * @property {Array.<eidolon.state.ISocketedGem>|null} [gems] Item gems
             */

            /**
             * Constructs a new Item.
             * @memberof eidolon.state
             * @classdesc Represents an Item.
             * @implements IItem
             * @constructor
             * @param {eidolon.state.IItem=} [properties] Properties to set
             */
            function Item(properties) {
                this.stats = {};
                this.gems = [];
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

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
             * @member {Array.<eidolon.state.ISocketedGem>} gems
             * @memberof eidolon.state.Item
             * @instance
             */
            Item.prototype.gems = $util.emptyArray;

            /**
             * Creates a new Item instance using the specified properties.
             * @function create
             * @memberof eidolon.state.Item
             * @static
             * @param {eidolon.state.IItem=} [properties] Properties to set
             * @returns {eidolon.state.Item} Item instance
             */
            Item.create = function create(properties) {
                return new Item(properties);
            };

            /**
             * Encodes the specified Item message. Does not implicitly {@link eidolon.state.Item.verify|verify} messages.
             * @function encode
             * @memberof eidolon.state.Item
             * @static
             * @param {eidolon.state.IItem} message Item message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Item.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
                if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.name);
                if (message.type != null && Object.hasOwnProperty.call(message, "type"))
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.type);
                if (message.rarity != null && Object.hasOwnProperty.call(message, "rarity"))
                    writer.uint32(/* id 4, wireType 2 =*/34).string(message.rarity);
                if (message.slot != null && Object.hasOwnProperty.call(message, "slot"))
                    writer.uint32(/* id 5, wireType 2 =*/42).string(message.slot);
                if (message.level != null && Object.hasOwnProperty.call(message, "level"))
                    writer.uint32(/* id 6, wireType 0 =*/48).int32(message.level);
                if (message.stats != null && Object.hasOwnProperty.call(message, "stats"))
                    for (let keys = Object.keys(message.stats), i = 0; i < keys.length; ++i)
                        writer.uint32(/* id 7, wireType 2 =*/58).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]).uint32(/* id 2, wireType 0 =*/16).int32(message.stats[keys[i]]).ldelim();
                if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                    writer.uint32(/* id 8, wireType 0 =*/64).int32(message.value);
                if (message.icon != null && Object.hasOwnProperty.call(message, "icon"))
                    writer.uint32(/* id 9, wireType 2 =*/74).string(message.icon);
                if (message.description != null && Object.hasOwnProperty.call(message, "description"))
                    writer.uint32(/* id 10, wireType 2 =*/82).string(message.description);
                if (message.stack != null && Object.hasOwnProperty.call(message, "stack"))
                    writer.uint32(/* id 11, wireType 0 =*/88).int32(message.stack);
                if (message.maxStack != null && Object.hasOwnProperty.call(message, "maxStack"))
                    writer.uint32(/* id 12, wireType 0 =*/96).int32(message.maxStack);
                if (message.potency != null && Object.hasOwnProperty.call(message, "potency"))
                    writer.uint32(/* id 13, wireType 0 =*/104).int32(message.potency);
                if (message.sockets != null && Object.hasOwnProperty.call(message, "sockets"))
                    writer.uint32(/* id 14, wireType 0 =*/112).int32(message.sockets);
                if (message.gemType != null && Object.hasOwnProperty.call(message, "gemType"))
                    writer.uint32(/* id 15, wireType 2 =*/122).string(message.gemType);
                if (message.gemQuality != null && Object.hasOwnProperty.call(message, "gemQuality"))
                    writer.uint32(/* id 16, wireType 2 =*/130).string(message.gemQuality);
                if (message.gems != null && message.gems.length)
                    for (let i = 0; i < message.gems.length; ++i)
                        $root.eidolon.state.SocketedGem.encode(message.gems[i], writer.uint32(/* id 17, wireType 2 =*/138).fork()).ldelim();
                return writer;
            };

            /**
             * Encodes the specified Item message, length delimited. Does not implicitly {@link eidolon.state.Item.verify|verify} messages.
             * @function encodeDelimited
             * @memberof eidolon.state.Item
             * @static
             * @param {eidolon.state.IItem} message Item message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Item.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes an Item message from the specified reader or buffer.
             * @function decode
             * @memberof eidolon.state.Item
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {eidolon.state.Item} Item
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Item.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.eidolon.state.Item(), key, value;
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.id = reader.string();
                            break;
                        }
                    case 2: {
                            message.name = reader.string();
                            break;
                        }
                    case 3: {
                            message.type = reader.string();
                            break;
                        }
                    case 4: {
                            message.rarity = reader.string();
                            break;
                        }
                    case 5: {
                            message.slot = reader.string();
                            break;
                        }
                    case 6: {
                            message.level = reader.int32();
                            break;
                        }
                    case 7: {
                            if (message.stats === $util.emptyObject)
                                message.stats = {};
                            let end2 = reader.uint32() + reader.pos;
                            key = "";
                            value = 0;
                            while (reader.pos < end2) {
                                let tag2 = reader.uint32();
                                switch (tag2 >>> 3) {
                                case 1:
                                    key = reader.string();
                                    break;
                                case 2:
                                    value = reader.int32();
                                    break;
                                default:
                                    reader.skipType(tag2 & 7);
                                    break;
                                }
                            }
                            message.stats[key] = value;
                            break;
                        }
                    case 8: {
                            message.value = reader.int32();
                            break;
                        }
                    case 9: {
                            message.icon = reader.string();
                            break;
                        }
                    case 10: {
                            message.description = reader.string();
                            break;
                        }
                    case 11: {
                            message.stack = reader.int32();
                            break;
                        }
                    case 12: {
                            message.maxStack = reader.int32();
                            break;
                        }
                    case 13: {
                            message.potency = reader.int32();
                            break;
                        }
                    case 14: {
                            message.sockets = reader.int32();
                            break;
                        }
                    case 15: {
                            message.gemType = reader.string();
                            break;
                        }
                    case 16: {
                            message.gemQuality = reader.string();
                            break;
                        }
                    case 17: {
                            if (!(message.gems && message.gems.length))
                                message.gems = [];
                            message.gems.push($root.eidolon.state.SocketedGem.decode(reader, reader.uint32()));
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes an Item message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof eidolon.state.Item
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {eidolon.state.Item} Item
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Item.decodeDelimited = function decodeDelimited(reader) {
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
            Item.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.id != null && message.hasOwnProperty("id"))
                    if (!$util.isString(message.id))
                        return "id: string expected";
                if (message.name != null && message.hasOwnProperty("name"))
                    if (!$util.isString(message.name))
                        return "name: string expected";
                if (message.type != null && message.hasOwnProperty("type"))
                    if (!$util.isString(message.type))
                        return "type: string expected";
                if (message.rarity != null && message.hasOwnProperty("rarity"))
                    if (!$util.isString(message.rarity))
                        return "rarity: string expected";
                if (message.slot != null && message.hasOwnProperty("slot"))
                    if (!$util.isString(message.slot))
                        return "slot: string expected";
                if (message.level != null && message.hasOwnProperty("level"))
                    if (!$util.isInteger(message.level))
                        return "level: integer expected";
                if (message.stats != null && message.hasOwnProperty("stats")) {
                    if (!$util.isObject(message.stats))
                        return "stats: object expected";
                    let key = Object.keys(message.stats);
                    for (let i = 0; i < key.length; ++i)
                        if (!$util.isInteger(message.stats[key[i]]))
                            return "stats: integer{k:string} expected";
                }
                if (message.value != null && message.hasOwnProperty("value"))
                    if (!$util.isInteger(message.value))
                        return "value: integer expected";
                if (message.icon != null && message.hasOwnProperty("icon"))
                    if (!$util.isString(message.icon))
                        return "icon: string expected";
                if (message.description != null && message.hasOwnProperty("description"))
                    if (!$util.isString(message.description))
                        return "description: string expected";
                if (message.stack != null && message.hasOwnProperty("stack"))
                    if (!$util.isInteger(message.stack))
                        return "stack: integer expected";
                if (message.maxStack != null && message.hasOwnProperty("maxStack"))
                    if (!$util.isInteger(message.maxStack))
                        return "maxStack: integer expected";
                if (message.potency != null && message.hasOwnProperty("potency"))
                    if (!$util.isInteger(message.potency))
                        return "potency: integer expected";
                if (message.sockets != null && message.hasOwnProperty("sockets"))
                    if (!$util.isInteger(message.sockets))
                        return "sockets: integer expected";
                if (message.gemType != null && message.hasOwnProperty("gemType"))
                    if (!$util.isString(message.gemType))
                        return "gemType: string expected";
                if (message.gemQuality != null && message.hasOwnProperty("gemQuality"))
                    if (!$util.isString(message.gemQuality))
                        return "gemQuality: string expected";
                if (message.gems != null && message.hasOwnProperty("gems")) {
                    if (!Array.isArray(message.gems))
                        return "gems: array expected";
                    for (let i = 0; i < message.gems.length; ++i) {
                        let error = $root.eidolon.state.SocketedGem.verify(message.gems[i]);
                        if (error)
                            return "gems." + error;
                    }
                }
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
            Item.fromObject = function fromObject(object) {
                if (object instanceof $root.eidolon.state.Item)
                    return object;
                let message = new $root.eidolon.state.Item();
                if (object.id != null)
                    message.id = String(object.id);
                if (object.name != null)
                    message.name = String(object.name);
                if (object.type != null)
                    message.type = String(object.type);
                if (object.rarity != null)
                    message.rarity = String(object.rarity);
                if (object.slot != null)
                    message.slot = String(object.slot);
                if (object.level != null)
                    message.level = object.level | 0;
                if (object.stats) {
                    if (typeof object.stats !== "object")
                        throw TypeError(".eidolon.state.Item.stats: object expected");
                    message.stats = {};
                    for (let keys = Object.keys(object.stats), i = 0; i < keys.length; ++i)
                        message.stats[keys[i]] = object.stats[keys[i]] | 0;
                }
                if (object.value != null)
                    message.value = object.value | 0;
                if (object.icon != null)
                    message.icon = String(object.icon);
                if (object.description != null)
                    message.description = String(object.description);
                if (object.stack != null)
                    message.stack = object.stack | 0;
                if (object.maxStack != null)
                    message.maxStack = object.maxStack | 0;
                if (object.potency != null)
                    message.potency = object.potency | 0;
                if (object.sockets != null)
                    message.sockets = object.sockets | 0;
                if (object.gemType != null)
                    message.gemType = String(object.gemType);
                if (object.gemQuality != null)
                    message.gemQuality = String(object.gemQuality);
                if (object.gems) {
                    if (!Array.isArray(object.gems))
                        throw TypeError(".eidolon.state.Item.gems: array expected");
                    message.gems = [];
                    for (let i = 0; i < object.gems.length; ++i) {
                        if (typeof object.gems[i] !== "object")
                            throw TypeError(".eidolon.state.Item.gems: object expected");
                        message.gems[i] = $root.eidolon.state.SocketedGem.fromObject(object.gems[i]);
                    }
                }
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
            Item.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
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
                }
                if (message.id != null && message.hasOwnProperty("id"))
                    object.id = message.id;
                if (message.name != null && message.hasOwnProperty("name"))
                    object.name = message.name;
                if (message.type != null && message.hasOwnProperty("type"))
                    object.type = message.type;
                if (message.rarity != null && message.hasOwnProperty("rarity"))
                    object.rarity = message.rarity;
                if (message.slot != null && message.hasOwnProperty("slot"))
                    object.slot = message.slot;
                if (message.level != null && message.hasOwnProperty("level"))
                    object.level = message.level;
                let keys2;
                if (message.stats && (keys2 = Object.keys(message.stats)).length) {
                    object.stats = {};
                    for (let j = 0; j < keys2.length; ++j)
                        object.stats[keys2[j]] = message.stats[keys2[j]];
                }
                if (message.value != null && message.hasOwnProperty("value"))
                    object.value = message.value;
                if (message.icon != null && message.hasOwnProperty("icon"))
                    object.icon = message.icon;
                if (message.description != null && message.hasOwnProperty("description"))
                    object.description = message.description;
                if (message.stack != null && message.hasOwnProperty("stack"))
                    object.stack = message.stack;
                if (message.maxStack != null && message.hasOwnProperty("maxStack"))
                    object.maxStack = message.maxStack;
                if (message.potency != null && message.hasOwnProperty("potency"))
                    object.potency = message.potency;
                if (message.sockets != null && message.hasOwnProperty("sockets"))
                    object.sockets = message.sockets;
                if (message.gemType != null && message.hasOwnProperty("gemType"))
                    object.gemType = message.gemType;
                if (message.gemQuality != null && message.hasOwnProperty("gemQuality"))
                    object.gemQuality = message.gemQuality;
                if (message.gems && message.gems.length) {
                    object.gems = [];
                    for (let j = 0; j < message.gems.length; ++j)
                        object.gems[j] = $root.eidolon.state.SocketedGem.toObject(message.gems[j], options);
                }
                return object;
            };

            /**
             * Converts this Item to JSON.
             * @function toJSON
             * @memberof eidolon.state.Item
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Item.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for Item
             * @function getTypeUrl
             * @memberof eidolon.state.Item
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            Item.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/eidolon.state.Item";
            };

            return Item;
        })();

        state.Entity = (function() {

            /**
             * Properties of an Entity.
             * @memberof eidolon.state
             * @interface IEntity
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
             * @property {eidolon.state.IStats|null} [baseStats] Entity baseStats
             * @property {eidolon.state.IStats|null} [stats] Entity stats
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
             * @property {Object.<string,eidolon.state.IItem>|null} [equipment] Entity equipment
             * @property {Array.<eidolon.state.IQuest>|null} [quests] Entity quests
             * @property {eidolon.state.IItem|null} [lootItem] Entity lootItem
             * @property {string|null} [ownerId] Entity ownerId
             * @property {number|null} [velX] Entity velX
             * @property {number|null} [velZ] Entity velZ
             * @property {boolean|null} [spiritsActive] Entity spiritsActive
             * @property {boolean|null} [spiritsBoosted] Entity spiritsBoosted
             * @property {boolean|null} [isCharging] Entity isCharging
             * @property {boolean|null} [stunned] Entity stunned
             * @property {boolean|null} [slowed] Entity slowed
             * @property {boolean|null} [rooted] Entity rooted
             * @property {boolean|null} [bleeding] Entity bleeding
             * @property {boolean|null} [poisoned] Entity poisoned
             * @property {number|null} [slowFactor] Entity slowFactor
             * @property {number|null} [rootDuration] Entity rootDuration
             * @property {number|null} [stunDuration] Entity stunDuration
             * @property {number|null} [talentPoints] Entity talentPoints
             * @property {Array.<string>|null} [unlockedTalents] Entity unlockedTalents
             * @property {Object.<string,number>|null} [talentRanks] Entity talentRanks
             * @property {Object.<string,string>|null} [skillRunes] Entity skillRunes
             */

            /**
             * Constructs a new Entity.
             * @memberof eidolon.state
             * @classdesc Represents an Entity.
             * @implements IEntity
             * @constructor
             * @param {eidolon.state.IEntity=} [properties] Properties to set
             */
            function Entity(properties) {
                this.unlockedSkills = [];
                this.equipment = {};
                this.quests = [];
                this.unlockedTalents = [];
                this.talentRanks = {};
                this.skillRunes = {};
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null)
                            this[keys[i]] = properties[keys[i]];
            }

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
            Entity.prototype.experience = 0;

            /**
             * Entity maxExperience.
             * @member {number} maxExperience
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.maxExperience = 0;

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
             * @member {eidolon.state.IStats|null|undefined} baseStats
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.baseStats = null;

            /**
             * Entity stats.
             * @member {eidolon.state.IStats|null|undefined} stats
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
             * @member {Object.<string,eidolon.state.IItem>} equipment
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.equipment = $util.emptyObject;

            /**
             * Entity quests.
             * @member {Array.<eidolon.state.IQuest>} quests
             * @memberof eidolon.state.Entity
             * @instance
             */
            Entity.prototype.quests = $util.emptyArray;

            /**
             * Entity lootItem.
             * @member {eidolon.state.IItem|null|undefined} lootItem
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
             * Creates a new Entity instance using the specified properties.
             * @function create
             * @memberof eidolon.state.Entity
             * @static
             * @param {eidolon.state.IEntity=} [properties] Properties to set
             * @returns {eidolon.state.Entity} Entity instance
             */
            Entity.create = function create(properties) {
                return new Entity(properties);
            };

            /**
             * Encodes the specified Entity message. Does not implicitly {@link eidolon.state.Entity.verify|verify} messages.
             * @function encode
             * @memberof eidolon.state.Entity
             * @static
             * @param {eidolon.state.IEntity} message Entity message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Entity.encode = function encode(message, writer) {
                if (!writer)
                    writer = $Writer.create();
                if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
                if (message.instanceId != null && Object.hasOwnProperty.call(message, "instanceId"))
                    writer.uint32(/* id 2, wireType 2 =*/18).string(message.instanceId);
                if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                    writer.uint32(/* id 3, wireType 2 =*/26).string(message.name);
                if (message.type != null && Object.hasOwnProperty.call(message, "type"))
                    writer.uint32(/* id 4, wireType 2 =*/34).string(message.type);
                if (message.subType != null && Object.hasOwnProperty.call(message, "subType"))
                    writer.uint32(/* id 5, wireType 2 =*/42).string(message.subType);
                if (message.x != null && Object.hasOwnProperty.call(message, "x"))
                    writer.uint32(/* id 6, wireType 5 =*/53).float(message.x);
                if (message.y != null && Object.hasOwnProperty.call(message, "y"))
                    writer.uint32(/* id 7, wireType 5 =*/61).float(message.y);
                if (message.z != null && Object.hasOwnProperty.call(message, "z"))
                    writer.uint32(/* id 8, wireType 5 =*/69).float(message.z);
                if (message.rotation != null && Object.hasOwnProperty.call(message, "rotation"))
                    writer.uint32(/* id 9, wireType 5 =*/77).float(message.rotation);
                if (message.health != null && Object.hasOwnProperty.call(message, "health"))
                    writer.uint32(/* id 10, wireType 0 =*/80).int32(message.health);
                if (message.maxHealth != null && Object.hasOwnProperty.call(message, "maxHealth"))
                    writer.uint32(/* id 11, wireType 0 =*/88).int32(message.maxHealth);
                if (message.mana != null && Object.hasOwnProperty.call(message, "mana"))
                    writer.uint32(/* id 12, wireType 0 =*/96).int32(message.mana);
                if (message.maxMana != null && Object.hasOwnProperty.call(message, "maxMana"))
                    writer.uint32(/* id 13, wireType 0 =*/104).int32(message.maxMana);
                if (message.level != null && Object.hasOwnProperty.call(message, "level"))
                    writer.uint32(/* id 14, wireType 0 =*/112).int32(message.level);
                if (message.experience != null && Object.hasOwnProperty.call(message, "experience"))
                    writer.uint32(/* id 15, wireType 0 =*/120).int32(message.experience);
                if (message.maxExperience != null && Object.hasOwnProperty.call(message, "maxExperience"))
                    writer.uint32(/* id 16, wireType 0 =*/128).int32(message.maxExperience);
                if (message.gold != null && Object.hasOwnProperty.call(message, "gold"))
                    writer.uint32(/* id 17, wireType 0 =*/136).int32(message.gold);
                if (message.skillPoints != null && Object.hasOwnProperty.call(message, "skillPoints"))
                    writer.uint32(/* id 18, wireType 0 =*/144).int32(message.skillPoints);
                if (message.selectedBranch != null && Object.hasOwnProperty.call(message, "selectedBranch"))
                    writer.uint32(/* id 19, wireType 2 =*/154).string(message.selectedBranch);
                if (message.unlockedSkills != null && message.unlockedSkills.length)
                    for (let i = 0; i < message.unlockedSkills.length; ++i)
                        writer.uint32(/* id 20, wireType 2 =*/162).string(message.unlockedSkills[i]);
                if (message.baseStats != null && Object.hasOwnProperty.call(message, "baseStats"))
                    $root.eidolon.state.Stats.encode(message.baseStats, writer.uint32(/* id 21, wireType 2 =*/170).fork()).ldelim();
                if (message.stats != null && Object.hasOwnProperty.call(message, "stats"))
                    $root.eidolon.state.Stats.encode(message.stats, writer.uint32(/* id 22, wireType 2 =*/178).fork()).ldelim();
                if (message.damage != null && Object.hasOwnProperty.call(message, "damage"))
                    writer.uint32(/* id 23, wireType 0 =*/184).int32(message.damage);
                if (message.defense != null && Object.hasOwnProperty.call(message, "defense"))
                    writer.uint32(/* id 24, wireType 0 =*/192).int32(message.defense);
                if (message.speed != null && Object.hasOwnProperty.call(message, "speed"))
                    writer.uint32(/* id 25, wireType 5 =*/205).float(message.speed);
                if (message.attackSpeed != null && Object.hasOwnProperty.call(message, "attackSpeed"))
                    writer.uint32(/* id 26, wireType 5 =*/213).float(message.attackSpeed);
                if (message.cooldownReduction != null && Object.hasOwnProperty.call(message, "cooldownReduction"))
                    writer.uint32(/* id 27, wireType 5 =*/221).float(message.cooldownReduction);
                if (message.hpRegen != null && Object.hasOwnProperty.call(message, "hpRegen"))
                    writer.uint32(/* id 28, wireType 5 =*/229).float(message.hpRegen);
                if (message.manaRegen != null && Object.hasOwnProperty.call(message, "manaRegen"))
                    writer.uint32(/* id 29, wireType 5 =*/237).float(message.manaRegen);
                if (message.castSpeed != null && Object.hasOwnProperty.call(message, "castSpeed"))
                    writer.uint32(/* id 30, wireType 5 =*/245).float(message.castSpeed);
                if (message.scale != null && Object.hasOwnProperty.call(message, "scale"))
                    writer.uint32(/* id 31, wireType 5 =*/253).float(message.scale);
                if (message.state != null && Object.hasOwnProperty.call(message, "state"))
                    writer.uint32(/* id 32, wireType 2 =*/258).string(message.state);
                if (message.equipment != null && Object.hasOwnProperty.call(message, "equipment"))
                    for (let keys = Object.keys(message.equipment), i = 0; i < keys.length; ++i) {
                        writer.uint32(/* id 33, wireType 2 =*/266).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]);
                        $root.eidolon.state.Item.encode(message.equipment[keys[i]], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim().ldelim();
                    }
                if (message.quests != null && message.quests.length)
                    for (let i = 0; i < message.quests.length; ++i)
                        $root.eidolon.state.Quest.encode(message.quests[i], writer.uint32(/* id 34, wireType 2 =*/274).fork()).ldelim();
                if (message.lootItem != null && Object.hasOwnProperty.call(message, "lootItem"))
                    $root.eidolon.state.Item.encode(message.lootItem, writer.uint32(/* id 35, wireType 2 =*/282).fork()).ldelim();
                if (message.ownerId != null && Object.hasOwnProperty.call(message, "ownerId"))
                    writer.uint32(/* id 36, wireType 2 =*/290).string(message.ownerId);
                if (message.velX != null && Object.hasOwnProperty.call(message, "velX"))
                    writer.uint32(/* id 37, wireType 5 =*/301).float(message.velX);
                if (message.velZ != null && Object.hasOwnProperty.call(message, "velZ"))
                    writer.uint32(/* id 38, wireType 5 =*/309).float(message.velZ);
                if (message.spiritsActive != null && Object.hasOwnProperty.call(message, "spiritsActive"))
                    writer.uint32(/* id 39, wireType 0 =*/312).bool(message.spiritsActive);
                if (message.spiritsBoosted != null && Object.hasOwnProperty.call(message, "spiritsBoosted"))
                    writer.uint32(/* id 40, wireType 0 =*/320).bool(message.spiritsBoosted);
                if (message.isCharging != null && Object.hasOwnProperty.call(message, "isCharging"))
                    writer.uint32(/* id 41, wireType 0 =*/328).bool(message.isCharging);
                if (message.guardianEmbraceActive != null && Object.hasOwnProperty.call(message, "guardianEmbraceActive"))
                    writer.uint32(/* id 51, wireType 0 =*/408).bool(message.guardianEmbraceActive);
                if (message.blessingResolveActive != null && Object.hasOwnProperty.call(message, "blessingResolveActive"))
                    writer.uint32(/* id 52, wireType 0 =*/416).bool(message.blessingResolveActive);
                if (message.divineInterventionActive != null && Object.hasOwnProperty.call(message, "divineInterventionActive"))
                    writer.uint32(/* id 53, wireType 0 =*/424).bool(message.divineInterventionActive);
                if (message.arcaneShieldActive != null && Object.hasOwnProperty.call(message, "arcaneShieldActive"))
                    writer.uint32(/* id 54, wireType 0 =*/432).bool(message.arcaneShieldActive);
                if (message.arcaneShieldHp != null && Object.hasOwnProperty.call(message, "arcaneShieldHp"))
                    writer.uint32(/* id 55, wireType 0 =*/440).int32(message.arcaneShieldHp);
                if (message.timeWarpActive != null && Object.hasOwnProperty.call(message, "timeWarpActive"))
                    writer.uint32(/* id 56, wireType 0 =*/448).bool(message.timeWarpActive);
                if (message.spellFocusActive != null && Object.hasOwnProperty.call(message, "spellFocusActive"))
                    writer.uint32(/* id 57, wireType 0 =*/456).bool(message.spellFocusActive);
                if (message.stunned != null && Object.hasOwnProperty.call(message, "stunned"))
                    writer.uint32(/* id 42, wireType 0 =*/336).bool(message.stunned);
                if (message.slowed != null && Object.hasOwnProperty.call(message, "slowed"))
                    writer.uint32(/* id 43, wireType 0 =*/344).bool(message.slowed);
                if (message.rooted != null && Object.hasOwnProperty.call(message, "rooted"))
                    writer.uint32(/* id 44, wireType 0 =*/352).bool(message.rooted);
                if (message.bleeding != null && Object.hasOwnProperty.call(message, "bleeding"))
                    writer.uint32(/* id 45, wireType 0 =*/360).bool(message.bleeding);
                if (message.poisoned != null && Object.hasOwnProperty.call(message, "poisoned"))
                    writer.uint32(/* id 46, wireType 0 =*/368).bool(message.poisoned);
                if (message.slowFactor != null && Object.hasOwnProperty.call(message, "slowFactor"))
                    writer.uint32(/* id 58, wireType 5 =*/469).float(message.slowFactor);
                if (message.rootDuration != null && Object.hasOwnProperty.call(message, "rootDuration"))
                    writer.uint32(/* id 59, wireType 5 =*/477).float(message.rootDuration);
                if (message.stunDuration != null && Object.hasOwnProperty.call(message, "stunDuration"))
                    writer.uint32(/* id 60, wireType 5 =*/485).float(message.stunDuration);
                if (message.talentPoints != null && Object.hasOwnProperty.call(message, "talentPoints"))
                    writer.uint32(/* id 47, wireType 0 =*/376).int32(message.talentPoints);
                if (message.unlockedTalents != null && message.unlockedTalents.length)
                    for (let i = 0; i < message.unlockedTalents.length; ++i)
                        writer.uint32(/* id 48, wireType 2 =*/386).string(message.unlockedTalents[i]);
                if (message.talentRanks != null && Object.hasOwnProperty.call(message, "talentRanks"))
                    for (let keys = Object.keys(message.talentRanks), i = 0; i < keys.length; ++i)
                        writer.uint32(/* id 49, wireType 2 =*/394).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]).uint32(/* id 2, wireType 0 =*/16).int32(message.talentRanks[keys[i]]).ldelim();
                if (message.skillRunes != null && Object.hasOwnProperty.call(message, "skillRunes"))
                    for (let keys = Object.keys(message.skillRunes), i = 0; i < keys.length; ++i)
                        writer.uint32(/* id 50, wireType 2 =*/402).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]).uint32(/* id 2, wireType 2 =*/18).string(message.skillRunes[keys[i]]).ldelim();
                return writer;
            };

            /**
             * Encodes the specified Entity message, length delimited. Does not implicitly {@link eidolon.state.Entity.verify|verify} messages.
             * @function encodeDelimited
             * @memberof eidolon.state.Entity
             * @static
             * @param {eidolon.state.IEntity} message Entity message or plain object to encode
             * @param {$protobuf.Writer} [writer] Writer to encode to
             * @returns {$protobuf.Writer} Writer
             */
            Entity.encodeDelimited = function encodeDelimited(message, writer) {
                return this.encode(message, writer).ldelim();
            };

            /**
             * Decodes an Entity message from the specified reader or buffer.
             * @function decode
             * @memberof eidolon.state.Entity
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @param {number} [length] Message length if known beforehand
             * @returns {eidolon.state.Entity} Entity
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Entity.decode = function decode(reader, length, error) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                let end = length === undefined ? reader.len : reader.pos + length, message = new $root.eidolon.state.Entity(), key, value;
                while (reader.pos < end) {
                    let tag = reader.uint32();
                    if (tag === error)
                        break;
                    switch (tag >>> 3) {
                    case 1: {
                            message.id = reader.string();
                            break;
                        }
                    case 2: {
                            message.instanceId = reader.string();
                            break;
                        }
                    case 3: {
                            message.name = reader.string();
                            break;
                        }
                    case 4: {
                            message.type = reader.string();
                            break;
                        }
                    case 5: {
                            message.subType = reader.string();
                            break;
                        }
                    case 6: {
                            message.x = reader.float();
                            break;
                        }
                    case 7: {
                            message.y = reader.float();
                            break;
                        }
                    case 8: {
                            message.z = reader.float();
                            break;
                        }
                    case 9: {
                            message.rotation = reader.float();
                            break;
                        }
                    case 10: {
                            message.health = reader.int32();
                            break;
                        }
                    case 11: {
                            message.maxHealth = reader.int32();
                            break;
                        }
                    case 12: {
                            message.mana = reader.int32();
                            break;
                        }
                    case 13: {
                            message.maxMana = reader.int32();
                            break;
                        }
                    case 14: {
                            message.level = reader.int32();
                            break;
                        }
                    case 15: {
                            message.experience = reader.int32();
                            break;
                        }
                    case 16: {
                            message.maxExperience = reader.int32();
                            break;
                        }
                    case 17: {
                            message.gold = reader.int32();
                            break;
                        }
                    case 18: {
                            message.skillPoints = reader.int32();
                            break;
                        }
                    case 19: {
                            message.selectedBranch = reader.string();
                            break;
                        }
                    case 20: {
                            if (!(message.unlockedSkills && message.unlockedSkills.length))
                                message.unlockedSkills = [];
                            message.unlockedSkills.push(reader.string());
                            break;
                        }
                    case 21: {
                            message.baseStats = $root.eidolon.state.Stats.decode(reader, reader.uint32());
                            break;
                        }
                    case 22: {
                            message.stats = $root.eidolon.state.Stats.decode(reader, reader.uint32());
                            break;
                        }
                    case 23: {
                            message.damage = reader.int32();
                            break;
                        }
                    case 24: {
                            message.defense = reader.int32();
                            break;
                        }
                    case 25: {
                            message.speed = reader.float();
                            break;
                        }
                    case 26: {
                            message.attackSpeed = reader.float();
                            break;
                        }
                    case 27: {
                            message.cooldownReduction = reader.float();
                            break;
                        }
                    case 28: {
                            message.hpRegen = reader.float();
                            break;
                        }
                    case 29: {
                            message.manaRegen = reader.float();
                            break;
                        }
                    case 30: {
                            message.castSpeed = reader.float();
                            break;
                        }
                    case 31: {
                            message.scale = reader.float();
                            break;
                        }
                    case 32: {
                            message.state = reader.string();
                            break;
                        }
                    case 33: {
                            if (message.equipment === $util.emptyObject)
                                message.equipment = {};
                            let end2 = reader.uint32() + reader.pos;
                            key = "";
                            value = null;
                            while (reader.pos < end2) {
                                let tag2 = reader.uint32();
                                switch (tag2 >>> 3) {
                                case 1:
                                    key = reader.string();
                                    break;
                                case 2:
                                    value = $root.eidolon.state.Item.decode(reader, reader.uint32());
                                    break;
                                default:
                                    reader.skipType(tag2 & 7);
                                    break;
                                }
                            }
                            message.equipment[key] = value;
                            break;
                        }
                    case 34: {
                            if (!(message.quests && message.quests.length))
                                message.quests = [];
                            message.quests.push($root.eidolon.state.Quest.decode(reader, reader.uint32()));
                            break;
                        }
                    case 35: {
                            message.lootItem = $root.eidolon.state.Item.decode(reader, reader.uint32());
                            break;
                        }
                    case 36: {
                            message.ownerId = reader.string();
                            break;
                        }
                    case 37: {
                            message.velX = reader.float();
                            break;
                        }
                    case 38: {
                            message.velZ = reader.float();
                            break;
                        }
                    case 39: {
                            message.spiritsActive = reader.bool();
                            break;
                        }
                    case 40: {
                            message.spiritsBoosted = reader.bool();
                            break;
                        }
                        case 41: {
                            message.isCharging = reader.bool();
                            break;
                        }
                    case 51: {
                            message.guardianEmbraceActive = reader.bool();
                            break;
                        }
                    case 52: {
                            message.blessingResolveActive = reader.bool();
                            break;
                        }
                    case 53: {
                            message.divineInterventionActive = reader.bool();
                            break;
                        }
                    case 54: {
                            message.arcaneShieldActive = reader.bool();
                            break;
                        }
                    case 55: {
                            message.arcaneShieldHp = reader.int32();
                            break;
                        }
                    case 56: {
                            message.timeWarpActive = reader.bool();
                            break;
                        }
                    case 57: {
                            message.spellFocusActive = reader.bool();
                            break;
                        }
                    case 42: {
                            message.stunned = reader.bool();
                            break;
                        }
                    case 43: {
                            message.slowed = reader.bool();
                            break;
                        }
                    case 44: {
                            message.rooted = reader.bool();
                            break;
                        }
                    case 45: {
                            message.bleeding = reader.bool();
                            break;
                        }
                    case 46: {
                            message.poisoned = reader.bool();
                            break;
                        }
                    case 58: {
                            message.slowFactor = reader.float();
                            break;
                        }
                    case 59: {
                            message.rootDuration = reader.float();
                            break;
                        }
                    case 60: {
                            message.stunDuration = reader.float();
                            break;
                        }
                    case 47: {
                            message.talentPoints = reader.int32();
                            break;
                        }
                    case 48: {
                            if (!(message.unlockedTalents && message.unlockedTalents.length))
                                message.unlockedTalents = [];
                            message.unlockedTalents.push(reader.string());
                            break;
                        }
                    case 49: {
                            if (message.talentRanks === $util.emptyObject)
                                message.talentRanks = {};
                            let end2 = reader.uint32() + reader.pos;
                            key = "";
                            value = 0;
                            while (reader.pos < end2) {
                                let tag2 = reader.uint32();
                                switch (tag2 >>> 3) {
                                case 1:
                                    key = reader.string();
                                    break;
                                case 2:
                                    value = reader.int32();
                                    break;
                                default:
                                    reader.skipType(tag2 & 7);
                                    break;
                                }
                            }
                            message.talentRanks[key] = value;
                            break;
                        }
                    case 50: {
                            if (message.skillRunes === $util.emptyObject)
                                message.skillRunes = {};
                            let end2 = reader.uint32() + reader.pos;
                            key = "";
                            value = "";
                            while (reader.pos < end2) {
                                let tag2 = reader.uint32();
                                switch (tag2 >>> 3) {
                                case 1:
                                    key = reader.string();
                                    break;
                                case 2:
                                    value = reader.string();
                                    break;
                                default:
                                    reader.skipType(tag2 & 7);
                                    break;
                                }
                            }
                            message.skillRunes[key] = value;
                            break;
                        }
                    default:
                        reader.skipType(tag & 7);
                        break;
                    }
                }
                return message;
            };

            /**
             * Decodes an Entity message from the specified reader or buffer, length delimited.
             * @function decodeDelimited
             * @memberof eidolon.state.Entity
             * @static
             * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
             * @returns {eidolon.state.Entity} Entity
             * @throws {Error} If the payload is not a reader or valid buffer
             * @throws {$protobuf.util.ProtocolError} If required fields are missing
             */
            Entity.decodeDelimited = function decodeDelimited(reader) {
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
            Entity.verify = function verify(message) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (message.id != null && message.hasOwnProperty("id"))
                    if (!$util.isString(message.id))
                        return "id: string expected";
                if (message.instanceId != null && message.hasOwnProperty("instanceId"))
                    if (!$util.isString(message.instanceId))
                        return "instanceId: string expected";
                if (message.name != null && message.hasOwnProperty("name"))
                    if (!$util.isString(message.name))
                        return "name: string expected";
                if (message.type != null && message.hasOwnProperty("type"))
                    if (!$util.isString(message.type))
                        return "type: string expected";
                if (message.subType != null && message.hasOwnProperty("subType"))
                    if (!$util.isString(message.subType))
                        return "subType: string expected";
                if (message.x != null && message.hasOwnProperty("x"))
                    if (typeof message.x !== "number")
                        return "x: number expected";
                if (message.y != null && message.hasOwnProperty("y"))
                    if (typeof message.y !== "number")
                        return "y: number expected";
                if (message.z != null && message.hasOwnProperty("z"))
                    if (typeof message.z !== "number")
                        return "z: number expected";
                if (message.rotation != null && message.hasOwnProperty("rotation"))
                    if (typeof message.rotation !== "number")
                        return "rotation: number expected";
                if (message.health != null && message.hasOwnProperty("health"))
                    if (!$util.isInteger(message.health))
                        return "health: integer expected";
                if (message.maxHealth != null && message.hasOwnProperty("maxHealth"))
                    if (!$util.isInteger(message.maxHealth))
                        return "maxHealth: integer expected";
                if (message.mana != null && message.hasOwnProperty("mana"))
                    if (!$util.isInteger(message.mana))
                        return "mana: integer expected";
                if (message.maxMana != null && message.hasOwnProperty("maxMana"))
                    if (!$util.isInteger(message.maxMana))
                        return "maxMana: integer expected";
                if (message.level != null && message.hasOwnProperty("level"))
                    if (!$util.isInteger(message.level))
                        return "level: integer expected";
                if (message.experience != null && message.hasOwnProperty("experience"))
                    if (!$util.isInteger(message.experience))
                        return "experience: integer expected";
                if (message.maxExperience != null && message.hasOwnProperty("maxExperience"))
                    if (!$util.isInteger(message.maxExperience))
                        return "maxExperience: integer expected";
                if (message.gold != null && message.hasOwnProperty("gold"))
                    if (!$util.isInteger(message.gold))
                        return "gold: integer expected";
                if (message.skillPoints != null && message.hasOwnProperty("skillPoints"))
                    if (!$util.isInteger(message.skillPoints))
                        return "skillPoints: integer expected";
                if (message.selectedBranch != null && message.hasOwnProperty("selectedBranch"))
                    if (!$util.isString(message.selectedBranch))
                        return "selectedBranch: string expected";
                if (message.unlockedSkills != null && message.hasOwnProperty("unlockedSkills")) {
                    if (!Array.isArray(message.unlockedSkills))
                        return "unlockedSkills: array expected";
                    for (let i = 0; i < message.unlockedSkills.length; ++i)
                        if (!$util.isString(message.unlockedSkills[i]))
                            return "unlockedSkills: string[] expected";
                }
                if (message.baseStats != null && message.hasOwnProperty("baseStats")) {
                    let error = $root.eidolon.state.Stats.verify(message.baseStats);
                    if (error)
                        return "baseStats." + error;
                }
                if (message.stats != null && message.hasOwnProperty("stats")) {
                    let error = $root.eidolon.state.Stats.verify(message.stats);
                    if (error)
                        return "stats." + error;
                }
                if (message.damage != null && message.hasOwnProperty("damage"))
                    if (!$util.isInteger(message.damage))
                        return "damage: integer expected";
                if (message.defense != null && message.hasOwnProperty("defense"))
                    if (!$util.isInteger(message.defense))
                        return "defense: integer expected";
                if (message.speed != null && message.hasOwnProperty("speed"))
                    if (typeof message.speed !== "number")
                        return "speed: number expected";
                if (message.attackSpeed != null && message.hasOwnProperty("attackSpeed"))
                    if (typeof message.attackSpeed !== "number")
                        return "attackSpeed: number expected";
                if (message.cooldownReduction != null && message.hasOwnProperty("cooldownReduction"))
                    if (typeof message.cooldownReduction !== "number")
                        return "cooldownReduction: number expected";
                if (message.hpRegen != null && message.hasOwnProperty("hpRegen"))
                    if (typeof message.hpRegen !== "number")
                        return "hpRegen: number expected";
                if (message.manaRegen != null && message.hasOwnProperty("manaRegen"))
                    if (typeof message.manaRegen !== "number")
                        return "manaRegen: number expected";
                if (message.castSpeed != null && message.hasOwnProperty("castSpeed"))
                    if (typeof message.castSpeed !== "number")
                        return "castSpeed: number expected";
                if (message.scale != null && message.hasOwnProperty("scale"))
                    if (typeof message.scale !== "number")
                        return "scale: number expected";
                if (message.state != null && message.hasOwnProperty("state"))
                    if (!$util.isString(message.state))
                        return "state: string expected";
                if (message.equipment != null && message.hasOwnProperty("equipment")) {
                    if (!$util.isObject(message.equipment))
                        return "equipment: object expected";
                    let key = Object.keys(message.equipment);
                    for (let i = 0; i < key.length; ++i) {
                        let error = $root.eidolon.state.Item.verify(message.equipment[key[i]]);
                        if (error)
                            return "equipment." + error;
                    }
                }
                if (message.quests != null && message.hasOwnProperty("quests")) {
                    if (!Array.isArray(message.quests))
                        return "quests: array expected";
                    for (let i = 0; i < message.quests.length; ++i) {
                        let error = $root.eidolon.state.Quest.verify(message.quests[i]);
                        if (error)
                            return "quests." + error;
                    }
                }
                if (message.lootItem != null && message.hasOwnProperty("lootItem")) {
                    let error = $root.eidolon.state.Item.verify(message.lootItem);
                    if (error)
                        return "lootItem." + error;
                }
                if (message.ownerId != null && message.hasOwnProperty("ownerId"))
                    if (!$util.isString(message.ownerId))
                        return "ownerId: string expected";
                if (message.velX != null && message.hasOwnProperty("velX"))
                    if (typeof message.velX !== "number")
                        return "velX: number expected";
                if (message.velZ != null && message.hasOwnProperty("velZ"))
                    if (typeof message.velZ !== "number")
                        return "velZ: number expected";
                if (message.spiritsActive != null && message.hasOwnProperty("spiritsActive"))
                    if (typeof message.spiritsActive !== "boolean")
                        return "spiritsActive: boolean expected";
                if (message.spiritsBoosted != null && message.hasOwnProperty("spiritsBoosted"))
                    if (typeof message.spiritsBoosted !== "boolean")
                        return "spiritsBoosted: boolean expected";
                if (message.isCharging != null && message.hasOwnProperty("isCharging"))
                    if (typeof message.isCharging !== "boolean")
                        return "isCharging: boolean expected";
                if (message.guardianEmbraceActive != null && message.hasOwnProperty("guardianEmbraceActive"))
                    if (typeof message.guardianEmbraceActive !== "boolean")
                        return "guardianEmbraceActive: boolean expected";
                if (message.blessingResolveActive != null && message.hasOwnProperty("blessingResolveActive"))
                    if (typeof message.blessingResolveActive !== "boolean")
                        return "blessingResolveActive: boolean expected";
                if (message.divineInterventionActive != null && message.hasOwnProperty("divineInterventionActive"))
                    if (typeof message.divineInterventionActive !== "boolean")
                        return "divineInterventionActive: boolean expected";
                if (message.arcaneShieldActive != null && message.hasOwnProperty("arcaneShieldActive"))
                    if (typeof message.arcaneShieldActive !== "boolean")
                        return "arcaneShieldActive: boolean expected";
                if (message.arcaneShieldHp != null && message.hasOwnProperty("arcaneShieldHp"))
                    if (!$util.isInteger(message.arcaneShieldHp))
                        return "arcaneShieldHp: integer expected";
                if (message.timeWarpActive != null && message.hasOwnProperty("timeWarpActive"))
                    if (typeof message.timeWarpActive !== "boolean")
                        return "timeWarpActive: boolean expected";
                if (message.spellFocusActive != null && message.hasOwnProperty("spellFocusActive"))
                    if (typeof message.spellFocusActive !== "boolean")
                        return "spellFocusActive: boolean expected";
                if (message.stunned != null && message.hasOwnProperty("stunned"))
                    if (typeof message.stunned !== "boolean")
                        return "stunned: boolean expected";
                if (message.slowed != null && message.hasOwnProperty("slowed"))
                    if (typeof message.slowed !== "boolean")
                        return "slowed: boolean expected";
                if (message.rooted != null && message.hasOwnProperty("rooted"))
                    if (typeof message.rooted !== "boolean")
                        return "rooted: boolean expected";
                if (message.bleeding != null && message.hasOwnProperty("bleeding"))
                    if (typeof message.bleeding !== "boolean")
                        return "bleeding: boolean expected";
                if (message.poisoned != null && message.hasOwnProperty("poisoned"))
                    if (typeof message.poisoned !== "boolean")
                        return "poisoned: boolean expected";
                if (message.slowFactor != null && message.hasOwnProperty("slowFactor"))
                    if (typeof message.slowFactor !== "number")
                        return "slowFactor: number expected";
                if (message.rootDuration != null && message.hasOwnProperty("rootDuration"))
                    if (typeof message.rootDuration !== "number")
                        return "rootDuration: number expected";
                if (message.stunDuration != null && message.hasOwnProperty("stunDuration"))
                    if (typeof message.stunDuration !== "number")
                        return "stunDuration: number expected";
                if (message.talentPoints != null && message.hasOwnProperty("talentPoints"))
                    if (!$util.isInteger(message.talentPoints))
                        return "talentPoints: integer expected";
                if (message.unlockedTalents != null && message.hasOwnProperty("unlockedTalents")) {
                    if (!Array.isArray(message.unlockedTalents))
                        return "unlockedTalents: array expected";
                    for (let i = 0; i < message.unlockedTalents.length; ++i)
                        if (!$util.isString(message.unlockedTalents[i]))
                            return "unlockedTalents: string[] expected";
                }
                if (message.talentRanks != null && message.hasOwnProperty("talentRanks")) {
                    if (!$util.isObject(message.talentRanks))
                        return "talentRanks: object expected";
                    let key = Object.keys(message.talentRanks);
                    for (let i = 0; i < key.length; ++i)
                        if (!$util.isInteger(message.talentRanks[key[i]]))
                            return "talentRanks: integer{k:string} expected";
                }
                if (message.skillRunes != null && message.hasOwnProperty("skillRunes")) {
                    if (!$util.isObject(message.skillRunes))
                        return "skillRunes: object expected";
                    let key = Object.keys(message.skillRunes);
                    for (let i = 0; i < key.length; ++i)
                        if (!$util.isString(message.skillRunes[key[i]]))
                            return "skillRunes: string{k:string} expected";
                }
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
            Entity.fromObject = function fromObject(object) {
                if (object instanceof $root.eidolon.state.Entity)
                    return object;
                let message = new $root.eidolon.state.Entity();
                if (object.id != null)
                    message.id = String(object.id);
                if (object.instanceId != null)
                    message.instanceId = String(object.instanceId);
                if (object.name != null)
                    message.name = String(object.name);
                if (object.type != null)
                    message.type = String(object.type);
                if (object.subType != null)
                    message.subType = String(object.subType);
                if (object.x != null)
                    message.x = Number(object.x);
                if (object.y != null)
                    message.y = Number(object.y);
                if (object.z != null)
                    message.z = Number(object.z);
                if (object.rotation != null)
                    message.rotation = Number(object.rotation);
                if (object.health != null)
                    message.health = object.health | 0;
                if (object.maxHealth != null)
                    message.maxHealth = object.maxHealth | 0;
                if (object.mana != null)
                    message.mana = object.mana | 0;
                if (object.maxMana != null)
                    message.maxMana = object.maxMana | 0;
                if (object.level != null)
                    message.level = object.level | 0;
                if (object.experience != null)
                    message.experience = object.experience | 0;
                if (object.maxExperience != null)
                    message.maxExperience = object.maxExperience | 0;
                if (object.gold != null)
                    message.gold = object.gold | 0;
                if (object.skillPoints != null)
                    message.skillPoints = object.skillPoints | 0;
                if (object.selectedBranch != null)
                    message.selectedBranch = String(object.selectedBranch);
                if (object.unlockedSkills) {
                    if (!Array.isArray(object.unlockedSkills))
                        throw TypeError(".eidolon.state.Entity.unlockedSkills: array expected");
                    message.unlockedSkills = [];
                    for (let i = 0; i < object.unlockedSkills.length; ++i)
                        message.unlockedSkills[i] = String(object.unlockedSkills[i]);
                }
                if (object.baseStats != null) {
                    if (typeof object.baseStats !== "object")
                        throw TypeError(".eidolon.state.Entity.baseStats: object expected");
                    message.baseStats = $root.eidolon.state.Stats.fromObject(object.baseStats);
                }
                if (object.stats != null) {
                    if (typeof object.stats !== "object")
                        throw TypeError(".eidolon.state.Entity.stats: object expected");
                    message.stats = $root.eidolon.state.Stats.fromObject(object.stats);
                }
                if (object.damage != null)
                    message.damage = object.damage | 0;
                if (object.defense != null)
                    message.defense = object.defense | 0;
                if (object.speed != null)
                    message.speed = Number(object.speed);
                if (object.attackSpeed != null)
                    message.attackSpeed = Number(object.attackSpeed);
                if (object.cooldownReduction != null)
                    message.cooldownReduction = Number(object.cooldownReduction);
                if (object.hpRegen != null)
                    message.hpRegen = Number(object.hpRegen);
                if (object.manaRegen != null)
                    message.manaRegen = Number(object.manaRegen);
                if (object.castSpeed != null)
                    message.castSpeed = Number(object.castSpeed);
                if (object.scale != null)
                    message.scale = Number(object.scale);
                if (object.state != null)
                    message.state = String(object.state);
                if (object.equipment) {
                    if (typeof object.equipment !== "object")
                        throw TypeError(".eidolon.state.Entity.equipment: object expected");
                    message.equipment = {};
                    for (let keys = Object.keys(object.equipment), i = 0; i < keys.length; ++i) {
                        if (typeof object.equipment[keys[i]] !== "object")
                            throw TypeError(".eidolon.state.Entity.equipment: object expected");
                        message.equipment[keys[i]] = $root.eidolon.state.Item.fromObject(object.equipment[keys[i]]);
                    }
                }
                if (object.quests) {
                    if (!Array.isArray(object.quests))
                        throw TypeError(".eidolon.state.Entity.quests: array expected");
                    message.quests = [];
                    for (let i = 0; i < object.quests.length; ++i) {
                        if (typeof object.quests[i] !== "object")
                            throw TypeError(".eidolon.state.Entity.quests: object expected");
                        message.quests[i] = $root.eidolon.state.Quest.fromObject(object.quests[i]);
                    }
                }
                if (object.lootItem != null) {
                    if (typeof object.lootItem !== "object")
                        throw TypeError(".eidolon.state.Entity.lootItem: object expected");
                    message.lootItem = $root.eidolon.state.Item.fromObject(object.lootItem);
                }
                if (object.ownerId != null)
                    message.ownerId = String(object.ownerId);
                if (object.velX != null)
                    message.velX = Number(object.velX);
                if (object.velZ != null)
                    message.velZ = Number(object.velZ);
                if (object.spiritsActive != null)
                    message.spiritsActive = Boolean(object.spiritsActive);
                if (object.spiritsBoosted != null)
                    message.spiritsBoosted = Boolean(object.spiritsBoosted);
                if (object.isCharging != null)
                    message.isCharging = Boolean(object.isCharging);
                if (object.guardianEmbraceActive != null)
                    message.guardianEmbraceActive = Boolean(object.guardianEmbraceActive);
                if (object.blessingResolveActive != null)
                    message.blessingResolveActive = Boolean(object.blessingResolveActive);
                if (object.divineInterventionActive != null)
                    message.divineInterventionActive = Boolean(object.divineInterventionActive);
                if (object.arcaneShieldActive != null)
                    message.arcaneShieldActive = Boolean(object.arcaneShieldActive);
                if (object.arcaneShieldHp != null)
                    message.arcaneShieldHp = object.arcaneShieldHp | 0;
                if (object.timeWarpActive != null)
                    message.timeWarpActive = Boolean(object.timeWarpActive);
                if (object.spellFocusActive != null)
                    message.spellFocusActive = Boolean(object.spellFocusActive);
                if (object.stunned != null)
                    message.stunned = Boolean(object.stunned);
                if (object.slowed != null)
                    message.slowed = Boolean(object.slowed);
                if (object.rooted != null)
                    message.rooted = Boolean(object.rooted);
                if (object.bleeding != null)
                    message.bleeding = Boolean(object.bleeding);
                if (object.poisoned != null)
                    message.poisoned = Boolean(object.poisoned);
                if (object.slowFactor != null)
                    message.slowFactor = Number(object.slowFactor);
                if (object.rootDuration != null)
                    message.rootDuration = Number(object.rootDuration);
                if (object.stunDuration != null)
                    message.stunDuration = Number(object.stunDuration);
                if (object.talentPoints != null)
                    message.talentPoints = object.talentPoints | 0;
                if (object.unlockedTalents) {
                    if (!Array.isArray(object.unlockedTalents))
                        throw TypeError(".eidolon.state.Entity.unlockedTalents: array expected");
                    message.unlockedTalents = [];
                    for (let i = 0; i < object.unlockedTalents.length; ++i)
                        message.unlockedTalents[i] = String(object.unlockedTalents[i]);
                }
                if (object.talentRanks) {
                    if (typeof object.talentRanks !== "object")
                        throw TypeError(".eidolon.state.Entity.talentRanks: object expected");
                    message.talentRanks = {};
                    for (let keys = Object.keys(object.talentRanks), i = 0; i < keys.length; ++i)
                        message.talentRanks[keys[i]] = object.talentRanks[keys[i]] | 0;
                }
                if (object.skillRunes) {
                    if (typeof object.skillRunes !== "object")
                        throw TypeError(".eidolon.state.Entity.skillRunes: object expected");
                    message.skillRunes = {};
                    for (let keys = Object.keys(object.skillRunes), i = 0; i < keys.length; ++i)
                        message.skillRunes[keys[i]] = String(object.skillRunes[keys[i]]);
                }
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
            Entity.toObject = function toObject(message, options) {
                if (!options)
                    options = {};
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
                    object.experience = 0;
                    object.maxExperience = 0;
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
                    object.guardianEmbraceActive = false;
                    object.blessingResolveActive = false;
                    object.divineInterventionActive = false;
                    object.arcaneShieldActive = false;
                    object.arcaneShieldHp = 0;
                    object.timeWarpActive = false;
                    object.spellFocusActive = false;
                    object.stunned = false;
                    object.slowed = false;
                    object.rooted = false;
                    object.bleeding = false;
                    object.poisoned = false;
                    object.slowFactor = 0;
                    object.rootDuration = 0;
                    object.stunDuration = 0;
                    object.talentPoints = 0;
                }
                if (message.id != null && message.hasOwnProperty("id"))
                    object.id = message.id;
                if (message.instanceId != null && message.hasOwnProperty("instanceId"))
                    object.instanceId = message.instanceId;
                if (message.name != null && message.hasOwnProperty("name"))
                    object.name = message.name;
                if (message.type != null && message.hasOwnProperty("type"))
                    object.type = message.type;
                if (message.subType != null && message.hasOwnProperty("subType"))
                    object.subType = message.subType;
                if (message.x != null && message.hasOwnProperty("x"))
                    object.x = options.json && !isFinite(message.x) ? String(message.x) : message.x;
                if (message.y != null && message.hasOwnProperty("y"))
                    object.y = options.json && !isFinite(message.y) ? String(message.y) : message.y;
                if (message.z != null && message.hasOwnProperty("z"))
                    object.z = options.json && !isFinite(message.z) ? String(message.z) : message.z;
                if (message.rotation != null && message.hasOwnProperty("rotation"))
                    object.rotation = options.json && !isFinite(message.rotation) ? String(message.rotation) : message.rotation;
                if (message.health != null && message.hasOwnProperty("health"))
                    object.health = message.health;
                if (message.maxHealth != null && message.hasOwnProperty("maxHealth"))
                    object.maxHealth = message.maxHealth;
                if (message.mana != null && message.hasOwnProperty("mana"))
                    object.mana = message.mana;
                if (message.maxMana != null && message.hasOwnProperty("maxMana"))
                    object.maxMana = message.maxMana;
                if (message.level != null && message.hasOwnProperty("level"))
                    object.level = message.level;
                if (message.experience != null && message.hasOwnProperty("experience"))
                    object.experience = message.experience;
                if (message.maxExperience != null && message.hasOwnProperty("maxExperience"))
                    object.maxExperience = message.maxExperience;
                if (message.gold != null && message.hasOwnProperty("gold"))
                    object.gold = message.gold;
                if (message.skillPoints != null && message.hasOwnProperty("skillPoints"))
                    object.skillPoints = message.skillPoints;
                if (message.selectedBranch != null && message.hasOwnProperty("selectedBranch"))
                    object.selectedBranch = message.selectedBranch;
                if (message.unlockedSkills && message.unlockedSkills.length) {
                    object.unlockedSkills = [];
                    for (let j = 0; j < message.unlockedSkills.length; ++j)
                        object.unlockedSkills[j] = message.unlockedSkills[j];
                }
                if (message.baseStats != null && message.hasOwnProperty("baseStats"))
                    object.baseStats = $root.eidolon.state.Stats.toObject(message.baseStats, options);
                if (message.stats != null && message.hasOwnProperty("stats"))
                    object.stats = $root.eidolon.state.Stats.toObject(message.stats, options);
                if (message.damage != null && message.hasOwnProperty("damage"))
                    object.damage = message.damage;
                if (message.defense != null && message.hasOwnProperty("defense"))
                    object.defense = message.defense;
                if (message.speed != null && message.hasOwnProperty("speed"))
                    object.speed = options.json && !isFinite(message.speed) ? String(message.speed) : message.speed;
                if (message.attackSpeed != null && message.hasOwnProperty("attackSpeed"))
                    object.attackSpeed = options.json && !isFinite(message.attackSpeed) ? String(message.attackSpeed) : message.attackSpeed;
                if (message.cooldownReduction != null && message.hasOwnProperty("cooldownReduction"))
                    object.cooldownReduction = options.json && !isFinite(message.cooldownReduction) ? String(message.cooldownReduction) : message.cooldownReduction;
                if (message.hpRegen != null && message.hasOwnProperty("hpRegen"))
                    object.hpRegen = options.json && !isFinite(message.hpRegen) ? String(message.hpRegen) : message.hpRegen;
                if (message.manaRegen != null && message.hasOwnProperty("manaRegen"))
                    object.manaRegen = options.json && !isFinite(message.manaRegen) ? String(message.manaRegen) : message.manaRegen;
                if (message.castSpeed != null && message.hasOwnProperty("castSpeed"))
                    object.castSpeed = options.json && !isFinite(message.castSpeed) ? String(message.castSpeed) : message.castSpeed;
                if (message.scale != null && message.hasOwnProperty("scale"))
                    object.scale = options.json && !isFinite(message.scale) ? String(message.scale) : message.scale;
                if (message.state != null && message.hasOwnProperty("state"))
                    object.state = message.state;
                let keys2;
                if (message.equipment && (keys2 = Object.keys(message.equipment)).length) {
                    object.equipment = {};
                    for (let j = 0; j < keys2.length; ++j)
                        object.equipment[keys2[j]] = $root.eidolon.state.Item.toObject(message.equipment[keys2[j]], options);
                }
                if (message.quests && message.quests.length) {
                    object.quests = [];
                    for (let j = 0; j < message.quests.length; ++j)
                        object.quests[j] = $root.eidolon.state.Quest.toObject(message.quests[j], options);
                }
                if (message.lootItem != null && message.hasOwnProperty("lootItem"))
                    object.lootItem = $root.eidolon.state.Item.toObject(message.lootItem, options);
                if (message.ownerId != null && message.hasOwnProperty("ownerId"))
                    object.ownerId = message.ownerId;
                if (message.velX != null && message.hasOwnProperty("velX"))
                    object.velX = options.json && !isFinite(message.velX) ? String(message.velX) : message.velX;
                if (message.velZ != null && message.hasOwnProperty("velZ"))
                    object.velZ = options.json && !isFinite(message.velZ) ? String(message.velZ) : message.velZ;
                if (message.spiritsActive != null && message.hasOwnProperty("spiritsActive"))
                    object.spiritsActive = message.spiritsActive;
                if (message.spiritsBoosted != null && message.hasOwnProperty("spiritsBoosted"))
                    object.spiritsBoosted = message.spiritsBoosted;
                if (message.isCharging != null && message.hasOwnProperty("isCharging"))
                    object.isCharging = message.isCharging;
                if (message.guardianEmbraceActive != null && message.hasOwnProperty("guardianEmbraceActive"))
                    object.guardianEmbraceActive = message.guardianEmbraceActive;
                if (message.blessingResolveActive != null && message.hasOwnProperty("blessingResolveActive"))
                    object.blessingResolveActive = message.blessingResolveActive;
                if (message.divineInterventionActive != null && message.hasOwnProperty("divineInterventionActive"))
                    object.divineInterventionActive = message.divineInterventionActive;
                if (message.arcaneShieldActive != null && message.hasOwnProperty("arcaneShieldActive"))
                    object.arcaneShieldActive = message.arcaneShieldActive;
                if (message.arcaneShieldHp != null && message.hasOwnProperty("arcaneShieldHp"))
                    object.arcaneShieldHp = message.arcaneShieldHp;
                if (message.timeWarpActive != null && message.hasOwnProperty("timeWarpActive"))
                    object.timeWarpActive = message.timeWarpActive;
                if (message.spellFocusActive != null && message.hasOwnProperty("spellFocusActive"))
                    object.spellFocusActive = message.spellFocusActive;
                if (message.stunned != null && message.hasOwnProperty("stunned"))
                    object.stunned = message.stunned;
                if (message.slowed != null && message.hasOwnProperty("slowed"))
                    object.slowed = message.slowed;
                if (message.rooted != null && message.hasOwnProperty("rooted"))
                    object.rooted = message.rooted;
                if (message.bleeding != null && message.hasOwnProperty("bleeding"))
                    object.bleeding = message.bleeding;
                if (message.poisoned != null && message.hasOwnProperty("poisoned"))
                    object.poisoned = message.poisoned;
                if (message.slowFactor != null && message.hasOwnProperty("slowFactor"))
                    object.slowFactor = options.json && !isFinite(message.slowFactor) ? String(message.slowFactor) : message.slowFactor;
                if (message.rootDuration != null && message.hasOwnProperty("rootDuration"))
                    object.rootDuration = options.json && !isFinite(message.rootDuration) ? String(message.rootDuration) : message.rootDuration;
                if (message.stunDuration != null && message.hasOwnProperty("stunDuration"))
                    object.stunDuration = options.json && !isFinite(message.stunDuration) ? String(message.stunDuration) : message.stunDuration;
                if (message.talentPoints != null && message.hasOwnProperty("talentPoints"))
                    object.talentPoints = message.talentPoints;
                if (message.unlockedTalents && message.unlockedTalents.length) {
                    object.unlockedTalents = [];
                    for (let j = 0; j < message.unlockedTalents.length; ++j)
                        object.unlockedTalents[j] = message.unlockedTalents[j];
                }
                if (message.talentRanks && (keys2 = Object.keys(message.talentRanks)).length) {
                    object.talentRanks = {};
                    for (let j = 0; j < keys2.length; ++j)
                        object.talentRanks[keys2[j]] = message.talentRanks[keys2[j]];
                }
                if (message.skillRunes && (keys2 = Object.keys(message.skillRunes)).length) {
                    object.skillRunes = {};
                    for (let j = 0; j < keys2.length; ++j)
                        object.skillRunes[keys2[j]] = message.skillRunes[keys2[j]];
                }
                return object;
            };

            /**
             * Converts this Entity to JSON.
             * @function toJSON
             * @memberof eidolon.state.Entity
             * @instance
             * @returns {Object.<string,*>} JSON object
             */
            Entity.prototype.toJSON = function toJSON() {
                return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
            };

            /**
             * Gets the default type url for Entity
             * @function getTypeUrl
             * @memberof eidolon.state.Entity
             * @static
             * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
             * @returns {string} The default type url
             */
            Entity.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
                if (typeUrlPrefix === undefined) {
                    typeUrlPrefix = "type.googleapis.com";
                }
                return typeUrlPrefix + "/eidolon.state.Entity";
            };

            return Entity;
        })();

        return state;
    })();

    return eidolon;
})();

export { $root as default };
