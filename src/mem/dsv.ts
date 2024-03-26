import util from "../utility.js";
import mem from "./mem.js";
/**
 * @summary **d**elimited-**s**eparated-**v**alues
 * @description
 * A generic parser/converter/serializer for comma/decimal/dot/tab separated values. 
 */
namespace dsv {
    const Type = mem.token.GType;
    const Token = mem.token.GToken;
    type Type = mem.token.GType<string>;
    type Token = mem.token.GToken<string>;
    export enum RowSymmetry {
        EMPTY = 0,// replace with the empty string
        NULL = 1,// replace with `null`
        THROW = 2,//raise exception
    }
    export enum TableUnaryOperation {
        INSERT, DELETE, REPLACE
    }
    /**
     * Merging Functor for cells
     */
    export type CellMerger =
        /**
         * Merges the given cells into one cell
         * @param {Cell[]} cells the cells that to be merged. Athough this parameter is annotated as a
         * rest parameter, it should contain an array with (at least) one cell as element or else the
         * behaviour of this call is undefined.
         * @returns {Cell} a new cell created from the input cells
         */
        (...cells: Cell[]) => Cell;
    /**
     * Merging Functor for rows
     */
    export type RowMerger =
        /**
         * Merges the given rows/columns into one
         * @param {Cell[][]} data an array of the row(s)/column(s) to be merged. Athough this parameter is annotated as a
         * rest parameter, it should contain an array with (at least) one row (or column) as element or else the
         * behaviour of this call is undefined.
         * @returns {Cell[]} a new row/column created from the input row(s)/column(s). It is recommended that
         * the array of cells returned should be the same length as the array with the max number of cells in the argument.
         */
        (...data: Cell[][]) => Cell[];
    /**
     * Merging Functor for columns
     */
    export type ColMerger = RowMerger;
    /** A function that merges mutiple rows, columns or cells into one */
    export type Merger = CellMerger | RowMerger | ColMerger;

    /**Splitting Functor for cells */
    export type CellSplitter =
        /**
         * Splits a single cell within a table into multiple cells.
         * @param {Cell} cell the cell to be split
         * @returns {Cell[]} an array of cells split from the argument. In the context of a {@linkcode Table},
         * this should be done in such a way that it does not compromise the symmetry of the table.
         */
        (cell: Cell) => Cell[];
    /**Splitting Functor for rows */
    export type RowSplitter =
        /**
         * Splits a single row/column within a table into multiple rows or columns.
         * @param {Cell[]} data the row/column to be split
         * @returns {Cell[][]} an array of multiple rows/columns split from the argument. In the context of a {@linkcode Table},
         * this should be done in such a way that it does not compromise the symmetry of the table.
         */
        (data: Cell[]) => Cell[][];
    /**Splitting Functor for columns */
    export type ColSplitter = RowSplitter;
    /** A function that splits a single row, column or cell into mutiple rows, columns or cells */
    export type Splitter = CellSplitter | RowSplitter | ColSplitter;
    export const SEPARATOR = Type("1", 2); //(SEPARATOR as any).toJSON = () => "SEPARATOR";
    export const EOL = Type("2", 2); //(EOL as any).toJSON = () => "EOL";
    export const ESCAPE = Type("3", 2); //(ESCAPE as any).toJSON = () => "ESCAPE";
    export const ESCAPED = Type("4", 2); //(ESCAPED as any).toJSON = () => "ESCAPED";
    export const TEXT = Type("5", 2); //(TEXT as any).toJSON = () => "TEXT";
    export const WHITESPACE = Type("6", 2); //(WHITESPACE as any).toJSON = () => "WHITESPACE";
    export const L_QUOTE = Type("6", 2); //(L_QUOTE as any).toJSON = () => "L_QUOTE";
    export const R_QUOTE = Type("7", 2); //(R_QUOTE as any).toJSON = () => "R_QUOTE";
    // export const FIELD = Type("3", 2);
    export const EOF = Type("-1", 2); //(EOL as any).toJSON = () => "EOL";
    export interface Syntax extends mem.parser.GSyntax<mem.token.GType<string>, Command> {
        /**
         * if not provided, then infer from separator declaration at begining of file.
         * For example, when a file starts with `Sep=;` then the semicolon character `;` will be used as the separator. If the
         * file has no separator declaration then a {@linkcode SyntaxError} is thrown.
         */
        readonly delimiter: string;
        readonly eol: string;//line terminator
        readonly bom: boolean;//byte-order-mark
        readonly field: {
            /**
             * The prefis and suffix quote character.
             * If empty, then all quotes are read as part of the field
             */
            readonly quotes: readonly [string, string],
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
            readonly spaces: readonly [boolean, boolean];//allow trailing and/or leading
            readonly escape: {
                // readonly chars: readonly string[];
                readonly encodings: readonly {//may be unicode, ascii etc
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
                readonly parse: ((rawEscape: string, syntax: Syntax) => string);
            };
            readonly parse: (<T>(cell: CellIndex, syntax: Syntax, value?: string) => T);
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
    };
    export type Lexer = mem.parser.MutableLexer<mem.token.GToken<string>, Syntax, string>;
    export type LexerConstructor = ObjectConstructor & {
        // new (): Lexer;
        (): Lexer;
    }
    export const lt = Symbol("lt");
    export const Lexer = function (this: Lexer | void) {
        type TokenFactory = mem.parser.TokenFactory;
        type Tokenizer = mem.parser.Tokenizer;
        const queue: Token[] = [];
        let p = 1, l = 1;
        let src = "";
        const constructMill = (s: Syntax) => {
            if (nx.mill) return nx.mill;
            const m = { ls: null } as TokenFactory;
            m.start = false;
            m.tx = {
                ad(x) {
                    if (m.ls !== null && m.ls !== "tx") m[m.ls].ad("");
                    m.ls = "tx";
                    if (x === "") m.tx.ge();
                    else if (s.field.escape.encodings.filter(e => (e.operator === x || e.operator.startsWith(x!))).length > 0) {
                        m.tx.ge();
                        m[x!].ad(x);
                    }
                    else if (s.field.quotes.filter(q => q.startsWith(x!)).length > 0) {
                        m.tx.ge();
                        m['c' + x!].ad(x);
                    }
                    else if (s.delimiter.startsWith(x!)) {
                        m.tx.ge();
                        m[x!].ad(x);
                    }
                    else if (s.eol.startsWith(x!)) {
                        m.tx.ge();
                        m[x!].ad(x);
                    }
                    else m.tx.value = (m.tx.value ?? "") + x!;
                },
                ca() {
                    const s = m.tx.value;
                    m.tx.value = null;
                    m.ls = null;
                    if (s && s.length > 0) m.ad(s);
                },
                ge() {
                    if (m.tx.value && m.tx.value.length > 0) manufacture(Token(m.tx.value, TEXT, line(), line(), position()));
                    m.tx.value = null;
                    m.ls = null;
                },
                value: null,
            }
            m[s.eol[0]] = {//line separator
                value: null,
                ad: (x) => {
                    if (m.ls !== null && m.ls !== s.eol[0]) m[m.ls].ad("");
                    m.ls = s.eol[0];
                    m[s.eol[0]].value = (m[s.eol[0]].value ?? "") + x!;
                    if (m[s.eol[0]].value === s.eol) m[s.eol[0]].ge();
                    else if (m[s.eol[0]].value.length < s.eol.length && m[s.eol[0]].value === s.eol.substring(0, m[s.eol[0]].value.length)) return;
                    else {
                        // m[s.eol[0]].value = m[s.eol[0]].value;
                        m[s.eol[0]].ca();
                    }
                },
                ca: () => {
                    // m.tx.value = m[s.eol[0]].value;
                    // m.ls = "tx";
                    m[s.eol[0]].value = null;
                    m.ls = null;
                    m.ad(m[s.eol[0]].value);
                },
                ge: () => {
                    manufacture(Token(m[s.eol[0]].value as string, SEPARATOR, line(), line(), position()));
                    m[s.eol[0]].value = null;
                    m.ls = null;
                },
            } as Tokenizer;
            //escaped sequences and escaped unicode/encoding
            s.field.escape.encodings.forEach(esc => {
                m[esc.operator[0]] = {
                    value: null,
                    ad: (x) => {
                        if (m.ls !== null && m.ls !== esc.operator[0]) m[m.ls].ad("");
                        m.ls = esc.operator[0];
                        m[esc.operator[0]].value = (m[esc.operator[0]].value ?? "") + x!;
                        if (m[esc.operator[0]].value === s.delimiter) m[esc.operator[0]].ge();
                        else if (m[esc.operator[0]].value.length < s.delimiter.length && m[esc.operator[0]].value === s.delimiter.substring(0, m[esc.operator[0]].value.length)) return;
                        else m[esc.operator[0]].ca();
                    },
                    ca: () => {
                        m[esc.operator[0]].value = null;
                        m.ls = null;
                        m.ad(m[esc.operator[0]].value);
                    },
                    ge: () => {
                        manufacture(Token(m[esc.operator[0]].value as string, ESCAPE, line(), line(), position()));
                        m[esc.operator[0]].value = null;
                        m.ls = "px" + esc.prefix[0];
                    },
                } as Tokenizer;
                m["px" + (esc.prefix[0] ?? "")] = {
                    value: null,
                    ad: (x) => {
                        if (m.ls !== null && m.ls !== "px" + (esc.prefix[0] ?? "")) m[m.ls].ad("");
                        m.ls = "px" + (esc.prefix[0] ?? "");
                        const c = (m[m.ls].value ?? "") as string;//current
                        m[m.ls].value = c + x!;
                        
                        if(esc.prefix !== ""){
                            //tackling the prefixes
                            if(c.length < esc.prefix.length) {// prefix yet to be captured
                                const cx = c + x;
                                if(cx === esc.prefix.substring(0, cx.length)){
                                    m[m.ls].value = cx;
                                    return;
                                } else {
                                    m[m.ls].ca();
                                    return;
                                }
                            } else if(c.length > esc.prefix.length) {// infix and/or suffix index
                                if(esc.suffix.length > 0){
                                    let ix = c.substring(esc.prefix.length);//infix
                                    const ixx = ix + x;
                                    const sx = (c.substring(c.lastIndexOf(esc.suffix[0]))??"");//suffix
                                    const sxx = sx + x;
                                    if(sxx === esc.suffix.substring(0, sxx.length)){//capturing suffix
                                        if(sxx === esc.suffix) {//suffix found!
                                            ix = ix.substring(0, ix.indexOf(esc.suffix[0]));
                                            if(ix.length < esc.min && esc.min > 0) throw new Error("minimum character for character code sequence violated");
                                            if(ix.length > esc.max && esc.max > 0) throw new Error("maximum characters for character code sequence violated");
                                            m[m.ls].ge();
                                            return;
                                        } else {
                                            m[m.ls].value = c + x!;
                                            return;
                                        }
                                    } else if(util.isValid(esc.infix.filter(x => x.startsWith(ixx))[0])){//capturing infix
                                        // if(esc.infix.indexOf(ixx) >= 0) {
                                        // }
                                        m[m.ls].value = c + x!;
                                        return;
                                    } else if(util.isNumber(x!, esc.radix)) {//capturing code points
                                        if(ixx.length > esc.max && esc.max > 0) throw new Error("maximum characters for character code sequence violated");
                                        m[m.ls].value = c + x!;
                                        return;
                                    } else {
                                        m[m.ls].ca();
                                        return;
                                    }
                                } else {
                                    let ix = c.substring(esc.prefix.length);//infix
                                    const ixx = ix + x;
                                    if(util.isValid(esc.infix.filter(x => x.startsWith(ixx))[0])){//capturing infix
                                        m[m.ls].value = c + x!;
                                        if(esc.infix.indexOf(m[m.ls].value) >= 0) m[m.ls].ge();
                                        return;
                                    } else if(util.isNumber(x!, esc.radix)) {//capturing code points
                                        m[m.ls].value = c + x!;
                                        if(ixx.length === esc.max) m[m.ls].ge();
                                        return;
                                    } else if(x === "") {// for '\x23'
                                        // m[m.ls].value = c + x!;
                                        m[m.ls].ge();
                                        return;
                                    } else {
                                        m[m.ls].ca();
                                        return;
                                    }
                                }
                            }
                        } else {
                            if(esc.suffix.length > 0){
                                let ix = c;//infix
                                const ixx = ix + x;
                                const sx = (c.substring(c.lastIndexOf(esc.suffix[0]))??"");//suffix
                                const sxx = sx + x;
                                if(sxx === esc.suffix.substring(0, sxx.length)){//capturing suffix
                                    if(sxx === esc.suffix) {//suffix found!
                                        ix = ix.substring(0, ix.indexOf(esc.suffix[0]));
                                        if(ix.length < esc.min && esc.min > 0) throw new Error("minimum character for character code sequence violated");
                                        if(ix.length > esc.max && esc.max > 0) throw new Error("maximum characters for character code sequence violated");
                                        m[m.ls].ge();
                                        return;
                                    } else {
                                        m[m.ls].value = c + x!;
                                        return;
                                    }
                                } else if(util.isValid(esc.infix.filter(x => x.startsWith(ixx))[0])){//capturing infix
                                    // if(esc.infix.indexOf(ixx) >= 0) {
                                    // }
                                    m[m.ls].value = c + x!;
                                    return;
                                } else if(util.isNumber(x!, esc.radix)) {//capturing code points
                                    if(ixx.length > esc.max && esc.max > 0) throw new Error("maximum characters for character code sequence violated");
                                    m[m.ls].value = c + x!;
                                    return;
                                } else {
                                    m[m.ls].ca();
                                    return;
                                }
                            } else {
                                let ix = c;//infix
                                const ixx = ix + x;
                                if(util.isValid(esc.infix.filter(x => x.startsWith(ixx))[0])){//capturing infix
                                    m[m.ls].value = c + x!;
                                    if(esc.infix.indexOf(m[m.ls].value) >= 0) m[m.ls].ge();
                                    return;
                                } else if(util.isNumber(x!, esc.radix)) {//capturing code points
                                    m[m.ls].value = c + x!;
                                    if(ixx.length === esc.max) m[m.ls].ge();
                                    return;
                                } else if(x === "") {
                                    m[m.ls].value = c + x!;
                                    m[m.ls].ge();
                                    return;
                                } else {
                                    m[m.ls].ca();
                                    return;
                                }
                            }
                        }
                    },
                    ca: () => {
                        m["px" + (esc.prefix[0] ?? "")].value = null;
                        m.ls = null;
                        m.ad(m["px" + (esc.prefix[0] ?? "")].value);
                    },
                    ge: () => {
                        const v = (m[m.ls!].value as string);
                        // const i = v.lastIndexOf(esc.suffix);
                        // if (i < 0 && esc.suffix.length > 0) throw new Error("suffix not found");
                        // manufacture(Token(v.substring(0, i), ESCAPED, line(), line(), position()));
                        manufacture(Token(v, ESCAPED, line(), line(), position()));
                        m[m.ls!].value = null;
                        m.ls = null;
                    },
                } as Tokenizer;
            });
            m.ws = {//whitespace
                value: null,
                ad: (x) => {
                    if (m.ls !== null && m.ls !== "ws") m[m.ls].ad("");
                    m.ls = "ws";
                    if (util.isWhitespace(x!)) m["ws"].value = (m["ws"].value ?? "") + x!;
                    else {
                        m.ws.ge();
                        m.ws.ca();
                    }
                },
                ca: () => {
                    // m.tx.value = m["ws"].value;
                    // m.ls = "tx";
                    m["ws"].value = null;
                    m.ls = null;
                    m.ad(m.ws.value);
                },
                ge: () => {
                    manufacture(Token(m["ws"].value as string, WHITESPACE, line(), line(), position()));
                    m["ws"].value = null;
                    m.ls = null;
                },
            } as Tokenizer;
            m[s.delimiter[0]] = {//field separator
                value: null,
                ad: (x) => {
                    if (m.ls !== null && m.ls !== s.delimiter[0]) m[m.ls].ad("");
                    m.ls = s.delimiter[0];
                    m[s.delimiter[0]].value = (m[s.delimiter[0]].value ?? "") + x!;
                    if (m[s.delimiter[0]].value === s.delimiter) m[s.delimiter[0]].ge();
                    else if (m[s.delimiter[0]].value.length < s.delimiter.length && m[s.delimiter[0]].value === s.delimiter.substring(0, m[s.delimiter[0]].value.length)) return;
                    else m[s.delimiter[0]].ca();
                },
                ca: () => {
                    // m.tx.value = m[s.delimiter[0]].value;
                    // m.ls = "tx";
                    m[s.delimiter[0]].value = null;
                    m.ls = null;
                    m.ad(m[s.delimiter[0]].value);
                },
                ge: () => {
                    manufacture(Token(m[s.delimiter[0]].value as string, SEPARATOR, line(), line(), position()));
                    m[s.delimiter[0]].value = null;
                    m.ls = null;
                },
            } as Tokenizer;
            m["o" + (s.field.quotes[0][0] ?? "")] = {//start quote
                value: null,
                ad: (x) => {
                    if (m.ls !== null && m.ls !== 'o' + (s.field.quotes[0][0] ?? "")) m[m.ls].ad("");
                    m.ls = 'o' + (s.field.quotes[0][0] ?? "");
                    const c = (m[m.ls].value ?? "") + x!;
                    if(m.start) {
                        m['c' + s.field.quotes[1][0]].ad(x);
                        return;
                    } else if(c === s.field.quotes[0][0].substring(0, c.length)){
                        const val = c;
                        if(val === s.field.quotes[0][0]) m[m.ls].ge();
                        else m[m.ls].value = c;
                    } else m[m.ls].ca();
                },
                ca: () => {
                    // m.tx.value = m[s.field.quotes[0][0]].value;
                    // m.ls = "tx";
                    m[s.field.quotes[0][0]].value = null;
                    m.start = false;
                    m.ls = null;
                    m.ad(m[s.field.quotes[0][0]].value);
                },
                ge: () => {
                    manufacture(Token(m[s.field.quotes[0][0]].value as string, L_QUOTE, line(), line(), position()));
                    m.start = true;
                    m[s.field.quotes[0][0]].value = null;
                    m.ls = null;
                },
            } as Tokenizer;
            m['c' + s.field.quotes[1][0]] = {//end quote
                value: null,
                ad: (x) => {
                    if (m.ls !== null && m.ls !== 'c' + (s.field.quotes[1][0] ?? "")) m[m.ls].ad("");
                    m.ls = 'c' + (s.field.quotes[1][0] ?? "");
                    const c = (m[m.ls].value ?? "") + x!;
                    if(!m.start) {
                        m['o' + s.field.quotes[0][0]].ad(x);
                        return;
                    } else if(c === s.field.quotes[1][0].substring(0, c.length)){
                        const val = c;
                        if(val === s.field.quotes[1][0]) m[m.ls].ge();
                        else m[m.ls].value = c;
                    } else m[m.ls].ca();
                },
                ca: () => {
                    // m.tx.value = m[s.field.quotes[1][0]].value;
                    // m.ls = "tx";
                    m[s.field.quotes[1][0]].value = null;
                    m.start = false;
                    m.ls = null;
                    m.ad(m[s.field.quotes[1][0]].value);
                },
                ge: () => {
                    manufacture(Token(m[s.field.quotes[1][0]].value as string, R_QUOTE, line(), line(), position()));
                    m.start = false;
                    m[s.field.quotes[1][0]].value = null;
                    m.ls = null;
                },
            } as Tokenizer;
            m.ad = x => {
                if (util.isValid(m.ls)) m[m.ls!].ad(x);
                else if(x === s.field.quotes[0][0].substring(0, x!.length)) m['o' + s.field.quotes[0][0]].ad(x);
                else if(x === s.field.quotes[1][0].substring(0, x!.length)) m['o' + s.field.quotes[1][0]].ad(x);
                else if (util.isValid(m[x!])) m[x!].ad(x);
                else if (util.isWhitespace(x!)) m.ws.ad(x!);//for whitespaces
                else m.tx.ad(x);
            };
            m.ca = () => {
                if (m.ls !== null && m.ls !== undefined) m[m.ls].ca();
                m.start = false;
            };

            return m;
        }
        const manufacture = (t: Token) => queue.push(t);
        const hasTokens = () => queue.length > 0;
        const canProcess = () => src.length > 0;
        const indexOf = (t: Type) => {
            for (let i = 0; i < queue.length; i++)
                if (queue[i].type!.equals(t)) return i;
            return -1;
        }
        const lastIndexOf = (t: Type) => {
            for (let i = queue.length - 1; i >= 0; i--)
                if (queue[i].type!.equals(t)) return i;
            return -1;
        }
        const end = (s: Syntax) => {
            if (canProcess()) process("", s);
            if (queue[queue.length - 1] && !queue[queue.length - 1].type!.equals(EOL))
                process(s.eol, s);
        }
        const unprocessed = () => nx.src;
        const processed = () => Object.freeze(queue);
        const frequency = (t: Type) => {
            let fx = 0;
            for (let i = 0; i < queue.length; i++) {
                if (queue[i].type!.equals(t)) fx++;
            }
            return fx;
        }
        const position = () => p;
        const line = () => l;
        const nx = (() => {
            while (true) {
                if (!hasTokens()) break;
                return queue.shift()!;
            }
            return Token("", EOF, l, l, p);
        }) as Lexer;
        const shiftSrc = (distance: number) => {
            const rv: string = nx.src.substring(0, distance);
            nx.src = nx.src.substring(distance);
            p += distance;
            return rv;
        }
        // const escIsEven = () => esc % 2 === 0;
        const process = (chunk: string, syntax: Syntax) => {
            (nx as any).mill = constructMill(syntax);
            nx.src += chunk;
            while (nx.src.length > 0) {
                let t = shiftSrc(1);

                // if (!escIsEven()) {
                // } else { }
                nx.mill.ad(t);
            }
        }
        (nx as any).manufacture = manufacture;
        nx.hasTokens = hasTokens;
        nx.canProcess = canProcess;
        nx.indexOf = indexOf;
        nx.lastIndexOf = lastIndexOf;
        nx.end = end;
        nx.unprocessed = unprocessed;
        (nx as any).processed = processed;
        nx.frequency = frequency;
        nx.position = position;
        nx.line = line;
        nx.process = process;
        nx.src = src;
        // (nx as any).mill = {};
        // if(new.target) {
        //     this!.prototype = nx.prototype;
        // } else {}
        return Object.freeze(nx);
    } as LexerConstructor;
    export type Command = mem.parser.GCommand<mem.token.GToken<string>, Expression, Syntax, Lexer, Parser>;
    export type Parser = mem.parser.PrattParser<Expression, Syntax, string>;
    /**
     * A location within a {@linkcode Table}.
     * \
     * A valid value means that the value is a
     * `number` type and can be located on the table without being `undefined` \
     * \
     * A convention of using a `CellIndex` specify a location within a `Table` is as follows:
     * - If both `row` and `col` have valid values, then a cell location has been specified.
     * - If `col` is not valid, then a row location has been specified.
     * - If `row` is not valid, then a column location has been specified.
     */
    export type CellIndex = {
        /**
         * The position of the row in which the cell is located
        */
       row: number;
       /**
        * The position of the column in which the cell is located
       */
      col: number
    };
    export type CellIndexConstructor = {
        new (row?: number | null, col?: number | null): CellIndex;
        (row?: number | null, col?: number | null): CellIndex;
    };
    export const CellIndex = function(this: CellIndex, row?: number | null, col?: number | null) {
        if(new.target){
            this.row = row as number;
            this.col = col as number;
        } else {
            return new CellIndex(row, col);
        }
    } as CellIndexConstructor;
    export type Expression = mem.expression.GExpression<Serializer>;
    /**
    A cell value that represents a singly-linked list that only supports forward traversal such that each index is a text node.
    e.g the field: `"Dave ""Mongoose"" Stick"` will be linked thus:
    1. START_FIELD
    1. PLAIN
    1. ESCAPED
    1. TEXT
    1. ESCAPED
    1. TEXT
    1. END_FIELD
    */
    export type Text = Expression & {
        /**
         * Returns the string value of this text and it.s siblings.
         * When `syntax` is provided, all escapes are converted to their escaped value. e.g
         * the escaped quotes `""` will be converted to `"` else all escapes are returned
         * 'as is'.
         * @param {Syntax} [syntax] an object provided to properly convert escaped characters
         * @returns {string} the value of this text along with the value of other linked texts.
         */
        (syntax?: Syntax): string;
        /**
         * Gets the sibling of this text or checks if this text has a sibling.
         * @param {boolean} next use `true` value to get the sibling or `false` value to check if this `Text` node has a sibling.
         * @returns {Text|null|boolean} the sibling of this element (or `null`
         * if this node does not have any sibling) or `boolean` to check if this node has any sibling.
         */
        (next: boolean): Text | null | boolean;
        /**
         * Adds, deletes or gets the number of nodes in this text depending on the argument(s)
         * @param {number} index a number value to specify whether to get the number of nodes
         * in this text or insert a new text node. A negative value will cause this method to
         * returns the number of nodes in this node. A zero or positive value will cause the this method
         * to perform an insertion (or deletion) of the second argument into the given index.
         * @param {Text | null} [text] an optional value (a mandatory value if insertion is intended) to be
         * inserted into the non-negative index specified by the first index. 
         * @returns {Text | null | number} a number value if the first argument is negative else returns
         * the second argument signifying a successful insert/deletion.
         */
        (index: number, text?: Text | null): Text | null | number;//add, delete, length
    };
    type Plain = Text & {};
    type PC = (s: string, sibling?: Text) => Plain;
    const Plain = function(this: Plain, s: string, sibling: Text|null = null) {
        let sib: Text|null = sibling as Text;//sibling
        const x: (i: number, t?: Text | null) => Text | null | number = (i: number, t?: Text | null) => {
            if(i < 0) return 1 + ((util.isValid(sib) ? sib!(i) : 0) as number);
            if(i === 0) {
                if(t === undefined && sib) {
                    sib = sib(true) as Text;
                } else sib = (t!(t!(-1) as number, sib) as Text);
                return sib;
            } else if(i === 1 && !sib) {sib = t as Text;return sib;}
            return sib!(i - 1, t);
        }
        const n = (next: boolean) => next ? sib : (util.isValid(sib));//next
        const v = (sx?: Syntax) => util.isValid(sib) ? s + sib!(sx) : s;//value
        const d = (str: string) => util.isValid(sib) ? sib!(str + s) : str + s;//debug
        const fe = (e: mem.expression.Expression) => {//from expression
            const p = e();//primitive
            if(!util.isValid(p)) return "";
            return String(p);
        }
        const f = (sz: Serializer, sx: Syntax) => sz(this);
        const p = (a: any, b: any) => {//plain
            switch (arguments.length) {
                case 0:
                default:
                    return v();
                case 1: {
                    if(typeof a === "boolean") return n(a);
                    if(typeof a === "number") return x(a);
                    if(typeof a === "string") return d(a);
                    if(typeof a === "object" && Object.keys(a).filter(x => ["delimeter", "eol", "field", "header"].includes(x)).length > 0) return v(a as Syntax);
                    else return fe(a as mem.expression.Expression);
                }
                case 2:{
                    if(typeof a === "number") return x(a, b as Text);
                    return f(a as Serializer, b as Syntax);
                }
            }
        }
        p.prototype.equals = (o?: object) => {
            return o && (o as any).sib && (o as any).sib! === sib;
        }
        p.prototype.hashCode32 = () => util.asHashable(sib ? sib("") : null).hashCode32();
        return p;
    } as PC
    type Coded = Text & {};
    type CC = (s: string, sibling?: Text | null) => Coded;
    const Coded = function(this: Coded, s: string, sibling: Text|null = null) {
        let sib: Text|null = sibling as Text;//sibling
        const x: (i: number, t?: Text | null) => Text | null | number = (i: number, t?: Text | null) => {
            if(i < 0) return 1 + ((util.isValid(sib) ? sib!(i) : 0) as number);
            if(i === 0) {
                if(t === undefined && sib) {
                    sib = sib(true) as Text;
                } else sib = (t!(t!(-1) as number, sib) as Text);
                return sib;
            } else if(i === 1 && !sib) {sib = t as Text;return sib;}
            return sib!(i - 1, t);
        }
        const n = (next: boolean) => next ? sib : (util.isValid(sib));//next
        const v = (sx?: Syntax) => util.isValid(sib) ? sx!.field.escape.parse(s, sx!) + sib!(sx) : sx!.field.escape.parse(s, sx!);//value
        const d = (str: string) => util.isValid(sib) ? sib!(str + s) : str + s;//debug
        const fe = (e: mem.expression.Expression) => {//from expression
            const p = e();//primitive
            if(!util.isValid(p)) return "";
            return String(p);
        }
        const f = (sz: Serializer, sx: Syntax) => sz(this);
        const p = (a: any, b: any) => {//plain
            switch (arguments.length) {
                case 0:
                default:
                    return v();
                case 1: {
                    if(typeof a === "boolean") return n(a);
                    if(typeof a === "number") return x(a);
                    if(typeof a === "string") return d(a);
                    if(typeof a === "object" && Object.keys(a).filter(x => ["delimeter", "eol", "field", "header"].includes(x)).length > 0) return v(a as Syntax);
                    else return fe(a as mem.expression.Expression);
                }
                case 2:{
                    if(typeof a === "number") return x(a, b as Text);
                    return f(a as Serializer, b as Syntax);
                }
            }
        }
        p.prototype.equals = (o?: object) => {
            return o && (o as any).sib && (o as any).sib! === sib;
        }
        p.prototype.hashCode32 = () => util.asHashable(sib ? sib("") : null).hashCode32();
        return p;
    } as CC
    type StartField = Text & {};
    type SC = (s?: Text | null) => StartField;
    const StartField = function(this: StartField, sib: Text | null = null) {
        const x: (i: number, t?: Text | null) => Text | null | number = (i: number, t?: Text | null) => {
            if(i < 0) return 1 + ((util.isValid(sib) ? sib!(i) : 0) as number);
            if(i === 0) {
                if(t === undefined && sib) {
                    sib = sib(true) as Text;
                } else sib = (t!(t!(-1) as number, sib) as Text);
                return sib;
            } else if(i === 1 && !sib) {sib = t as Text;return sib;}
            return sib!(i - 1, t);
        }
        const n = (next: boolean) => next ? sib : (util.isValid(sib));//next
        const v = (sx?: Syntax) => util.isValid(sib) ? sx!.field.quotes[0] + sib!(sx) : sx!.field.quotes[0];//value
        const d = (str: string) => util.isValid(sib) ? sib!(str + "\"") : str + "\"";//debug
        const fe = (e: mem.expression.Expression) => {//from expression
            const p = e();//primitive
            if(!util.isValid(p)) return "";
            return String(p);
        }
        const f = (sz: Serializer, sx: Syntax) => sz(this);
        const p = (a: any, b: any) => {//plain
            switch (arguments.length) {
                case 0:
                default:
                    return v();
                case 1: {
                    if(typeof a === "boolean") return n(a);
                    if(typeof a === "number") return x(a);
                    if(typeof a === "string") return d(a);
                    if(typeof a === "object" && Object.keys(a).filter(x => ["delimeter", "eol", "field", "header"].includes(x)).length > 0) return v(a as Syntax);
                    else return fe(a as mem.expression.Expression);
                }
                case 2:{
                    if(typeof a === "number") return x(a, b as Text);
                    return f(a as Serializer, b as Syntax);
                }
            }
        }
        p.prototype.equals = (o?: object) => {
            return o && (o as any).sib && (o as any).sib! === sib;
        }
        p.prototype.hashCode32 = () => util.asHashable(sib ? sib("") : null).hashCode32();
        return p;
    } as SC;
    type EndField = Text & {};
    type EC = (s?: Text | null) => EndField;
    const EndField = function(this: EndField, sib: Text | null = null) {
        const x: (i: number, t?: Text | null) => Text | null | number = (i: number, t?: Text | null) => {
            if(i < 0) return 1 + ((util.isValid(sib) ? sib!(i) : 0) as number);
            if(i === 0) {
                if(t === undefined && sib) {
                    sib = sib(true) as Text;
                } else sib = (t!(t!(-1) as number, sib) as Text);
                return sib;
            } else if(i === 1 && !sib) {sib = t as Text;return sib;}
            return sib!(i - 1, t);
        }
        const n = (next: boolean) => next ? sib : (util.isValid(sib));//next
        const v = (sx?: Syntax) => util.isValid(sib) ? sx!.field.quotes[1] + sib!(sx) : sx!.field.quotes[1];//value
        const d = (str: string) => util.isValid(sib) ? sib!(str + "\"") : str + "\"";//debug
        const fe = (e: mem.expression.Expression) => {//from expression
            const p = e();//primitive
            if(!util.isValid(p)) return "";
            return String(p);
        }
        const f = (sz: Serializer, sx: Syntax) => sz(this);
        const p = (a: any, b: any) => {//plain
            switch (arguments.length) {
                case 0:
                default:
                    return v();
                case 1: {
                    if(typeof a === "boolean") return n(a);
                    if(typeof a === "number") return x(a);
                    if(typeof a === "string") return d(a);
                    if(typeof a === "object" && Object.keys(a).filter(x => ["delimeter", "eol", "field", "header"].includes(x)).length > 0) return v(a as Syntax);
                    else return fe(a as mem.expression.Expression);
                }
                case 2:{
                    if(typeof a === "number") return x(a, b as Text);
                    return f(a as Serializer, b as Syntax);
                }
            }
        }
        p.prototype.equals = (o?: object) => {
            return o && (o as any).sib && (o as any).sib! === sib;
        }
        p.prototype.hashCode32 = () => util.asHashable(sib ? sib("") : null).hashCode32();
        return p;
    } as EC;
    export type Cell = Expression & {
        /**
         * Gets the parsed value whereby the initial value of this cell has been processed by all the available parsers
         * (row, column and cell-wise)
         */
        <T>(): T;
        /**
         * Gets the initial value with all escapes intact 'as is'.
         * @param {Syntax} syntax the `Syntax` that was used to create this value.
         * @returns {string} the raw data as a string.
         */
        (syntax?: Syntax): string;//raw data (primitive)
        /**
         * Replaces this cell's value with the second argument, using the first argument as a guide.
         * @param {T} prev the previous value
         * @param {T} value the replacement value
         * @returns {T} the new value.
         */
        <T>(prev: T, value: T): T;//overwrite data
        /**
         * Gets the row, column or cell index of this cell depending on the argument.
         * @param {CellIndex} cell an object representing the type of return value.
         * - If both the `row` and `col` properties are truthy, then the same object is populated with the
         * actual row and column indices (indexes) of this cell.
         * - If only the `row` is truthy, then the row index of this cell is returned as a number.
         * - If only the `col` is truthy, then the column index is returned as a number.
         * @returns {number | CellIndex} a `number` representing either the row or column index
         * of this cell. It may also return a `CellIndex` representing the complete cell location
         * within the given table.
         */
        (cell: CellIndex): number | CellIndex;
        /**
         * Immutable retrieval of all parsers for this cell. Only parsers specifically to this cell are returned.
         * Row-wide and column-wide parsers are not returned.
         * @template T the input data type of the data parameter of the returned functor
         * @template R the output data type of the returned functor
         * @param {never[]} parsers an empty array which will be populated with the parsers for this cell and returned.
         * @returns {(<T, R>((s: Syntax, data: T) => R))[]} an array of all parsers for this cell
         */
        <T, R>(parsers: never[]): ((syntax: Syntax, data?: T) => R)[];//parsers for this cell
        /**
         * Adds (or removes) a parser at the given index. If this is a delete operation, the last argument needs not
         * be given.
         * @param {number} index the index within the list of parser to add this parser. It is also the index (from the
         * list if parsers) from which to remove the parser.
         * @param {boolean} add `true` if an insertion is to be done. `false` if otherwise.
         * @param {(<T, R>(syntax: Syntax, data?: T) => R)} [parser] the parser to be added. This can be ignored if
         * `add` is set to `false`.
         * @returns {boolean} `true` if the operation was successful, `false` if not.
         */
        (index: number, add: boolean, parser?: (<T, R>(syntax: Syntax, data?: T) => R)): boolean;
    };
    export type CellConstructor = {
        // new (cell: CellIndex, text?: Text): Cell;
        (cell: CellIndex, text?: Text | null): Cell;
    }
    export const Cell = function(this: Cell, cell: CellIndex, text: Text | null = null) {
        const i = new CellIndex(cell.row, cell.col);
        const p = (s?: Syntax) => text!(s);
        const f = (e: mem.expression.Expression) => text!(e);
        const g = (f: mem.expression.Format, s?: Syntax) => text!(f, s);
        const o = <T>(prev: T, val: T) => {
        }
    } as CellConstructor;
    export const transpose = Symbol("transpose");
    export const flip = Symbol("flip");
    export const html = Symbol("html");
    export const rLength = Symbol("rLength");
    /**All mutative operations (inserts, appendage, prependage, deletion, swaps, splits & mergers triggers parsers to be called).*/
    export type Table = Expression & {//table headers are at row 0
        (syntax?: Syntax): (readonly string[][]) | readonly Cell[][];//primitive
        /**
         * Gets a row, column or cell in this table either as a formatted string, or an in-memory object.
         * @param {CellIndex} cell the location of the row, column or cell to ge retrieved. The following determines the return value:
         * - If `CellIndex.row` and `CellIndex.col` is set (a valid number), then the given cell/data is returned
         * - If `CellIndex.col` is not given, then the specified row is returned.
         * - If `CellIndex.row` is not given, then the specified column is returned.
         * @param {Syntax} [syntax] a optional `Syntax` object. If given then a `Cell` object will be returned as a cell/data else if ommited
         * then a `string` will be returned as a cell/data.
         * @returns {((readonly string[]) | string | (readonly Cell[]) | Cell)} a row, column or cell within
         * this table, depending on the argument(s).
         */
        (cell: CellIndex, syntax?: Syntax): (readonly string[]) | string | (readonly Cell[]) | Cell;
        /**
         * Get parsers for the given row, column or cell
         */
        <T, R>(cell: CellIndex, parsers: never[]): (<T, R>(cells: Cell[], syntax: Syntax, data?: T) => R)[];
        /**Adds or removes the parser at the given index for the given row, col or cell*/
        (index: number, add: boolean, cellIndex: CellIndex, parser?: (<T, R>(cells: Cell[], syntax: Syntax, data?: T) => R)): boolean;
        /**
         * Inserts, replaces or deletes a cell/column/row at the given location
         * @param {CellIndex} ci the row, column or cell at which the operation
         * is to take place
         * @param {TableUnaryOperation} op the type of operation to be done
         * @param {string|(string|undefined|null)[]} [data] the data for the insert/replace operation. If
         * a row or column operation is intended, then this is expected to be an array else it is expected
         * to be a string (or undefined)
         * @returns {boolean} `true` if the operation was successful else returns `false`
         */
        (ci: CellIndex, op: TableUnaryOperation, data?: string | (string | undefined | null)[]): boolean;
        /**
         * Swaps rows, columns or cells.
         * @param {CellIndex} c1 the left operand of the swap operation
         * @param {CellIndex} c2 the right operand of the swap operation
         * @return {(readonly [Cell, Cell]) | (readonly [Cell[], Cell[]])} the row, column or cell that was swapped after the operation completes
         */
        (c1: CellIndex, c2: CellIndex): (readonly [Cell, Cell]) | (readonly [Cell[], Cell[]]);//swap
        /**
         * Merges rows, columns or cells. The merged data will have the same location(s) as `indexes`
         * @param {CellIndex[]} indexes the locations of the data to be merged
         * @param {Merger} merger a user-defined merging function to be called
         * @return {boolean} a boolean value representing whether the merge was successful
         */
        (indexes: CellIndex[], merger: Merger): boolean;
        /**
         * Merges this table with the argument
         */
        (table: Table): Table | undefined;//merge this with `table`
        /**
         * Splits a row, column or cell into the given number of elements (specified by `src.length`) and
         * inserts the second element of the resultant array into `dst`.
         * @param {CellIndex[]} src the positions of the row, column or cell to be split
         * @param {Splitter} splitter the user-defined splitting function to be called. The first element
         * of the return value will remain in the same position specified by `src`, but the second element
         * of the returned value will be at `dst` or adjacent to `src` (if `dst` is undefined)
         * @param {CellIndex[]} [dst] the optional destinations of resultant elements of the array returned by `splitter`.
         * If this is a `Cell` splitter, then a replacement is done on the positions specified by this argument. This should
         * have the same length as `splitter` or the behaviour of this call will be undefined.
         * @return {boolean} a boolean value representing whether the split was successful
         */
        (src: CellIndex[], splitter: Splitter, dst?: CellIndex[]): boolean;
        [transpose](reverse: boolean): void;//transposes table
        [flip](reverse: boolean): void;//flips table
        [html](previous?: string): string;//pretty print a html table
        [rLength](): number;//max row length
    };
    export interface Serializer extends mem.expression.GFormat<Expression, string> {
        (data?: Expression | string | string[] | string[][] | null): void;
        /**
         * Note that `T` may be `null` or `undefined`
         */
        readonly format: (<T>(cell: CellIndex, value: T) => string);
    }
    export function Test(csv: string, s: Syntax) {
        const l = Lexer() as Lexer;
        l.process(csv, s);
        // console.log(l.mill);
        l.end(s);
        console.table(l.processed());
    }
    Test("jan,\"feb\",mar", {
        delimiter: ",",
        eol: "\n",
        header: [],
        bom: false,
        params: () => ({}) as any,
        field: {
            strict: false,
            spaces: [true, false],
            quotes: ['"', '"'],
            nap: undefined as any as string,
            nop: undefined as any as string,
            parse: (c: CellIndex, v: string) => v as any,
            escape: {
                parse: (s: string) => s,
                encodings: [{
                    infix: [],
                    max: 4,
                    min: 4,
                    operator: "\\",
                    prefix: "u",
                    radix: 16,
                    suffix: ""
                }]
            }
        },
    } as any as Syntax);
}
export default dsv; 