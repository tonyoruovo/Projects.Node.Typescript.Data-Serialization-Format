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
    export const SEPARATOR = Type("1", 2);
    export const EOL = Type("2", 2);
    export const ESCAPE = Type("3", 2);
    export const ESCAPED = Type("4", 2);
    export const TEXT = Type("5", 2);
    export const WHITESPACE = Type("6", 2);
    export const L_QUOTE = Type("6", 2);
    export const R_QUOTE = Type("7", 2);
    // export const FIELD = Type("3", 2);
    export const EOF = Type("-1", 2);
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
                     * - using C-based escape this value in `\u002a` will be `4`
                     * - using xml-based escape this value in `&#x002a;` will be `1`
                     * - using xml-based escape this value in `&#0042;` will be `1`
                     * - using css-based escape this value in `'\0042'` will be `4`
                     * - using js-based (ES6) escape this value in `\x2a` will be `2`
                     * - using js-based (ES6) escape this value in `\x{2a}` will be `1`
                     */
                    readonly min: number;
                    /**
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
                readonly parse: ((rawEscape: string) => string);
            };
            readonly parse: (<T>(cell: CellIndex, value?: string) => T);
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
    export const Lexer = function(this: Lexer | void) {
        type TokenFactory = mem.parser.TokenFactory;
        type Tokenizer = mem.parser.Tokenizer;
        const queue: Token[] = [];
        const header: string[] = [];
        let p = 1, l = 1;
        let mill: TokenFactory;
        let src = "";
        let esc = 0;
        let escText = "";
        const constructMill = (s: Syntax) => {
            if(nx.mill) return nx.mill;
            const m = {ls: null} as TokenFactory;
            m[s.eol[0]] = {//line separator
                value: null,
                ad: (x) => {
                    if(m.ls !== null && m.ls !== s.eol[0]) m[m.ls].ad("");
                    m.ls = s.eol[0];
                    m[s.eol[0]].value = (m[s.eol[0]].value ?? "") + x!;
                    if(m[s.eol[0]].value === s.eol) m[s.eol[0]].ge();
                    else if(m[s.eol[0]].value.length < s.eol.length && m[s.eol[0]].value === s.eol.substring(0, m[s.eol[0]].value.length)) return;
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
                        if(m.ls !== null && m.ls !== esc.operator[0]) m[m.ls].ad("");
                        m.ls = esc.operator[0];
                        m[esc.operator[0]].value = (m[esc.operator[0]].value ?? "") + x!;
                        if(m[esc.operator[0]].value === s.delimiter) m[esc.operator[0]].ge();
                        else if(m[esc.operator[0]].value.length < s.delimiter.length && m[esc.operator[0]].value === s.delimiter.substring(0, m[esc.operator[0]].value.length)) return;
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
                m["px" + esc.prefix[0]] = {
                    value: null,
                    ad: (x) => {
                        if(m.ls !== null && m.ls !== "px" + esc.prefix[0]) m[m.ls].ad("");
                        m.ls = "px" + esc.prefix[0];
                        m["px" + esc.prefix[0]].value = (m["px" + esc.prefix[0]].value ?? "") + x!;
                        if(m["px" + esc.prefix[0]].value === esc.prefix || x === esc.suffix) m["px" + esc.prefix[0]].ge();
                        else if(m["px" + esc.prefix[0]].value.length < esc.prefix.length
                        && m["px" + esc.prefix[0]].value === esc.prefix.substring(0, m["px" + esc.prefix[0]].value.length)) return;
                        else {
                            m["px" + esc.prefix[0]].ca();
                        }
                    },
                    ca: () => {
                        m["px" + esc.prefix[0]].value = null;
                        m.ls = null;
                        m.ad(m["px" + esc.prefix[0]].value);
                    },
                    ge: () => {
                        manufacture(Token(m["px" + esc.prefix[0]].value as string, ESCAPE, line(), line(), position()));
                        m["px" + esc.prefix[0]].value = null;
                        m.ls = "px" + esc.prefix[0];
                    },
                } as Tokenizer;
            });
            m.ws = {//whitespace
                value: null,
                ad: (x) => {
                    if(m.ls !== null && m.ls !== "ws") m[m.ls].ad("");
                    m.ls = "ws";
                    if(util.isWhitespace(x!)) m["ws"].value = (m["ws"].value ?? "") + x!;
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
                    if(m.ls !== null && m.ls !== s.delimiter[0]) m[m.ls].ad("");
                    m.ls = s.delimiter[0];
                    m[s.delimiter[0]].value = (m[s.delimiter[0]].value ?? "") + x!;
                    if(m[s.delimiter[0]].value === s.delimiter) m[s.delimiter[0]].ge();
                    else if(m[s.delimiter[0]].value.length < s.delimiter.length && m[s.delimiter[0]].value === s.delimiter.substring(0, m[s.delimiter[0]].value.length)) return;
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
            m[s.field.quotes[0][0]] = {//start quote
                value: null,
                ad: (x) => {
                    if(m.ls !== null && m.ls !== s.field.quotes[0][0]) m[m.ls].ad("");
                    m.ls = s.field.quotes[0][0];
                    m[s.field.quotes[0][0]].value = (m[s.field.quotes[0][0]].value ?? "") + x!;
                    if(m[s.field.quotes[0][0]].value === s.field.quotes[0]) m[s.field.quotes[0][0]].ge();
                    else if(m[s.field.quotes[0][0]].value.length < s.field.quotes[0].length && m[s.field.quotes[0][0]].value === s.field.quotes[0].substring(0, m[s.field.quotes[0][0]].value.length)) return;
                    else m[s.field.quotes[0][0]].ca();
                },
                ca: () => {
                    // m.tx.value = m[s.field.quotes[0][0]].value;
                    // m.ls = "tx";
                    m[s.field.quotes[0][0]].value = null;
                    m.ls = null;
                    m.ad(m[s.field.quotes[0][0]].value);
                },
                ge: () => {
                    manufacture(Token(m[s.field.quotes[0][0]].value as string, L_QUOTE, line(), line(), position()));
                    m[s.field.quotes[0][0]].value = null;
                    m.ls = null;
                },
            } as Tokenizer;
            m[s.field.quotes[1][0]] = {//end quote
                value: null,
                ad: (x) => {
                    if(m.ls !== null && m.ls !== s.field.quotes[1][0]) m[m.ls].ad("");
                    m.ls = s.field.quotes[1][0];
                    m[s.field.quotes[1][0]].value = (m[s.field.quotes[1][0]].value ?? "") + x!;
                    if(m[s.field.quotes[1][0]].value === s.field.quotes[1]) m[s.field.quotes[1][0]].ge();
                    else if(m[s.field.quotes[1][0]].value.length < s.field.quotes[1].length && m[s.field.quotes[1][0]].value === s.field.quotes[1].substring(0, m[s.field.quotes[1][0]].value.length)) return;
                    else m[s.field.quotes[1][0]].ca();
                },
                ca: () => {
                    // m.tx.value = m[s.field.quotes[1][0]].value;
                    // m.ls = "tx";
                    m[s.field.quotes[1][0]].value = null;
                    m.ls = null;
                    m.ad(m[s.field.quotes[1][0]].value);
                },
                ge: () => {
                    manufacture(Token(m[s.field.quotes[1][0]].value as string, R_QUOTE, line(), line(), position()));
                    m[s.field.quotes[1][0]].value = null;
                    m.ls = null;
                },
            } as Tokenizer;
            m.ad = x => {
                if(m.ls !== null) m[m.ls].ad(x);
                else if (util.isValid(m[x!])) m[x!].ad(x);
                else if(util.isWhitespace(x!)) m.ws.ad(x!);//for whitespaces
                else m.tx.ad(x);
            };
            m.ca = () => {
                // if(m.ls !== null && m.ls)
            };

            return m;
        }
        const manufacture = (t: Token) => queue.push(t);
        const hasTokens = () => queue.length > 0;
        const canProcess = () => src.length > 0;
        const indexOf = (t: Type) => {
            for(let i = 0; i < queue.length; i++)
                if(queue[i].type!.equals(t)) return i;
            return -1;
        }
        const lastIndexOf = (t: Type) => {
            for(let i = queue.length - 1; i >= 0; i--)
                if(queue[i].type!.equals(t)) return i;
            return -1;
        }
        const end = (s: Syntax) => {
            if(canProcess()) process("", s);
            if(queue[queue.length - 1] && !queue[queue.length - 1].type!.equals(EOL))
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
            while(true) {
                if(!hasTokens()) break;
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
        const escIsEven = () => esc % 2 === 0;
        const process = (chunk: string, syntax: Syntax) => {
            (nx as any).mill = constructMill(syntax);
            nx.src += chunk;
            while(nx.src.length > 0) {
                let t = shiftSrc(1);

                if(!escIsEven()) {
                } else {}
            }
        }
        nx.prototype.manufacture = manufacture;
        nx.prototype.hasTokens = hasTokens;
        nx.prototype.canProcess = canProcess;
        nx.prototype.indexOf = indexOf;
        nx.prototype.lastIndexOf = lastIndexOf;
        nx.prototype.end = end;
        nx.prototype.unprocessed = unprocessed;
        nx.prototype.processed = processed;
        nx.prototype.frequency = frequency;
        nx.prototype.position = position;
        nx.prototype.line = line;
        nx.prototype.process = process;
        nx.prototype.src = src;
        nx.prototype.mill = {};
        // if(new.target) {
        //     this!.prototype = nx.prototype;
        // } else {}
        return nx;
    } as LexerConstructor;
    export type Command = mem.parser.GCommand<mem.token.GToken<string>, Expression, Syntax, Lexer, Parser>;
    export type Parser = mem.parser.PrattParser<Expression, Syntax, string>;
    export type CellIndex = {row: number; col: number};
    export type Expression = mem.expression.GExpression<Serializer>;
    export type Text = Expression & {
        (): string;
    };
    export type Plain = Text & {};
    export type Raw = Text & {};
    export type StartField = Text & {};
    export type EndField = Text & {};
    export type Cell = Expression & {
        /**
         * @param {util.Truthy} parse a truthy value specifying whether the to be value retrieved should be parsed before this retrieval
         * @template {*} T the type of value to be retrieved if a truthy value was used as the argument.
         * @returns {T | string} a value of type `T` if a truthy was passed as the argument or else the raw value of the cell
         * will be returned as a `string`.
         */
        <T>(parse: null): T;
        (): string;//raw data
        (raw: string): string;//overwrite data
        (row: true): number;//row num
        (col: false): number;//col num
        (parsers: []): (<T>(raw: string) => T)[];//parsers for this cell
    };
    export type Row = Expression & {
        (): readonly string[];//primitive
        (c: CellIndex): readonly Cell[];
        (col: number): Cell;
        (cell: Cell): void;//append to this row
        (cell: readonly Cell[]): void;//overwrite/replace this row
        (cell: Cell, col: false): void;//prepend to this row
        (cell: Cell, col: number): void;//insert/overwrite
        (parsers: []): (<T>(raw: string) => T)[];//parsers for this row
        <T>(parse: null): T;//reduce this row
        (r: Row, merger?: (c1: Cell, c2: Cell) => Cell): boolean; // merge
    };
    export const transpose = Symbol("transpose");
    export const flip = Symbol("flip");
    export const swap = Symbol("swap");
    export const html = Symbol("html");
    export type Table = Expression & {//table headers are at row 0
        (): readonly string[][];//primitive
        (c: {}): readonly Row[];//table
        (row: number): Row;//row
        (row: undefined | null, col: number): readonly Cell[];// col
        (row: number, col: number): Cell;//cell
        (row: number, col: number, cell: Cell): boolean;//replace the cell
        (c1: CellIndex, c2: CellIndex): readonly [Cell, Cell];//swap cells
        (cell: false, row: number): boolean;//row delete
        (cell: Cell, row: number): void;//row append
        (cell: undefined | null, row: undefined, col: number): void;//col append
        (cell: false, row: undefined, col: number): void;//col delete
        (cell: Cell, row: undefined, col: number): void;//col append
        (cell: undefined | null, row: number, col: number): void;//delete
        (cell: Cell, row: number, col: number): void;//insert/overwrite
        (col1: util.NumericString, col2: util.NumericString, merger: (c1: Cell, c2: Cell) => Cell): boolean//merge cols
        (r1: number, r2: number, merger: (c1: Cell, c2: Cell) => Cell): boolean//merge cols
        (table: Table): boolean//merge this with `table`
        (row: number, splitter: (cell: Cell) => [Cell, Cell]): boolean//split row
        (col: util.NumericString, splitter: (cell: Cell) => [Cell, Cell]): boolean//split col
        [transpose](reverse: boolean): void;//transposes table
        [flip](reverse: boolean): void;//flips table
        [swap](r1: number, r2: number): void;//swaps rows in table
        [swap](cl1: util.NumericString, cl2: util.NumericString): void;//swaps col in table
        [swap](c1: Cell, c2: Cell): void;//swaps cells in table
        [html](previous?: string): string;//pretty print a html table
    };
    export interface Serializer extends mem.expression.GFormat<Expression, string> {
        (data?: Expression | string | string[] | string[][] | null): void;
        /**
         * Note that `T` may be `null` or `undefined`
         */
        readonly format: (<T>(cell: CellIndex, value: T) => string);
    }
}
export default dsv; 