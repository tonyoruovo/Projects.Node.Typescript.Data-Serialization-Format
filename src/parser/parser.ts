import { Transform, TransformCallback, TransformOptions } from "node:stream";
import { Transformer, TransformStream, ReadableStream, WritableStream, TransformStreamDefaultController, CountQueuingStrategy, ByteLengthQueuingStrategy, QueuingStrategy } from "node:stream/web";
import util from "../utility.js";
import exp from "./expression.js";
/**
 * @summary One of 2 foundational api for the mathaid-data-interchange project
 * @description
 * The documentation of this namespace features a pseudocode informally dubbed mathaid,
 * it is just the math syntax most people who encountered elementary math will be used to.
 * @remark
 * **Extrinsicity** (the act of using extrinsic states on an object) This
 * is used throughout the mathaid api to allow for limited memory objects.
 * Without extrinsic states, objects such as the {@link exp.Expression} interface
 * will have their memory baloon out of sizeable proportion preventing runs on
 * "potato" devices. It is recommended that implementors of the interfaces consider
 * using this design pattern frequently as this cause applications to be scalable
 * memorywise (in terms of RAM).
 */
namespace parser {
  /**
   * Parses the given `text` argument into a type given by the `format.data()` and returns that value. Althogh this method can probably be used to parse complex textual data, it is meant for simple single text.
   * @param {string} text the value to be parsed
   * @param {(text: string) => () => Token} tokenizer a functor that tokenizes the lexeme(s) and identifiers of `text` into valid {@link Token `Token`} objects and then returns a function that can retrive the tokens with each successive call.
   * @param {{data: () => any, append: (input: any, syntax: Syntax, params?: P) => void}} format a formatter of sorts. Please see the docs of the `expression` namespace for more about formatters.
   * @param {Syntax} syntax the syntax that will provide commands for the parsing
   * @param {P} [params] an object that complements the work of the `syntax` parameter. Can be left undefined, however if present, then `format.append` will recieve this object.
   * @template P a type of an object that may be used during parsing and formatting to update their states
   * @returns {any} the result of parsing `text`
   */
  export function parseText<P>(text: string, tokenizer: (text: string) => () => Token, format: {data: () => any, append: (input: any, syntax: Syntax, params?: P) => void}, syntax: Syntax, params?: P): any{
    const p = new PrattParser();
    const l = tokenizer(text);
    const e = p.parse(l as any, syntax as any, params);
    (e as any).format(format as any, syntax, params);
    return format.data();
  }

  export type Unicode = "utf-1" | "utf1" | "utf-7" | "utf7" | "utf-8" | "utf8" | "utf-16" | "utf16" | "utf16le" | "utf-16le" |  "utf-32" | "utf32" |  "utf-32le" | "utf32le" | "utf-64" | "utf64" | "utf-128" | "utf128" | "utf-ebcdic" | "utfebcdic";
  export type Encoding = Unicode | "ascii" | "scsu" | "bocu-1" | "bocu1" | "gb18030" | "binary";
  /**
   * Represents data info of a given source or syntax
   */
  export type Metadata = {
    /**
     * The expected encoding in the document to be parsed
     * @type {Encoding}
     * @readonly
     */
    readonly encoding: Encoding;
      /**
       * The file extension of the data, if it has one. This should not have any trailing dot(s)
       * @type {string}
       * @readonly
       */
      readonly fileExt: string;
      /**
       * The MIME type of the data parsed with this syntax.
       * @type {string}
       * @readonly
       */
      readonly mediaType: string;
      /**
       * Checks if the data parsed by this syntax is part of a web standard. Return `true` if it is and `false` otherwise.
       * @type {string}
       * @readonly
       */
      readonly isStandard: boolean;
      /**
       * A url to a resource such as an rfc webpage or a schema
       * @type {string}
       * @readonly
       */
      readonly standard: string;
  };

  /**
   * Class for throwing an error if the parser or lexer encounters one such
   * as an illegal token or character or wrong syntax.
   */
  export class ParseError extends TypeError {
    /**
     * Constructs a `ParseError` object
     * @param {string} msg A message detailing the cause
     * @param {Error|undefined} cause the error that caused this object to be thrown
     */
    constructor(msg: string = "", cause?: Error) {
      super(msg + "\r\n" + cause?.stack);
    }
  }
  /**
   * A specific type of `ParseError` that target syntax misuse.
   */
  export class SyntaxError extends ParseError {
    /**
     * Constructs a `SyntaxError` object.
     * @param {Token} token a {@link Token} object
     * @param {Error|undefined} cause the error that caused this object to be thrown
     */
    constructor(public readonly token: Token, cause?: Error) {
      super(util.isValid(cause) ? `The token after '${token.value}' was not parsed because of the following: ` :
        `Unexpected token "${token.value}" at line: ${token.lineStart}, position: ${token.startPos}`,
        cause
      );
    }
  }
  /**
   * @summary The parser command's directionality.
   * @description
   * This enum is used as an argument for
   * `Syntax.getCommand`. It's sole purpose is specify the parsing direction
   * when a command is given to parse a token. \
   * \
   * For instance consider the expression:
   * `2x + 8yz!`. If left-to-right parsing is done, then the tokens `2`, `x`, `8`, `y`
   * and `z` will all have a parsing direction of `PREFIX` while `+` will have a parsing
   * direction of `INFIX` and `!` may have the parsing direction of `POSTFIX`.
   * @remark
   * For now {@link Direction.POSTFIX} is not supported in the {@link PrattParser} class, however implementors
   * can use it in custom parsers.
   */
  export enum Direction {
    /**
     * The command direction for parsing prefix tokens
     */
    PREFIX = 0,
    /**
     * The command direction for parsing infix tokens
     */
    INFIX = 1,
    /**
     * The command direction for parsing postfix tokens. For now the {@link PrattParser} class does not support for this value
     * @alpha
     */
    POSTFIX = 2 
  }
  /**
   * @summary Represents the type of a token.
   * @description
   * An interface that represents the type that a token is associated with. This is done by the use of a `precedence` (used by {@link Parser parsers}) and an
   * optional `id` property. `Type` objects are usually created by lexers whi then appropriate them to `Token` objects, they are not meant to be created
   * manually. The precedence specifies -- to the parser -- how to parse infix tokens of the same `Direction`. An example of this is the
   * expression: `3 * 19 / 2 ^ 3`, which, without any parenthesis, ambiguity is certain because it can be parsed in the following different ways:
   * - `((3 * 19) / 2) ^ 3` (`*` has the highest precedence and `^` has the lowest precedence)
   * - `(3 * 19) / (2 ^ 3)` (`*` and `^` have a higher precedence than `/`)
   * - `3 * ((19 / 2) ^ 3)` (`/` has the highest precedence and `*` has the lowest precedence)
   * - `(3 * (19 / 2)) ^ 3` (`/` has the highest precedence and `^` has the lowest precedence)
   * - ... and so on
   * as shown above, without a precedence direction the parser on what operator has more priority, unexpected results may be produced.
   * Also, when an `id` property is available, tokens may be distinguished from one another, i.e
   * - `3` will be identified as a number
   * - `*` will be identified as an operator (and a binary one at that!)
   * - `1` and `9` will be identified as partial units that makeup a number
   * - ... and so on
   * Comparison is also provided via extension of the {@link util.Equalizer} interface so that users may compare 2 types for equality so that `3` is equal to
   * `19` but is not equal to `1` and `9` individually as `1` and `9` are number unit types and not numbers themselves. This the purpose of the `id` property.
   */
  export interface Type extends util.Equalizer {
    /**
     * A unique identifier for this type. It is recommended that this be a string
     * or a number. Basically it should be a value that can be uniquely identified.
     * _uniquely indentified_ here means that the `===` operator can work consistently
     * with this value.
     * @type {any}
     * @readonly
     */
    readonly id?: any;
    /**
     * @summary The precedence of this type for tokens where evaluation is neccessary and operators are present.
     * @description
     * A number that is generally intended for specifying a precedence for this `Type`.
     * Although the interpretaion of the magnitude-to-importance of this property is
     * left to implementors to define within their parsers, the general idea is that
     * higher values should be considered more important. \
     * \
     * When making use of the {@link PrattParser} class, values less than zero will not
     * be parsed if such a value is not prefix and the first in the expression and as
     * this value increases, the higher the precedence. Consider this example:
     * @example <caption>Generic mathematical notation</caption>
     * ```txt
     * 20! + (3/5)
     * ```
     * The first token here (`20`) is a number token and a prefix. It usually has the highest precedence.
     * The next is a unary postfix (`!`) whose precedence is of no effect as the next token is not a postfix
     * (i.e unless both types are {@link util.Equalizer equal}, precedence is not invoked), as such,
     * will be read immediately alongside it's predecessor (`20`). As the lexer continues to read tokens, all token
     * types must have a precedence higher than 0. The following list is a precedence table of the above expression:
     * 1. `20`  --> highest
     * 2. `!`   --> mid
     * 3. `+`   --> lower-mid
     * 4. `(`   --> N/A
     * 5. `3`   --> highest
     * 6. `/`   --> mid
     * 7. `5`   --> highest
     * 8. `)`   --> N/A causes all the contents of the opening parenthesis to be evaluated
     * The `)` helps the pratt parser break out of the parsing which would have thrown an error
     * considering how the `(` character would have been parsed.
     * @see
     * the documentation of this interface for a clearer example.
     * @type {number}
     */
    readonly precedence: number;
  }
  /**
   * @summary A generic child interface of {@link Type}
   * @description
   * A generic extension of the {@link Type `Type`} interface which allows users to specify the data type of {@link Type.id the id property}
   * @template T the type of the id. Complex ids can be created whereby a set of ids can consist of one base id and several child (or sub) - ids.
   * For example, all operators in the expression `-2! + 3` can have a single base id `OPERATOR` and unary operators can have the `UNARY`
   * operators be a child id of `OPERATOR` and then `-`, `+` and `!` will be `PREFIX`, `INFIX` and `POSTFIX` respectively, all inheriting from
   * their respective super ids (as it were).
   * @typeParam T - the type of the id. Complex ids can be created whereby a set of ids can consist of one base id and several child (or sub) - ids.
   * For example, all operators in the expression `-2! + 3` can have a single base id `OPERATOR` and unary operators can have the `UNARY`
   * operators be a child id of `OPERATOR` and then `-`, `+` and `!` will be `PREFIX`, `INFIX` and `POSTFIX` respectively, all inheriting from
   * their respective super ids (as it were).
   */
  export interface GType<T> extends Type {
    /**
     * @summary The unique value that identifies this type
     * @description
     * A unique identifier for this type. It is recommended that this be a string
     * or a number. Basically it should be a value that can be uniquely identified.
     * _uniquely indentified_ here means that the `===` operator can work consistently
     * with this value.
     * @type {T}
     */
    readonly id: T;
  }
  /**
   * @summary A token is an object created by a {@link Lexer} object from a source
   * @description
   * This interface represents parts/pieces of a given source (for example a string). `Token` objects are created when a {@link Lexer `Lexer`} splits a given source
   * into multiple parts/pieces, each of which is referred to by this documentation as a `Token`. Although tokens cannot be compared for equality, their `type`
   * property can, hence a token's intrinsic worth is it's `type` and `value` property. The rest properties may be provided for proper error construction and 
   * debugging purposes.
   */
  export interface Token {
    /**
     * The begining of the line from which the token
     * was read. The first value is generally 1.
     * @type {number | undefined}
     * @readonly
     */
    readonly lineStart?: number;
    /**
     * The last line from which this token was read.
     * In most cases this will be the same as `lineStart`, except for tokens that represent code blocks, for example the body of a function as a single token.
     * @type {number | undefined}
     * @readonly
     */
    readonly lineEnd?: number;
    /**
     * The index of the position within a line of the initial
     * character that is part of this token. For example
     * if `x + 1234.5` is a read by the lexer, then the token
     * representing `1234.5` will have `4` as the value of
     * this property.
     * @type {number | undefined}
     * @readonly
     */
    readonly startPos?: number;
    /**
     * The length (length of the string or the number of bits)
     * of this token
     * @type {number | undefined}
     * @readonly
     */
    readonly length?: number;
    /**
     * The intrinsic value of this token. This is the value that will be incoporated into an expression.
     * @type {any}
     * @readonly
     */
    readonly value: any;
    // readonly type: Array<Type>;
    /**
     * The type of this token
     * @type {Type | undefined}
     * @readonly
     */
    readonly type?: Type;
  }
  /**
   * @summary A Token with a generic interface.
   * @description
   * A generic extension of the {@link Token `Token`} interface which allows users to specify the data type of {@link Token.value the value property}
   * @template T the kind of value that this token wraps
   * @typeParam T - the kind of value that this token wraps
   */
  export interface GToken<T> extends Token {
    /**
     * The value that this object wraps
     * @type {T}
     * @readonly
     */
    readonly value: T;
  }
  /**
   * @summary A command issued by a {@link Parser `Parser`} to parse tokens.
   * @description
   * Commands are actions that specifically parse a selection of tokens. In the {@link PrattParser}, commands are retrieved from a {@link Syntax} for toekns
   * they can parse. This is an action that parsers apply to the token stack. This command must know
   * how to parse the next token and if it fails to do so, then a {@link ParseError}
   * will be thrown, this means that each command only knows how to parse a single token type. The types of commands vary from implementation-to-implementation,
   * but they are generally of 3 types as specified by the {@link Direction} given to
   * the {@link Syntax} object associated with the given parser. \
   * These usually created during instantiation of the `Syntax` object
   * (which really is just a factory of commands). This doubles as a command issued by
   * the `Parser` and as a factory for expressions
   * @remark
   * In the context of the {@link PrattParser} object, token types that don't that are unequal or have differing `Direction` should have commands dedicated to
   * them. There are 3 kinds of commands supported by the {@link PrattParser} class:
   * - __Prefix commands__: These will halt the parser when used and are only ever called to parse the first token in an expression. They only make use of the
   * `yetToBeParsed` parameter.
   * - __Infix commands__: These keep the parser working as long as the remaining tokens have a higher precedence thamn the one that triggered the call to this
   * command. They make use of `alreadyParsed` and `yetToBeParsed` as well as the `parser` parameters.
   * - __Postfix commands__: These are registered as infix during `Syntax` object instantiation, but are only invoked after _Prefix commands_ and/or after
   * _Infix commands_ and they will halt the parser after being called. They make use of the `alreadyParsed` and `yetToBeParsed` parameters, however they may
   * further mutate the former. \
   * \
   * An example of this is:
   * ```txt
   * 200%! - 1050
   * ```
   * The {@link PrattParser} will invoke the following commands
   * 1. _Prefix command_ to parse `200`
   * 2. _Postfix command_ (as defined as above) to parse`%` and `!`
   * 3. _Infix command_ to parse `-`, which will automatically parse `1050` as well
   */
  export interface Command {
    /**
     * A factory method that creates expressions when called by creating the
     * AST (abstract syntax tree).
     * @param {exp.Expression} alreadyParsed the `Expression` that was processed most recently
     * @param {Token} yetToBeParsed the next `Token` to be processed by this function
     * @param {Parser} parser the `Parser` issued this command
     * @param {Lexer} lexer the `Lexer` used by the parser that isssued this command
     * @param {Syntax} syntax the `Syntax` that contains all the grammar data for the formulation
     * of a valid expressioin by this command
     * @returns {exp.Expression} an expression each time it is called
     * {@label Command.parse}
     */
    parse(
      alreadyParsed: exp.Expression,
      yetToBeParsed: Token,
      parser: Parser,
      lexer: Lexer,
      syntax: Syntax
    ): exp.Expression;
  }
  
  /**
   * @summary The generic type of {@link Command}.
   * @description A {@link Command} functor that adds a params
   * object that may contains an unlimited number of arguments for the
   * parser and acts as a mutable visitor for this functor.
   * @template GT the type of the `Token` given
   * @template E the type of the `Expression` given
   * @template S the type of the `Syntax` given
   * @template L the type of the `Lexer` given
   * @template PR the type of the `Parser` given
   */
  export interface GCommand<
  GT extends Token,
  E extends exp.Expression,
  S extends Syntax,
  L extends Lexer,
  PR extends Parser> extends Command {
    /**
     * @inheritdoc
     * @override
     * Does the parsing as usual
     */
    parse(
      alreadyParsed: E,
      yetToBeParsed: GT,
      parser: PR,
      lexer: L,
      syntax: S): E;
    /**
     * Does the parsing as usual but includes an additional params object that
     * contains arguments used by the parser when creating tokens. 
     * @param {P} params an object that may contain arguments whose true meaning is
     * unique to the process being performed.
     * @param {E} alreadyParsed the `Expression` that was processed most recently
     * @param {GT} yetToBeParsed the next `Token` to be processed by this function
     * @param {PR} parser the `Parser` issued this command
     * @param {L} lexer the `Lexer` used by the parser that isssued this command
     * @param {S} syntax the `Syntax` that contains all the grammar data for the formulation
     * of a valid expressioin by this command
     * @template P the type of params object. A params object is a type of mutable visitor that may be
     * used to temporarily hold variables.
     * @returns {E} an `Expression`
     * {@label GCommand.parse}
     */
    parse<P>(
      alreadyParsed: E,
      yetToBeParsed: GT,
      parser: PR,
      lexer: L,
      syntax: S,
      params: P
    ): E;
  }
  /**
   * @summary A `Lexer` is a tokeniser of pieces from a source such as a file or a value.
   * @description An object creates tokens from a given source. This is a basic interpretation
   * of what a lexer is. \
   * \
   * The Lexer may contain a cursor that will split the source at certain points, then transform
   * the split piece(s) into a valid token which can be retrived using the {@link Lexer.next} method.
   * The expression `5a log 10b` can be parsed as follows:
   * |Position|Text|Token type|Remarks|
   * :---|:---:|:---:|---:|
   * |0|`5`|number|The lexer recognises this as a numerical token and tokenises it as such|
   * |1|`a`|free variable|This is tokenised into a variable because the syntax does not have a special reserved definition for it. Note that a multiplication token is created, this will be dealt with by the commands that will parse these tokens to make the lexer work fast|
   * |2|`log`|special function|The provided syntax alerts the lexer that this string is reserved as a function name (for advanced lexers, a params object may also hold info about the base of the `log` function)|
   * |5|`10`|number|Just as position 0, this is tokenised as a number|
   * |7|`b`|free variable|Just as position 1|
   */
  export interface Lexer {
    /**
     * @summary The value from which tokens are created.
     * @description
     * The property that is used to create tokens for the parser's consumption.
     * May be `null` for lean lexers that do not need bulky objects
     * in memory. These may opt to read directly from an external
     * source and then return the value as a token inside the
     * {@link next} method as opposed to initialising the whole
     * source inside this object.
     * @type {any}
     * @readonly
     */
    readonly src?: any;

    /**
     * @method
     * Gets the current position within a line that the cursor exists in and returns
     * it as a zero-based index value. This means that the first value is 0
     * and the last value is `totalNumOfCharacters[line()] - 1`.
     *
     * @returns {number} returns the cursor's position number i.e the position of the
     * last character read in the cureent line of the source.
     */
    position(): number;
    /**
     * Gets the current line that the cursor exists in and returns
     * it as a zero-based index value. This means that the first line is 0
     * and the last line is `total num of lines - 1`.
     *
     * @returns {number} returns the cursor's line number i.e the line of the
     * source file that is currently being read.
     */
    line(): number;

    /**
     * Advances the cursor forward and reads all the characters from the
     * previous position of the cursor to the advanced position, then
     * returns all the characters read as a valid {@link Token} object
     * or throws an error to indicate a syntax error. It is advisable
     * that this method as returns a token even if the source has stopped
     * emitting values, this will prevent end-users from performing costly
     * checks for available tokens, however, it is not compulsory that valid
     * tokens must always be returned as a special end-of-file/stream token
     * may be returned to signify that the source has stopped emitting.
     * @param {Syntax} syntax a streamlining object that tells this lexer what a
     * valid syntax is.
     * @returns {Token} a `Token` object wrapping all the characters read if the
     * the characters are a valid token considering the given `Syntax`
     * object
     */
    next(syntax?: Syntax): Token;
    /**
     * Registers a listener that will be fired just before `next` is called. Note that if this
     * method is called more than once with the same id as argument, then previous call(s) are
     * removed and only the latest is registered.
     * @param fn a function to call just before `next` is called. It has the
     * following parameters:
     * 1. `line` the line number from which the lexer is currently reading. This is also specified by {@link line()}.
     * 2. `position` the position within the line as specified by {@link position()}.
     * 3. `estimatedSize` a number specifying the size/number of characters/number of bits of items that this `Lexer` will tranform to token(s).
     * @param {number} id an optional identification used to track this function
     * @returns {number} the id registered to the function, if a valid id was presented, then that value is returned
     */
    // onNextRead(fn: (line?: number, position?: number, estimatedSize?: number) => void, id?: number): number;
    /**
     * Registers a listener that will be fired just as `next` is called. Note that if this
     * method is called more than once with the same id as argument, then previous call(s) are
     * removed and only the latest is registered.
     * @param fn a function to call just as `next` is called. It has the
     * following parameters:
     * - `rawToken` the intrinsic value of the token being read as specified by {@link Token.value}.
     * @param {number} id an optional identification used to track this function
     * @returns {number} the id registered to the function, if a valid id was presented, then that value is returned
     */
    // onReading(fn: (rawToken?: any) => void, id?: number): number;
    /**
     * Registers a listener that will be fired after `next` is called. Note that if this
     * method is called more than once with the same id as argument, then previous call(s) are
     * removed and only the latest is registered.
     * @param fn a function to call after `next` is called. It has the
     * following parameters:
     * - `err` any error that occured during the reading.
     * - `type` the type of the token that was read as specified by {@link Token.type}.
     * @param {number} id an optional identification used to track this function
     * @returns {number} the id registered to the function, if a valid id was presented, then that value is returned
     */
    // onRead(fn: (err?: Error, type?: Type) => void, id?: number): number;
  }
  /**
   * @summary A {@link Lexer} with a generic interface.
   * @description A generic extension of the {@link Lexer} interface with additional parameter for the `parse` method.
   * @template GT the type of the `GToken` given
   * @template S the type of the `GSyntax` given
   */
  export interface GLexer<
    GT extends Token,
    S extends Syntax
  > extends Lexer {
    /**
     * Searches the source of this Lexer and returns the next valid token depeding on the
     * argument(s)
     * @param {S} syntax a data object that contains all the grammar used for checking the syntax
     * @param {P} params a data object that contains values specific to this reading session
     * @template P the type of params object that represents a mutable visitor that allows a `Lexer` visited to read and update it's state during the call to `next()` so that other methods can gain access to the same saved state(s) thereby creating a global state extrinsically. A params object is an options object that is specific
     * to the current value being parsed.
     * @returns {GT} a generic token after a successful read
     */
    next<P>(syntax?: S, params?: P): GT;
  }
  /**
   * @summary A type of a {@link Lexer} that allows for adding to or removing from the source
   * @description 
   * An interface that extends the {@link GLexer} interface to provide mutability of the `src` property.
   * In this interface, calling `next` immediately after object instantiation will cause the lexer to enter end-of-file/stream mode, instead, `process`
   * should first be called to inject data into the `src` property which in most cases will allow for subsequent injection, this is how mutability is
   * achieved. This enables the lexer to "wait" for data from a source that may not be ready for the lexer yet and allows support for gradual tokenisation
   * @template T the `Token` type which will be created from the data recieved
   * @template S the `Syntax` type which is used during tokensation of the data inside the `process` method. 
   * @template CHUNK the type of data accepted as the first argument by the `process` method. The default is a `string`
   */
  export interface MutableLexer<T extends Token, S extends Syntax, CHUNK = string> extends GLexer<T, S>{
    /**
     * @summary Gets and returns the list of tokens that have already been processed.
     * @description
     * Return the token buffer which contains tokens processed from `process` calls
     * Each time `processed` is called, tokens are created and these tokens are pushed into the token buffer awaiting a parser to call the `next`method of this
     * lexer and consume them. This token buffer then returned as an array each time this method is called. Please note that an empty buffer does not mean processing
     * has completed or that processing is yet to begin.
     * @returns {T[]} an array of already processed `Token` objects or an empty array if ther is no token in the token buffer
     */
    processed: () => T[];
    /**The same as {@link src} */
    unprocessed: () => any;
    /**
     * Traverses the token buffer and returns the number of times a `Token` with the given `Type` occurs in the buffer.
     * @param {Type} type The type to search for
     * @returns {number} a value greater than 0 if the specified `Type` occurs at least once else returns 0
     */
    frequency(type: Type): number;
    /**
     * Traverses the `Token` buffer and returns the first index (from the start) in which the token with the given type occurs
     * @param {Type} type The type to search for
     * @returns {number} the first index of the token with the given type or returns -1 if no token with the specified type was found
     */
    indexOf(type: Type): number;
    /**
     * Traverses the `Token` buffer and returns the last index (from the start) in which the token with the given type occurs
     * @param {Type} type The type to search for
     * @returns {number} the last index of the token with the given type or returns -1 if no token with the specified type was found
     */
    lastIndexOf(type: Type): number;
    /**
     * Analyses and processes the provided `chunk` value and (if possible) fills the token buffer with tokens produced from the processing.
     * @param {CHUNK} chunk the piece of data to analyse
     * @param {Syntax} syntax the provided syntax for this operation
     * @param {P} params the provided params object for this operation
     * @template P a mutable visitor that assists in this method by allowing this lexer to read and update it's state
     */
    process<P>(chunk: CHUNK, syntax: S, params: P): void;
    /**
     * Finalises this lexer and signals an end to the processing. For some lexers, this will prevent `process`  from ever being called again.
     * @param {Syntax} syntax the provided syntax for this operation
     * @param {P} params the provided params object for this operation
     * @template P a mutable visitor that assists in this method by allowing this lexer to read and update it's state
     */
    end<P>(syntax: S, params: P): void;
    /**
     * A check for whether tokens are `waiting` in the buffer
     * @returns {boolean} `true` if there is at least one token in the token buffer otherwise returns `false`
     */
    hasTokens(): boolean;
    /**
     * A check for whether this lexer is in a state where it can accept and process data
     * @returns {boolean} `true` if this can process more data and `false` if otherwise
     */
    canProcess(): boolean;
  }
  /**
   * @summary An immutable object that contains the rules for creating tokens, expressions and formatting expressions.
   * @description
   * A factory of parse actions which may also act as a data object for the Lexer
   * during reading of tokens, which contains all the values used by the grammar
   * to check the syntax of a Lexer and a Parser. A `Syntax` may contain a list of reserved keywords, reserved functions and other options specific to the user's use case,
   * for example a syntax object may tell if a parser may support implicit multiplication such as `6a` or only explicit such as `6 * a`. \
   * \
   * A `Syntax` covers how data is tranformed into tokens, how parsers use commands and how commands will create expressions and how those expressions
   * are formatted. The `Syntax` object governs the parsing process.
   * @remark
   * This object is expected to be immutable such that no changes should be made to it to alter it's properties after it has been instantiated.
   */
  export interface Syntax {
    /**
     * Gets the appropriate `Command` that will be used for parsing a
     * specific token into an expression. Care should be taken so that no `Type`
     * should be mapped to the same `Command` and direction. Doing this creates ambiguity and
     * short-circuits the syntax such that it's behaviour becomes unpredictable.
     * For example in the following state: \
     * \
     * `2x = 10y` \
     * \
     * `x` will result in an error during parsing if it is the same type with `2`and both
     * are prefixes (can start an expression) because this method will return the first prefix
     * command it can find for this type when queried.
     * @param {Direction} direction the direction which specifies the kind of command to get.
     * For example, infix parsers may be returned by using `Direction.INFIX` as
     * argument here.
     * @param {Type} type the type of token this command will parse.
     * @returns {Command|undefined} a `Command` that may be used to tranform a specific type
     * of token or returns undefined if the command was not found with the given arguments
     */
    getCommand(direction: Direction, type: Type): Command | undefined;
    /**
     * Metadata info associated with the data parsed with this syntax.
     * @readonly
     */
    readonly metadata?: Metadata;
  }
  /**
   * A generic version of the `Syntax`
   * @template TY the type of the `GType` given
   * @template C the type of the `GCommand` given
   */
  export interface GSyntax<
  TY extends Type,
  C extends Command> extends Syntax {
    /**@inheritdoc */
    getCommand(direction: Direction, type: TY): C | undefined;
  }
  /**
   * @summary Creates expressions from tokens provided by a lexer.
   * @description
   * A Parser is an object that queries a lexer for token(s) which it then turns into {@link exp.Expression `Expression`} objects. A Parser is basically an abstract
   * factory of expressions while the command is the factory of expression. \
   * \
   * A parser is the opposite of a {@link exp.Format formatter} as it creates an internal representation of a data format.
   */
  export interface Parser {
    /**
     * Consume, Parse and Repeat on the tokens generated by the given Lexer, until
     * a valid abstract syntax tree is formed by the expression object returned.
     * @param {Lexer} lexer a token factory for this parser
     * @param {Syntax} syntax an object that knows which command is appropriate for a given
     * token to be parsed into an expression
     * @return {exp.Expression} returns an expression object that represents the
     * AST (Abstract Syntax Tree).
     * {@label Parser.parse}
     */
    parse(lexer: Lexer, syntax: Syntax): exp.Expression;
  }
  /**
   * A generic form of the `Parser` interface with an additional method overload.
   * @template E the type of the `GExpression` given
   * @template S the type of the `GSyntax` given
   * @template L the type of the `GLexer` given
   */
  export interface GParser<
  E extends exp.Expression,
  S extends Syntax,
  L extends Lexer
  > extends Parser {
    /**
     * In addition to consuming, parsing and generating exprssions, this method
     * also feeds a parameter object to the commands.
     * @param {L} lexer The token generator a.k.a the `Tokenizer`
     * @param {S} syntax The comand factory
     * @param  {P} params parameter object that contains data for the parse commands
     * @template P the type of params object. A params object is an options object that is specific
     * to the current value being parsed. This is also a mutable visitor that allows this parser to read and update it's state during `parse` so that other methods can gain access to the same state thereby creating a global state extrinsically.
     * @returns {E} a specific type of expression created by this parser that is
     * the AST of the values parsed
     * {@label GParser.parse}
     */
    parse<P>(lexer: L, syntax: S, params?: P): E;
  }
  /**
   * @summary An implementation of the Vaughn Pratt's parser, which parses {@link Token tokens} into an Abstract Syntax Tree (AST).
   * @description
   * This is a typescript implementation of Vaughn Pratt's recursive descent parser. It implements the {@link GParser} interface.
   * @template E the type of expression returned by `parse`
   * @template S the type of syntax to use
   * @template TV the type of {@link GToken.value token value}. The default is a `string`
   */
  export class PrattParser<
    E extends exp.Expression,
    S extends GSyntax<Type, GCommand<GToken<TV>, E, S, GLexer<GToken<TV>, S>, PrattParser<E, S, TV>>>,
    TV = string,
  > implements GParser<E, S, GLexer<GToken<TV>, S>>
  {
    private ii = 0;
    // parse(lexer: GLexer<GToken<TV>, S>, syntax: S): E;
    /**
     * Prompts the provided Lexer for tokens and parses the results into an expression.
     * @ignore
     * 1. The first token parsed by this method is expected to be a prefix token. Prefix tokens are tokens that will always start an expression such numbers
     * variable names, prefix (such as pre-increment/decrement) operators and prefix keywords. If this token fails to retrieve the corresponding prefix command,
     * a syntactic error is thrown.
     * 2. The command for this type is retrieved from the syntax and the parsed into an expression. This expression becomes the left-side expression.
     * 3. The parser continues to search for the next token whose precedence is greater than zero. When a token's type's precedence is less than zero, then a valid AST is returned.
     * \
     * \
     * Note that for the above to work properly, the following should generally be observed:
     * - all prefix commands (a prefix command is a command that is retrieved from the syntax using `syntax.getCommand(Direction.PREFIX, type)`)
     * should not call this method and should not query the lexer (to query the lexer is to call it's next method).
     * - all infix commands (an infix command is a command that is retrieved from the syntax using `syntax.getCommand(Direction.INFIX, type)`)
     * should call {@link parseWithPrecedence this method} instead if another token is ahead of them otherwise they are considered postfix and should act like prefix command. These
     * should not also query the lexer. When calling the {@link parseWithPrecedence recommended parse method}, the precedence of the token about to be parsed should be the argument
     * for the first parameter of that method.
     * - all postfix commands (a postfix command is an infix command that acts like a prefix and does not call `parse` within) can
     * not call this method but should act like prefix commands.
     * @param {GLexer<GToken<TV>, S>} lexer The token generator
     * @param {S} syntax The comand factory
     * @param  {P} params parameter object that contains data for the parse commands
     * @template P the type of params object. A params object is an options object that is specific
     * to the current value being parsed. This is also a mutable visitor that allows this parser to read and update it's state during `parse()`, `parseWithPrecedence()`, `consume()`, `match()`, `readAndPop()` and `readAndPeek()`, so that other methods can gain access to the same state thereby creating a global state extrinsically.
     * @returns {E} a specific type of expression created by this parser that is
     * the AST of the values parsed
     */
    parse<P>(lexer: GLexer<GToken<TV>, S>, syntax: S, params?: P): E {
      return this.parseWithPrecedence(0, lexer as GLexer<GToken<TV>, S>, syntax as S, params);
    }

    /**
     * Parses tokens generated by the provided Lexer into an expression
     * where the parsing will go as long as the next token generated by
     * the token factory is a type that has higher precedence (as
     * specified by {@link Type.precedence}) then the provided `beginingPrecedence`
     * argument.
     * @param {number} beginingPrecedence the smallest precedence this parser may regard. When
     * the parser encounters values with precedence equal to or less than this value,
     * the parsing stops and the generated AST is returned.
     * @param {GLexer<GToken<TV>, S>} l the token factory
     * @param {Syntax} s the command factory
     * @param {P} params parameter object that contains data for the parse commands
     * @template P the type of params object
     * @returns {E} a specific type of expression created by this parser that is
     * the AST of the values parsed
     */
    public parseWithPrecedence<P>(beginingPrecedence: number, l: GLexer<GToken<TV>, S>, s: S, params: P): E {
      // the first token
      let t = this.readAndPop(l, s, params);
      // console.log(`first: ${t.value}`);
      //must be a prefix
      const prefix = s.getCommand(Direction.PREFIX, t.type!);

      if (prefix === null || prefix === undefined) throw new SyntaxError(t);

      //convert it to an expression
      let left = prefix.parse(undefined as unknown as E, t, this, l, s, params);

      //read more tokens with higher precedence than the input
      while (beginingPrecedence < this.getPrecedence(l, s, params)) {
        //The next token
        t = this.readAndPop(l, s, params);
        // console.log(`second: ${t.value}`);
        // is expected to be an infix
        const infix = s.getCommand(Direction.INFIX, t.type!)!;
        //!!!Expreimental!!!
        // if(infix) left = infix.parse(left, t, this, l, s, params);
        //or a postfix which ends the expression
        // else {
        //   const postfix = s.getCommand(Direction.POSTFIX, t.type!);
        //   if(util.isValid(postfix)) left = postfix!.parse(left, t, this, l, s, params);
        //   break;
        // }
        left = infix.parse(left, t, this, l, s, params);
      }
      // console.log(this.ii++);
      // console.log(left);
      // console.log("\r\n");
      return left;
    }

    /**
     * Requests the given Lexer object to generate a token, pushes it into the waiting stack awaiting processing,
     * inspects the waiting token whether it is the same as the expected token, if it is, then removes the waiting token
     * from the stack into the processing queue to be parse, if it isn't, then a `SyntaxError` is thrown.
     * @param expected the type of token this parser expects to consume
     * @param l the token generator
     * @param s a syntax for the token generator
     * @param {P} params parameter object that contains data for the parse commands
     * @template P the type of params object. A params object is an options object that is specific
     * to the current value being parsed.
     * @returns {GToken<string, string>} a valid token ready to be processed
     * @throws {Error} throws if `expected` was not found in the {@link GLexer} argument
     */
    public consume<P>(
      expected: GType<any>,
      l: GLexer<GToken<TV>, S>,
      s: S,
      params: P
    ): GToken<TV> {
      const t = this.readAndPeek(0, l, s, params);
      // if (!t.type!.equals(expected)) throw new SyntaxError(t);
      if (!t.type!.equals(expected)) throw new Error(`Expected: ${expected} but got ${t.type} as ${t.value}.\n at line: ${t.lineStart}, position: ${t.startPos}`);
      return this.readAndPop(l, s, params);
    }

    /**
     * Tests whether the given next token is the same as the argument
     * and returns `true` if it is otherwise returns `false`
     * @param expected the type of token this parser expects to consume
     * @param l the token generator
     * @param s a syntax for the token generator
     * @param {P} params parameter object that contains data for the parse commands
     * @template P the type of params object. A params object is an options object that is specific
     * to the current value being parsed.
     * @returns {boolean} a truthy for a match found
     */
    public match<P>(expected: GType<any>, l: GLexer<GToken<TV>, S>, s: S, params: P): boolean {
      const t = this.readAndPeek(0, l, s, params);
      if (!t.type!.equals(expected)) return false;
      return true;
    }

    /**
     * Gets the precedence of the next token to be consumed. That is basically
     * the token on the processing queue.
     * @param l the token generator
     * @param s a syntax for the token generator
     * @param {P} params parameter object that contains data for the parse commands
     * @template P the type of params object. A params object is an options object that is specific
     * to the current value being parsed.
     * @returns {number} the precedence of the next token to be consumes
     */
    private getPrecedence<P>(l: GLexer<GToken<TV>, S>, s: S, params: P): number {
      // const token = this.readAndPeek(0, l, s, params);
      const cmd = s.getCommand(Direction.INFIX, this.readAndPeek(0, l, s, params).type!);
      // const cmd = s.getCommand(Direction.INFIX, token.type!);
      // || s.getCommand(Direction.POSTFIX, token.type!);
      if (util.isValid(cmd))
        return this.readAndPeek(0, l, s, params).type!.precedence;
      return 0;
    }

    /**
     * Removes a token from the preocessing queue, discards it and returns the next token on the
     * waiting stack
     * @param l the token generator
     * @param s a syntax for the token generator
     * @param {P} params parameter object that contains data for the parse commands
     * @template P the type of params object. A params object is an options object that is specific
     * to the current value being parsed.
     * @returns {GToken<string, string>} return the topmost token on the waiting stack
     */
    protected readAndPop<P>(l: GLexer<GToken<TV>, S>, s: S, params: P): GToken<TV> {
      this.readAndPeek(0, l, s, params);
      return this.#stack.shift()!;
      // return this.#stack.pop()!;
    }

    /**
     * Causes the token generator to generate a token and then pushes it into the stack
     * and returns that same token.
     * @param distance the number of tokens to generate
     * @param l the token generator
     * @param s a syntax for the token generator
     * @param {P} params parameter object that contains data for the parse commands
     * @template P the type of params object. A params object is an options object that is specific
     * to the current value being parsed.
     * @returns {GToken<string, string>} returns the last token generated that is also the topmost token
     * on the stack but does not remove it from the stack
     */
    protected readAndPeek<P>(
      distance: number,
      l: GLexer<GToken<TV>, S>,
      s: S,
      params: P
    ): GToken<TV> {
      while (distance >= this.#stack.length) this.#stack.push(l.next(s, params));
      return this.#stack[distance];
    }

    /**
     * The token stack
     * @readonly
     * @type {GToken<string, string>[]}
     */
    readonly #stack: GToken<TV>[] = [];
  }
  /**
   * @summary A class that converts data from one stream into expression in another
   * @description
   * An abstract class that extends the {@link Transform} class to provide basic support for `NodeJS.ReadableStream` and `NodeJS.WritableStream` which means that objects
   * created from this class can be involved in a stream in the `stream` module of node.js. It's purpose is to enable users to parse data directly from the web or any stream
   * source as opposed to getting the data to be come locally available first before conversion. The following example demonstrates a basic usage:
   * @example
   * #### create a concrete implementation and instantiate it
   * ```ts
   * type MyOptions = {readableObjectMode: boolean, writableObjectMode: boolean, readableHighWaterMark: number, writableHighWaterMark: number, allowHalfOpen: boolean}
   * class MyConverter extends AbstractConverter<MySyntax, MyParams> {
   *  constructor(options: MyOptions = {}, s: MySyntax, p: MyParams){
   *    super(options, s, p);
   *  }
   * //... implement both _flush and _transform
   * }
   * const o = //.. create a valid options object
   * const s = new MySyntax();
   * const p = new MyParams();
   * const conv = new MyConverter(o, s, p);
   * ```
   * #### Usage in node https
   * ```ts
   * //https is from the 'node:https' module
   * https.get("http://www.example.com/resource/a_certain_json", res => {
   *  res.pipe(conv).pipe(process.stdout);
   * });
   * ```
   * #### Usage in node stream
   * ```ts
   * const fileName = "file.json";
   * //fs is from the 'node:fs' module
   * const stream = fs.createReadStream(fileName);
   * stream.pipe(conv).pipe(process.stdout);
   * ```
   * #### Usage in the `fetch` api (WHATWG web streams)
   * ```ts
   * const url = "http://www.example.com/resource/a_certain_json";
   * //Duplex is found in the 'node:stream' module
   * //TransformStream and ReadableWritablePair are found in the 'node:stream/web' module
   * const webStream = Duplex.toWeb(conv) as any as ReadableWritablePair<any, any>;
   * //or
   * //const webStream = Duplex.toWeb(conv) as any as TransformStream<any, any>;
   * const res = await fetch(url);
   * await res.body.pipeThrough(webStream).pipeTo(Duplex.toWeb(Duplex.from(process.stdout)));
   * ```
   * The outputs of this stream are expected to be {@link exp.Expression expression} objects \
   * \
   * For suituations where a user may need to bypass usage of a lexer and parser
   * to work with data, this class should be favoured over {@link Converter}
   * @template S the type of {@link Syntax} object to be used
   * @template P the type of {@link AbstractConverter.params} object to be used
   */
  export abstract class AbstractConverter<S extends Syntax, P = any> extends Transform {
    /**
     * Abstract constructor to instantiate properties of the `AbstractConverter` class.
     * @param {TransformOptions} options a standin object that may act as the implementation of the {@link Transoform} class. When implementors extend this class,
     * They do not need to provide this option as the only useful properties of this option are `readableObjectMode`, `writableObjectMode`, `readableHighWaterMark`,
     * `writableHighWaterMark` and `allowHalfOpen`.
     * @param {S} syntax an internal `Syntax` object that controls the conversion process
     * @param {P} params an object that may act as a mutable visitor
     */
    constructor(options: TransformOptions, public readonly syntax: S, public params: P){
      super(options);
    }
    /**
     * @summary transforms the `chunk` argument and uses the result as an argumtn for the provided `callback`
     * @description
     * #### Copied from [nodejs.org](https://www.nodejs.org)
     * This function MUST NOT be called by application code directly. It should be implemented by child classes, and called by the internal `Readable` class methods only. \
     * \
     * All Transform stream implementations must provide a `_transform()` method to accept input and produce output. The `transform._transform()` implementation handles the
     * bytes being written, computes an output, then passes that output off to the readable portion using the `transform.push()` method. \
     * \
     * The `transform.push()` method may be called zero or more times to generate output from a single input chunk, depending on how much is to be output as a result of the chunk. \
     * \
     * It is possible that no output is generated from any given chunk of input data. \
     * \
     * The `callback` function must be called only when the current chunk is completely consumed. The first argument passed to the `callback` must be an `Error`
     * object if an error occurred while processing the input or `null` otherwise. If a second argument is passed to the `callback`, it will be forwarded on to the
     * `transform.push()` method. In other words, the following are equivalent:
     * ```js
     * transform.prototype._transform = function(data, encoding, callback) {
     *  this.push(data);
     *  callback();
     * };
     * 
     * transform.prototype._transform = function(data, encoding, callback) {
     *  callback(null, data);
     * }; 
     * ```
     * The `transform._transform()` method is prefixed with an underscore because it is internal to the class that defines it, and should never be called directly
     * by user programs. \
     * \
     * `transform._transform()` is never called in parallel; streams implement a queue mechanism, and to receive the next chunk, callback must be called, either
     * synchronously or asynchronously.
     * @param {Buffer | string | any} chunk The `Buffer` to be transformed, converted from the `string` passed to {@link Transform.write `stream.write()`}. If the stream's decodeStrings
     * option is false or the stream is operating in object mode, the chunk will not be converted & will be whatever was passed to {@link Transform.write `stream.write()`}.
     * @param {BufferEncoding} encoding  If the chunk is a `string`, then this is the encoding type. If chunk is a `Buffer`, then this is the special value
     * `'buffer'`. Ignore it in that case.
     * @param {TransformCallback} callback A callback function (optionally with an error argument and data) to be called after the supplied `chunk` has
     * been processed.
     */
    abstract _transform(chunk: Buffer | string | any, encoding: BufferEncoding, callback: TransformCallback): void;
    /**
     * @summary Ends the tranfer and flushes any remaining data to the output destination.
     * @description
     * #### Copied from [nodejs.org](https://www.nodejs.org)
     * This function MUST NOT be called by application code directly. It should be implemented by child classes, and called by the internal
     * `Readable` class methods only. \
     * \
     * In some cases, a transform operation may need to emit an additional bit of data at the end of the stream. For example, a `zlib` compression stream will
     * store an amount of internal state used to optimally compress the output. When the stream ends, however, that additional data needs to be flushed so that
     * the compressed data will be complete. \
     * \
     * Custom {@link Transform} implementations may implement the `transform._flush()` method. This will be called when there is no more written data to be consumed,
     * but before the `'end'` event is emitted signaling the end of the `Readable` stream. \
     * \
     * Within the `transform._flush()` implementation, the `transform.push()` method may be called zero or more times, as appropriate. The `callback` function must
     * be called when the flush operation is complete. \
     * \
     * The `transform._flush()` method is prefixed with an underscore because it is internal to the class that defines it, and should never be called
     * directly by user programs
     * @param {TransformCallback} callback A callback function (optionally with an error argument and data) to be called when remaining data has been flushed.
     */
    abstract _flush(callback: TransformCallback): void;
  }
  /**
   * @summary A less basic extension of the {@link Transform} class
   * @description
   * A class that divides the load of conversion between a given lexer and a parser. The Lexer process the data from {@link _transform} and the Parser produces
   * {@link exp.Expression expression} objects from the lexer's results.
   * @template Tk the type of token that the lexer will create
   * @template E the type of expression that the parse will produce
   * @template S the type of Syntax used by this class
   * @template P the type of PrattParser to be used by this class
   * @template PARAMS the type of params object for this class
   * @template ML the type of MutableLexer for this class
   * @template C the type of data to be recieved by the lexer
   * @template TV the type of value within the tokens produced by the lexer
   */
  export abstract class Converter<Tk extends Token, E extends exp.Expression,
  S extends GSyntax<Type, GCommand<GToken<TV>, E, S, ML, P>>,
  P extends PrattParser<E, S, TV>, PARAMS, ML extends MutableLexer<Tk, S, C>, C, TV = string>  extends AbstractConverter<S, PARAMS> {
    constructor(options: TransformOptions, public readonly lexer: ML, public readonly parser: P, syntax: S, params: PARAMS){
      super(options, syntax, params);
    }
  }
  /**
   * @summary A basic `Transformer` interface implementation to provide support for the `fetch` api.
   * @description An abstract class which provides the basic structure for implementation of a [WHATWG streams standard](https://streams.spec.whatwg.org) that can be
   * used with the `fetch` api both in node and javascript web.
   * @remark
   * All the documentation for the members of this class have been copied from <https://nodejs.org>
   * ### COPIED FROM [NODEJS.ORG](https://nodejs.org)
   * 
   * A `TransformStream` consists of a {@link ReadableStream} and a {@link WritableStream} that are connected such that the data
   * written to the `WritableStream` is received, and potentially transformed, before being pushed into the `ReadableStream`'s queue.
   * @see {@link AbstractConverter} for examples on how to use with the fetch api. Note that no conversion to a `Duplex` object is required.
   */
  export abstract class AbstractTransformer<I = any, O extends exp.Expression = exp.Expression> implements Transformer<I, O> {
    /**
     * The `readableType` option is reserved for future use and must be `undefined`.
     * @type {undefined}
     * @readonly
     */
    readonly readableType: undefined = undefined;
    /**
     * The `writableType` option is reserved for future use and must be `undefined`.
     * @type {undefined}
     * @readonly
     */
    readonly writableType: undefined = undefined;
    /**
     * A user-defined function that is invoked immediately when the `TransformStream` is created.
     * @param {TransformStreamDefaultController<O>} controller The `TransformStreamDefaultController` manages the internal state of the `TransformStream`
     * @returns {void | PromiseLike<void>} `undefined` or a promise fulfilled with `undefined`
     */
    public abstract start(controller: TransformStreamDefaultController<O>): void | PromiseLike<void>;
    /**
     * A user-defined function that receives, and potentially modifies, a chunk of data written to {@link TransformStream.writable}, before forwarding
     * that on to {@link TransformStream.readable}.
     * @param {I} chunk a piece of the input data
     * @param {TransformStreamDefaultController} controller The `TransformStreamDefaultController` manages the internal state of the `TransformStream`
     * @returns {void | PromiseLike<void>} A promise fulfilled with `undefined`
     */
    public abstract transform(chunk: I, controller: TransformStreamDefaultController<O>): void | PromiseLike<void>;
    /**
     * A user-defined function that is called immediately before the writable side of the `TransformStream` is closed, signaling the end of the transformation process.
     * @param {TransformStreamDefaultController} controller The `TransformStreamDefaultController` manages the internal state of the `TransformStream`
     * @returns {void | PromiseLike<void>} A promise fulfilled with undefined.
     */
    public abstract flush(controller: TransformStreamDefaultController<O>): void | PromiseLike<void>;
  }
  export class BasicQueuingStrategy extends CountQueuingStrategy {
    constructor(highWaterMark: number = 256) {
      super({highWaterMark});
      
    }
  }
  export class BitQueuingStrategy extends ByteLengthQueuingStrategy {
    constructor(highWaterMark = 512){
      super({highWaterMark});
    }
  }
  export class BasicTransformer<I, O extends exp.Expression> extends TransformStream<I, O> {
    constructor(transformer: AbstractTransformer<I, O>, readableStrategy: QueuingStrategy<O>, writableStrategy: QueuingStrategy<I> = new BasicQueuingStrategy()){
      super(transformer, writableStrategy, readableStrategy);
    }
  }
  /**
   * An object that evaluates the arguments and returns a result
   */
  export interface Evaluator {
    /**
     * Evaluates the argument and returns a result
     * @param {any} s the value to be evaluated
     * @returns {any} a result
     */
    evaluate(s: any): any;
  }
  /**
   * A generic version of the evaluator interface
   * @template E
   */
  export interface GEvaluator<E> extends Evaluator {
    /**
     * Evaluates the expression with extra parameter argument to guide the evaluation
     * @param {E} expr the value to be evaluated
     * @param {P} params the parameter argument for the evaluation process.
     * @template P A params object is an options object that is specific
     * to the current value being parsed.
     */
    evaluate<P>(expr: E, params: P): E;
    evaluate(expr: E): E;
  }
}

export default parser;
