import { Command } from "../parser/Command";
import { GSyntax } from "../parser/GSyntax";
import { GType } from "../token/GType";
import { CellIndex } from "./CellIndex";

export interface Syntax
  extends GSyntax<GType<string>, Command> {
  /**
   * if not provided, then infer from separator declaration at begining of file.
   * For example, when a file starts with `Sep=;` then the semicolon character `;` will be used as the separator. If the
   * file has no separator declaration then a {@linkcode SyntaxError} is thrown.
   */
  readonly delimiter: string;
  readonly eol: string; //line terminator
  readonly bom: boolean; //byte-order-mark
  readonly field: {
    /**
     * The prefis and suffix quote character.
     * If empty, then all quotes are read as part of the field
     */
    readonly quotes: readonly [string, string];
    /**
     * When `true`:
     * - only quoted fields are valid
     * - whitespaces (except line-end and separator) are not allowed outside of fields
     * - all null fields that are just before a line terminator must be specified by a delimiter or empty quotes to be parsed as `null` else an error will be thrown
     * - All escapes must be inside a quoted field
     * - all rows must have the same number of fields
     */
    readonly strict: boolean;
    /**
     * Note that whitespace(s) in a field will be trimmed only when
     * the {@linkplain Syntax.delimiter delimiter} and {@linkplain Syntax.eol line terminator}
     * have been identified.
     */
    readonly spaces: readonly [boolean, boolean]; //allow trailing and/or leading
    readonly escape: {
      // readonly chars: readonly string[];
      readonly encodings: readonly {
        //may be unicode, ascii etc
        /**
         * An empty value is a syntax error.
         * This is case sensitive
         * - using C-based escape this operator in `'\u002a'` will be `'\'`
         * - using xml-based escape this operator in `'&#x002a;'` will be `'&#'`
         * - using xml-based escape this operator in `'&#0042;'` will be `'&#'`
         * - using css-based escape this operator in `'\0042'` will be `'\'`
         * - using js-based (ES6) escape this operator in `'\x2a'` will be `'\'`
         * - using js-based (ES6) escape this operator in `'\x{2a}'` will be `'\'`
         */
        readonly operator: string;
        /**
         * This is case sensitive
         * - using C-based escape this value in `'\u002a'` will be `'u'`
         * - using xml-based escape this value in `'&#x002a;'` will be `'x'`
         * - using xml-based escape this value in `'&#0042;'` will be an empty string
         * - using css-based escape this value in `'\0042'` will be an empty string
         * - using js-based (ES6) escape this value in `'\x2a'` will be `'x'`
         * - using js-based (ES6) escape this value in `'\x{2a}'` will be `'x{'`
         */
        readonly prefix: string;
        /**
         * A list of escape character sequence(s) associated with this escape.
         * ### C-style:
         * - `'n'`: line feed
         * - `'r'`: carriage return
         * - `'"'`: double quote
         * - `'''`: single quote etc.
         * ### XML-style
         * - `'apos'` apostrophe
         * - `'gt'` greater than (right angle bracket)
         * - `'lt'` less than (left angle bracket)
         * - `'amp'` ampersand etc.
         */
        readonly infix: string[];
        /**
         * This is case sensitive
         * - using C-based escape this value in `'\u002a'` will be an empty string
         * - using xml-based escape this value in `'&#x002a;'` will be `';'`
         * - using xml-based escape this value in `'&#0042;'` will be `';'`
         * - using css-based escape this value in `'\0042'` will be an empty string
         * - using js-based (ES6) escape this value in `'\x2a'` will be an empty string
         * - using js-based (ES6) escape this value in `'\x{2a}'` will be `'}'`
         */
        readonly suffix: string;
        /**
         * Usually if `suffix` is an empty string, then this value must be valid. \
         *
         * - using C-based escape this value in `\u002a` will be `4`
         * - using xml-based escape this value in `&#x002a;` will be `1`
         * - using xml-based escape this value in `&#0042;` will be `1`
         * - using css-based escape this value in `'\0042'` will be `4`
         * - using js-based (ES6) escape this value in `\x2a` will be `2`
         * - using js-based (ES6) escape this value in `\x{2a}` will be `1`
         */
        readonly min: number;
        /**
         * Usually if `suffix` is an empty string, then this value must be valid. \
         *
         * - using C-based escape this value in `\u002a` will be `4`
         * - using xml-based escape this value in `&#x002a;` will be `-1` (limitless)
         * - using xml-based escape this value in `&#0042;` will be `-1` (limitless)
         * - using css-based escape this value in `'\0042'` will be `6`
         * - using js-based (ES6) escape this value in `\x2a` will be `2`
         * - using js-based (ES6) escape this value in `\x{2a}` will be `-1` (limitless)
         */
        readonly max: number;
        /**
         * If the escape continues, what are the index in the sequence for us to know this is a valid escape
         */
        // readonly steps: number[]; // Not included as this can be implemented in parse(esc: string)
        /**
         * - using C-based escape this value in `\u002a` will be `16`
         * - using xml-based escape this value in `&#x002a;` will be `16`
         * - using xml-based escape this value in `&#0042;` will be `10`
         * - using css-based escape this value in `'\0042'` will be `16`
         * - using js-based (ES6) escape this value in `\x2a` will be `16`
         * - using js-based (ES6) escape this value in `\x{2a}` will be `16`
         */
        readonly radix: number;
      }[];
      readonly parse: (rawEscape: string, syntax: Syntax) => string;
    };
    readonly parse: <T>(cell: CellIndex, syntax: Syntax, value?: string) => T;
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
     * @type {string} a single character string. Classes and functions in this namespace only support a single character as this value.
     * @readonly
     */
    readonly nop: string;
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
     * @type {string} a single character string. Classes and functions in this namespace only support a single character as this value.
     * @readonly
     */
    readonly nap: string;
  };
  /**
   * Specifies the header values. If no header was specified, then this value will be an empty array
   */
  readonly header: readonly string[];
}
