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
      /**
       * Only `\r`, `\n` and `\r\n` are supported. 
       */
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

        // [Symbol.toStringTag](){
        //   return this.toString();
        // }

        // toString(){
        //   return "NULL";
        // }
    }

    /**
     * A special type that creates the global section where unamed properties and all sections are stored.
     * There will always be at most one token with this type in every given lexer.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const INIT: parser.GType<string> = new Type("0", Number.MAX_SAFE_INTEGER);
    /**
     * The type used for end-of-line tokens.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const EOL: parser.GType<string> = new Type("1", 1);
    /**
     * The type used for the comment tokens.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const HASH: parser.GType<string> = new Type("2", 50);
    /**
     * The type used for single quote tokens.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const QUOTE: parser.GType<string> = new Type("3", 10);
    export const TRI_QUOTE: parser.GType<string> = new Type("4", 10);
    /**
     * The type used for double quote tokens.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
    */
    export const D_QUOTE: parser.GType<string> = new Type("5", 10);
    export const TRI_D_QUOTE: parser.GType<string> = new Type("6", 10);
    /**
     * They include all 26 letters of the latin alphabet (upper and lower case), the decimal numerals (0-9), `$` and the `_`
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const TEXT: parser.GType<string> = new Type("7", 5);
    /**
     * The type used for escape tokens.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const B_SLASH: parser.GType<string> = new Type("8", 1);
    /**
     * The type used for tokens preceded by the escape token.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const ESCAPED: parser.GType<string> = new Type("9", 1);
    /**
     * The type used for whitespace tokens.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const WHITESPACE: parser.GType<string> = new Type("10", 1);
    /**
     * The type used for single quote tokens that end an identifier when the same identifier was declared begining with a single quote.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const QUOTE_END: parser.GType<string> = new Type("11", 5);
    export const TRI_QUOTE_END: parser.GType<string> = new Type("12", 5);
    /**
     * The type used for double quotes tokens that end an identifier when the same identifier was declared begining with a double quotes.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const D_QUOTE_END: parser.GType<string> = new Type("13", 5);
    export const TRI_D_QUOTE_END: parser.GType<string> = new Type("14", 5);
    //Does not matter the precedence it has will always be parsed with
    //the `parse(0)` So it will be parsed as long as it's precedence is
    //greater than 0
    /**
     * The type used for tokens that delimit between keys and their values.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const EQUALS: parser.GType<string> = new Type("15", 20);

    export const PLUS: parser.GType<string> = new Type("16", 5);
    export const MINUS: parser.GType<string> = new Type("17", 5);
    export const INT: parser.GType<string> = new Type("18", 5);
    export const PREFIX_16: parser.GType<string> = new Type("19", 5);
    export const PREFIX_8: parser.GType<string> = new Type("20", 5);
    export const PREFIX_2: parser.GType<string> = new Type("21", 5);
    export const UNDERSCORE: parser.GType<string> = new Type("22", 5);

    export const COMMA: parser.GType<string> = new Type("24", 3);
    export const LEFT_BRACE: parser.GType<string> = new Type("25", 5);
    export const RIGHT_BRACE: parser.GType<string> = new Type("26", 50);

    /**
     * The type used for tokens that start a table's name. Used to signify the start of a section declaration.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const LEFT_BRACKET: parser.GType<string> = new Type("27", 5);
    /**
     * The type used for delimiting table names to show table nesting,
     * floating point values, .
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const DOT: parser.GType<string> = new Type("28", 1);
    /**
     * The type used for ending a section declaraction.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const RIGHT_BRACKET: parser.GType<string> = new Type("29", 50);
    export const DUAL_LEFT_BRACKET = new Type("30", 5);
    export const DUAL_RIGHT_BRACKET = new Type("31", 50);

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
     * @summary Builds tokens for a {@linkcode TokenFactory}.
     * @description
     * A token builder that combines strings *character-by-character* in the process of generating a string. It knows how to abort
     * this process when it recieves a syntactically improper character (that will cannot compose the token, for example, to construct
     * a new line in a *windows* system, `\r` is the first item then `\n` is the last. If the `\r` is first recived, the building
     * process will be intiated via `ad()`, however if anything other than the character `\n` is recieved next, this will abort by
     * spawning the resident `\r` as a whitespace token and then calling the appropriate tokenizer for `\n`).\
     * \
     * This object is needed for variable length tokens that may be set by the user of this lexer eg {@linkplain Syntax.eol line terminators}.
     */
    type Tokenizer = {
      /**
       * Used by *multi character* tokenizers as the result of the appendage done by {@linkcode Tokenizer.ad}.
       * This value is `null` if this is a single character tokenizer, or this multi-character tokenizer is not
       * currently processing any character(s).
       * @type {string | null}
       */
      value: string | null,
      /**
       * @summary adds a character to this tokenizer.
       * @description
       * Adds, appends, combines, creates and concats a single character to/with the existing store, the total of which will form
       * a full token. It processes the given item and decides where to continue building the token, or to abort the building process.
       * If the decision to continue building the token is made, this method may adjuge the process to be complete hence may call
       * {@linkcode Tokenizer.ge ge()}. For tokens that can be created using single characters, this method instantly
       * creates the token, hence it does the work that `Tokenizer.ge()` does for muti-character tokens.
       * @param {string} item The value to be appended. For tokens that can be created using single characters, this parameter may be
       * omitted.
       * @returns {void} an imperative and mutative code, does not return anything.
       */
      ad: (item?: string) => void,
      /**
       * @summary Cancels the tokenizing process.
       * @description
       * Aborts or cancels the process started in {@linkcode Tokenizer.ad ad()} and performs a cleanup operation on the residual
       * items in this tokenizer. For tokens that can be created using single characters, this method does nothing.
       * @returns {void} an imperative and mutative code, does not return anything.
       */
      ca: () => void,
      /**
       * @summary Generates the token.
       * @description
       * Generates or creates the token by calling {@linkcode StringLexer.manufacture} on a fully composed token.
       * @returns {void} an imperative and mutative code, does not return anything.
       */
      ge: () => void
    }
    /**
     * @summary Makes tokens through its tokenizer properties.
     * @description
     * An object that creates single and multi character tokens by abstracting the process and delegating the implementation thereof to
     * it's properties which are {@linkcode Tokenizer} objects. This enables tokens which are not single characters (such as the
     * triple quotes `'''` for toml data formats) to be properly tokenized without hard-coding the process but rather stream-lining
     * it with other tokens types (including single character tokens). \
     * \
     * When values defined as single character tokens are encountered by any of the tokenizers in this object, they are immediately
     * pushed into the queue for manufactured tokens (with the appropriate `Type` tag).\
     * \
     * When values defined in a multi-character token are encountered, they are first appended to the appropriate `Tokenizer`, the name
     * of that tokenizer is set to the {@linkcode ls} property. When the next token is encountered, then the last tokenizer that was
     * used is invoked by using the value of `ls`, the invoked tokenizer will validate whether the incoming value is syntactically proper
     * to be appended and if it is, then it is appended else the process will be aborted, the items in this tokenizer will be spawned
     * as single character tokens and the incoming token will be processed by another tokenizer.
     * @remark
     * The implementation of this type is found in the {@linkcode StringLexer} as `StringLexer.mill`
     */
    type TokenFactory = {
      /**
       * @summary *Last saved tokenizer*
       * @description
       * a value that may be a `string` or `null` type. \
       * \
       * As a `string`, it represents the last property (`Tokenizer` object) that
       * was used in appendage, more tecnically as a `string` value, it represents the last tokenizer in this property that called
       * {@linkcode Tokenizer.ad}, but did not create a new token. This is always the key of a *multi-character* tonizer property.\
       * \
       * As a `null` value, it represents either there was no last muti-character tokenizer used, or one was aborted.
       */
      ls: string | null,
      /**
       * Default `Tokenizer` for integers in a given radix. This only appends digits, it does not append separators (such as `_`),
       * exponents (such as `e`) or prefixes (such as `+`, `-`, `0x` etc) and will abort if it encounters one.
       */
      int: Tokenizer,
      /**
       * Default `Tokenizer` for non-whitespace text. Will abort if it encounters numbers or any token that is defined in this factory.
       */
      tx: Tokenizer,
      /**
       * A user-defined tokenizer. The `any` type annotation allows for other properties to be declared as non-Tokenizers for
       * the TypeScript 5.2.2 compiler.
       */
      [name: string]: Tokenizer | any,
      /**
       * Calls (if possible) `ad()` for the property whose name is allocated to the `ls` property,
       * or else calls `ad()` for the property (if available) with the name `item`, or else calls `ad()` for
       * the `int` property (if it is a number) or else calls add for the `tx` property.
       * @param {string | undefined} item the same parameter as {@linkcode Tokenizer.ad}
       * @returns {void}
       */
      ad: (item?: string) => void;
      /**
       * Calls (if possible) `ca()` for the property whose name is allocated to the `ls` property
       * @param {string | undefined} item the same parameter as {@linkcode Tokenizer.ca}
       * @returns {void}
       */
      ca: () => void;
    };
    /**
     * `inf`, `nan`, `snan`, `qnan`, `true` and `false` are all identifiers and will be differentiated by the identifier parser.
     */
    export class StringLexer implements MutableLexer {
      /**
       * Holds the type of start delimiter for the current string. For example, if the current value being processed is in a
       * basic string, then this value will be {@linkcode D_QUOTE}, else if it is in a literal string then this value will be
       * {@linkcode QUOTE}, else if it is in a *multi-line* basic string, then this value will be {@linkcode TRI_D_QUOTE} else
       * if it is in a *multi-line* literal string, then this value will be {@linkcode TRI_QUOTE} else this value will be `null`.
       * @type {Type}
       */
      private q: Type;
      /**
       * An array for {@linkcode Token} objects that have been created ({@link manufacture manufactured}) from
       * {@linkplain StringLexer.process processing} characters.
       * @type {Token[]}
       */
      private queue: Token[];
      /**
       * A string value that is the temporary cache for the source code (i.e the data format as a `string`). This value gets
       * updated each time {@linkcode StringLexer.process process()} is called. It will be empty (but not `null` or `undefined`)
       * before the first call to process and will also be empty in-between calls to process.
       * @type {string}
       */
      public src: string;
      /**
       * The current line that is being processed. This is updated each time a {@linkplain Syntax.eol line terminator} is
       * encountered by {@linkcode StringLexer.process process()}.
       * @type {number}
       */
      private ln: number;
      /**
       * The current position of the character within a given line that is being processed. This is updated each time a
       * character is encountered by {@linkcode StringLexer.process process()}. Gets set to `0` when a
       * {@linkplain Syntax.eol line terminator} is encountered.
       * @type {number}
       */
      private li: number;
      /**
       * The counter that keeps track of the number of escapes encountered. When it is an odd number, then the next token to be
       * processed is surely an escaped character or set of characters.
       * @type {number}
       */
      private esc: number;
      /**
       * Stores the text that has being escaped. For most escaped sequence, this value will be an empty string (since it gets
       * written to the {@linkplain queue token output} immediately), however for sequences such a unicode (such as `uXXXX` or
       * `uXXXXXXXX`) or `\r\n` this value will be all the characters except the last one. \
       * \
       * This value gets updated as long as {@linkcode esc} is odd.
       * @type {string}
       */
      private escText: string;
      /**
       * The radix of the next set of numbers to be processed. Note that if this value is `2` then a value like `9876543` will be
       * processed as text.
       * @type {10 | 8 | 16 | 2}
       */
      private rx: 10 | 8 | 16 | 2 = 10;//the radix of this lexer
      /**
       * A switch for when the `#` character is encountered durong processing.
       * @type {boolean}
       */
      private he: boolean;//hash encountered
      /**
       * The token processing mill. It is an object that accepts single character strings and produces/manufactures
       * {@linkplain parser.Token tokens}.
       */
      private mill = {
        ls: null,
        "#": {
          value: null,
          ad: (() => {
            // if(ic()){} else {}
            if(this.mill.ls !== null) this.mill[this.mill.ls].ca();
            this.manufacture(new Token('#', HASH, this.ln, this.ln, this.li - 1));
            this.he = true;
          }).bind(this),
          ca: (() => {}).bind(this),
          ge: (() => this.mill['#'].ad()).bind(this)
        },
        '\\': {
          value: null,
          ad: (() => {
            if(this.mill.ls !== null) this.mill[this.mill.ls].ca();
            this.manufacture(new Token('\\', B_SLASH, this.ln, this.ln, this.li - 1));
            if(!this.lStr()) this.esc++;
            else this.esc = 0;
          }).bind(this),
          ca: (() => {}).bind(this),
          ge: (() => this.mill['\\'].ad()).bind(this)
        },
        '=': {
          value: null,
          ad: (() => {
            if(this.mill.ls !== null) this.mill[this.mill.ls].ca();
            this.manufacture(new Token('=', EQUALS, this.ln, this.ln, this.li - 1));
          }).bind(this),
          ca: (() => {}).bind(this),
          ge: (() => this.mill['='].ad()).bind(this)
        },
        '+': {
          value: null,
          ad: (() => {
            if(this.mill.ls !== null) this.mill[this.mill.ls].ca();
            this.manufacture(new Token('+', PLUS, this.ln, this.ln, this.li - 1));
          }).bind(this),
          ca: (() => {}).bind(this),
          ge: (() => this.mill['+'].ad()).bind(this)
        },
        '-': {
          value: null,
          ad: (() => {
            if(this.mill.ls !== null) this.mill[this.mill.ls].ca();
            this.manufacture(new Token('-', MINUS, this.ln, this.ln, this.li - 1));
          }).bind(this),
          ca: (() => {}).bind(this),
          ge: (() => this.mill['-'].ad()).bind(this)
        },
        '_': {
          value: null,
          ad: (() => {
            if(this.mill.ls !== null) this.mill[this.mill.ls].ca();
            this.manufacture(new Token('_', UNDERSCORE, this.ln, this.ln, this.li - 1));
          }).bind(this),
          ca: (() => {}).bind(this),
          ge: (() => this.mill['_'].ad()).bind(this)
        },
        '.': {
          value: null,
          ad: (() => {
            if(this.mill.ls !== null) this.mill[this.mill.ls].ca();
            this.manufacture(new Token('.', DOT, this.ln, this.ln, this.li - 1));
          }).bind(this),
          ca: (() => {}).bind(this),
          ge: (() => this.mill['.'].ad()).bind(this)
        },
        ',': {
          value: null,
          ad: (() => {
            if(this.mill.ls !== null) this.mill[this.mill.ls].ca();
            this.manufacture(new Token(',', COMMA, this.ln, this.ln, this.li - 1));
          }).bind(this),
          ca: (() => {}).bind(this),
          ge: (() => this.mill[','].ad()).bind(this)
        },
        '{': {
          value: null,
          ad: (() => {
            if(this.mill.ls !== null) this.mill[this.mill.ls].ca();
            this.manufacture(new Token('{', LEFT_BRACE, this.ln, this.ln, this.li - 1));
          }).bind(this),
          ca: (() => {}).bind(this),
          ge: (() => this.mill['{'].ad()).bind(this)
        },
        '}': {
          value: null,
          ad: (() => {
            if(this.mill.ls !== null) this.mill[this.mill.ls].ca();
            this.manufacture(new Token('}', RIGHT_BRACE, this.ln, this.ln, this.li - 1));
          }).bind(this),
          ca: (() => {}).bind(this),
          ge: (() => this.mill['}'].ad()).bind(this)
        },
        '0': {
          value: null,
          ad: ((x: string) => {
            if(this.mill.ls !== null){
              //If there is already an integer appendage going on, then it is presumed that this `0` is a digit that is part of an integer
              if(this.mill[this.mill.ls].value === this.mill.int.value){
                this.mill.int.ad(x);
                return;
              } else if (this.mill[this.mill.ls].value !== this.mill['0'].value)
                this.mill[this.mill.ls].ca();
            }
            const k = (this.mill['0'].value??"") + x;
            if((k[0] === '0' && k.length === 2 && ['x','o','b'].indexOf(k[1].toLowerCase()) >= 0) || (k.length === 1 && k === '0')){
              this.mill['0'].value = k;
              if(k.length === 2) this.mill['0'].ge();
              else this.mill.ls = '0';
            } else {
              this.mill['0'].ca();
              if(utility.isValid(this.mill[x])) this.mill[x].ad(x);//because this might be '0x'
              else if(utility.isWhitespace(x)) this.manufacture(new Token(x, WHITESPACE, this.ln, this.ln, this.li - x.length));
              else if(this.isNumber(x, this.rx)) {
                this.mill.int.ad(x);
              } else this.mill.tx.ad(x);
            }
          }).bind(this),
          ca: (() => {
            this.mill.ls = null;
            const v = this.mill['0'].value;
            this.mill['0'].value = null;
            this.mill.int.ad(v);
          }).bind(this),
          ge: (() => {
            this.manufacture(new Token(this.mill['0'].value as string, PREFIX_16, this.ln, this.ln, this.li - (this.mill['0'].value as string).length));
            if(!this.ic())
              switch ((this.mill['0'].value[1] as string).toLowerCase()) {
                case 'x': this.rx = 16;break;
                case 'o': this.rx = 8;break;
                case 'b': this.rx = 2;break;
                default: this.rx = 10;
              }
            this.mill.ls = null;
            this.mill['0'].value = null;
          }).bind(this)
        },
        '[': {
          value: null,
          ad: ((x: string) => {
            if(this.mill.ls !== null && this.mill[this.mill.ls].value !== this.mill['['].value) this.mill[this.mill.ls].ca();
            const k = (this.mill['['].value??"") + x;
            if((k === "[[") || (k.length === 1 && k === '[')){
              this.mill['['].value = k;
              if(k === "[["){
                this.mill['['].ge();
              } else this.mill.ls = '[';
            } else {
              this.mill['['].ca();
              if(utility.isValid(this.mill[x])) this.mill[x].ad(x);//because this might be '0x'
              else if(utility.isWhitespace(x)) this.manufacture(new Token(x, WHITESPACE, this.ln, this.ln, this.li - x.length));
              else if(this.isNumber(x, this.rx)) {
                this.mill.int.ad(x);
              } else this.mill.tx.ad(x);
            }
          }).bind(this),
          ca: (() => {
            this.manufacture(new Token(this.mill['['].value as string, LEFT_BRACKET, this.ln, this.ln, this.li - (this.mill['['].value as string).length));
            this.mill.ls = null;
            this.mill['['].value = null;
          }).bind(this),
          ge: (() => {
            this.manufacture(new Token(this.mill['['].value as string, DUAL_LEFT_BRACKET, this.ln, this.ln, this.li - (this.mill['['].value as string).length));
            this.mill.ls = null;
            this.mill['['].value = null;
          }).bind(this)
        },
        ']': {
          value: null,
          ad: ((x: string) => {
            if(this.mill.ls !== null && this.mill[this.mill.ls].value !== this.mill[']'].value) this.mill[this.mill.ls].ca();
            const k = (this.mill[']'].value??"") + x;
            if((k === "]]") || (k.length === 1 && k === ']')){
              this.mill[']'].value = k;
              if(k === "]]"){
                this.mill[']'].ge();
              } else this.mill.ls = ']';
            } else {
              this.mill[']'].ca();
              if(utility.isValid(this.mill[x])) this.mill[x].ad(x);//because this might be '0x'
              else if(utility.isWhitespace(x)) this.manufacture(new Token(x, WHITESPACE, this.ln, this.ln, this.li - x.length));
              else if(this.isNumber(x, this.rx)) {
                this.mill.int.ad(x);
              } else this.mill.tx.ad(x);
            }
          }).bind(this),
          ca: (() => {
            this.manufacture(new Token(this.mill[']'].value as string, RIGHT_BRACKET, this.ln, this.ln, this.li - (this.mill[']'].value as string).length));
            this.mill.ls = null;
            this.mill[']'].value = null;
          }).bind(this),
          ge: (() => {
            this.manufacture(new Token(this.mill[']'].value as string, DUAL_RIGHT_BRACKET, this.ln, this.ln, this.li - (this.mill[']'].value as string).length));
            this.mill.ls = null;
            this.mill[']'].value = null;
          }).bind(this)
        },
        '"': {
          value: null,
          ad: ((x: string) => {
            if(this.mill.ls !== null && this.mill[this.mill.ls].value !== this.mill['"'].value) this.mill[this.mill.ls].ca();
            const k = (this.mill['"'].value??"") + x;
            if((k === '""""""') || (k.length < 6 && x === '"')){
              this.mill['"'].value = k;
              if(k === '""""""'){
                this.mill['"'].ge();
              } else this.mill.ls = '"';
            } else {
              this.mill['"'].ca();
              if(utility.isValid(this.mill[x])) this.mill[x].ad(x);//because this might be '0x'
              else if(utility.isWhitespace(x)) this.manufacture(new Token(x, WHITESPACE, this.ln, this.ln, this.li - x.length));
              else if(this.isNumber(x, this.rx)) {
                this.mill.int.ad(x);
              } else this.mill.tx.ad(x);
            }
          }).bind(this),
          ca: (() => {
            if(this.bStr()){
              while(this.mill['"'].value.length !== 3 && this.mill['"'].value.length > 0){
                const q = (this.mill['"'].value as string).substring(0, 1);
                this.manufacture(new Token(q, this.iBStr() ? D_QUOTE_END : D_QUOTE, this.ln, this.ln, this.li - 1));
                this.mill.ls = null;
                if(this.iBStr()) this.q = null as any as Type;
                else if(this.q === null && !this.ic()) this.q = D_QUOTE;
                this.mill['"'].value = (this.mill['"'].value as string).substring(1);
              }
              if((this.mill['"'].value as string).length === 3) {
                this.manufacture(new Token('"""', this.iMBStr() ? TRI_D_QUOTE_END : TRI_D_QUOTE, this.ln, this.ln, this.li - 3));
                if(this.iMBStr()) this.q = null as any as Type;
                else if(this.q === null && !this.ic()) this.q = TRI_D_QUOTE;
              }
            } else {
              if((this.mill['"'].value as string).length >= 3) {
                this.manufacture(new Token('"""', this.iMBStr() ? TRI_D_QUOTE_END : TRI_D_QUOTE, this.ln, this.ln, this.li - 3));
                if(this.iMBStr()) this.q = null as any as Type;
                else if(this.q === null && !this.ic()) this.q = TRI_D_QUOTE;
                this.mill['"'].value = (this.mill['"'].value as string).substring(3);
              }
              while(this.mill['"'].value.length > 0){
                const q = (this.mill['"'].value as string).substring(0, 1);
                this.manufacture(new Token(q, this.iBStr() ? D_QUOTE_END : D_QUOTE, this.ln, this.ln, this.li - 1));
                this.mill.ls = null;
                if(this.iBStr()) this.q = null as any as Type;
                else if(this.q === null && !this.ic()) this.q = D_QUOTE;
                this.mill['"'].value = (this.mill['"'].value as string).substring(1);
              }
            }
            this.mill.ls = null;
            this.mill['"'].value = null;
            this.rx = 10;
          }).bind(this),
          ge: (() => {
            while((this.mill['"'].value as string).length > 0) {
              const q = (this.mill['"'].value as string).substring(0, 3);
              this.manufacture(new Token(q, this.iMBStr() ? TRI_D_QUOTE_END : TRI_D_QUOTE, this.ln, this.ln, this.li - q.length));
              if(this.iMBStr()) this.q = null as any as Type;
              else if(this.q === null && !this.ic()) this.q = TRI_D_QUOTE;
              this.mill['"'].value = (this.mill['"'].value as string).substring(3);
            }
            this.mill.ls = null;
            this.mill['"'].value = null;
            this.rx = 10;
          }).bind(this)
        },
        "'": {
          value: null,
          ad: ((x: string) => {
            if(this.mill.ls !== null && this.mill[this.mill.ls].value !== this.mill["'"].value) this.mill[this.mill.ls].ca();
            const k = (this.mill["'"].value??"") + x;
            if((k === "''''''") || (k.length < 6 && x ===  "'")){
              this.mill["'"].value = k;
              if(k === "''''''"){
                this.mill["'"].ge();
              } else this.mill.ls = "'";
            } else {
              this.mill["'"].ca();
              if(utility.isValid(this.mill[x])) this.mill[x].ad(x);//because this might be '0x'
              else if(utility.isWhitespace(x)) this.manufacture(new Token(x, WHITESPACE, this.ln, this.ln, this.li - x.length));
              else if(this.isNumber(x, this.rx)) {
                this.mill.int.ad(x);
              } else this.mill.tx.ad(x);
            }
          }).bind(this),
          ca: (() => {
            if(this.lStr()) {
              while(this.mill["'"].value.length !== 3 && this.mill["'"].value.length > 0){
                const q = (this.mill["'"].value as string).substring(0, 1);
                this.manufacture(new Token(q, this.iLStr() ? QUOTE_END : QUOTE, this.ln, this.ln, this.li - 1));
                this.mill.ls = null;
                if(this.iLStr()) this.q = null as any as Type;
                else if(this.q === null && !this.ic()) this.q = QUOTE;
                this.mill["'"].value = (this.mill["'"].value as string).substring(1);
              }
              if((this.mill["'"].value as string).length === 3) {
                this.manufacture(new Token("'''", this.iMLStr() ? TRI_QUOTE_END : TRI_QUOTE, this.ln, this.ln, this.li - 3));
                if(this.iMLStr()) this.q = null as any as Type;
                else if(this.q === null && !this.ic()) this.q = TRI_QUOTE;
              }
            } else {
              if((this.mill["'"].value as string).length >= 3) {
                this.manufacture(new Token("'''", this.iMLStr() ? TRI_QUOTE_END : TRI_QUOTE, this.ln, this.ln, this.li - 3));
                if(this.iMLStr()) this.q = null as any as Type;
                else if(this.q === null && !this.ic()) this.q = TRI_QUOTE;
                this.mill["'"].value = (this.mill["'"].value as string).substring(3);
              }
              while(this.mill["'"].value.length > 0){
                const q = (this.mill["'"].value as string).substring(0, 1);
                this.manufacture(new Token(q, this.iLStr() ? QUOTE_END : QUOTE, this.ln, this.ln, this.li - 1));
                this.mill.ls = null;
                if(this.iLStr()) this.q = null as any as Type;
                else if(this.q === null && !this.ic()) this.q = QUOTE;
                this.mill["'"].value = (this.mill["'"].value as string).substring(1);
              }
            }
            this.mill.ls = null;
            this.mill["'"].value = null;
            this.rx = 10;
          }).bind(this),
          ge: (() => {
            while((this.mill["'"].value as string).length > 0) {
              const q = (this.mill["'"].value as string).substring(0, 3);
              this.manufacture(new Token(q, this.iMLStr() ? TRI_QUOTE_END : TRI_QUOTE, this.ln, this.ln, this.li - q.length));
              if(this.iMLStr()) this.q = null as any as Type;
              else if(this.q === null && !this.ic()) this.q = TRI_QUOTE;
              this.mill["'"].value = (this.mill["'"].value as string).substring(3);
            }
            this.mill.ls = null;
            this.mill["'"].value = null;
            this.rx = 10;
          }).bind(this)
        },
        int: {
          value: null,
          ad: ((x: string) => {
            if(this.mill.ls !== null && this.mill[this.mill.ls].value !== this.mill.int.value) this.mill[this.mill.ls].ca();
            const k = (this.mill.int.value??"") + x;
            if(this.isNumber(x, this.rx) || (x === "_" && this.mill.ls === "int")){
              this.mill.int.value = k;
              this.mill.ls = "int";
            } else {
              this.mill.int.ca();
              if(utility.isValid(this.mill[x])) this.mill[x].ad(x);//because this might be '0x'
              else if(utility.isWhitespace(x)) this.manufacture(new Token(x, WHITESPACE, this.ln, this.ln, this.li - x.length));
              else this.mill.tx.ad(x);
            }
          }).bind(this),
          ca: (() => {
            if(this.mill.int.value && this.mill.int.value.length > 0)
            this.manufacture(new Token(this.mill.int.value as string, INT, this.ln, this.ln, this.li - (this.mill.int.value as string).length));
            this.mill.ls = null;
            this.mill.int.value = null;
            this.rx = 10;
          }).bind(this),
          ge: (() => {
            this.manufacture(new Token(this.mill.int.value as string, INT, this.ln, this.ln, this.li - (this.mill.int.value as string).length));
            this.mill.int.value = null;
            this.mill.ls = null;
            this.rx = 10;
          }).bind(this)
        },
        tx: {
          value: null,
          ad: ((x: string) => {
            if(this.mill.ls !== null && this.mill[this.mill.ls].value !== this.mill.tx.value) this.mill[this.mill.ls].ca();
            const k = (this.mill.tx.value??"") + x;
            if(utility.isValid(this.mill[x])){
              this.mill.tx.ca();
              this.mill[x].ad(x);
            } else if(utility.isWhitespace(x)){
              this.mill.tx.ca();
              this.manufacture(new Token(x, WHITESPACE, this.ln, this.ln, this.li - x.length));
            } else if(this.isNumber(x, this.rx)){
              this.mill.tx.ca();
              this.mill.int.ad(x);
            } else {
              this.mill.tx.value = k;
              this.mill.ls = "tx";
            }
          }).bind(this),
          ca: (() => {
            if(this.mill.tx.value && this.mill.tx.value.length > 0)
            this.manufacture(new Token(this.mill.tx.value as string, TEXT, this.ln, this.ln, this.li - (this.mill.tx.value as string).length));
            this.mill.tx.value = null;
            this.mill.ls = null;
          }).bind(this),
          ge: (() => {
            this.manufacture(new Token(this.mill.tx.value as string, TEXT, this.ln, this.ln, this.li - (this.mill.tx.value as string).length));
            this.mill.tx.value = null;
            this.mill.ls = null;
          }).bind(this)
        },
        ad: ((x: string) => {
          if(this.mill.ls !== null) this.mill[this.mill.ls].ad(x);
          else if(utility.isValid(this.mill[x])) (this.mill[x] as Tokenizer).ad(x);
          else if(this.isNumber(x, this.rx)) this.mill.int.ad(x);
          else this.mill.tx.ad(x);
        }).bind(this),
        ca: (() => {
          if(this.mill.ls !== null) this.mill[this.mill.ls].ca();
        }).bind(this)
      } as TokenFactory;
      /**
       * Gets the token factory ready for processing. This also intialises all other properties including normilising the token
       * queue. It also properly creates a tokenizer for the *user-defined* line terminator
       * @param {string} eol The intended line terminator for this lexer
       */
      constructor(eol: string) {
        this.q = null as any as Type;
        this.queue = [new Token("", INIT, -1, -1, -1)];
        this.src = "";
        this.ln = 1;
        this.li = 1;
        this.esc = 0;
        this.escText = "";
        this.he = false;

        this.mill[eol[0]] = {
          value: null,
          ad: ((x?: string) => {
            if(this.mill.ls !== null && this.mill[this.mill.ls].value !== this.mill[eol[0]].value) this.mill[this.mill.ls].ca();
            const k = (this.mill[eol[0]].value??"") + x!;
            if((k === eol) || (k.length < eol.length && eol.startsWith(k))){
              this.mill[eol[0]].value = k;
              if(k === eol) this.mill[eol[0]].ge();
              else this.mill.ls = eol[0];
            } else {
              this.mill[eol[0]].ca();
              if(utility.isValid(this.mill[x!])) this.mill[x!].ad(x!);//because this might be '0x'
              else if(utility.isWhitespace(x!)) this.manufacture(new Token(x!, WHITESPACE, this.ln, this.ln, this.li - x!.length));
              else if(this.isNumber(x!, this.rx)) {
                this.mill.int.ad(x!);
              } else this.mill.tx.ad(x!);
            }
          }).bind(this),
          ca: (() => {
            this.manufacture(new Token(this.mill[eol[0]].value as string, WHITESPACE, this.ln, this.ln, this.li - (this.mill[eol[0]].value as string).length));
            this.mill.ls = null;
            this.mill[eol[0]].value = null;
            this.rx = 10;
          }).bind(this),
          ge: (() => {
            this.manufacture(new Token(this.mill[eol[0]].value as string, EOL, this.ln, this.ln, this.li - (this.mill[eol[0]].value as string).length));
            this.mill.ls = null;
            this.mill[eol[0]].value = null;
            this.rx = 10;

            this.ln++;
            this.li = 1;
            this.he = false;
          }).bind(this)
        }

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
       * @summary Is the lexer in any basic string?
       * @description
       * Asserts that this lexer is creating tokens which are the contents of any of the basic string variant (basic or multi-line basic).
       * @returns {boolean} `true` if the current token is being created as any basic string content and `false` if otherwise.
       */
      private bStr(): boolean {
        return this.iBStr() || this.iMBStr();
      }
      /**
       * @summary Is the lexer in any literal string?
       * @description
       * Asserts that this lexer is creating tokens which are the contents of any of the literal string variant (literal or multi-line literal).
       * @returns {boolean} `true` if the current token is being created as any literal string content and `false` if otherwise.
       */
      private lStr(): boolean {
        return this.iLStr() || this.iMLStr();
      }
      /**
       * @summary Is the lexer in a string?
       * @description
       * Asserts that this lexer is creating tokens which are the contents of a string (basic, literal, multiline basic or mutiline literal).
       * @remark
       * This method is unused though.
       * @returns {boolean} `true` if the current token is being created as a string content and `false` if otherwise.
       */
      private isStr(): boolean {
        return this.iBStr() || this.iLStr() || this.iMBStr() || this.iMLStr();
      }
      /**
       * @summary Is this a comment?
       * @description
       * Gets whether or not the next character will be part of a comment.
       * @returns {boolean} true if the next character to be processed is part of an inline comment
       */
      private ic(): boolean {
        return (!this.isStr()) && this.he === true;
      }
      /**
       * @summary pops the distance from 0 of the {@linkcode unprocessed} string
       * @description
       * Pops the given num of characters from {@linkcode unprocessed} and returns it.
       * After this returns, `unprocessed` will be one character shorter.
       * @param {number} distance the number of characters to be popped from the src.
       * @returns {string} the character(s) occupying the given range. Note: will
       * return undefined if `distance` is equal to or greater than `unprocessed().length`.
       */
      private shiftSrc(distance: number): string {
        const rv = this.src.substring(0, distance);
        this.src = this.src.substring(distance);
        this.li += distance;
        return rv;
      }
      /**
       * @summary Is the number of escape even?
       * @description
       * A check for whether the number of escape characters encountered by this lexer is even.
       * @returns {boolean} `true` if the number of escape character encountered is even `false` is otherwise.
       */
      private escIsEven(): boolean {
        return this.esc % 2 == 0;
      }
      /**
       * Tests the string if it is defined as a number in the given radis/base.
       * @param {string} val the character to be tested.
       * @param {number} rx the radix (number base) to test with.
       * @returns {boolean} `true` is the string argument is defined as a number in the given radix or else `false`.
       */
      private isNumber(val: string, rx: number = 10): boolean{
        const i = "01234567890ABCDEF".indexOf(val.toUpperCase());
        return i <= rx && i >= 0;
      }
      /**
       * Properly enqueues the given token for consumption by a parser.
       * @param {Token} t token to be enqueued.
       * @returns {void} an imperative and mutative code, does not return anything.
       */
      manufacture(t: Token): void {
        this.queue.push(t);
      }
      /**
       * @summary An operation to complete the processing of characters.
       * @description
       * This method performs the following functions:
       * 
       * - Writes an empty string to coerce processing of stuck character tokens into proper {@linkplain Token tokens}. Because
       * this lexer processes characters only after it encounters them, some characters may remain stuck in the production line
       * (a cache or variable used to temporary hold characters that would have a different meaning if the right set of characters
       * are encountered next) awaiting further processing (until another character is analysed to interpret the meaning of it)
       * which may be never, if the end of stream/file is encountered. Hence a coercion is done to liberate stuck token as this
       * lexer does not support the ubiquitous `lookahead()` which conventional parsing is known for.
       * - And then writes a line terminator to ease the parsing downstream (also as a last ditch attempt to fully corce any unstuck
       * character).
       * 
       * Without calling this method the following will not be properly processed if it is not line terminated even though all the
       * characters may be read into
       * this lexer:
       * ```ini
       * # ... all other data omitted for brevity
       * key = 'values'
       * ```
       * This is because the processing pipline is expecting an extra (possibly 2 extra) characters to defined the last `'`
       * encountered. \
       * \
       * It is the resposibility of users of this lexer to call this method as a cleanup after `process()`. This is because if a
       * stream/file/string is ended by a {@linkplain EOL line terminator}, then no need character(s) will be stuck in the token mill
       * and, by consequence, no need for coercion or cleanup.
       * @param {Syntax} syntax a reference to a syntax object which is used to call {@linkcode StringLexer.process process()}.
       * @param {Params} params a reference to a params object which is used to call {@linkcode StringLexer.process process()}.
       * Can be `undefined`.
       * @returns {void} an imperative and mutative code, does not return anything.
       */
      end(syntax: Syntax, params: Params): void {
        if (this.canProcess()) this.process("", syntax, params);
        this.process(syntax.eol, syntax, params);
      }
      /**
       * @summary Processes a string into tokens
       * @description
       * Appends the given `chunk` to `src` and then gradually polls (extracts the first character of) `src`, process it, and
       * appends a fully processed token to the token queue.
       * @param {Syntax} syntax a reference to a syntax object which is used to call {@linkcode StringLexer.process process()}.
       * @param {Params} p can be left `undefined` if possible or defined as `null`.
       * @returns {void} an imperative and mutative code, does not return anything.
       */
      process(chunk: string, syntax: Syntax, p: Params): void {
        this.src += chunk;
        while(this.src.length > 0){
          let token = this.shiftSrc(1);

          if(!this.escIsEven()) {//if there is an escape already waiting for it's correspondent
            if (this.escText.length === 0) {//There is no escaped text stored yet
              this.escText += token;//append
              if (this.escText[0].toLowerCase() !== 'u' && this.escText[0] !== syntax.eol[0]) {//If the escaped text is not unicode
                if (utility.isValid(this.mill.ls)) {//if we have values waiting in the mill to be processed into tokens
                  this.mill.ca();
                }
                // if(token === '\r' && this.src[0] === '\n'){
                //   token = this.shiftSrc(1);
                //   this.li++;
                //   this.escText += token;
                // }
                this.manufacture(new Token(this.escText, ESCAPED, this.ln, this.ln, this.li - this.escText.length));
                this.escText = "";
                this.esc = 0;
              }
            } else if (/[A-Fa-f0-9]/.test(token)) {//a hexadecimal escape. Probably for a unicode escape
              this.escText += token;
              if (this.escText.length === 9) {//It is complete utf32 escape in the form U+XXXXXXXX (including 'u')
                if (utility.isValid(this.mill.ls)) {//if we have values waiting in the mill to be processed into tokens
                  this.mill.ca();
                }
                this.manufacture(new Token(this.escText, ESCAPED, this.ln, this.ln, this.li - this.escText.length));
                this.escText = "";
                this.esc = 0;
              }
            } else if((this.escText + token) === syntax.eol || ((this.escText + token).length < syntax.eol.length && syntax.eol.startsWith(this.escText + token))) {
              this.escText += token;
              if(this.escText === syntax.eol){
                if (utility.isValid(this.mill.ls)) {//if we have values waiting in the mill to be processed into tokens
                  this.mill.ca();
                }
                this.manufacture(new Token(this.escText, ESCAPED, this.ln, this.ln, this.li - this.escText.length));
                this.escText = "";
                this.esc = 0;
                //an escaped line terminator ends a line
                this.ln++;
                this.li = 1;
                this.he = false;
              }
            } else {
              if (utility.isValid(this.mill.ls)) {//if we have values waiting in the mill to be processed into tokens
                this.mill.ca();
              }
              let t = "";
              if(this.escText.length > 5){//It may be a utf16 escape in the form U+XXXX, but may already have unnecessary digits appended
                t = this.escText.substring(5);//extract the excess (hex numbers only but is regarded as a string)
                this.escText = this.escText.substring(0, 5);//extract only the code points
              } else if(this.escText.length < 5) {//A malformed escape? in one of the forms U | U+X | U+XX | U+XXX
                t = this.escText.substring(1);//extract the excess (hex numbers only but is regarded as a string)
                this.escText = this.escText.substring(0, 1);//return only the 'U'. Will cause an error when command gets it
              }
              this.src = t + token + this.src;
              this.li -= (t.length + token.length);
              this.manufacture(new Token(this.escText, ESCAPED, this.ln, this.ln, this.li - this.escText.length));
              this.escText = "";
              this.esc = 0;
            }
          } else {
            this.mill.ad(token);
          }
        }
      }
      /**
       * Gets the queue of {@linkcode Token} objects ready to be consumed by a parser. DO NOT MODIFY the array returned as that may
       * cause parsing to be undefined.
       * @returns {Token[]} the queue of `Token` objects which is an array
       */
      processed = (): Token[] => this.queue;
      /**
       * Returns an empty string. See {@linkcode src} for the reason why.
       * @returns {string} the {@link src} value.
       * @see {@linkcode src}
       */
      unprocessed = (): string => this.src;
      /**
       * @inheritdoc
       */
      frequency(type: parser.Type): number {
        let frqy = 0;
        for (let i = 0; i < this.queue.length; i++) {
          if (this.queue[i].type.equals(type)) frqy++;
        }
        return frqy;
      }
      /**
       * @inheritdoc
       */
      indexOf(type: parser.Type): number {
        for (let i = 0; i < this.queue.length; i++) {
          if (this.queue[i].type.equals(type)) return i;
        }
        return -1;
      }
      /**
       * @inheritdoc
       */
      lastIndexOf(type: parser.Type): number {
        for (let i = this.queue.length - 1; i >= 0; i--) {
          if (this.queue[i].type.equals(type)) return i;
        }
        return -1;
      }
      /**
       * @inheritdoc
       */
      hasTokens(): boolean {
        return this.queue.length > 0;
      }
      /**
       * @inheritdoc
       */
      canProcess(): boolean {
        return this.src.length > 0;
      }
      /**
       * @inheritdoc
       */
      next(): Token {
        while (true) {
          if (!this.hasTokens()) break;
          return this.queue!.shift()!;
        }
        return new Token("", EOF, this.line(), this.line(), this.position());
      }
      /**
       * Gets the current line that is being processed. This is updated each time a {@linkplain Syntax.eol line terminator} is
       * encountered by {@linkcode StringLexer.process process()}.
       * @returns {number} The current line that is being processed.
       */
      position(): number {
        return this.li;
      }
      /**
       * Gets the current position of the character within a given line that is being processed. This is updated each time a
       * a character is encountered by {@linkcode StringLexer.process process()}.
       * @returns {number} The current position of the character within the current line.
       */
      line(): number {
        return this.ln;
      }
    }
    export interface Command extends parser.GCommand<Token, Expression, Syntax, MutableLexer, Parser> {
      parse( ap: Expression, yp: Token, p: Parser, l: MutableLexer, s: Syntax, pa?: Params ): Expression;
    }
    /**
     * @summary The source comment.
     * @description
     * Represents the part of the code that is a comment, i.e Characters following/on the same line of source code, that
     * is regard as a comment to the code.
     */
    export type SourceComment = {
      /**
       * @summary An array representing consecutive lines of comment verbatim.
       * @description 
       * The block comment preceding a given snippet of source code. Each element in the array represents a line of comment
       * whereby the first element is the first line of comment, second element is the second line of comment, et cetera (and so on).
       * Every index with an empty string (`""`) denotes the presence of a comment character but abscence of accompanying
       * characters. `null` and `undefined` indexes are not supported.
       * @readonly
       * @type {readonly string[]}
       */
      readonly blk: readonly string[];
      /**
       * The inline comment as a string i.e comment on the same line as a snippet of code. An empty string (`""`) denotes the
       * presence of the comment character (`#`) and abscence of accompanying characters. This value is 'as is'.
       * @readonly
       * @type {string}
       */
      readonly iln?: string;
    }
    /**
     * @summary a section of code.
     * @description
     * Represents a partial {@linkplain Expression expression} which contains the source of the expression i.e the part of a
     * format which was parsed to produce a given expression which is represented 'as is'.
     */
    export type Snippet = SourceComment & {
      /**
       * @summary The source code
       * Represents the part of the code that is not a comment.
       * @readonly
       * @type {string}
       */
      readonly src: string;
    }
    export interface Expression extends expression.GExpression<Format> {
      /**
       * @summary The source code.
       * @description
       * The source code from which this expression was parsed. This may be syntactically incorrect in isolation,
       * However, file formats will initially seek for the original code to replicate the data format as it was read from the
       * file.
       * @readonly
       * @type {Snippet}
       */
      readonly c?: Snippet;
      format(format: Format, syntax?: Syntax, params?: Params | any): void;
    }
    /**
     * @summary An abstract class for all toml numerical types
     * @description
     * A class creating the basic structure for {@linkcode Int} and {@linkcode B64}.
     */
    abstract class Figure implements Expression {
      /**
       * The `Figure` constructor.
       * @param {bigint | number} val the numerical value of this object
       * @param {Snippet | undefined} c the source expression that thus object was parsed from.
       */
      constructor(public readonly val: bigint | number, public readonly c?: Snippet){}
      format(format: Format<any>, syntax?: Syntax | undefined, params?: any): void {
        format.append(this, syntax, params);
      }
      debug(): string {
        let v = "";
        if(utility.isValid(this.c) && this.c!.blk.length > 0) v += this.c!.blk.join("\n").concat("\n");
        v += this.val.toString();
        if(utility.isValid(this.c) && utility.isValid(this.c!.iln)) v += ` # ${this.c!.iln!}`;
        return v;
      }
      equals(obj?: object | undefined): boolean {
        if(obj instanceof Figure){
          return this.val === obj.val && this.c === obj.c;
        }
        return false;
      }
      hashCode32(): number {
        return utility.hashCode32(true, utility.asHashable(this.val));//, utility.asHashable(this.c ? this.c.src : null),
        // utility.asHashable(this.c ? this.c.iln : null), utility.asHashable(this.c ? this.c.blk : null));
      }
      toString() {
        return this.debug();
      }
    }
    /**
     * @summary Integer implementation as per the toml spec.
     * @description
     * A wrapper for a `bigint` type represented as 64 bit integer value.
     */
    class Int extends Figure {
      /**
       * The bitlength of this `Int`
       * @readonly
       * @type {number}
       */
      public readonly l;
      /**
       * Constructs an `Int`
       * @param {bigint} val the value wrapped by this `Int`
       * @param {Snippet | undefined} c the code snippet that created this expression
       */
      constructor(val: bigint, c?: Snippet) {
        super(val, c);
        const len = utility.length(val);
        this.l = val >= 0n || len > 64 ? len : 64;
        if(this.l > 64) throw new expression.ExpressionError(`length of val is ${this.l}. The max is 64`);
      }
    }
    /**
     * @summary Binary64 implementation as per the toml spec.
     * @description
     * A wrapper for a `number` type represented as an IEEE 754 floating point value.
     */
    class B64 extends Figure {
      /**
       * Constructs a `B64`
       * @param {number} val the floating point value.
       * @param {Snippet | undefined} c the snippet that created this object.
       */
      constructor(val: number, c?: Snippet) {
        super(val, c);
      }
    }
    /**
     * A local date as defined by the toml spec.
     */
    type LocalDate = {
      /**
       * @summary The year property
       * @description
       * The year in the range [0, 9999]
       * @readonly
       * @type {Int}
       */
      readonly yr: Int,
      /**
       * @summary The month property
       * @description
       * The month in the range [1, 12].\
       * \
       * Can be `null` or `undefined` only if the day property is also `null` or `undefined`.
       * @readonly
       * @type {Int}
       */
      readonly mo?: Int,
      /**
       * @summary The day property
       * @description
       * The day of the month in any of the following ranges
       * - [`1`, `28`] *if the month property is* `2` *and the yr property is not a leap year*.
       * - [`1`, `29`] *if the month property is* `2` *and the yr property is a leap year*.
       * - [`1`, `30`] *if the month property either of the following* `4`, `6`, `9`, `11`.
       * - [`1`, `31`] *if the month property any other than those specified from the preceding 3 lists*.
       * 
       * Can be `null` or `undefined` only if the month property is also `null` or `undefined`.
       * @readonly
       * @type {Int | null | undefined}
       */
      readonly dy?: Int,
    }
    /**
     * A local time as defined by the toml spec.
     */
    type LocalTime = {
      /**
       * @summary The hour property
       * @description
       * The hour in the range [0, 23]
       * @readonly
       * @type {Int}
       */
      readonly hr: Int,
      /**
       * @summary The minute property
       * @description
       * The minute in the range [0, 59].\
       * \
       * Can be `null` or `undefined` only if the second property is also `null` or `undefined`.
       * @readonly
       * @type {Int}
       */
      readonly mi?: Int,
      /**
       * @summary The second property
       * @description
       * The second in the range [0, 59]. Leap seconds are not considered by this parser.\
       * \
       * Can be `null` or `undefined` only if the minute property is also `null` or `undefined`.
       * @readonly
       * @type {Int}
       */
      readonly se?: B64,
    }
    /**
     * A UTC offset time as defined by the toml spec.
     */
    type OffsetTime = {
      /**
       * The type of offset-time. `undefined` is no UTC offset, `null` is `Z` (UTC), `true` is `+`and `false is `-` in
       * RFC 3339 (and ISO8601).
       * @readonly
       * @type {boolean | undefined | null}
       */
      readonly type: boolean | null | undefined,
      /**
       * @summary The offset-hour property
       * @description
       * The offset-hour in the range [0, 23].\
       * \
       * Can be `null` or `undefined` only if the type property is also `null` or `undefined`.
       * @readonly
       * @type {Int}
       */
      readonly ohr?: Int,
      /**
       * @summary The offset-minute property
       * @description
       * The offset-minute in the range [0, 23].\
       * \
       * Can be `null` or `undefined` only if the type property is also `null` or `undefined`.
       * @readonly
       * @type {Int}
       */
      readonly omi?: Int
    }
    /**
     * A full-time where the time and UTC offset must be provided.
     */
    type FullTime = LocalTime & OffsetTime;
    /**
     * An offset date-time as defined by the toml spec.
     */
    type OffsetDateTime = LocalDate & FullTime;
    /**
     * A local date-time as defined by the toml spec.
     */
    type LocalDateTime = LocalDate & LocalTime;
    /**
     * @summary DateTime implementation using the RFC 3339 spec.
     * @description
     * An object that follows the RFC 3339 recommendation by wrapping multiple {@linkcode Int} values.
     */
    class R39 implements Expression {
      /**
       * Constructs a `R39` object.
       * @param {OffsetDateTime | LocalDateTime | LocalDate | LocalTime} val the value to be wrapped.
       * @param {Snippet | undefined} c the code snippet that created this expression.
       */
      constructor(public readonly val: OffsetDateTime | LocalDateTime | LocalDate | LocalTime, public readonly c?: Snippet){
      }
      format(format: Format<any>, syntax?: Syntax | undefined, params?: any): void {
        format.append(this, syntax, params);
      }
      debug(): string {
        let v = "";

        if(utility.isValid(this.c) && this.c!.blk.length > 0) v += this.c!.blk.join("\n").concat("\n");

        if((this.val as LocalDate).yr) {
          let date = [(this.val as LocalDate).yr.debug()];
          if(utility.isValid((this.val as LocalDate).mo)){
            date.push((this.val as LocalDate).mo!.debug());
            date.push((this.val as LocalDate).dy!.debug());
            v += date.join("-");
          } else v += date[0];
          if(v.indexOf("-") < 0) {
            if(utility.isValid(this.c) && utility.isValid(this.c!.iln)) v += ` # ${this.c!.iln!}`;
            return v;
          }
        }
        if((this.val as LocalTime).hr) {
          let time = [(this.val as LocalTime).hr.debug()];
          if(utility.isValid((this.val as LocalTime).mi)){
            time.push((this.val as LocalTime).mi!.debug());
            time.push((this.val as LocalTime).se!.debug());
          } else time.push("00", "00")
          v += time.join(":");
          v += (this.val as OffsetTime).type === null ? "Z" :
                 (this.val as OffsetTime).type === true ? "+" :
                     (this.val as OffsetTime).type === false ? "-" : "";
          if((this.val as OffsetTime).ohr) {
            let oft = [(this.val as OffsetTime).ohr!.debug()];
            if(utility.isValid((this.val as OffsetTime).omi)){
              oft.push((this.val as OffsetTime).omi!.debug());
            } else oft.push("00")
            v += oft.join(":");
          }
        }
        if(utility.isValid(this.c) && utility.isValid(this.c!.iln)) v += ` # ${this.c!.iln!}`;
        return v;
      }
      equals(obj?: object | undefined): boolean {
        if(obj instanceof R39){
          return this.c === obj.c && this.val === obj.val;
        }
        return false;
      }
      hashCode32(): number {
        return utility.hashCode32(false, utility.asHashable(this.val));
      }
    }
    /**
     * @summary Represents a toml string or bare key.
     * @description
     * A class that wraps a toml text value that is an {@linkcode Expression} that was created by a parser from one of the
     * following:
     * ### Basic string
     * TOML characters that are enclosed in double quotes `"` such as:
     * ```ini
     * "key" = "value" # both `key` and `value` are basic strings
     * ```
     * ### Literal string
     * TOML characters that are enclosed in quotes `'` such as:
     * ```ini
     * 'key' = 'value' # both `key` and `value` are literal strings
     * ```
     * ### Multi line basic string
     * TOML characters that are enclosed in 3 double quotes `"""` such as:
     * ```toml
     * """key""" = """value""" # both `key` and `value` are multi line basic strings
     * ```
     * ### Multi line literal string
     * TOML characters that are enclosed in 3 quotes `'''` such as:
     * ```toml
     * '''key''' = '''value''' # both `key` and `value` are multi line literal strings
     * ```
     * ### Bare keys
     * TOML characters that are not strings but are valid as keys with their character range being `A-Za-z0-9_-` such as:
     * ```ini
     * key = 0xFF # `key` is a bare key
     * ``` 
     */
    class Text implements Expression {
      /**
       * Constructs a `Text`, given the type if text being constructed with the `q` parameter.
       * @param {string} val the value wrapped by this object
       * @param {("" | "\"" | "\"\"\"" | "'" | "'''")} q the quote type used for this expression. An empty string denotes a bare key, a double quote `"` denotes a
       * basic string, a single quote `'` denotes a literal string, 3 characters that are all double quotes `"""` denote a
       * *multi-line* basic string and 3 characters that are all quotes `'''` denote *multi-line* literal strings.
       * @param {Snippet | undefined} c the code snippet that created this expression
       */
      constructor(public readonly val: string, public readonly q: ('"' | '"""' | "'" | "'''" | ""), public readonly c?: Snippet){
      }
      format(format: Format<any>, syntax?: Syntax | undefined, params?: any): void {
        format.append(this, syntax, params);
      }
      debug(): string {
        let v = "";
        if(utility.isValid(this.c) && this.c!.blk.length > 0) v += this.c!.blk.join("\n").concat("\n");
        v += `${this.q}${this.val}${this.q}`;
        if(utility.isValid(this.c) && utility.isValid(this.c!.iln)) v += ` # ${this.c!.iln!}`;
        return v;
      }
      equals(obj?: object | undefined): boolean {
        if(obj instanceof Text) return this.val === obj.val && this.c === obj.c;
        return false;
      }
      hashCode32(): number {
        return utility.hashCode32(true, utility.asHashable(this.val));
      }
    }
    type TablularData = {
      [key: string]: [Text, Expression]
    }
    abstract class Str<DType extends (TablularData | Expression[])> implements Expression {
      /**
       * Instantiates a `Str`
       * @param {DType} data the value wrapped by this class
       * @param {boolean} inl Is this TOML structural data readonly?. Check for whether this is an inline structure. `true` if
       * this is an inline structure, `false` if otherwise.
       * @param {Snippet | undefined} c a representation of the snippet of code that this expression was created from
       */
      protected constructor(protected readonly data: DType, public readonly inl: boolean, public readonly c?: Snippet){
        // this.in = utility.isValid(inline);
      }
      format(format: Format<any>, syntax?: Syntax | undefined, params?: any) {
        format.append(this, syntax, params);
      }
      abstract debug(): string;
      abstract equals(obj?: object | undefined): boolean;
      hashCode32(): number {
        return utility.hashCode32(false, utility.asHashable(this.inl), utility.asHashable(this.c ? this.c.src : null));
      }
    }
    /**
     * @summary An {@linkcode Expression} that is a toml table
     * @description
     * A class representing TOML table types including block and inline tables. Block tables can be modified after construction
     * inline ones cannot.
     */
    //Note that it is not possible to have block comments on inline tables
    //for inline tables, inline comments are after the table has been created
    // also note that the c.src property cannot have the whole body, just the head of thee table
    class Table extends Str<TablularData> {
      constructor(inline?: TablularData, public readonly c?: Snippet){
        super(inline??{}, utility.isValid(inline), c);
      }
      /**@summary print block table */
      private pbt(vl: string, pa?: string, e?: Expression){
        for (const k in this.data) {
          const v = this.data[k][1];
          if(v instanceof Table && !v.inl){}
          else if(v instanceof Seq && !v.inl){}
          else {
            vl += this.data[k][0].debug();//key
            vl += " = ";
            vl += this.data[k][1].debug();
          }
        }
      }
      override debug(): string {
        let r = "";
        if(this.inl) {
          r += "{ ";
          for (const k in this.data) {
            r += this.data[k][0].debug();
            r += " = ";
            r += this.data[k][1].debug();
            r += ", ";
          }
          if(r.endsWith(", ")) r = r.substring(0, r.length - 1);
          r += " }";
          if(utility.isValid(this.c) && utility.isValid(this.c!.iln)) r += ` # ${this.c!.iln!}`;
          return r;
        } else {
          r += "";
          for (const k in this.data) {
            const v = this.data[k];
            if(v instanceof Table){
            }
          }
          if(r.endsWith(",")) r = r.substring(0, r.length - 1);
          r += "}";
          if(utility.isValid(this.c) && utility.isValid(this.c!.iln)) r += ` # ${this.c!.iln!}`;
        }
        return r;
      }
      override equals(obj?: object | undefined): boolean {
        if(obj instanceof Table) {
          return Object.keys(this.data) === Object.keys(obj.data) && this.data === obj.data;
        }
        return false;
      }
    }
    /**
     * @summary An {@linkcode Expression} that is a toml array sequence
     * @description
     * A class representing TOML array sequence types including block and inline arrays. Block arrays can be modified after
     * they are created but inline arrays cannot be modified after they have been created.
     */
    class Seq extends Str<Expression[]> {
      constructor(inline?: Expression[], public readonly c?: Snippet){
        super(inline??[], utility.isValid(inline), c);
      }
      override debug(): string {
        throw new Error("Method not implemented.");
      }
      override equals(obj?: object | undefined): boolean {
        if(obj instanceof Seq) {
          return this.data.length === obj.data.length && this.data === obj.data;
        }
        return false;
      }
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