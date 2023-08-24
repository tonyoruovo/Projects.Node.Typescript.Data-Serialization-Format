import parser from "./parser.js";
import { TransformOptions, TransformCallback } from "node:stream";
import expression from "./expression.js";

namespace json {
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
        writableObjectMode: true,
        allowHalfOpen: true,
      }
    ) {
      super(options, syntax, params);
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
        this.push(this.format.data());
      } catch (e) {
        return callback(e as Error);
      }
      return callback();
    }
    /**
     * @inheritdoc
     */
    _flush(callback: TransformCallback): void {
      callback();
    }
  }
}
export default json;