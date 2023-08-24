import { ReadStream } from "fs";
import utility from "../utility.js";
import expression from "./expression.js";
import json from "./json.js";
import parser from "./parser.js";
/**
 * #### Examples
 * - .ini
 * - .conf
 * - .cfg
 * - .desktop
 * - git config file
 * - php config file
 * 
 * #### tokens
 * - `[` --> *section start*
 * - `'` --> *quote*
 * - `"` --> *double quote*
 * - **_plain text_** --> *untokenised string of characters*
 * - `'` --> *quote end*
 * - `"` --> *double quote end*
 * - `.` --> *sub-section*
 * - `]` --> *section end*
 * - `;` --> *comment*
 * - `=` --> *assignment*
 * - `\` --> *escape*
 * - **_escaped text_** --> *escaped* - text precede by an *escape*
 * 
 * @summary Defines the constituents of the ini pipeline.
 * @description The ini pipeline constitutes tokenisers (lexers) for tokenising text and json data; a parser which translates the
 * tokens into expressions; formatters which can create file, in-memory and simple string formats; a converter which binds several
 * of the aforementioned components so that the data contained within can be tranferred to other data languages seamlessly.
 */
namespace ini {
    function mergeTokens(t: Token[]){
        let text = "";
        for (let i = 0; i < t.length; i++) {
            text += t[i].value;
        }
        return text;
    }
    export class SyntaxBuilder implements utility.Builder<Syntax> {}
    /**
     * Duplicate properties merge values and duplicate sections merge their properties
     */
    export interface Syntax extends parser.GSyntax<Type, Command>{
        /**
         * An object that specifies how comments are parsed
         */
        readonly comments: {
            /**
             * A check that specifies whether to store comments. If `true`, comments can be found in the {@link Expression} it precedes
             * @type {boolean}
             * @readonly
             */
            readonly retain: boolean,
            /**
             * The single characters that starts an inline comment. For example [pacman.conf](https://archlinux.org/pacman/pacman.conf.5.html) uses the `'#'` character, windows uses the `';'` character
             * and [apache commons configuration api](https://commons.apache.org/proper/commons-configuration/apidocs/org/apache/commons/configuration2/INIConfiguration.html) supports both
             */
            readonly chars: string[]
            /**
             * Enables support for inline comments where a comment may exit on any line. A `false` value ensures that all comments are the only tokens on a line. For example:
             * a `true` value enables parsing of:
             * ```ini
             * ; a comment on it's own line
             * [section]
             * name = value
             * another = anotherValue ; an inline comment
             * ```
             * but a `false` will cause the parser to add the inline comment as part of the property `another`'s value i.e `anotherValue ; an inline comment` will be regarded as a single value, hence
             * all comments must occur on lines by themslves.
             */
            readonly inline: boolean;
        };
        /**
         * The characters used for delimiting a name from it's value within a property. As an example, most ini file use:
         * ```ini
         * [section]
         * name1 = value1
         * name2 = value2
         * ; ... and so on
         * ```
         * but some may use
         * ```txt
         * [section]
         * name1 : value1
         * name2 : value2
         * ; ... and so on
         * ```
         * and some supports both syntax such that
         * ```txt
         * [section]
         * name1 : = value1
         * name2 = : value2
         * ; ... and so on
         * ```
         * is a valid syntax
         */
        readonly delimiters: string[];
        /**If this is `null` or `undefined`, nesting is not considered, else if it is in a quoted string, then it must be escaped or an error is thrown */
        readonly nesting?: {
            /**
             * All the characters used for delimiting child sections from their parent
             * @type {string[]}
             * @readonly
             */
            readonly chars: string[],
            /**
             * Allows for a syntax that uses nesting chars at the start of a section name e.g `[.section]`. A `false`value will parse `[.section]` as a single
             * section name disregarding the "parent" section and will only assign a section as a child of another if it is written as `'[section.subsection]'`.
             * @type {boolean}
             * @readonly
             */
            readonly relative: boolean
        };
        /**
         * Allows quoted values to be used to escape whitespaces and special characters
         * @type {boolean}
         * @readonly
         */
        readonly quoted: boolean;
        /**An object that specifies how escaped sequences are parsed. If `undefined` or `null`, then no escape will be supported */
        readonly escape?: {
            /**
             * The characters, when placed after an {@link Syntax.escape.char escape character} tells the parser that a unicode hex literal follows.
             * The standard values includes `'u'` and `'x'` such that `'\u20'` and `'\x20'` are equal. This enables the ini parser to be compatible
             * with properties documents.
             * @type {string}
             * @readonly
             */
            readonly unicode: string[],
            /**
             * The single character `string` used for escaping special and escapable characters. A list of escapable characters include:
             * |Character|Standard escaped meaning|Standard unescaped meaning|
             * |---|:---:|:---:|
             * |`\`|A single backslash|Used as the escaped character to escape the character that comes after it|
             * |`'`|An apostrophe|1 of 2 characters used for quoting property names/values to enable embeding of escapable characters in the name/values without being explicitly being escaped|
             * |`"`|Double quotes|1 of 2 characters used for quoting property names/values to enable embeding of escapable characters in the name/values without being explicitly being escaped|
             * |`0`|ascii null character `\u0000`|The digit `0`|
             * |`a`|Bell/Alert/Audible|the letter `'a'`|
             * |`b`|Backspace, Bell for some applications|the letter `'b'`|
             * |`t`|tab|the letter `'t'`|
             * |`r`|Carriage return|the letter `'r'`|
             * |`n`|Line feed|the letter `'n'`|
             * |`;`|Semicolon|the start of a comment|
             * |`#`|Number sign|the start of a comment|
             * |`=`|Equals sign|Operator that assigns a value to a property|
             * |`:`|Colon|Operator that assigns a value to a property|
             * |`x????`|A unicode character whose hex representation is `????`|As is|
             * 
             * @type {string}
             * @readonly
             */
            readonly char: string,
            /**
             * Parses the 2-length string (and if the `unicode` property has at least 1 element, parses unicode escapes as well such as `\x20`) and returns an appropriate string for an escaped character
             * @param esc a 2-length string given as the escape character, and the character it escapes
             * @returns {string} a `string` which is defined as the in-memory representation of the argument
             */
            parse(esc: string): string,
        }
        /**
         * User defined parsing of a property's value to determine the json data type. This enables users to define the in-memory data type they want for a specific
         * value
         * @remark
         * This is only for the value part of a property.
         * @param value a property value
         * @returns {json.Value} the in-memory data to be associated with the argument.
         */
        parse(value: string): json.Value;
    }
    export class Params {
        /**
         * The current section's name i.e the section being parsed
         * @type {string}
         */
        section: string[] = [];
        /**An array of strings representing consecutiveline of comments. This value is empty the moment a {@link Section} or {@link Property} is parsed. */
        block = Array<string>();
        /**inline comments complete with their line number and actual comment */
        inline: Map<number, string> = new Map();
    }
    /**
     * - `'['` section start
     * - `']'` section end
     * - `'='` assignment within a property
     * - `';'` `'#'` `'!'` comment start (comment may be retained by configuring the syntax so)
     * - **text** these are the names of sections, properties and the value of a property.
     */
    class Type implements parser.GType<string> {
        /**
         * Constructs a `Type` with an assigned unique id and precedence.
         * @param {string} id a unique id associated with this {@link parser.Type}
         * @param {number} precedence the precedence of this type. This determines how it will be evaluated in the evaluation hierarchy (per se)
         */
        public constructor(
          public readonly id: string,
          public readonly precedence: number
        ) {}
    
        /**
         * Test the equality of this `Type` to the given input
         * @param {(object|undefined)} obj any object to test against `this`
         * @returns {boolean} `true` if `this` is equal to the input and `false` if otherwise.
         */
        public equals(obj?: object): boolean {
          if (obj instanceof Type)
            return this.id === obj.id && this.precedence === obj.precedence;
          return false;
        }
    }
    export const EOF: parser.GType<string> = new Type("-1", Number.MIN_SAFE_INTEGER);
    export const EOL: parser.GType<string> = new Type("0", 1);
    // export const LINE: parser.GType<string> = new Type("1", 2);
    export const SECTION_START: parser.GType<string> = new Type("1", 2);
    export const QUOTE: parser.GType<string> = new Type("2", 2);
    export const D_QUOTE: parser.GType<string> = new Type("3", 2);
    export const TEXT: parser.GType<string> = new Type("4", 2);
    // export const SECTION_START: parser.GType<string> = new Type("1", 2);
    export const SUB_SECTION: parser.GType<string> = new Type("5", 2);
    export const SECTION_END: parser.GType<string> = new Type("6", 2);
    export const ASSIGNMENT: parser.GType<string> = new Type("7", 2);
    export const COMMENT: parser.GType<string> = new Type("8", 2);
    export const QUOTE_END: parser.GType<string> = new Type("9", 2);
    export const D_QUOTE_END: parser.GType<string> = new Type("10", 2);
    export const ESCAPE: parser.GType<string> = new Type("11", 2);
    export const ESCAPED: parser.GType<string> = new Type("12", 2);
    class Token implements parser.GToken<string> {
        public readonly length;
        constructor(
            public readonly value: string,
            public readonly type: Type,
            public readonly lineStart: number,
            public readonly lineEnd: number,
            public readonly startPos: number
            // public readonly names?: string[]
        ){
            this.length = value.length;
        }
        public toString() {
          return JSON.stringify(
            { token: this.value, type: this.type.toString() },
            null,
            2
          );
        }
    }
    export interface MutableLexer<CH = string> extends parser.MutableLexer<Token, Syntax, CH> {
      end(syntax: Syntax, p: Params | any): void;
      process(chunk: CH, syntax: Syntax, p: Params | any): void;
    //   readonly bytes?: number;
    }
    export class JSONLexer implements MutableLexer<json.Value>{}
    /**Since this is a line oriented data-serialisation-format, strings are tokenised by lines and not individually */
    export class StringLexer implements MutableLexer{
        #ln: number;
        #li: number;
        #queue: Token[];
        public src: string;
        #esc;//number of escape characters found on a line
        #text;
        #escText;
        #qt = false;//check for quote start. true means the next quote will be a closing one
        #com = "";//comments
        constructor() {
            this.#ln = 0;
            this.#li = 0;
            this.#queue = [];
            this.src = "";
            this.#esc = 0;
            this.#text = "";
            this.#escText = "";
        }
        #eol = '\n';//utility.eol;
        #escEven(){
            return this.#esc % 2 == 0;
        }
        #shiftSrc(distance: number) {
            if(distance > this.src.length) return undefined;
            const rv = this.src.substring(0, distance);
            this.src = this.src.substring(distance);
            return rv;
        }
        #manufacture(t: Token) {
            this.#queue.push(t);
        }
        end(syntax: Syntax, params: Params): void {
            if(this.canProcess()) this.process("", syntax, params);
            if(this.#queue[this.#queue.length - 1] && !this.#queue[this.#queue.length - 1].type.equals(EOL))
                this.process(this.#eol, syntax, params);
        }
        process(chunk: string = "", syntax: Syntax, p: Params): void {
            this.src += chunk;
            while (this.src.length > 0) {
                const token = this.#shiftSrc(1)!;
                this.#li++;
                if(!this.#escEven()){
                    if(this.#escText.length === 0){
                        this.#escText += token;
                        if(!syntax.escape!.unicode.indexOf(this.#escText[0])){
                            this.#manufacture(new Token(this.#escText, ESCAPED, this.#ln, this.#ln, this.#li));
                            this.#escText = "";
                            this.#esc = 0;
                        }
                    } else if(/[A-Fa-f0-9]/.test(token)) {
                        this.#escText += token;
                        if(this.#escText.length === 4) {
                            this.#manufacture(new Token(this.#escText, ESCAPED, this.#ln, this.#ln, this.#li));
                            this.#escText = "";
                            this.#esc = 0;
                        }
                    } else {
                        this.#manufacture(new Token(this.#escText, ESCAPED, this.#ln, this.#ln, this.#li));
                        this.#escText = "";
                        this.#esc = 0;
                        this.#text += token;
                    }
                    if(this.#escText.length === 0)
                    this.#escText += token;
                    /*If the escape sequence is not a unicode escape sequence, then a single character would suffice to be escaped */
                    if(!syntax.escape!.unicode.indexOf(this.#escText[0])) {
                    } else if(!/[A-Fa-f0-9]/.test(token)) {
                        this.#manufacture(new Token(this.#escText, ESCAPED, this.#ln, this.#ln, this.#li));
                        this.#escText = "";
                        this.#esc = 0;
                    }
                } else if(token === this.#eol) {
                    if(this.#com.length > 0){
                        this.#manufacture(new Token(this.#com, COMMENT, this.#ln, this.#ln, this.#li - this.#com.length));
                        this.#com = "";
                    } else if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, EOL, this.#ln, this.#ln, this.#li - token.length));
                    this.#escText = "";
                    this.#esc = 0;
                } else if(syntax.comments.chars.indexOf(token) > -1 || this.#com.length > 0) {
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#com += token;
                } else if(utility.isValid(syntax.escape) && syntax.escape!.char === token) {//an escape character?
                    this.#esc++;
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, ESCAPE, this.#ln, this.#ln, this.#li - token.length));
                } else if(token === '[') {
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, SECTION_START, this.#ln, this.#ln, this.#li - token.length));
                    this.#escText = "";
                    this.#esc = 0;
                } else if(token === ']') {
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, SECTION_END, this.#ln, this.#ln, this.#li - token.length));
                    this.#escText = "";
                    this.#esc = 0;
                } else if(token === "'" && syntax.quoted) {
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, this.#qt ? QUOTE_END : QUOTE, this.#ln, this.#ln, this.#li - token.length));
                    this.#qt = !this.#qt;
                    this.#escText = "";
                    this.#esc = 0;
                } else if(token === '"' && syntax.quoted) {
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, this.#qt ? D_QUOTE_END : D_QUOTE, this.#ln, this.#ln, this.#li - token.length));
                    this.#qt = !this.#qt;
                    this.#escText = "";
                    this.#esc = 0;
                } else if(utility.isValid(syntax.nesting) && syntax.nesting!.chars.indexOf(token) > -1) {
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, SUB_SECTION, this.#ln, this.#ln, this.#li - token.length));
                    this.#escText = "";
                    this.#esc = 0;
                } else if(syntax.delimiters.indexOf(token) > -1) {
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, ASSIGNMENT, this.#ln, this.#ln, this.#li - token.length));
                    this.#escText = "";
                    this.#esc = 0;
                } else {
                    this.#text += token;
                }
            }
        }
        processed = () => this.#queue;
        unprocessed = () => this.src;
        frequency(type: parser.Type): number {
            let frqy = 0;
            for (let i = 0; i < this.#queue.length; i++) {
              if (this.#queue[i].type.equals(type)) frqy++;
            }
            return frqy;
        }
        indexOf(type: parser.Type): number {
            for (let i = 0; i < this.#queue.length; i++) {
              if (this.#queue[i].type.equals(type)) return i;
            }
            return -1;
        }
        lastIndexOf(type: parser.Type): number {
            for (let i = this.#queue.length - 1; i >= 0; i--) {
              if (this.#queue[i].type.equals(type)) return i;
            }
            return -1;
        }
        hasTokens(): boolean {
            return this.#queue.length > 0;
        }
        canProcess(): boolean {
            return this.src.length > 0;
        }
        next(): Token {
            while (true) {
              if (!this.hasTokens()) break;
              return this.#queue!.shift()!;
            }
            return new Token("", EOF, this.line(), this.line(), this.position());
        }
        position(): number {
            return this.#li;
        }
        line(): number {
            return this.#ln
        }
    }
    export interface Command extends parser.GCommand<Token, Expression, Syntax, MutableLexer, Parser> {
      parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer, s: Syntax, pa?: Params): Expression;
    }
    class Comment implements Command {
        parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer<string>, s: Syntax, pa?: Params | undefined): Expression {
            ap ??= new Section({preceding:Object.freeze([])});
            if(s.comments.retain){
                const tokens = Array<Token>();
                if(p.match(COMMENT, l, s, pa)) tokens.push(p.consume(COMMENT, l, s, pa) as Token);
                pa!.block.push(mergeTokens(tokens))
            }
            p.consume(EOL, l, s, pa);
            return ap;
        }
    }
    class SectionCmd implements Command {
        #traverseSection(names: string[], exp: Expression, value?: string, comments?: {readonly preceding: readonly string[], readonly inline?: string}): void {
            if(utility.isValid(value) && names.length === 1) {
                const name = names.shift()!;
                let property = (exp as Section).get(name);
                if(!utility.isValid(property)) property = new Property(comments ?? {preceding: Object.freeze([])});
                else if(!(property instanceof Property)) throw new parser.ParseError("section name and property name collide");
                (property as Property).add(value!);
                return;
            } else if(names.length === 0) return;
            let name = names.shift()!;
            let section = (exp as Section).get(name);
            if(!utility.isValid(section)) {
                section = new Section({preceding: Object.freeze([])});
                (exp as Section).add(name, section);
            } else if(!(section instanceof Section)) throw new parser.ParseError("section name and property name collide");
            return this.#traverseSection(names, section, value);
        }
        parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer<string>, s: Syntax, pa?: Params | undefined): Expression {
            ap ??= new Section({preceding:Object.freeze([])});
            const section = Array<string>();
            while(true){
                if(p.match(SUB_SECTION, l, s, pa)){}
            }
            do {
                if(p.match(SUB_SECTION, l, s, pa)) p.consume(SUB_SECTION, l, s, pa);
                const text = p.parseWithPrecedence(yp.type.precedence, l, s, pa);
                if(text instanceof Text){
                    section.push(text.text);
                }
                else throw new parser.ParseError("section name not found")
            } while (p.match(SUB_SECTION, l, s, pa));
            p.consume(SUB_SECTION, l, s, pa);
            return ap;
        }
    }
    class String implements Command {
        parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer<string>, s: Syntax, pa?: Params | undefined): Expression {
            if(yp.type.equals(QUOTE)) {
                const tokens = Array<Token>();
                while(true){
                    if(p.match(TEXT, l, s, pa))
                    tokens.push(p.consume(TEXT, l, s, pa) as Token);
                    else if(p.match(ESCAPE, l, s, pa)){
                        const esc = p.consume(ESCAPE, l, s, pa);
                        const escaped = p.consume(ESCAPED, l, s, pa) as Token;
                        tokens.push(new Token(s.escape!.parse(esc.value + escaped.value), TEXT, escaped.lineStart, escaped.lineEnd, escaped.startPos));
                    }
                    else if(p.match(D_QUOTE, l, s, pa))
                    tokens.push(p.consume(D_QUOTE, l, s, pa) as Token);
                    else if(p.match(D_QUOTE_END, l, s, pa))
                    tokens.push(p.consume(D_QUOTE_END, l, s, pa) as Token);
                    else if(p.match(QUOTE_END, l, s, pa)) {
                        p.consume(QUOTE_END, l, s, pa);
                        break;
                    }
                }
                return new Text(mergeTokens(tokens))
            } else if(yp.type.equals(D_QUOTE)) {
                const tokens = Array<Token>();
                while(true){
                    if(p.match(TEXT, l, s, pa))
                    tokens.push(p.consume(TEXT, l, s, pa) as Token);
                    else if(p.match(ESCAPE, l, s, pa)){
                        const esc = p.consume(ESCAPE, l, s, pa);
                        const escaped = p.consume(ESCAPED, l, s, pa) as Token;
                        tokens.push(new Token(s.escape!.parse(esc.value + escaped.value), TEXT, escaped.lineStart, escaped.lineEnd, escaped.startPos));
                    }
                    else if(p.match(QUOTE, l, s, pa))
                    tokens.push(p.consume(QUOTE, l, s, pa) as Token);
                    else if(p.match(QUOTE_END, l, s, pa))
                    tokens.push(p.consume(QUOTE_END, l, s, pa) as Token);
                    else if(p.match(D_QUOTE_END, l, s, pa)) {
                        p.consume(D_QUOTE_END, l, s, pa);
                        break;
                    }
                }
                return new Text(mergeTokens(tokens))
            }
            return new Text(yp.value);
        }
    }
    export interface Expression extends expression.GExpression<Format> {
        readonly comments: {
            readonly preceding: readonly string[],
            readonly inline?: string,
        };
      format(format: Format, syntax?: Syntax, params?: Params | any): void;
    }
    class Section implements Expression {
        // #props;
        private readonly _map: {[key: string]: Expression};
        constructor(/*public readonly name: string, */public readonly comments: {
            readonly preceding: readonly string[],
            readonly inline?: string
        }) { /*this.#props = Array<Expression>();*/ this._map = {}; }
        public add(name: string, e: Expression){
            // this.#props[index] = e;
            this._map[name] = e;
        }
        format(format: Format, syntax?: Syntax | undefined, params?: any): void {
            format.append(this, syntax, params);
        }
        debug(): string {
            throw new Error("Method not implemented.");
        }
        compareTo(obj?: expression.Expression | undefined): utility.Compare {
            return utility.compare(this.hashCode32(), obj?.hashCode32());
        }
        equals(obj?: object | undefined): boolean {
            if (obj instanceof Section) return this.compareTo(obj) === 0;
            return false;
        }
        hashCode32(): number {
            return utility.hashCode32(false, utility.asHashable(this._map), utility.asHashable(this.comments), /*utility.asHashable(utility.hashCode32ForArray(false, this.#props))*/);
        }
        // public get properties() {
        //     return Object.freeze(this.#props);
        // }
        public get(name: string): Expression{
            return this._map[name];
        }
        public remove(name: string) {
            delete this._map[name];
        }
        toString(): string {
          return this.debug();
        }
    }
    class Property implements Expression {
        #_values;
        constructor(public readonly comments: {
            readonly preceding: readonly string[],
            readonly inline?: string
        }, initialValue?: string) {
            this.#_values = Array<string>();
            if(utility.isValid(initialValue)) this.#_values.push(initialValue!);
        }
        public add(value: string, index: number = this.#_values.length) {
            this.#_values[index] = value;
        }
        format(format: Format, syntax?: Syntax | undefined, params?: any): void {
            throw new Error("Method not implemented.");
        }
        debug(): string {
            throw new Error("Method not implemented.");
        }
        compareTo(obj?: expression.Expression | undefined): utility.Compare {
            return utility.compare(this.hashCode32(), obj?.hashCode32());
        }
        equals(obj?: object | undefined): boolean {
            if (obj instanceof Property) return this.compareTo(obj) === 0;
            return false;
        }
        hashCode32(): number {
            return utility.hashCode32(false, utility.asHashable(this.comments), utility.asHashable(this.#_values));
        }
        public remove(index: number = 0) {
            this.#_values.splice(index);
        }
        toString(): string {
          return this.debug();
        }
        public get values() {
            return Object.freeze(this.#_values);
        }
    }
    class Text implements Expression {
        readonly comments;
        constructor(public readonly text: string){
            this.comments = { preceding: Object.freeze(Array<string>()) };
        }
        format(format: Format<any>, syntax?: Syntax | undefined, params?: any): void {
            throw new Error("Method not implemented.");
        }
        debug(): string {
            throw new Error("Method not implemented.");
        }
        compareTo(obj?: expression.Expression | undefined): utility.Compare {
            return utility.compare(this.hashCode32(), obj?.hashCode32());
        }
        equals(obj?: object | undefined): boolean {
            if (obj instanceof Text) return this.compareTo(obj) === 0;
            return false;
        }
        hashCode32(): number {
            return utility.hashCode32(false, utility.asHashable(this.comments), utility.asHashable(this.text));
        }
    }
    /**Convenience class to allow for proper return values using `parse` */
    export class Parser extends parser.PrattParser<Expression, Syntax> {}
    export type Appendage = string | Expression;
    /**A base ini format */
    export interface Format<T = any> extends expression.GFormat<Expression, T> {
      append(data: Appendage, s?: Syntax, p?: Params): void;
    }
    export class StringFormat implements Format<string> {}
    export class JSFormat implements Format<json.Value> {}
    export class FileFormat implements Format<ReadStream> {}
    export class Converter extends parser.Converter<parser.GToken<string>, Expression, Syntax, Parser, Params, MutableLexer, any> {}
}
export default ini;