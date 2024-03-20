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
        const header: string[] = [];
        let p = 1, l = 1;
        let mill: TokenFactory;
        let src = "";
        let esc = 0;
        // let escText = "";
        const constructMill = (s: Syntax) => {
            if (nx.mill) return nx.mill;
            const m = { ls: null } as TokenFactory;
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
                        m[x!].ad(x);
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
                        m["px" + (esc.prefix[0] ?? "")].value = (m["px" + (esc.prefix[0] ?? "")].value ?? "") + x!;
                        //tackling the prefixes
                        //It is a prefix so continue
                        if (m["px" + (esc.prefix[0] ?? "")].length
                            <= esc.prefix.length &&
                            m["px" + (esc.prefix[0] ?? "")] === esc.prefix.substring(0, m["px" + (esc.prefix[0] ?? "")].value.length)) {
                            return;
                        }
                        //tackling escape chars such as \r, \n, ""
                        else if (m["px" + (esc.prefix[0] ?? "")].length > esc.prefix.length && esc.infix.indexOf(m["px" + (esc.prefix[0] ?? "")].value.substring(esc.prefix.length)) >= 0) {
                            if (esc.suffix.length === 0) m["px" + (esc.prefix[0] ?? "")].ge();
                        }
                        //tackling hex unicodes/encodings
                        else if (m["px" + (esc.prefix[0] ?? "")].length > esc.prefix.length) {
                            const v = (m["px" + (esc.prefix[0] ?? "")].value.substring(esc.prefix.length) ?? "") as string;
                            if (!util.isNumber(x!, esc.radix)) {
                                if (v.length < esc.min) throw new Error("Not a number", { cause: x });
                            } else if (v.length > esc.max) throw new Error("escape too long");
                            else if (v.length === esc.max) m["px" + (esc.prefix[0] ?? "")].ge();
                        }
                        //tackling suffixes
                        else if (m["px" + (esc.prefix[0] ?? "")].value.length > esc.prefix.length &&
                            m["px" + (esc.prefix[0] ?? "")].value.endsWith(esc.suffix)) { m["px" + (esc.prefix[0] ?? "")].ge(); }
                        // if (m["px" + (esc.prefix[0] ?? "")].value === esc.prefix || x === esc.suffix) m["px" + (esc.prefix[0] ?? "")].ge();
                        // else if (m["px" + (esc.prefix[0] ?? "")].value.length < esc.prefix.length
                        //     && m["px" + (esc.prefix[0] ?? "")].value === esc.prefix.substring(0, m["px" + (esc.prefix[0] ?? "")].value.length)) return;
                        else {
                            m["px" + (esc.prefix[0] ?? "")].ca();
                        }
                    },
                    ca: () => {
                        m["px" + (esc.prefix[0] ?? "")].value = null;
                        m.ls = null;
                        m.ad(m["px" + (esc.prefix[0] ?? "")].value);
                    },
                    ge: () => {
                        const v = (m["px" + (esc.prefix[0] ?? "")].value as string);
                        const i = v.lastIndexOf(esc.suffix);
                        if (i < 0 && esc.suffix.length > 0) throw new Error("suffix not found");
                        manufacture(Token(v.substring(0, i + 1), ESCAPED, line(), line(), position()));
                        m["px" + (esc.prefix[0] ?? "")].value = null;
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
            m[s.field.quotes[0][0]] = {//start quote
                value: null,
                ad: (x) => {
                    if (m.ls !== null && m.ls !== s.field.quotes[0][0]) m[m.ls].ad("");
                    m.ls = s.field.quotes[0][0];
                    m[s.field.quotes[0][0]].value = (m[s.field.quotes[0][0]].value ?? "") + x!;
                    if (m[s.field.quotes[0][0]].value === s.field.quotes[0]) m[s.field.quotes[0][0]].ge();
                    else if (m[s.field.quotes[0][0]].value.length < s.field.quotes[0].length && m[s.field.quotes[0][0]].value === s.field.quotes[0].substring(0, m[s.field.quotes[0][0]].value.length)) return;
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
                    if (m.ls !== null && m.ls !== s.field.quotes[1][0]) m[m.ls].ad("");
                    m.ls = s.field.quotes[1][0];
                    m[s.field.quotes[1][0]].value = (m[s.field.quotes[1][0]].value ?? "") + x!;
                    if (m[s.field.quotes[1][0]].value === s.field.quotes[1]) m[s.field.quotes[1][0]].ge();
                    else if (m[s.field.quotes[1][0]].value.length < s.field.quotes[1].length && m[s.field.quotes[1][0]].value === s.field.quotes[1].substring(0, m[s.field.quotes[1][0]].value.length)) return;
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
                if (util.isValid(m.ls)) m[m.ls!].ad(x);
                else if (util.isValid(m[x!])) m[x!].ad(x);
                else if (util.isWhitespace(x!)) m.ws.ad(x!);//for whitespaces
                else m.tx.ad(x);
            };
            m.ca = () => {
                if (m.ls !== null && m.ls !== undefined) m[m.ls].ca();
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
        const escIsEven = () => esc % 2 === 0;
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
        return nx;
    } as LexerConstructor;
    export type Command = mem.parser.GCommand<mem.token.GToken<string>, Expression, Syntax, Lexer, Parser>;
    export type Parser = mem.parser.PrattParser<Expression, Syntax, string>;
    export type CellIndex = { row: number; col: number };
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
         * The sibling of this text.
         * @param {true} next a `true` value to get the sibling.
         * @returns {Text|null} the sibling of this element or `null` if it has no sibling.
         */
        (next: true): Text | null;
    };
    export type Plain = Text & {};
    export type Raw = Text & {};
    export type StartField = Text & {};
    export type EndField = Text & {};
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
        (syntax: Syntax): string;//raw data (primitive)
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
         * @param {never[]} parsers an empty array which will be populated with the parsers for this cell and returned.
         * @returns {(<T, R>((s: Syntax, r: T) => R))[]} an array of all parsers for this cell
         */
        (parsers: never[]): (<T, R>(syntax: Syntax, raw?: T) => R)[];//parsers for this cell
        /**
         * Adds (or removes) a parser at the given index. If this is a delete operation, the last argument needs not
         * be given.
         * @param {number} index the index within the list of parser to add this parser. It is also the index (from the
         * list if parsers) from which to remove the parser.
         * @param {boolean} add `true` if an insertion is to be done. `false` if otherwise.
         * @param {(<T, R>(syntax: Syntax, raw?: T) => R)} [parser] the parser to be added. This can be ignored if
         * `add` is set to `false`.
         * @returns {boolean} `true` if op was successful, `false` if not.
         */
        (index: number, add: boolean, parser?: (<T, R>(syntax: Syntax, raw?: T) => R)): boolean;
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
        (syntax?: Syntax): (readonly string[][]) | readonly Cell[][];//primitive
        /***/
        (cell: CellIndex, syntax?: Syntax): (readonly string[]) | string | (readonly Cell[]) | Cell
        // (row: Row[]): readonly Row[];//table
        // (row: number): Row;//row
        // (row: undefined | null, col: number): readonly Cell[];// col
        // (row: number, col: number): Cell;//cell
        (row: number, col: number, cell: Cell): boolean;//replace the cell
        (c1: CellIndex, c2: CellIndex): readonly [Cell, Cell];//swap cells
        (cell: false, row: number): boolean;//row delete
        (cell: Cell, row: number): void;//row append
        (cell: undefined | null, row: undefined, col: number): void;//col append
        (cell: false, row: undefined, col: number): void;//col delete
        (cell: Cell, row: undefined, col: number): void;//col append
        (cell: undefined | null, row: number, col: number): void;//delete
        (cell: Cell, row: number, col: number): void;//insert/overwrite
        (col1: util.DecimalString, col2: util.DecimalString, merger: (c1: Cell, c2: Cell) => Cell): boolean//merge cols
        (r1: number, r2: number, merger: (c1: Cell, c2: Cell) => Cell): boolean//merge cols
        (table: Table): boolean//merge this with `table`
        (row: number, splitter: (cell: Cell) => [Cell, Cell]): boolean//split row
        (col: util.DecimalString, splitter: (cell: Cell) => [Cell, Cell]): boolean//split col
        <T>(col: number, parsers: []): ((raw: string) => T)[];
        [transpose](reverse: boolean): void;//transposes table
        [flip](reverse: boolean): void;//flips table
        [swap](r1: number, r2: number): void;//swaps rows in table
        [swap](cl1: util.DecimalString, cl2: util.DecimalString): void;//swaps col in table
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
    export function Test(csv: string, s: Syntax) {
        const l = Lexer() as Lexer;
        l.process(csv, s);
        // console.log(l.mill);
        l.end(s);
        console.table(l.processed());
    }
    Test("jan,feb,mar", {
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
        }
    } as any as Syntax);
}
export default dsv; 