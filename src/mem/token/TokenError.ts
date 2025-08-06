import utility from "../../utility";
import DataError, { DataError as DataTypeError } from "../DataError";
import { Token, instanceOfToken } from "./Token";

/**
 * @summary Specialized error type for token-related errors in lexical analysis
 * @description
 * A custom error type that extends DataError to handle token-specific errors during
 * lexical analysis and parsing, specifically during formation of tokens. Features include:
 * - Token preservation for error context
 * - Detailed error messaging
 * - Integration with DataError's error chaining
 * 
 * Use cases:
 * - Invalid token detection
 * - Tokenizer state errors
 * 
 * @example
 * // Basic error creation
 * throw new TokenError(invalidToken);
 * 
 * @example
 * // Error handling in a lexer
 * try {
 *   tokenize(input);
 * } catch (e) {
 *   if (e instanceof TokenError) {
 *     console.error(`Invalid token at ${e.token.lineStart}:${e.token.startPos}`);
 *   }
 * }
 * 
 * @example
 * // Custom error handling with token context
 * function handleTokenError(error: TokenError) {
 *   const { token } = error;
 *   console.error(`Error processing token '${token.value}' of type ${token.type?.id}`);
 * }
 */
export type TokenError = DataTypeError<Token> & {
  /**
   * The token that caused the error
   * @type {Token}
   */
  token: Token;
};
export type TokenErrorConstructor = {
  new (token: Token): TokenError;
  (token: Token): TokenError;
  prototype: DataTypeError & TokenError & {constructor: TokenErrorConstructor};
};
export function instanceOfTokenError(o: any): o is TokenError {
    return !utility.isInvalid(o) && (o instanceof TokenError || isLikeTokenError(o));
}
function isLikeTokenError(o: unknown) {
  return typeof o === "object" && "token" in o! && instanceOfToken(o.token);
}
function ConcreteTokenError(
  this: TokenError,
  token: Token
) {
  if (new.target) {
    DataError.call(this, (token.type || { id: Number.NaN }).id +
      " is not a valid token" +
      utility.eol +
      "at: " +
      token.lineStart +
      ":" +
      token.startPos, token)
    Error.captureStackTrace(this, this.constructor)
    Object.defineProperties(this, {
        token: utility.readonlyPropDescriptor(token),
        name: utility.readonlyPropDescriptor("TokenError")
    })
  } else {
    return new TokenError(token);
  }
}
ConcreteTokenError.prototype = Object.create(DataError.prototype);
ConcreteTokenError.prototype.constructor = ConcreteTokenError;

const TokenError = ConcreteTokenError as TokenErrorConstructor;
export default TokenError;