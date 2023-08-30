import parser from "./parser.js";
import { TransformOptions, TransformCallback } from "node:stream";
import expression from "./expression.js";

namespace json {
  /**
   * Tests whether the argument is not an object/array
   * @param {any} data the value to be tested
   * @returns {boolean} `true` if the argument is not an object/array otherwise returns `false`
   */
  export function isAtomic(data: any): boolean {
    return (
      data === null || (typeof data !== "object" && !Array.isArray(data))
    );
  }
  /**
   * Checks if the array contains exclusively atomic values (as specified by {@link json.Atom `json.Atom`}) and return `true` if it is, else returns `false`.
   * @param {any[]} array an array
   * @returns {boolean} `true` if the argument does not contain an array/object otherwise `false`
   */
  export function arrayIsAtomic(array: any[]): array is Array<Atom> {
    for (let i = 0; i < array.length; i++) {
      if(!isAtomic(array[i])) return false;
    }
    return true;
  }
  /**The atomic types of json, used elsewhere for detecting parameter that have json atomic type(s) */
  export type Atom = null | boolean | number | string;
  /**The object types of json, used elsewhere for detecting parameter that have object type(s) */
  export type Pair = {
    /**
     * Gets the json value stored with the given key
     * @type {Value}
     */
    [key: string]: Value;
  };
  /**The list types of json, used elsewhere for detecting parameter that have list type(s) */
  export type List = Value[];
  /**The data types of json, used elsewhere for detecting parameter type(s) */
  export type Value = Atom | List | Pair;
  /**
   * A converter that accepts {@link expression.Expression} objects and outputs in-memory json
   * @template S the {@link Syntax} to use during conversion
   * @template P a mutable parameter object
   * @template F a type of {@link GFormat} that actually does the conversion, provided by the users of this class
   */
  export class Converter<
    S extends parser.Syntax,
    P,
    F extends expression.GFormat<expression.Expression, Value>
  > extends parser.AbstractConverter<S, P> {
    constructor(
      syntax: S,
      params: P,
      public readonly format: F,
      options: TransformOptions = {
        readableObjectMode: true,
        writableObjectMode: true
      }
    ) {
      super({
        ...options,
        allowHalfOpen: true,
        objectMode: true
      }, syntax, params);
    }
    /**
     * @inheritdoc
     */
    _transform(
      chunk: any,
      encoding: BufferEncoding,
      callback: TransformCallback
    ): void {
      try {
        (chunk as expression.GExpression<F>).format(
          this.format,
          this.syntax,
          this.params
        );
        // const array = this.format.data() as Pair[];
        // console.log(array);
        return callback();
      } catch (e) {
        return callback(e as Error);
      }
    }
    /**
     * @inheritdoc
     */
    _flush(callback: TransformCallback): void {
      this.push(this.format.data());
      callback();
    }
  }
}
export default json;
