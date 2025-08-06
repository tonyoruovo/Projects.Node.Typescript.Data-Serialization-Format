import utility from "../../utility";
import { instanceOfType, Type } from "./Type";

/**
 * @summary Core token type for lexical analysis
 * @description
 * A comprehensive token type that represents lexical units in the parsing system.
 * Implements multiple utility interfaces for enhanced functionality:
 * - Hashable for efficient storage and lookup
 * - Predicatable for equality comparison
 * - Comparable for ordering and sorting
 * 
 * Features include:
 * - Source position tracking (line and column)
 * - Token value storage
 * - Type classification
 * - Length information
 * 
 * @example
 * // Create a basic token
 * const numToken = new Token("123", numberType, 1, 1, 0);
 * 
 * @example
 * // Token comparison and ordering
 * const token1 = new Token("+", opType, 1, 1, 5);
 * const token2 = new Token("*", opType, 1, 1, 7);
 * console.log(token1.compareTo(token2)); // negative (comes before)
 * 
 * @example
 * // Using token source information
 * const errToken = new Token("@", errorType, 3, 3, 10);
 * console.log(`Error at line ${errToken.lineStart}, position ${errToken.startPos}`);
 */
export type Token = utility.Hashable &
  utility.Predicatable &
  utility.Comparable<Token> & {
    /**
     * The begining of the line from which the token
     * was read. The first value is generally 1.
     * @type {number | undefined}
     * @readonly
     */
    readonly lineStart?: number;
    /**
     * The last line from which this token was read.
     * In most cases this will be the same as `lineStart`, except for tokens that represent code blocks, for example the body of a function as a single token.
     * @type {number | undefined}
     * @readonly
     */
    readonly lineEnd?: number;
    /**
     * The index of the position within a line of the initial
     * character that is part of this token. For example
     * if `x + 1234.5` is a read by the lexer, then the token
     * representing `1234.5` will have `4` as the value of
     * this property.
     * @type {number | undefined}
     * @readonly
     */
    readonly startPos?: number;
    /**
     * The length (length of the string or the number of bits)
     * of this token
     * @type {number | undefined}
     * @readonly
     */
    readonly length?: number;
    /**
     * The intrinsic value of this token. This is the value that will be incoporated into an expression.
     * @type {any}
     * @readonly
     */
    readonly value: any;
    // readonly type: Array<Type>;
    /**
     * The type of this token
     * @type {Type | undefined}
     * @readonly
     */
    readonly type?: Type;
  };

export type TokenConstructor = {
  new (
    value: string,
    type: Type,
    lineStart: number,
    lineEnd: number,
    startPos: number
  ): Token;
  (
    value: string,
    type: Type,
    lineStart: number,
    lineEnd: number,
    startPos: number
  ): Token;
  prototype: (typeof Object.prototype) & Token & {constructor: TokenConstructor};
};

export function instanceOfToken(o: any): o is Token {
    return !utility.isInvalid(o) && (o instanceof Token || isLikeToken(o));
}

function isLikeToken(o: unknown) {
  return typeof o === "object" &&
          "value" in o! &&
          "type" in o! && instanceOfType(o.type) &&
          "lineStart" in o! && typeof o.lineStart === "number" &&
          "lineEnd" in o! && typeof o.lineEnd === "number" &&
          "startPos" in o! && typeof o.startPos === "number" &&
          "length" in o! && typeof o.length === "number"
}

function ConcreteToken(this: Token, value: string, type: Type, lineStart: number, lineEnd: number, startPos: number) {
    if(new.target) {
        Object.defineProperties(this, {
            value: utility.readonlyPropDescriptor(value),
            type: utility.readonlyPropDescriptor(type),
            lineStart: utility.readonlyPropDescriptor(lineStart),
            lineEnd: utility.readonlyPropDescriptor(lineEnd),
            startPos: utility.readonlyPropDescriptor(startPos),
            length: utility.readonlyPropDescriptor(value.length)    
        })
    } else return new Token(value, type, lineStart, lineEnd, startPos);
}
// static methods
ConcreteToken.prototype = Object.create(Object.prototype);
// instance methods
ConcreteToken.prototype.constructor = ConcreteToken;
ConcreteToken.prototype.equals = function(this: Token, o?: object) {
    if(o instanceof Token) {
        return (this.lineStart === o.lineStart && this.lineEnd === o.lineEnd && this.startPos === o.startPos
                        && this.type!.equals(o.type) && this.value === o.value)
    }
    return false;
}
ConcreteToken.prototype.hashCode32 = function(this: Token) {
    return utility.hashCode32(true, utility.asHashable(this.value), utility.asHashable(this.type!.id), utility.asHashable(this!.type!.precedence), utility.asHashable(this!.startPos), utility.asHashable(this!.lineEnd), utility.asHashable(this!.lineStart))
}
ConcreteToken.prototype.compareTo = function(this: Token, o?: Token) {
    if(!utility.isValid(o)) {
        let by = utility.compare(this.lineStart, o!.lineStart);
        if (by !== 0) return by;
        by = utility.compare(this.lineEnd, o!.lineEnd);
        if (by !== 0) return by;
        by = utility.compare(this.startPos, o!.startPos);
        if (by !== 0) return by;
        by = utility.asCompare(utility.hashCode32(true, utility.asHashable(this.type!.id), utility.asHashable(this.type!.precedence)));
        if (by !== 0) return by;
        return utility.compare(this.value, o!.value);
    }
    return 1
}

const Token = ConcreteToken as TokenConstructor;
export default Token;
