import { Token } from "../token/Token";
import { Type } from "../token/Type";
import { GLexer } from "./GLexer";
import { Syntax } from "./Syntax";

export type MutableLexer<
  T extends Token,
  S extends Syntax,
  CHUNK = string
> = GLexer<T, S> & {
  prototype: ThisType<MutableLexer<T, S>>;
  /**
   * @summary Gets and returns the list of tokens that have already been processed.
   * @description
   * Return the token buffer which contains tokens processed from `process` calls
   * Each time `processed` is called, tokens are created and these tokens are pushed into the token buffer awaiting a parser to call the `next` method of this
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
  process(chunk: CHUNK, syntax: S): void;
  /**
   * Finalises this lexer and signals an end to the processing. For some lexers, this will prevent `process`  from ever being called again.
   * @param {Syntax} syntax the provided syntax for this operation
   * @param {P} params the provided params object for this operation
   * @template P a mutable visitor that assists in this method by allowing this lexer to read and update it's state
   */
  end(syntax: S): void;
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
};
