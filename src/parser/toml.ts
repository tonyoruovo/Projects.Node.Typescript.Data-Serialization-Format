import { createReadStream, createWriteStream, ReadStream, WriteStream } from "fs";
import { TransformCallback } from "stream";
import utility from "../utility.js";
import expression from "./expression.js";
import json from "./json.js";
import parser from "./parser.js";
/**
 * @summary Defines the constituents of the toml pipeline.
 * @description The toml pipeline constitutes tokenisers (lexers) for tokenising text and json data; a parser which translates the
 * tokens into expressions; formatters which can create file, in-memory and simple string formats; a converter which binds several
 * of the aforementioned components so that the data contained within can be tranferred to other data languages seamlessly.
 */ 
namespace toml {
    export class SyntaxBuilder implements utility.Builder<Syntax> {
      build(): Syntax {
        throw new Error("Method not implemented.");
      }
      rebuild(from: Syntax): utility.Builder<Syntax> {
        throw new Error("Method not implemented.");
      }
      clear(): utility.Builder<Syntax> {
        throw new Error("Method not implemented.");
      }
    }
    export interface Syntax extends parser.GSyntax<Type, Command>{
      readonly eol: string;
      readonly global: boolean;
      readonly snan: boolean;
      readonly qnan: boolean;
    }
    export class Params {}
    /**
     * A concrete implementation of the {@link parser.GType `GType`}
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

    /**
     * A special type that creates the global section where unamed properties and all sections are stored.
     * There will always be at most one token with this type in every given lexer.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const INIT: parser.GType<string> = new Type("14", Number.MAX_SAFE_INTEGER);
    /**
     * The type used for end-of-line tokens.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const EOL: parser.GType<string> = new Type("0", Number.MAX_SAFE_INTEGER - 100);
    /**
     * The type used for the comment tokens.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const HASH: parser.GType<string> = new Type("8", 0);
    /**
     * The type used for single quote tokens.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const QUOTE: parser.GType<string> = new Type("2", 5);
    export const TRI_QUOTE: parser.GType<string> = new Type("2", 5);
    /**
     * The type used for double quote tokens.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
    */
    export const D_QUOTE: parser.GType<string> = new Type("3", 5);
    export const TRI_D_QUOTE: parser.GType<string> = new Type("3", 5);
    /**
     * They include all 26 letters of the latin alphabet (upper and lower case), the decimal numerals (0-9), `$` and the `_`
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const TEXT: parser.GType<string> = new Type("4", 5);
    /**
     * The type used for escape tokens.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const B_SLASH: parser.GType<string> = new Type("11", 5);
    /**
     * The type used for tokens preceded by the escape token.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const ESCAPED: parser.GType<string> = new Type("12", 5);
    /**
     * The type used for whitespace tokens.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const WHITESPACE: parser.GType<string> = new Type("13", 1);
    /**
     * The type used for single quote tokens that end an identifier when the same identifier was declared begining with a single quote.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const QUOTE_END: parser.GType<string> = new Type("9", 5);
    export const TRI_QUOTE_END: parser.GType<string> = new Type("9", 5);
    /**
     * The type used for double quotes tokens that end an identifier when the same identifier was declared begining with a double quotes.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const D_QUOTE_END: parser.GType<string> = new Type("10", 5);
    export const TRI_D_QUOTE_END: parser.GType<string> = new Type("10", 5);
    //Does not matter the precedence it has will always be parsed with
    //the `parse(0)` So it will be parsed as long as it's precedence is
    //greater than 0
    /**
     * The type used for tokens that delimit between keys and their values.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const EQUALS: parser.GType<string> = new Type("7", 3);

    export const SIGN: parser.GType<string> = new Type("7", 3);
    export const INT: parser.GType<string> = new Type("7", 3);
    // export const PREFIX_16: parser.GType<string> = new Type("7", 3);
    // export const PREFIX_8: parser.GType<string> = new Type("7", 3);
    // export const PREFIX_2: parser.GType<string> = new Type("7", 3);
    // export const UNDERSCORE: parser.GType<string> = new Type("7", 3);
    export const FLOAT: parser.GType<string> = new Type("7", 3);
    // export const EXPONENT: parser.GType<string> = new Type("7", 3);
    // export const INF: parser.GType<string> = new Type("7", 3);
    // export const NAN: parser.GType<string> = new Type("7", 3);

    /**
     * Because `-`, `:` are only used in dates and they have only 1 character, they can be ommited from the type table.
     * This the same reason `_` and `.` are ommited.
     */

    export const DASH: parser.GType<string> = new Type("7", 3);
    export const COMMA: parser.GType<string> = new Type("7", 3);
    export const LEFT_BRACE: parser.GType<string> = new Type("7", 3);
    export const RIGHT_BRACE: parser.GType<string> = new Type("7", 3);

    /**
     * The type used for tokens that start a table's name. Used to signify the start of a section declaration.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const LEFT_BRACKET: parser.GType<string> = new Type("1", 2);
    /**
     * The type used for delimiting table names to show table nesting,
     * floating point values, .
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const DOT: parser.GType<string> = new Type("5", 3);
    /**
     * The type used for ending a section declaraction.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const RIGHT_BRACKET: parser.GType<string> = new Type("6", 1);
    export const DUAL_RIGHT_BRACKET = new Type("", 3);
    export const DUAL_LEFT_BRACKET = new Type("", 3);

    /**
     * The type used for end-of-file tokens.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const EOF: parser.GType<string> = new Type("-1", Number.MIN_SAFE_INTEGER);

    /**
     * @summary An object representing a valid lexeme in a `.toml` data format.
     * @description
     * A `Token` is concrete implementation of the {@link parser.GToken} interface where each token maps to a one or more lexeme in `.toml` data.
     * A token contains all the data that helps describe it's payload's distinction in a data. It represents a string of characters that individually
     * represent a logical portion of a toml document. Although each {@link Token.value value} is unique, there are expected to be 16 types of token
     * and accounted for in this documentation.
     */
    class Token implements parser.GToken<string> {
        /**
         * The length of a token
         * @type {number}
         * @readonly
         * @constant
         */
        public readonly length: number;
        /**
         * Constructs a `Token`, giving details such as the line and position (within the data format) from which it was formed
         * @param {string} value the payload of this token containing the actual value of the data it carries
         * @param {Type} type the type of the token. This is the main determinant of a token that differentiates one from another
         * @param {number} lineStart the line within the data format that this token was assembled from
         * @param {number} lineEnd the line within the data format that this token was assembled from
         * @param {number} startPos the position within the line from which this token was assembled.
         */
        constructor(
            public readonly value: string,
            public readonly type: Type,
            public readonly lineStart: number,
            public readonly lineEnd: number,
            public readonly startPos: number
        ){
            this.length = value.length;
        }
        /**
         * Test if the argument is the same `Token` object as `this`.
         * @param {object | undefined} obj 
         * @returns {boolean} `true` if the argument is a `Token` and is the same type, is in the same line, position as `this`. 
         */
        equals(obj?: object | undefined): boolean {
          if(obj instanceof Token)
          return (this.lineStart == obj.lineStart && this.lineEnd == obj.lineEnd && this.startPos === obj.startPos
          && this.type.equals(obj.type));
          return false;
        }
        /**
         * Returns the hascode of this `Token`
         * @returns {number} the hashcode of this token
         */
        hashCode32(): number {
          return utility.hashCode32(true, utility.asHashable(this.value), utility.asHashable(this.type.id), utility.asHashable(this.type.precedence), utility.asHashable(this.startPos), utility.asHashable(this.lineEnd), utility.asHashable(this.lineStart));
        }
        /**
         * Takes an optional {@linkcode parser.Token} argument and returns a value that specifies the ordering between `this` and the argument.
         * @param {parser.Token | undefined} obj the value which `this` is tobe compared
         * @returns {utility.Compare} a numerical value to specify ordering after comparison has been done.
         * @see {@linkcode utility.Comparable}
         */
        compareTo(obj?: parser.Token | undefined): utility.Compare {
          if(utility.isValid(obj)){
            let by = utility.compare(this.lineStart, obj!.lineStart);
            if(by !== 0) return by;
            by = utility.compare(this.lineEnd, obj!.lineEnd);
            if(by !== 0) return by;
            by = utility.compare(this.startPos, obj!.startPos);
            if(by !== 0) return by;
            by = utility.asCompare(utility.hashCode32(true, utility.asHashable(this.type.id), utility.asHashable(this.type.precedence)));
            if(by !== 0) return by;
            return utility.compare(this.value, obj!.value);
          }
          return 1;
        }
        /**
         * Gets a debug value for this `Token`.
         * @returns {string} a debug string for this `Token`
         */
        public toString(): string {
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
    }
    export class JSONLexer implements MutableLexer<json.Value> {
      private queue = [] as Token[];
      end(syntax: Syntax, p: any): void {
        throw new Error("Method not implemented.");
      }
      process(chunk: json.Value, syntax: Syntax, p: any): void {
        throw new Error("Method not implemented.");
      }
      processed: () => Token[] = () => this.queue;
      unprocessed: () => any = () => this.src;
      frequency(type: parser.Type): number {
        throw new Error("Method not implemented.");
      }
      indexOf(type: parser.Type): number {
        throw new Error("Method not implemented.");
      }
      lastIndexOf(type: parser.Type): number {
        throw new Error("Method not implemented.");
      }
      hasTokens(): boolean {
        throw new Error("Method not implemented.");
      }
      canProcess(): boolean {
        throw new Error("Method not implemented.");
      }
      next<P>(syntax?: Syntax | undefined, params?: P | undefined): Token {
        throw new Error("Method not implemented.");
      }
      src?: any;
      position(): number {
        throw new Error("Method not implemented.");
      }
      line(): number {
        throw new Error("Method not implemented.");
      }
    }
    /**
     * `inf`, `nan`, `snan`, `qnan`, `true` and `false` are all identifiers and will be differentiated by the identifier parser.
     */
    export class StringLexer implements MutableLexer {
      private q;
      private queue;
      public src;
      private ln;
      private li;
      private esc;
      private escText;
      private text;
      private token;
      private numStart;// the index of the number within the 'text' string property
      private rx = 10;//the radix of this lexer
      private def = {} as any;
      constructor() {
        this.q = null as any as Type;
        this.queue = [new Token("", INIT, -1, -1, -1)];
        this.src = "";
        this.ln = 1;
        this.li = 1;
        this.esc = 0;
        this.text = "";
        this.token = "";
        this.escText = "";
        this.numStart = -1;
      }
      /**
       * @summary Is the lexer in a basic string?
       * @description
       * Asserts that this lexer is creating tokens which are the contents of a basic string
       * @returns {boolean} `true` if the current token is being created as a basic-string content and `false` if otherwise.
       */
      private iBStr(): boolean {
        return utility.isValid(this.q) && this.q.equals(D_QUOTE);
      }
      /**
       * @summary Is the lexer in a literal string?
       * @description
       * Asserts that this lexer is creating tokens which are the contents of a literal string
       * @returns {boolean} `true` if the current token is being created as a literal-string content and `false` if otherwise.
       */
      private iLStr(): boolean {
        return utility.isValid(this.q) && this.q.equals(QUOTE);
      }
      /**
       * @summary Is the lexer in a multiline basic string?
       * @description
       * Asserts that this lexer is creating tokens which are the contents of a multiline basic string
       * @returns {boolean} `true` if the current token is being created as a multiline-basic-string content and `false` if otherwise.
       */
      private iMBStr(): boolean {
        return utility.isValid(this.q) && this.q.equals(TRI_D_QUOTE);
      }
      /**
       * @summary Is the lexer in a multiline literal string?
       * @description
       * Asserts that this lexer is creating tokens which are the contents of a multiline literal string
       * @returns {boolean} `true` if the current token is being created as a multiline-literal-string content and `false` if otherwise.
       */
      private iMLStr(): boolean {
        return utility.isValid(this.q) && this.q.equals(TRI_QUOTE);
      }
      /**
       * @summary Is the lexer in a string?
       * @description
       * Asserts that this lexer is creating tokens which are the contents of a string (basic, literal, multiline basic or mutiline literal)
       * @returns {boolean} `true` if the current token is being created as a string content and `false` if otherwise.
       */
      private isStr(): boolean {
        return this.iBStr() || this.iLStr() || this.iMBStr() || this.iMLStr();
      }
      private shiftSrc(distance: number) {
        const rv = this.src.substring(0, distance);
        this.src = this.src.substring(distance);
        return rv;
      }
      private escIsEven() {
        return this.esc % 2 == 0;
      }
      private ifNext(waiting: string, reality: string, expected: string | ((s: string) => boolean)){
        // if(waiting + reality === expected){
        //   f();
        // } else if (expected.startsWith(waiting + reality)) return;
      }
      private is(expected: string){
        return this.token === expected;
      }
      private may(expected: string){
        return this.token.length < expected.length && expected.substring(0, this.token.length) === this.token;
      }
      private isOrMay(expected: string) {
        return this.is(expected) || this.may(expected);
      }
      manufacture(t: Token) {
        this.queue.push(t);
      }
      end(syntax: Syntax, params: Params): void {
        if (this.canProcess()) this.process("", syntax, params);
        this.process(syntax.eol, syntax, params);
      }
      process(chunk: string, syntax: Syntax, p: any): void {
        this.src += chunk;
        while(this.src.length > 0){
          let token = this.shiftSrc(1);
          this.li++;

          if(!this.escIsEven()) {//if there is an escape already waiting for it's correspondent
            if (this.escText.length === 0) {//There is no escaped text stored yet
              this.escText += token;//append
              if (this.escText[0] !== 'u' && this.escText[0] !== 'U') {//If the escaped text is not unicode
                if (this.text.length > 0) {//if we have text waiting to be processed to tokens
                  this.manufacture(new Token(this.text, TEXT, this.ln, this.ln, this.li - this.text.length));
                  this.text = "";
                }
                this.manufacture(new Token(this.escText, ESCAPED, this.ln, this.ln, this.li - this.escText.length));
                this.escText = "";
                this.esc = 0;
              }
            } else if (/[A-Fa-f0-9]/.test(token)) {//a hexadecimal escape. Probably for a unicode escape
              this.escText += token;
              if (this.escText.length === 9) {//It is complete utf32 escape in the form U+XXXXXXXX
                if (this.text.length > 0) {//if we have text waiting to be processed to tokens
                  this.manufacture(new Token(this.text, TEXT, this.ln, this.ln, this.li - this.text.length));
                  this.text = "";
                }
                this.manufacture(new Token(this.escText, ESCAPED, this.ln, this.ln, this.li - this.escText.length));
                this.escText = "";
                this.esc = 0;
              }
            } else {
              if (this.text.length > 0) {//if we have text waiting to be processed to tokens
                this.manufacture(new Token(this.text, TEXT, this.ln, this.ln, this.li - this.text.length));
                this.text = "";
              }
              if(this.escText.length > 5){//It may be a utf16 escape in the form U+XXXX
                this.text = this.escText.substring(5);
                this.escText = this.escText.substring(0, 5);
              }
              this.manufacture(
                new Token(this.escText, ESCAPED, this.ln, this.ln, this.li - this.escText.length)
              );
              this.escText = "";
              this.esc = 0;
              this.text += token;
            }
          } else if(token === "\n") {
          } else if(token === ""){
          } else if(token === "'"){
          } else if(token === '"'){
          } else if(token === '\\'){
            this.esc++;
            if (this.text.length > 0) {
              this.manufacture(new Token(this.text, TEXT, this.ln, this.ln, this.li - this.text.length));
              this.text = "";
            }
            this.manufacture(new Token(token, B_SLASH, this.ln, this.ln, this.li - token.length));
          } else if(token === '='){
          } else if(token === '+'){
          } else if(token === '-'){
          } else if(token === '_'){
          } else if(token === '.'){
          } else if(token === ','){
          } else if(token === '['){
          } else if(token === ']'){
          } else if(token === '{'){
          } else if(token === '}'){
          } else if(utility.isWhitespace(token)){
          } else {
            if(!this.isNumber(token, this.rx)){
              this.rx = 10;
            }
            this.text += token;
            if(this.text === "0x"){}
            else if(this.text === "0b"){}
            else if(this.text === "0o"){}
            else if(this.text === "'''"){}
            else if(this.text === '"""'){}
            else if(this.text.startsWith("'") && !this.text.endsWith("'")){
              if(this.text.startsWith("''")){}
            }
            else if(this.text.startsWith('"') && !this.text.endsWith('"')){
              if(this.text.startsWith('""')){}
            }
          }
          if (token === '\n') {
            this.ln++;
            this.li = 0;
          }
        }
      }
      processed = () => this.queue;
      unprocessed = () => this.src;
      frequency(type: parser.Type): number {
        let frqy = 0;
        for (let i = 0; i < this.queue.length; i++) {
          if (this.queue[i].type.equals(type)) frqy++;
        }
        return frqy;
      }
      indexOf(type: parser.Type): number {
        for (let i = 0; i < this.queue.length; i++) {
          if (this.queue[i].type.equals(type)) return i;
        }
        return -1;
      }
      lastIndexOf(type: parser.Type): number {
        for (let i = this.queue.length - 1; i >= 0; i--) {
          if (this.queue[i].type.equals(type)) return i;
        }
        return -1;
      }
      hasTokens(): boolean {
        return this.queue.length > 0;
      }
      canProcess(): boolean {
        return this.src.length > 0;
      }
      next(): Token {
        while (true) {
          if (!this.hasTokens()) break;
          return this.queue!.shift()!;
        }
        return new Token("", EOF, this.line(), this.line(), this.position());
      }
      position(): number {
        return this.li;
      }
      line(): number {
        return this.ln;
      }
    }
    export interface Command extends parser.GCommand<Token, Expression, Syntax, MutableLexer, Parser> {
      parse( ap: Expression, yp: Token, p: Parser, l: MutableLexer, s: Syntax, pa?: Params ): Expression;
    }
    export interface Expression extends expression.GExpression<Format> {
      format(format: Format, syntax?: Syntax, params?: Params | any): void;
    }
    /**Convenience class to allow for proper return values using `parse` */
    export class Parser extends parser.PrattParser<Expression, Syntax> {}
    export type Appendage = string | Expression;
    /**A base toml format */
    export interface Format<T = any> extends expression.GFormat<Expression, T> {
      append(data: Appendage, s?: Syntax, p?: Params): void;
    }
    export class StringFormat implements Format<string> {
      private _data = "";
      append(data: Appendage, s?: Syntax | undefined, p?: Params | undefined): void {
        throw new Error("Method not implemented.");
      }
      data(): string {
        return this._data;
      }
      reverse(): expression.GFormat<Expression, string> {
        this._data.split("").reverse().join("");
        return this;
      }
      equals(another: expression.GFormat<Expression, string>): boolean {
        if (another instanceof StringFormat) return this._data === another._data;
        return false;
      }
      modifications: number = 0;
      readonly bpc: number = 8;
      readonly bpn: number = 32;
      readonly prettyfier?: expression.Prettyfier | undefined;
      readonly minifier?: expression.Minifier | undefined;
      readonly logger?: utility.Messenger | undefined;
      hashCode32(): number {
        return utility.hashCode32(
          false,
          utility.asHashable(this.modifications),
          utility.asHashable(this.bpc),
          utility.asHashable(this.bpn),
          utility.asHashable(this._data)
        );
      }
      toJSON(): string {
        return JSON.stringify(this);
      }
    }
    export class JSFormat implements Format<json.Value> {
      private _data = {} as json.Pair;
      append(data: Appendage, s?: Syntax | undefined, p?: Params | undefined): void {
        throw new Error("Method not implemented.");
      }
      data(): json.Value {
        return this._data;
      }
      reverse(): expression.GFormat<Expression, json.Value> {
        return this;
      }
      equals(another: expression.GFormat<Expression, json.Value>): boolean {
        if (another instanceof JSFormat) return this._data === another._data;
        return false;
      }
      modifications: number = 0;
      readonly bpc: number = 8;
      readonly bpn: number = 32;
      prettyfier?: expression.Prettyfier | undefined;
      minifier?: expression.Minifier | undefined;
      logger?: utility.Messenger | undefined;
      hashCode32(): number {
        return utility.hashCode32(
          false,
          utility.asHashable(this.modifications),
          utility.asHashable(this.bpc),
          utility.asHashable(this.bpn),
          utility.asHashable(this._data)
        );
      }
      toJSON(): string {
        return JSON.stringify(this);
      }
    }
    export class FileFormat implements Format<ReadStream> {
      private _str: WriteStream;
      constructor(filename: string) {
        this._str = createWriteStream(filename, {
          autoClose: true,
          emitClose: false,
          encoding: "utf-8",
        });
      }
      public endWrite() {
        this._str!.end();
        this._str!.close();
      }
      append(
        data: Appendage,
        s?: Syntax | undefined,
        p?: Params | undefined
      ): void {
        throw new expression.FormatError("format not supported");
      }
      data(): ReadStream {
        return createReadStream(this._str.path, {
          autoClose: true,
          encoding: "utf-8",
        });
      }
      reverse(): this {
        return this;
      }
      equals(another: expression.GFormat<Expression, ReadStream>): boolean {
        if (another instanceof FileFormat)
          return this._str.path === another._str.path;
        return false;
      }
      modifications: number = 0;
      readonly bpc: number = 8;
      readonly bpn: number = 32;
      hashCode32(): number {
        return utility.hashCode32(
          false,
          utility.asHashable(this.modifications),
          utility.asHashable(this.bpc),
          utility.asHashable(this.bpn),
          utility.asHashable(this._str)
        );
      }
      toJSON(): string {
        return JSON.stringify(this);
      }
    }
    export class Converter extends parser.Converter<parser.GToken<string>, Expression, Syntax, Parser, Params, MutableLexer, any > {
      _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
        throw new Error("Method not implemented.");
      }
      _flush(callback: TransformCallback): void {
        throw new Error("Method not implemented.");
      }
}
}
export default toml;