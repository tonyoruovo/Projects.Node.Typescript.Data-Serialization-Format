import util from "../utility.js";
import parser from "./parser.js";
/**
 * contains interfaces that may be mapped/represented as
 * partial or full expressions in a syntax
 */
namespace expression {
  const isValid = util.isValid;
  /**
   * Provided by a {@link Format formatter} to create specialized formats with the intention of increasing the readbility of the format.
   */
  export type Prettyfier = {
    /**
     * The value that represnts the whitespace character `\t`.
     * @type {string}
     * @readonly
     */
    readonly tab: string;
    /**
     * The value that represnts the whitespace character `\x20`.
     * @type {string}
     * @readonly
     */
    readonly space: string;
    /**
     * The value that represnts the whitespace character `\n` (`\r\n` in DOS).
     * @type {string}
     * @readonly
     */
    readonly newLine: string;
  };
  /**
   * Provided by a {@link Format formatter} to create a format that is reduced to only the essential characters
   */
  export type Minifier = {
    /**
     * A flag for allowing comments
     * @type {boolean}
     * @readonly
     */
    readonly retainComments: boolean;
    /**
     * The maximum number of lines a minified format can have
     * @type {boolean}
     * @readonly
     */
    readonly maxNumOfLines: number;
  };
  /**
   * Thrown when an error is detected in the {@link Expression}
   * interface
   */
  export class ExpressionError extends TypeError implements util.Predicatable {
    /**
     * Constructor the `ExpressionError` class
     * @param {string} msg a string detailing the reason for the error
     * @param {Error | undefined} cause this is the initial error that caused this
     * error to be trown
     */
    constructor(msg: string = "", cause?: Error) {
      super(msg + "\r\n" + cause?.stack);
    }
    public equals(obj: object | Object): boolean {
      let exprErr = obj as ExpressionError;
      return isValid(exprErr) && exprErr.message === this.message;
    }
  }
  /**
   * Thrown by the implementors of the {@link Format} interface
   * to indicate an error in the format or in one of the methods.
   */
  export class FormatError extends TypeError implements util.Predicatable {
    /**
     * Constructor the `FormatError` class
     * @param {string} msg a string detailing the reason for the error
     * @param {Error|undefined} cause this is the initial error that caused this
     * error to be trown
     */
    constructor(msg: string = "", cause?: Error) {
      super(msg + "\r\n" + cause?.stack);
    }
    public equals(obj: object | Object): boolean {
      let forErr = obj as FormatError;
      return isValid(forErr) && forErr.message === this.message;
    }
  }
  /**
   * @summary The result of calling {@link Parser.parse `parse`}.
   * @description
   * Represents an expression that was represented in string
   * such as `2 + 3`. Expressions are created by the `Parser`
   * interface which acts as a factory interface.
   * \
   * \
   * An `Expression` is meant to be implemented as an immutable
   * object. No method **SHOULD** mutate the contents of it's
   * format. For expressions that can be evaluated, it is recommended that
   * the object should implement the {@link Evaluatable} interface
   * then when `evaluate` is called, a new object should be returned
   * without mutating the state(s) of the caller.
   *
   * Extrinsic state
   * ================
   * This interface maintains an extrinsic state that is a {@link Format}
   * object. The reason for this is because an expression (with the
   * exception of leaf expressions/nodes) may contain multiple
   * (potentially unlimited) number of child expressions, and yet
   * the `Format` object is the same across all instances. This
   * approach causes is meant to reduce memory footprints.
   */
  export interface Expression
    extends util.Predicatable,
      util.Hashable {
    /**
     * Formats this expression to the given format. The recommended
     * implemenatation is to to call where the expression is not a
     * terminal expression otherwise if it is a terminal expression,
     * then `format.append` should recieve a language-specific
     * primitive (such as `number` or `string` in the case of javascript).
     * A terminal expression is an expression that can be reduced
     * (without loss of precision) to a primitive whereby during a single
     * call to `format.append` and has no ambiguity in the call. All
     * non-terminal expressions may use `format.append(this)` in this
     * method thereby delegating all formatting responsibilities
     * to the format argument. \
     * Note that to return the same format as the one this
     * was parsed from, you may implement a `Format` interface
     * that does exactly that. In this case it may
     * append the expression to the same format from
     * which it was parsed. For example if this is an
     * expression parsed from a JSON, then the same
     * JSON format is appended to the argument.
     * @param {Format} format an object that will dictate the method
     * in which this expression is formatted. \
     * This value may or may not hold
     * data. If it holds data, then it is expected to be
     * in the same format as the data from which this
     * expression was created.
     */
    format(format: Format): void;

    /**
     * Registers the given function with an id that will be called just before
     * formatting is done. If the id is already in this expression then this
     * listener replaces the one with the id.
     * @param id a unique identification number associated with this listener.
     * This helps to track the listener especially in the case of eventual
     * deletion where the precise listener may be required.
     * @param listener a `function` that will be called just before formatting
     * is done. This is callback (or hook) is called inside {@link format}
     */
    // registerOnFormat(
    //   id: number,
    //   listener: (expr: Expression, format: Format) => void
    // ): void;

    /**
     * Registers the given function with an id that will be called during
     * formatting. If the id is already in this expression then this
     * listener replaces the one with the id.
     * @param id a unique identification number associated with this listener.
     * This helps to track the listener especially in the case of eventual
     * deletion where the precise listener may be required.
     * @param listener a `function` that will be called during formatting.
     * This is called inside {@link format}
     */
    // registerOnFormatting(
    //   id: number,
    //   listener: (expr: Expression, format: Format) => void
    // ): void;

    /**
     * Registers the given function with an id that will be called just after
     * formatting is done. If the id is already in this expression then this
     * listener replaces the one with the id.
     * @param id a unique identification number associated with this listener.
     * This helps to track the listener especially in the case of eventual
     * deletion where the precise listener may be required.
     * @param listener a `function` that will be called just after formatting
     * is done. This is called inside {@link format}
     */
    // registerOnFormatted(
    //   id: number,
    //   listener: (expr: Expression, format: Format) => void
    // ): void;

    /**
     * Returns a string that will display debug info about this expression
     * @returns {string} debug info about this expression
     */
    debug(): string; //should be implemented on a concrete class
  }
  /**
   * A generic implementation of the {@link Expression} interface.
   * A notable addition to this class is params parameter in the
   * `format` method which tells the formatter how to format based
   * on the formatter object. This is done as a generic interface
   * to ensure scalability and adaptability. \
   * \
   * In addition to the {@link Format} parameter of the `Expression` interface (which is
   * overriden by this interface as a `GFormat` object) an extra
   * extrinsic state includes `P` (named as a `params` in parameters).
   * This may be an object that contains fields and are meant to act
   * as options.
   * @template F the type of format which will represent this class in usable form such as a string, an object or a file
   */
  export interface GExpression<F extends Format> extends Expression {
    /**
     * a generic override of the {@linkcode Expression.format} method. Formats this object to the given format and uses
     * the provided parameters as a guide for the formatter
     * @param {F} f a generic format object
     * @param {P} params the parameters injected into this
     * method as an extrinsic state of this object.
     * @template P A mutable visitor that allows this expression to gain readonly access to values from it's state that were set by a parser.
     */
    format<P = any>(f: F, s?: parser.Syntax, params?: P): void;
    /**
     * Registers the given function with an id that will be called just before
     * formatting is done. If the id is already in this expression then this
     * listener replaces the one with the id.
     * @param id a unique identification number associated with this listener.
     * This helps to track the listener especially in the case of eventual
     * deletion where the precise listener may be required.
     * @param listener a `function` that will be called just before formatting
     * is done. This is called inside {@link format}. This is an overriden method
     * from {@link Expression.registerOnFormat} that adds an extra `params`
     * parameter that supports the extrinsic state `P` of this interface.
     */
    // registerOnFormat<P>(
    //   id: number,
    //   listener: (
    //     expr: GExpression,
    //     format: GFormat<GExpression>,
    //     params: P
    //   ) => void
    // ): void;
    /**
     * Registers the given function with an id that will be called during
     * formatting. If the id is already in this expression then this
     * listener replaces the one with the id.
     * @param id a unique identification number associated with this listener.
     * This helps to track the listener especially in the case of eventual
     * deletion where the precise listener may be required.
     * @param listener a `function` that will be called during formatting
     *. This is called inside {@link format}. This is an overriden method
     * from {@link Expression.registerOnFormatting} that adds an extra `params`
     * parameter that supports the extrinsic state `P` of this interface.
     */
    // registerOnFormatting<P>(
    //   id: number,
    //   listener: (
    //     expr: GExpression,
    //     format: GFormat<GExpression>,
    //     params: P
    //   ) => void
    // ): void;
    /**
     * Registers the given function with an id that will be called just after
     * formatting is done. If the id is already in this expression then this
     * listener replaces the one with the id.
     * @param id a unique identification number associated with this listener.
     * This helps to track the listener especially in the case of eventual
     * deletion where the precise listener may be required.
     * @param listener a `function` that will be called just after formatting
     * is done. This is called inside {@link format}. This is an overriden method
     * from {@link Expression.registerOnFormatted} that adds an extra `params`
     * parameter that supports the extrinsic state `P` of this interface.
     */
    // registerOnFormatted<P>(
    //   id: number,
    //   listener: (
    //     expr: GExpression,
    //     format: GFormat<GExpression>,
    //     params: P
    //   ) => void
    // ): void;
  }
  /**
   * A format interface capable of recieving and interpreting
   * the data according to how it is implemented. The final data
   * may be gotten from a string representation, but that may not
   * be the actual representation of the data in it's most pure form.
   * For example the data may be in binary form.  Note thatwhen
   * the source is an `Expression`, then it may not be included
   * as a state in this object. A `Format` is the opposite of a {@link parser.Parser parser}
   * as it creates an external representation of the data created by a parser. \
   * \
   * It is expected that implementors implement this interface as
   * a mutable object for a fast exprerience for users, hence
   * whenever a mutation takes place, it should be recored
   * in the modifications property i.e whenever a mutator
   * is called. \
   * \
   * Binary endocing is partially supported by this class via
   * bits per character and bits per number. Full binary
   * encoding can be achieved by implemented classes and child
   * interfaces as that is not the main focus of this interface,
   * which is an abstract representation of a format. \
   * \
   * Implementors of this interface may throw a {@link FormatError}
   * on any method if an incompatible data is attempted to be
   * formatted by a user. Loggers, prettyfiers and minifiers may be provided however, their implementation is limited in this version and very experimental.
   */
  export interface Format extends util.Predicatable {
    /**
     * The in-memory representation of the data. This is either
     * a string, number, boolean, array or object so that it is
     * in a form that can be used in-memory and users can work with
     * the format directly in a normal javascript code.
     *
     * # Warning:
     * Because this is meant for use in-memory, this means that it potentially
     * contains unlimited number of data. Care should be taken when implementing
     * this as streams and file containing millions of lines of data may cause
     * performance issues, in cases such as these, symbolic representations may
     * be the solution rather than fitting the whole format into memory.
     *
     * @returns {any} an in-memory representation of all the bytes of data read into this format.
     */
    data(): any;
    /**
     * Gets the number of modifications done to this
     * format.
     */
    modifications: number;
    /**
     * Bits per character. This value is used
     * to determine the encoding type of a `string`.
     * This mostly for binary encoding.
     * @readonly
     */
    readonly bpc: number;
    /**
     * Bits per number. This value is used to
     * determine the binary encoding type of a
     * number.
     * @readonly
     */
    readonly bpn: number;

    /**
     * A {@link Prettyfier prettyfier} provided by formats that support string streaming such as file formats and string formats.
     * @type {Prettyfier}
     * @readonly
     */
    readonly prettyfier?: Prettyfier;
    /**
     * A {@link Minifier minifier} provided by formats that support string streaming such as file formats and string formats.
     * @type {Minifier}
     * @readonly
     */
    readonly minifier?: Minifier;
    /**
     * A {@link util.Messenger logger} used by formats to log info, errors and warnings during formatting. Note that the `isSealed` property will return `false` for this object when the formatting is yet to be completed and `true` when it is. Hence no logging may take place after the formatting is done.
     * @type {util.Messenger}
     * @readonly
     */
    readonly logger?: util.Messenger;

    /**
     * Parses the argument into a result and appends the result
     * to this object. This is a mutator.
     * @param {string|number|bigint|boolean|object|(string|number|bigint|boolean|object|undefined|null)[]|undefined|null} data the data in a compatible format
     * as this.
     * @returns {void}
     */
    append(
      data:
        | string
        | number
        | bigint
        | boolean
        | object
        | (string | number | bigint | boolean | object | undefined | null)[]
        | undefined
        | null
    ): void;

    /**
     * Returns a new `Format` object that has all the data written
     * into this object but in a reversed form without
     * changing this object.
     * @returns {Format} the reversed form of this `Format`
     */
    reverse(): Format;

    /**
     * Compares this format to the argument and returns
     * `true` if they are equal and `false` if otherwise.
     * @param {Format} another the format to be compared to this
     * @returns {boolean} `true` if this object is equal to the argument
     * and `false` if otherwise.
     */
    equals(another: Format): boolean;
    /**
     * Returns a uniquely identifiable number for this
     * `Format`
     * @returns a number that is unique to this `Format` object
     */
    hashCode32(): number;
    /**
     * Stringifies this object to a JSON format.
     * @returns a string in JSON format
     */
    toJSON(): string; //optional
  }
  /**
   * A generic implementation of the {@link Format} interface.
   * Whereby the data is a generic interface `T`
   * @template T a type of {@link Expression}
   * @template D the in-memory type of this format
   */
  export interface GFormat<T extends Expression, D>
    extends Format {
    /**
     * Parses the argument into a result and appends the result
     * to this object. This is a mutator.
     * @param {string | number | bigint | boolean | T | (string | number | bigint | boolean | T | undefined | null)[] | undefined | null} data a `T` data in a compatible format
     * as this.
     */
    append(data: | string | number | bigint | boolean | T | (string | number | bigint | boolean | T | undefined | null)[] | undefined | null): void;

    /**
     * @inheritdoc
     */
    data(): D;

    /**
     * Returns a new `GFormat` object that has all the data written
     * into this object but in a reversed form without
     * changing this object.
     * @returns {GFormat<T, D>} the reversedform of this `Format`
     */
    reverse(): GFormat<T, D>;

    /**
     * Compares this format to the argument and returns
     * `true` if they are equal and `false` if otherwise.
     * @param {GFormat<T, D>} another the generic format to be compared to this
     * @returns `true` if this object is equal to the argument
     * and `false` if otherwise.
     */
    equals(another: GFormat<T, D>): boolean;
  }
  /**
   * An interface that evaluates itself and returns an `Expression` object.
   * A typical way of implementing this interface is by extending as also as
   * an expression.
   */
  export interface Evaluatable extends util.Predicatable {
    /**
     * Computes this object and returns a valid `Expression` which represents the
     * result of the evalulation.
     * @return {Expression} an expression computed from this object
     */
    evaluate(): Expression;
  }
  /**
   * A generic version of the {@link Evaluatable} interface.
   * A notable addition to this class is `params` parameter in the
   * `evaluate` method which tells the formatter how to format based
   * on the formatter object. This is done as a generic interface
   * to ensure scalability and adaptability. \
   * \
   * This interface maintains an extrinsic property 'params` which
   * is a value that has the same function as the value of the same
   * name in the `GExpression` interface.
   * @template E
   * @see GExpression for more details on `params` as an extrinsic property
   * of this class.
   */
  export interface GEvaluatable<E extends Expression> extends Evaluatable {
    /**
     * Computes this object and returns a valid `GExpression` which represents the
     * result of the evalulation and uses
     * the provided parameters as a guide for the evaluation
     * @param {P} params the parameters injected into this
     * method as an extrinsic state of this object.
     * @template P
     * @returns {E}
     */
    evaluate<P>(params: P): E;
    /**
     * Computes this object and returns a valid `GExpression` which represents the
     * result of the evalulation.
     * @returns {E} an expression computed from this object
     */
    evaluate(): E;
  }
}

export default expression;
