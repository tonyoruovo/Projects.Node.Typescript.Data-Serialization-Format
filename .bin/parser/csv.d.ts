/// <reference types="node" resolution-mode="require"/>
/// <reference types="node" resolution-mode="require"/>
/// <reference types="node" resolution-mode="require"/>
import parser from "./parser.js";
import expression from "./expression.js";
import utility from "../utility.js";
import * as fs from "node:fs";
import { TransformCallback } from "node:stream";
import json from "./json.js";
/**
 * @summary Defines the constituents of the csv pipeline.
 * @description The csv pipeline constitutes tokenisers (lexers) for tokenising text and json data; a parser which translates the
 * tokens into expressions; formatters which can create file, in-memory and simple string formats; a converter which binds several
 * of the aforementioned components so that the data contained within can be tranferred to other data languages seamlessly. \
 * \
 * While this pipeline can parse tsv and other delimited-separator-value type formats, it adhere to their individual specification
 * e.g there is no means for using proper escapes rather the quote character within a quoted string. This will be fixed in the future.
 * @remark ## Implementation note:
 * In the near future I hope to implement a feature where the delimiter can be read from the first line of a stream/file in the form `Sep=;`
 * This is case-insensitive ofcourse. \
 * \
 * I Also need a feature where a table can be transposed such that it's rows become the columns vice-versa.
 */
declare namespace csv {
    /**
     * The expected format in which the parser will parse double quotes (`\u0022`).
     * - `'always'` - All fields are required to be enclosed in quotes. This is a strict form and violation of this syntax will result in a {@link parser.SyntaxError} to be thrown
     * - `'a'` - Shorthand for `'always'`
     * - `'none'` - All fields are required to be without quotes. This is a strict form and violation of this syntax will result in a {@link parser.SyntaxError} to be thrown. This also places the greatest limitation on the input data as field names and values cannot contain the {@link Syntax.separator separator character} and the {@link Syntax.eol line terminator character}.
     * - `'n'` - Shorthand for `'none'`
     * - `undefined` - The parser makes it's own descision on what is escaped, and what is a field based on percieved syntax of the document. This is the most loose option.
     * @enum {"always" | "a" | "none" | "n" | undefined}
     */
    export type QuotesType = "always" | "a" | "none" | "n" | undefined;
    /**
     * @summary Builds {@link Syntax} objects.
     * @description
     * A {@link utility.Builder `Builder`} class that builds {@link Syntax} objects via it's {@link build `build`} method.
     * This is the recommended way to create a `Syntax` object as this class features a number of checks when setting the properties if the `Syntax` object.
     * For example:
     * - users cannot set the {@link Syntax.separator separator}, {@link Syntax.eol eol}, {@link Syntax.nop nested-object-operator}, {@link Syntax.nap nested-array-operator}
     * or {@link Syntax.dQuotes quotes} to the same string, none of them can match or else this class will throw
     * - users cannot set the {@link Syntax.separator separator}, {@link Syntax.eol eol}, {@link Syntax.nop nested-object-operator}, {@link Syntax.nap nested-array-operator}
     * or {@link Syntax.dQuotes quotes} to the a string identified by {@link Syntax.isWhitespace} as a whitespace
     * - {@link Syntax.isWhitespace} cannot be set to a value that will consider {@link Syntax.separator separator}, {@link Syntax.eol eol}, {@link Syntax.nop nested-object-operator},
     * {@link Syntax.nap nested-array-operator} or {@link Syntax.dQuotes quotes} as a whitespace
     * - {@link Syntax.isWhitespace} and {@link Syntax.parse} cannot be set to `null` or `undefined`
     * - The `Syntax` object returned by {@link build `build`} is immutable such that none of it's properties can be changed after it is built
     *
     * All properties being built have default values, however there are not defaults for the {@link Syntax.getCommand} and without manually calling any of the
     * `setXxxCommand` methods, there will be no {@link Command} to be retrived from the built `Syntax`. \
     * \
     * This class can {@link rebuild assemble} a `Syntax` from the default of a different `Syntax` object, this is useful if a user only wants to change a single property from
     * an already configured `Syntax`, hence mutability of a `Syntax` object is done through this class by using the {@link rebuild} method in combination with
     * the {@link clear} method.
     *
     */
    export class SyntaxBuilder implements utility.Builder<Syntax> {
        #private;
        /**
         * Check for a bom in the document to be parsed. The default value in it's `encoding` field is `"utf-8"`
         * @default {"utf-8"}
         * @defaultValue `"utf-8"`
         */
        private _md;
        /**
         * @summary registers an infix {@link Command}
         * @description
         * Registers a {@link parser.GType<string>} (which is compatible with infix tokens) with the corresponding {@link Command} that can parse that `parser.GType<string>`.
         * This method should not be called more than once for the same `parser.GType<string>` as that would cause ambiguity on the built {@link Syntax `Syntax`}
         * object such that each query for a `Command` may have undefined behaviour, as such, consecutive calls of this method with the same `parser.GType<string>` invalidates
         * the previous call with that `parser.GType<string>`.
         * @remark
         * There are no defaults for infix commands, if there are not available by the time {@link build} is called the built `Syntax` will have no access to
         * infix `Command`s
         * @param {parser.GType<string>} type the type with which to query this command. This is expected to be a compatible infix type.
         * @param {Command} cmd the command which can parse infix tokens into {@link Expression expression(s)}
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        addInfixCommand(type: parser.GType<string>, cmd: Command): SyntaxBuilder;
        /**
         * @summary registers a prefix {@link Command}
         * @description
         * Registers a {@link parser.GType<string>} (which is compatible with prefix tokens) with the corresponding {@link Command} that can parse that `parser.GType<string>`.
         * This method should not be called more than once for the same `parser.GType<string>` as that would cause ambiguity on the built {@link Syntax `Syntax`}
         * object such that each query for a `Command` may have undefined behaviour, as such, consecutive calls of this method with the same `parser.GType<string>` invalidates
         * the previous call with that `parser.GType<string>`.
         * @remark
         * There are no defaults for prefix commands, if there are not available by the time {@link build} is called the built `Syntax` will have no access to
         * prefix `Command`s
         * @param {parser.GType<string>} type the type with which to query this command. This is expected to be a compatible prefix type.
         * @param {Command} cmd the command which can parse prefix tokens into {@link Expression expression(s)}
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        addPrefixCommand(type: parser.GType<string>, cmd: Command): SyntaxBuilder;
        /**
         * @summary registers a postfix {@link Command}
         * @description
         * Registers a {@link parser.GType<string>} (which is compatible with postfix tokens) with the corresponding {@link Command} that can parse that `parser.GType<string>`.
         * This method should not be called more than once for the same `parser.GType<string>` as that would cause ambiguity on the built {@link Syntax `Syntax`}
         * object such that each query for a `Command` may have undefined behaviour, as such, consecutive calls of this method with the same `parser.GType<string>` invalidates
         * the previous call with that `parser.GType<string>`.
         * @remark
         * Calling this method has no effect on the built `Syntax` as {@link Parser} does not support {@link parser.Direction.POSTFIX} therefore ignore this
         * method. \
         * \
         * There are no defaults for postfix commands, if there are not available by the time {@link build} is called the built `Syntax` will have no access to
         * postfix `Command`s
         * @param {parser.GType<string>} type the type with which to query this command. This is expected to be a compatible postfix type.
         * @param {Command} cmd the command which can parse postfix tokens into {@link Expression expression(s)}
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        addPostfixCommand(type: parser.GType<string>, cmd: Command): SyntaxBuilder;
        /**
         * Sets the {@link Syntax.isWhitespace} determinant.
         * @remark
         * the default is {@link utility.isWhitespace} except {@link Syntax.eol} is not counted as a whitespace
         * @param {function(s: string): boolean} isWhitespace the funtion that determines which string is a white space. An undefined or null value is ignored.
         * @returns {SyntaxBuilder} the same builder object for method chaining
         * @throws {TypeError} if the argument evaluates {@link Syntax.separator separator}, {@link Syntax.eol eol}, {@link Syntax.nop nested-object-operator},
         * {@link Syntax.nap nested-array-operator} or {@link Syntax.dQuotes quotes} as a whitespace
         */
        setIsWhiteSpace(isWhitespace: (s: string) => boolean): SyntaxBuilder;
        /**
         * Sets the {@link Syntax.parse} function to determine how the user wants to parse a cell value to a json value.
         * @remark
         * the default returns the argument if it has a length greater than 0 else will return `null` if the length is 0 or else throws a `TypeError` for `undefined`
         * and `null` arguments.
         * @param {(text: string) => boolean} parse the funtion that determines the json data type of a given cell when converting a csv document to json.
         * An undefined value sets the parse function to return any argument it's given;
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        setParse(parse: (text: string) => json.Value): SyntaxBuilder;
        /**
         * Sets the {@link Syntax} to enable parsing of hex and binary literals as numbers
         * @param {boolean} b `true` to allow parsing of binary and hex literals as numbers such as `0b100111`, `0xabba1c` otherwise set to `false`
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        /**
         * Sets the {@link Syntax} to enable truncating of fields containing whitespaces to the right (end) of the field
         * @remark
         * the default is `false`
         * @param {boolean} b `true` to allow trimming otherwise set to `false`
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        trimLeadingSpaces(b: boolean): SyntaxBuilder;
        /**
         * Sets the {@link Syntax} to enable truncating of fields containing whitespaces to the left (start) of the field
         * @remark
         * the default is `false`
         * @param {boolean} b `true` to allow trimming otherwise set to `false`
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        trimTrailingSpaces(b: boolean): SyntaxBuilder;
        /**
         * Sets the {@link Syntax.eol line terminator} of the {@link Syntax} to the argument.
         * Note that providing a custom line terminator also calls for providing a {@link Syntax.isWhitespace whitespace determinant} via {@link setIsWhiteSpace here}
         * or else an unpredictable object may be built.
         * @remark
         * the default is the same value returned by `require("node:os").EOL`
         * @param {string} lt the value to be used as the official line terminator of this syntax
         * @returns {SyntaxBuilder} the same builder object for method chaining
         * @throws {TypeError} if the argument is the same as a {@link Syntax.separator separator}, {@link Syntax.nop nested-object-operator},
         * {@link Syntax.nap nested-array-operator}, {@link Syntax.dQuotes quotes} or a whitespace
         */
        setEol(lt: string): SyntaxBuilder;
        /**
         * Sets the {@link Syntax.separator separator} of the {@link Syntax} to the argument
         * @remark
         * the default is the `','`
         * @param {string} s the value to be used as the official separator of this syntax
         * @returns {SyntaxBuilder} the same builder object for method chaining
         * @throws {TypeError} if the argument is the same as a {@link Syntax.eol line terminator}, {@link Syntax.nop nested-object-operator},
         * {@link Syntax.nap nested-array-operator}, {@link Syntax.dQuotes quotes} or a whitespace
         */
        setSeparator(s: string): SyntaxBuilder;
        /**
         * Sets the {@link Syntax.quotesType} of the {@link Syntax} to the argument
         * @remark
         * the default is the `undefined`
         * @param {QuotesType} qt a valid string or `undefined` to denote how quotes will be handled
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        setQuotesType(qt: QuotesType): SyntaxBuilder;
        /**
         * Sets the {@link Syntax.enfSym} property on this builder.
         * @remark
         * the default is the `true`
         * @param {boolean} enfSym `true` to allow for row length checking and `false` if otherwise
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        setEnforceSymmetry(enfSym: boolean): SyntaxBuilder;
        /**
         * Sets the {@link Syntax.encoding encoding} property of the syntax to be built
         * @remark
         * the default is the `'utf-8'`
         * @param {parser.Encoding} enc the encoding to be set. This value is not validated, so an invalid valid may cause propblems during formatting and converting
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        setEncoding(enc: parser.Encoding): SyntaxBuilder;
        /**
         * Sets the {@link Syntax.bom byte-order-mark} property of the syntax to be built
         * @remark
         * the default is the `false`
         * @param {boolean} bom the bom to be set
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        setBom(bom: boolean): SyntaxBuilder;
        /**
         * Sets the {@link Syntax.dQuotes string} identified as the "double quote" of the {@link Syntax} to the given argument
         * @remark
         * the default is the `'"'`
         * @param {string} dq a valid string or `undefined` to denote the double quote
         * @returns {SyntaxBuilder} the same builder object for method chaining
         * @throws {TypeError} if the argument is the same as a {@link Syntax.eol line terminator}, {@link Syntax.nop nested-object-operator},
         * {@link Syntax.nap nested-array-operator}, {@link Syntax.separator separator} or a whitespace
         */
        setDQuotes(dq: string): SyntaxBuilder;
        /**
         * Sets the {@link Syntax.nop character} that enables the {@link Syntax} identify nested object(s) to the given argument.
         * @remark
         * the default is the `'.'`
         * @param {string|undefined} nop a valid single character string or `undefined`
         * @returns {SyntaxBuilder} the same builder object for method chaining
         * @throws {TypeError} if the argument is the same as a {@link Syntax.eol line terminator}, {@link Syntax.dQuotes quotes},
         * {@link Syntax.nap nested-array-operator}, {@link Syntax.separator separator}, a whitespace or if the string length is not equal to 1
         */
        setNop(nop?: string): SyntaxBuilder;
        /**
         * Sets the {@link Syntax.nap character} that enables the {@link Syntax} identify nested array(s) to the given argument.
         * @remark
         * the default is the `'#'`
         * @param {string|undefined} nap a valid single character string or `undefined`
         * @returns {SyntaxBuilder} the same builder object for method chaining
         * @throws {TypeError} if the argument is the same as a {@link Syntax.eol line terminator}, {@link Syntax.dQuotes quotes},
         * {@link Syntax.nop nested-object-operator}, {@link Syntax.separator separator}, a whitespace or if the string length is not equal to 1
         */
        setNap(nap?: string): SyntaxBuilder;
        /**
         * Sets the {@link Syntax.metadata.fileExt extension string} associated with the syntax as specified by {@link Syntax.metadata.fileExt}
         * @remark
         * The default is `'csv'`.
         * @param {string} ext the file extension as a string. This should not have any trailing dot(s). An undefined or null value has no effect
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        setFileExt(ext: string): SyntaxBuilder;
        /**
         * Sets the {@link Syntax.metadata.isStandard isStandard property} in the syntax to be built.
         * @remark
         * The default is `true`.
         * @param {boolean} b `true` if the syntax is a web standard `false` if otherwise. A truthy value will be converted to a boolean.
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        setIsStandard(b: boolean): SyntaxBuilder;
        /**
         * Sets the {@link Syntax.metadata.mediaType media type} associated with the data for which the syntax is being built.
         * @remark
         * The default is `'text/csv'`
         * @param {string} mediaType the MIME type for the syntax
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        setMediaType(mediaType: string): SyntaxBuilder;
        /**
         * Sets the {@link Syntax.metadata.standard standard} associated with the data for which the syntax is being built.
         * The standard is a string associated with the media type, web specification, schema or syntax definition e.g a **R**equest **F**or **C**ommenid.t
         * @remark
         * The default is `'Rfc 4180'`
         * @param {string} standard a string representing the standard specification for the data that this syntax will be created for.
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        setStandard(standard: string): SyntaxBuilder;
        /**
         * @summary Builds a `Syntax` object and returns it given all the options that were set.
         * @description
         * Builds and returns an immutable `Syntax` object.
         * If any values apart from {@link Syntax.quotesType}, {@link Syntax.nap} and {@link Syntax.nop} is set to undefined (This may occur when {@link rebuild}
         * is called just before this method and an invalid `Syntax` object is passed to it), an invalid object will be built and the behaviour of the resulting
         * object will be undefined (unpredictable).
         * @returns {Syntax} an immutable `Syntax` object.
         */
        build(): Syntax;
        /**
         * @summary
         * Overwrites every {@link Syntax} property in this builder with the properties of the argument
         * @remark
         * Please note that no check is done when rebuilding from a given syntax (this speeds up the rebuilding process) hence the caller must ensure that the argument is a valid `Syntax` object.
         * @inheritdoc
         */
        rebuild(from: Syntax): SyntaxBuilder;
        /**@inheritdoc */
        clear(): SyntaxBuilder;
    }
    /**
     * @summary Defines how a csv document is to be parsed
     * @description An immutable object that carries info about how the csv pipeline process inputs and outputs data. This object can be used to create
     * dsv (**D**ot **S**eparated **V**alues) syntax and tsv (**T**ab **S**eparated **V**alues) as well as setting line terminator string. Parsing can
     * be set to only accept quoted fields or no quotes at all. All these and more can be configured to parse different documents in the csv family. \
     * \
     * Because of the complex nature of the `Syntax` interface (and all it's responsibilities), it is recommended that users instantiate it through the
     * use of the {@link SyntaxBuilder} class, as there are checks that exist in `SyntaxBuilder` that may prevent instantiating an invalid `Syntax`
     * object.
     */
    export interface Syntax extends parser.GSyntax<parser.GType<string>, Command> {
        /**
         * Tells whether the input argument is a whitespace according to this syntax.
         * @param {string} text the value to be tested
         * @returns {boolean} `true` if the arg is a whitespace and `false` if otherwise
         */
        isWhitespace(text: string): boolean;
        /**
         * Formats the given text which is considered to be the field (or cell) value of a given row and column.
         * This used by formatters when converting to json, and aims to delegate 'cell interpretation' to the user.
         * @param {string} field the value of the field that will be formatted
         * @returns {json.Value} returns a json {@link json.Value data type}
         */
        parse(field: string): json.Value;
        /**
         * When `true`, enforces row symmetry on the parser whereby each row must be exactly the same number
         * of fields as the header (or the first row). When `false`, does not enforce row symmetry.
         * @type {boolean}
         * @readonly
         */
        readonly enfSym: boolean;
        /**
         * Value used by parsers to decide whether to trim leading spaces within records
         * @type {boolean}
         * @readonly
         */
        readonly trimLeadingSpaces: boolean;
        /**
         * Value used by parsers to decide whether to trim trailing spaces within records
         * @type {boolean}
         * @readonly
         */
        readonly trimTrailingSpaces: boolean;
        /**
         * Determines how the parser will parse quotes `"`.
         * @type {QuotesType}
         * @readonly
         */
        readonly quotesType: QuotesType;
        /**
         * Defines the string used as the de-facto separator. Although this is usually the comma character (`\u002c`), it can be any string and longer strings will impact performance.
         * It is expected that this value be different from the {@link eol end-of-line} string
         * @type {string}
         * @readonly
         */
        readonly separator: string;
        /**
         * Defines the string used as the de-facto line-terminator.
         * @readonly
         * @type {string}
         */
        readonly eol: string;
        /**
         * The string constant representing the value that encloses quoted fields in a csv expression and defines the string identified as the quote.
         * This is also the value that is used to escape quotes.
         * @type {string}
         * @readonly
         */
        readonly dQuotes: string;
        /**
         * Contains the encoding expected in the document. When {@link Syntax.bom} is provided. This value helps to read the bom it properly
         * @inheritdoc
         */
        readonly metadata: parser.Metadata;
        /**
         * Specifies whether the document carries a byte-order-mark
         * @type {boolean}
         */
        readonly bom: boolean;
        /**
         * **N**ested **O**bject o**P**erator. The character that is used (in the header) to identify properties in nested
         * objects in a csv document. For example if the operator is a `.` then:
         * ```csv
         * sibling1,sibling2,sibling3.child1,sibling3.child2.grandchild1,sibling4
         * "row1 column1","row1 column2","row1 column3",,"row1 column5"
         * "row2 column1",row2 column2,"row2 column3",row2 column4,"row2 column5"
         * row3 column1,row3 column2,"",row3 column4,"row3 column5"
         * ```
         * translates to:
         * ```json
         * [{
         *     "sibling1": "row1 column1",
         *     "sibling2": "row1 column2",
         *     "sibling3": {
         *         "child1": "row1 column3",
         *         "child2": null
         *     },
         *     "sibling4": "row1 column5"
         * }, {
         *     "sibling1": "row2 column1",
         *     "sibling2": "row2 column2",
         *     "sibling3": {
         *         "child1": "row2 column3",
         *         "child2": {
         *             "grandchild1": "row2 column4"
         *         }
         *     },
         *     "sibling4": "row2 column5"
         * }, {
         *     "sibling1": "row3 column1",
         *     "sibling2": "row3 column2",
         *     "sibling3": {
         *         "child1": null,
         *         "child2": {
         *             "grandchild1": "row3 column4"
         *         }
         *     },
         *     "sibling4": "row3 column5"
         * }]
         * ```
         * else if the operator is undefined, then this value is not used at all.
         * @type {string} a single character string. Classes and functions in this namespace only support a single chracter as this value.
         * @readonly
        */
        readonly nop?: string;
        /**
         * **N**ested **A**rray o**P**erator. The character that is used (in the header) to identify indexes in nested
         * arrays in a csv document. For example if the operator is a `#` then:
         * ```csv
         * sibling1,sibling2,sibling3#0,sibling3#1#0,sibling4
         * "row1 column1","row1 column2","row1 column3",,"row1 column5"
         * "row2 column1",row2 column2,"row2 column3",row2 column4,"row2 column5"
         * row3 column1,row3 column2,"",row3 column4,"row3 column5"
         * ```
         * translates to:
         * ```json
         * [{
         *     "sibling1": "row1 column1",
         *     "sibling2": "row1 column2",
         *     "sibling3": [ "row1 column3", null ],
         *     "sibling4": "row1 column5"
         * }, {
         *     "sibling1": "row2 column1",
         *     "sibling2": "row2 column2",
         *     "sibling3": [ "row2 column3", [ "row2 column4" ] ],
         *     "sibling4": "row2 column5"
         * }, {
         *     "sibling1": "row3 column1",
         *     "sibling2": "row3 column2",
         *     "sibling3": [ null, [ "row3 column4" ] ],
         *     "sibling4": "row3 column5"
         * }]
         * ```
         * else if the operator is undefined, then this value is not used at all.
         * Only integers are allowed for index specification.
         * @type {string} a single character string. Classes and functions in this namespace only support a single chracter as this value.
         * @readonly
         */
        readonly nap?: string;
    }
    /**A mutative object used to store temporay data about a document or an expression */
    export class Params {
        #private;
        /**
         * The number of fields that have been read by the parser for the current line.
         * @type {number}
         */
        fieldCount: number;
        /**
         * The number of rows that have been read by the parser for the current line.
         * @type {number}
         */
        rowCount: number;
        /**
         * Meant to be set by the lexer to inform the {@link Format} to format the first line as the csv header
         * @param {boolean} b `true` if the first line is not to be formatted as the header or else `false`
         * @set
         * This can only be set once
         */
        set headerless(b: boolean);
        /**
         * A check that informs the {@link Format} that a csv document may or may not require formatting of the first line i.e specifies whether the first line is the header or not.
         * @returns {boolean} `true` if the first line is the header and `false` if otherwise
         */
        get headerless(): boolean;
        /**
         * Sets the header value of the document being parsed.
         * @set
         * This can only be set once
         * @param {string[] | undefined} header the val to be assigned to this.
         */
        set header(header: string[] | undefined);
        /**
         * Any record whose number of fields are more than the length of the argument will cause an error to throw. This value can also be used by formatters
         * where headers will be useful e.g json formatters
         * @get
         * This will return the value that was the argument to `set` the first time `set` was called or will return an
         * empty array if `set` was never called.
         * @returns {string[]| undefined}
         */
        get header(): string[] | undefined;
    }
    /**A concrete {@link parser.GType<string>} that uses string types as ids */
    class Type implements parser.GType<string> {
        readonly id: string;
        readonly precedence: number;
        /**
         * Constructs a `Type` with an assigned unique id and precedence.
         * @param {string} id a unique id associated with this {@link parser.Type}
         * @param {number} precedence the precedence of this type. This determines how it will be evaluated in the evaluation hierarchy (per se)
         */
        constructor(id: string, precedence: number);
        /**
         * Test the equality of this `Type` to the given input
         * @param {(object|undefined)} obj any object to test against `this`
         * @returns {boolean} `true` if `this` is equal to the input and `false` if otherwise.
         */
        equals(obj?: object): boolean;
        toString(): string;
    }
    /**
     * @constant {parser.GType<string>} SEPARATOR the type representing the separator token of this csv document
     * @type {parser.GType<string>}
     * @readonly
     */
    export const SEPARATOR: parser.GType<string>;
    /**
     * @constant {parser.GType<string>} EOL the type representing the line terminator (end-of-line) token of the csv document.
     * It's respective command ({@link ParseRow}) is going to be registered in the syntax object as an infix (not postfix) command and has a lower precedence than other
     * infix commands (such as the {@link ParseSeparator}), hence this token has to have a lower precedence to cause the {@link parser.PrattParser parser} to stop parsing
     * after this token has been parsed.
     * @type {parser.GType<string>}
     * @readonly
     */
    export const EOL: parser.GType<string>;
    /**
     * @constant {parser.GType<string>} FIELD the type representing the field token of this csv document
     * @type {parser.GType<string>}
     * @readonly
     */
    export const FIELD: parser.GType<string>;
    /**
     * @constant {parser.GType<string>} EOF A constant representing an end of file or an end of stream or an end of parsing (for strings)
     * @type {parser.GType<string>}
     * @readonly
     */
    export const EOF: parser.GType<string>;
    /**
     * @summary a class that represents a string of characters that individually represent a logical portion of a csv document.
     * @description a csv implementation of the {@link parser.Token token interface} meant for conveying data about a sub-text. Although each {@link Token.value value} is unique,
     * there are expected to be 4 types of token namely:
     * - {@link FIELD fields}: these are tokens that can start an expression (depending on the syntax) and end an expression but cannot be subsequent in a record (same line).
     * - {@link SEPARATOR separator}: these are tokens that can be found between 2 fields.
     * - {@link EOL line terminator}: these are tokens that mark a complete record or an end of a line.
     * - {@link EOF end-of-file}: these are tokens that mark a complete document or the end of a file.
     */
    class Token extends Object implements parser.GToken<string> {
        readonly value: string;
        readonly type: Type;
        readonly lineStart: number;
        readonly lineEnd: number;
        readonly startPos: number;
        readonly length: number;
        /**
         * Constructs a `Token`
         * @param {string} value the intrinsic content of this token
         * @param {Type} type the type of this token
         */
        constructor(value: string, type: Type, lineStart: number, lineEnd: number, startPos: number);
        toString(): string;
    }
    export interface MutableLexer<CH = string> extends parser.MutableLexer<parser.GToken<string>, Syntax, CH> {
        end(syntax: Syntax, p: Params | any): void;
        process(chunk: CH, syntax: Syntax, p: Params | any): void;
    }
    /**This is the direct opposite of {@link JSFormat `JSFormat`} */
    export class JSONLexer implements MutableLexer<json.Value> {
        #private;
        constructor();
        /**
         * This value is different before and after the initial call of {@link JSONLexer.process `process`}.
         * @inheritdoc
         */
        get src(): string | number | boolean | json.Pair | readonly json.Value[] | null;
        end(): void;
        process(chunk: json.Value, syntax: Syntax, p: Params): void;
        indexOf(type: parser.Type): number;
        lastIndexOf(type: parser.Type): number;
        unprocessed: () => string | number | boolean | json.Pair | readonly json.Value[];
        processed: () => Token[];
        frequency(type: parser.Type): number;
        hasTokens(): boolean;
        canProcess(): boolean;
        next(): Token;
        position(): number;
        line(): number;
    }
    export class StringLexer implements MutableLexer {
        #private;
        src: string[];
        constructor();
        indexOf(type: parser.Type): number;
        lastIndexOf(type: parser.Type): number;
        end(syntax: Syntax, params: Params): void;
        unprocessed: () => readonly string[];
        /**
         * Returns an unmodifiable array of {@link parser.GToken<string>} objects
         * @returns {readonly parser.GToken<string>} an unmodifiable array of tokens
         */
        processed: () => parser.GToken<string>[];
        frequency(type: parser.Type): number;
        hasTokens(): boolean;
        canProcess(): boolean;
        process(chunk: string, syntax: Syntax, params: unknown): void;
        position(): number;
        line(): number;
        next(): Token;
    }
    export interface Command extends parser.GCommand<parser.GToken<string>, Expression, Syntax, MutableLexer, Parser> {
        parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer, s: Syntax, pa?: Params): Expression;
    }
    export interface Expression extends expression.GExpression<Format> {
        format(format: Format, syntax?: Syntax, params?: Params | any): void;
    }
    /**Convenience class to allow for proper return values using `parse` */
    export class Parser extends parser.PrattParser<Expression, Syntax> {
    }
    export type Appendage = string | Expression;
    /**A base csv format */
    export interface Format<T = any> extends expression.GFormat<Expression, T> {
        append(data: Appendage, s?: Syntax, p?: Params): void;
        get rows(): number;
        get columns(): number;
    }
    /**A csv format as a generic string, good for quick formatting and testing purposes */
    export class StringFormat implements Format<string> {
        #private;
        constructor(initialValue?: string);
        get rows(): number;
        get columns(): number;
        append(data: Appendage, s?: Syntax | undefined, p?: Params | undefined): void;
        data(): string;
        reverse(): expression.GFormat<Expression, string>;
        equals(another: expression.GFormat<Expression, string>): boolean;
        modifications: number;
        readonly bpc: number;
        readonly bpn: number;
        hashCode32(): number;
        toJSON(): string;
        compareTo(obj?: expression.GFormat<Expression, string> | undefined): utility.Compare;
    }
    /**
     * @summary An in-memory representation of a csv document in json format.
     *
     * @description A class that builds an an array objects (dictionaries) whereby the property names
     * correspond to full/partial header values of the csv document and the property values correspond
     * to either partial header values or to a cell value in a csv document. \
     * \
     * The in-memory json is built by repeatedly calling {@link JSFormat.append}, however, `append`
     * shoud never be called in isolation by a user, it is automatically called by {@link Expression} objects
     * when {@link Expression.format their own `format()`} method is called. Each call of `append` formats
     * a single row, hence to format an entire csv document, it will be called for each row. The resulting data
     * can then be retrieved using the method {@link JSFormat.data}.
     *
     * @remark
     * The {@link Syntax.bom byte-order-mark} is not taken into account in this format. \
     * \
     * The order of the header value (for nested properties) is important and may cause values to
     * be overwritten if not properly placed. The general rule place the most nested values at the
     * begining of the header array and the least nested ones at the end of the header array. Nesting
     * can be done using the {@link Syntax.nop nested-object-opertor} (for nested properties) and/or
     * {@link Syntax.nap nested-array-operator} (for nested array indexes/indices).
     *
     * @privateRemark
     * In later versions it will support arbitrary json values (such as objects with 1m+
     * properties or arrays with 5m elements). This will be achieved by storing the data as a file and querying it using
     * the anticipated properties.
     */
    export class JSFormat implements Format<json.List> {
        #private;
        /**
         * Creates a `JSFormat` object. This constructor should be regarded as parameterless as the parameter option is reserved for
         * internal state regulation i.e the appropriate argument for the parameter can only be provided by another method of this
         * object. Any attempt to manually provide the argument will cause this object to behave in an indefinite way.
         * @param {any} value an object which is used to initialise `JSFormat.#value`. This value is not required to be provided,
         * infact, providing this value may cause indefinite behaviour of this object. The default value is an empty array.
         */
        constructor(value?: any);
        /**
         * @summary Appends `data` to the this object as an in-memory json.
         * @description Appends the given `data` to the internal document using the `header` from the provided {@link Params} object, the
         * {@link Syntax.nap array operator} and {@link Syntax.nop object operator} both from the given {@link Syntax} object to
         * properly build an in-memory json object from csv expressions.
         * @param {Appendage} data the value to be appended.
         * @param {Params} p a valid {@link Params} object. This is a required parameter, despite being marked as optional.
         * @param {Syntax} s a {@link Syntax} object which has it's array and object operator properly configured.
         * @throws {expression.FormatError} if the value is not defined as one of the {@link Appendage} value.
         */
        append(data: Appendage, s?: Syntax, p?: Params): void;
        /**
         * The number of columns that have been formatted
         * @returns {number}
         */
        get columns(): number;
        /**
         * The number of rows that have been formatted
         * @returns {number}
         */
        get rows(): number;
        /**
         * Returns this object with all rows contained therein in reverse order
         * @returns {JSFormat} this with the rows in reverse order
         */
        reverse(): JSFormat;
        equals(another: expression.GFormat<Expression, json.List>): boolean;
        /**
         * @summary Returns the csv document that has been formatted as an in-memory json
         *
         * @description Gets a json list of rows formatted from {@link Expression} objects. This list represents the whole csv document, and each item in the list
         * is a of type {@link json.Pair} and it represents a row in the csv document. Each property name in the `Pair` object is a header value and
         * every property value is a cell in the csv document.
         *
         * @returns {json.List} an array of objects representing the csv document that was formatted.
         * @see {@link expression.Format.data} for details about this method
         */
        data(): json.List;
        modifications: number;
        readonly bpc: number;
        readonly bpn: number;
        hashCode32(): number;
        toJSON(): string;
        compareTo(obj?: expression.GFormat<Expression, json.List> | undefined): utility.Compare;
    }
    /**A csv format that writes to a file */
    export class FileFormat implements Format<fs.ReadStream> {
        #private;
        /**
         * Constructs this `FileFormat` object
         * @param {string} [filename=] the name of the file that the internal {@link fs.WriteStream `fs.WriteStream`} will save the data to.
         * The default is `file.csv` in the current directory
         */
        constructor(filename: string);
        endWrite(): void;
        /**@todo Remember to write the bom */
        append(data: Appendage, s?: Syntax, p?: Params): void;
        get rows(): number;
        get columns(): number;
        reverse(): this;
        equals(another: expression.GFormat<Expression, fs.ReadStream>): boolean;
        /**
         * @summary Gets all the data in this `Format` from a stream
         * @description
         * Creates a {@link fs.ReadStream} with the same path as was provided in the constructor and the same encoding that was used to save the data. If no data has been written
         * i.e if {@link append} has not been called then no data associated with this format will be found in this stream.
         * @remark
         * It is the duty of the caller to properly close all resources associated with the returned stream and also note that the `autoClose` property of the
         * {@link fs.createReadStream} `options` parameter is set to `true` in the stream.
         * @returns {fs.ReadStream} the path where this format is written to as a stream.
         */
        data(): fs.ReadStream;
        modifications: number;
        bpc: number;
        bpn: number;
        hashCode32(): number;
        toJSON(): string;
        compareTo(obj?: expression.GFormat<Expression, fs.ReadStream> | undefined): utility.Compare;
    }
    export class Converter extends parser.Converter<parser.GToken<string>, Expression, Syntax, Parser, Params, MutableLexer, any> {
        _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void;
        _flush(callback: TransformCallback): void;
    }
    /**
     * A {@link Syntax `Syntax`} that embodies the Rfc 4180 specification found [here](https://www.rfc-editor.org/rfc/rfc4180). \
     * \
     * The following are the configuration of this object:
     * - A field may be quoted (enclosed in double quotes) or unquoted, however, if the field contains special characters such as {@link Syntax.eol line terminators}, {@link Syntax.separator separators}, and {@link Syntax.dQuotes quotes} then it must be quoted otherwise the parser becomes unpredictable.
     * - The {@link Syntax.eol line terminator} is the same as the default of the current operating system.
     * - The {@link Syntax.separator field separator} (delimiter) is the comma character `,`.
     * - The {@link Syntax.dQuotes quote} is the double quotes character `"`.
     * - The {@link Syntax.nop} is the period character `"."`
     * - The {@link Syntax.nap} is the number sign `"#"`
     * - Whitespaces include those found at {@link utility.whitespaces} excluding the {@link Syntax.eol line terminator}.
     * - All special characters such as {@link Syntax.eol}, {@link Syntax.separator}, quotes etc can be part of a string via quoted fields and quotes-escapes respectively.
     * - All white spaces are considered part of the field, except those that are outside quotes where quotes are explicitly present as such an error is thrown.
     * - All trailing and leading whitespaces are unclipped and are sent raw down the parsing pipeline.
     * - Double quotes may be part of a field by putting them inside a quoted field (as stated above) and escaping them with a double quote just before they appear.
     * - A new line may begin with a quoted or non-quoted field, which may be followed by a separator and/or a line terminator or nothing.
     * - All lines are ended when an unquoted line terminator is encountered
     * - When a document is ended, this is no need for a line terminator to end the line
     * - All quoted fields must be enclosed in quotes and quotes that are part of the field must be escaped by placing a quote before it i.e 2 double quotes `""` escapes one quote. There is no need to escape single quotes.
     * - Null fields (fields that contain no character) are supported. Having a separator before a line break will parse a null field before the line break.
     * - Row symmetry is enforced such that all rows must have the same number of fields as the first row (header) in the csv document.
     */
    export const RFC_4180: Syntax;
    export {};
}
export default csv;
