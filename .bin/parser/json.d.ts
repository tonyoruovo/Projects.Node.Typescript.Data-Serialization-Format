/// <reference types="node" resolution-mode="require"/>
/// <reference types="node" resolution-mode="require"/>
import parser from "./parser.js";
import { TransformOptions, TransformCallback } from "node:stream";
import expression from "./expression.js";
declare namespace json {
    /**
     * Tests whether the argument is not an object/array
     * @param {any} data the value to be tested
     * @returns {boolean} `true` if the argument is not an object/array otherwise returns `false`
     */
    function isAtomic(data: any): boolean;
    /**
     * Checks if the array contains exclusively atomic values (as specified by {@link json.Atom `json.Atom`}) and return `true` if it is, else returns `false`.
     * @param {any[]} array an array
     * @returns {boolean} `true` if the argument does not contain an array/object otherwise `false`
     */
    function arrayIsAtomic(array: any[]): array is Array<Atom>;
    /**The atomic types of json, used elsewhere for detecting parameter that have json atomic type(s) */
    type Atom = null | boolean | number | string;
    /**The object types of json, used elsewhere for detecting parameter that have object type(s) */
    type Pair = {
        /**
         * Gets the json value stored with the given key
         * @type {Value}
         */
        [key: string]: Value;
    };
    /**The list types of json, used elsewhere for detecting parameter that have list type(s) */
    type List = Value[];
    /**The data types of json, used elsewhere for detecting parameter type(s) */
    type Value = Atom | List | Pair;
    /**
     * A converter that accepts {@link expression.Expression} objects and outputs in-memory json
     * @template S the {@link Syntax} to use during conversion
     * @template P a mutable parameter object
     * @template F a type of {@link GFormat} that actually does the conversion, provided by the users of this class
     */
    class Converter<S extends parser.Syntax, P, F extends expression.GFormat<expression.Expression, Value>> extends parser.AbstractConverter<S, P> {
        readonly format: F;
        constructor(syntax: S, params: P, format: F, options?: TransformOptions);
        /**
         * @inheritdoc
         */
        _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void;
        /**
         * @inheritdoc
         */
        _flush(callback: TransformCallback): void;
    }
}
export default json;
