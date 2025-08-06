import utility from "../../utility";
import Type, { Type as TokenType } from "./Type";

/**
 * @summary Generic version of Type for type-safe token classification
 * @description
 * A generic wrapper around the base Type that provides type safety for token identifiers.
 * This allows for:
 * - Type-safe token classification
 * - Compile-time type checking for token identifiers
 * - Type inheritance from the base Type
 * 
 * @example
 * // Create a typed token classification
 * type Operator = "+" | "-" | "*" | "/";
 * const addOp = new GType<Operator>("+", 10);
 * 
 * @example
 * // Type-safe comparison
 * const mulOp = new GType<Operator>("*", 20);
 * console.log(addOp.equals(mulOp)); // false
 * 
 * @template T - The type of the token identifier
 */
export type GType<T> = TokenType & {
  readonly id: T;
};
export type GTypeConstructor = {
  new (id: string, precedence: number): GType<string>;
  (id: string, precedence: number): GType<string>;
  prototype: (typeof Type.prototype) & GType<string>;
};
export function instanceOfGType(o: any): o is GType<string> {
  return !utility.isInvalid(o) && o instanceof GType;
}
function ConcreteGType(this: GType<string>, id: string, precedence: number) {
    if (new.target) {
        Type.call(this, id, precedence)
    } else return new GType(id, precedence);
}
ConcreteGType.prototype = Object.create(Type.prototype);
ConcreteGType.prototype.constructor = ConcreteGType;

const GType = ConcreteGType as GTypeConstructor;

export default GType;