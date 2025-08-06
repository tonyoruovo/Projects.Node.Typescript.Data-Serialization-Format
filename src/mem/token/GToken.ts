import utility from "../../utility";
import { GType } from "./GType";
import Token, { Token as TokenType } from "./Token";

/**
 * @summary Generic token type for type-safe lexical analysis
 * @description
 * A generic version of the Token type that provides type safety for token values.
 * This type ensures:
 * - Type-safe token values
 * - Proper type relationship with GType
 * - Full inheritance of Token capabilities
 * 
 * Key features:
 * - Generic type parameter for value type safety
 * - Compatible with GType for consistent typing
 * - Maintains all Token functionality
 * 
 * @example
 * // Create a typed number token
 * const numToken = new GToken<number>("123", numberType, 1, 1, 0);
 * 
 * @example
 * // Using with string literals
 * type Keywords = "if" | "else" | "while";
 * const keywordToken = new GToken<Keywords>("if", keywordType, 1, 1, 0);
 * 
 * @example
 * // Type-safe token processing
 * function processToken<T>(token: GToken<T>) {
 *   // Value is now properly typed as T
 *   const value = token.value;
 * }
 * 
 * @template T - The type of the token value
 */
export type GToken<T> = TokenType & {
  readonly value: T;
  readonly type: GType<T>;
};
export type GTokenConstructor = {
  new (
    value: string,
    type: GType<string>,
    lineStart: number,
    lineEnd: number,
    startPos: number
  ): GToken<string>;
  (
    value: string,
    type: GType<string>,
    lineStart: number,
    lineEnd: number,
    startPos: number
  ): GToken<string>;
  prototype: TokenType & GToken<string> & {constructor: GTokenConstructor};
};
export function instanceOfGToken(o: any): o is GToken<any> {
  return !utility.isInvalid(o) && o instanceof GToken
}

function ConcreteGToken(this: GToken<string>, value: string, type: GType<string>, lineStart: number, lineEnd: number, startPos: number) {
    if(new.target) {
        Token.call(this, value, type, lineStart, lineEnd, startPos)
    } else return new GToken(value, type, lineStart, lineEnd, startPos);
}
ConcreteGToken.prototype = Object.create(Token.prototype);
ConcreteGToken.prototype.constructor = ConcreteGToken;

const GToken = ConcreteGToken as GTokenConstructor
