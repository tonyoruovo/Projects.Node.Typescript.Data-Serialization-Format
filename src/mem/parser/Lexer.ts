
import {Token} from "../token/Token"
import { Syntax } from "./Syntax";
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
export type Tokenizer = {
  /**
   * Used by *multi character* tokenizers as the result of the appendage done by {@linkcode Tokenizer.ad}.
   * This value is `null` if this is a single character tokenizer, or this multi-character tokenizer is not
   * currently processing any character(s).
   * @type {string | null}
   */
  value: string | null;
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
  ad: (item?: string) => void;
  /**
   * @summary Cancels the tokenizing process.
   * @description
   * Aborts or cancels the process started in {@linkcode Tokenizer.ad ad()} and performs a cleanup operation on the residual
   * items in this tokenizer. For tokens that can be created using single characters, this method does nothing.
   * @returns {void} an imperative and mutative code, does not return anything.
   */
  ca: () => void;
  /**
   * @summary Generates the token.
   * @description
   * Generates or creates the token by calling {@linkcode StringLexer.manufacture} on a fully composed token.
   * @returns {void} an imperative and mutative code, does not return anything.
   */
  ge: () => void;
};
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
 * The implementation of this type is found in the {@linkcode Lexer} as `Lexer.mill`
 */
export type TokenFactory = {
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
  ls: string | null;
  /**
   * Default `Tokenizer` for integers in a given radix. This only appends digits, it does not append separators (such as `_`),
   * exponents (such as `e`) or prefixes (such as `+`, `-`, `0x` etc) and will abort if it encounters one.
   */
  int: Tokenizer;
  /**
   * Default `Tokenizer` for non-whitespace text. Will abort if it encounters numbers or any token that is defined in this factory.
   */
  tx: Tokenizer;
  /**
   * A user-defined tokenizer. The `any` type annotation allows for other properties to be declared as non-Tokenizers for
   * the TypeScript 5.2.2 compiler.
   */
  [name: string]: Tokenizer | any;
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

export type Lexer = {
  src?: any;
  readonly mill: TokenFactory;
  position(): number;
  line(): number;
  (syntax?: Syntax): Token; //callable. Queries the lexer
};
