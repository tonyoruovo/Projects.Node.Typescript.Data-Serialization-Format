import utility from "../../utility";

/**
 * @summary Base type for token type classification
 * @description
 * A foundational type for classifying tokens in the parsing system. It extends the Predicatable
 * interface and provides:
 * - Unique identifier system
 * - Operator precedence support
 * - Type equality comparison
 * 
 * @example
 * // Create a basic type
 * const numberType = new Type("NUMBER", 1);
 * 
 * @example
 * // Using types for operator precedence
 * const addType = new Type("+", 10);
 * const mulType = new Type("*", 20); // Higher precedence
 * 
 * @example
 * // Type comparison
 * const type1 = new Type("ID", 1);
 * const type2 = new Type("ID", 1);
 * console.log(type1.equals(type2)); // true
 */
export type Type = utility.Predicatable & {
  readonly id: any;
  readonly precedence: number;
};

export type TypeConstructor = {
  new (id: string, precedence: number): Type;
  (id: string, precedence: number): Type;
  prototype: (typeof Object.prototype) & Type;
};
export function instanceOfType(o: any): o is Type {
  return !utility.isInvalid(o) && (o instanceof Type || isLikeType(o));
}
function isLikeType(o: unknown) {
  return typeof o === "object" &&
          "id" in o! &&
          typeof o.id === "string" &&
          "precedence" in o! &&
          typeof o.precedence === "number";
}

function toString(this: Type) {
  return String(this.id);
}

function ConcreteType(this: Type, id: string, precedence: number) {
  if (new.target) {
    Object.defineProperties(this, {
      id: utility.readonlyPropDescriptor(id),
      precedence: utility.readonlyPropDescriptor(precedence),
    });
  } else return new Type(id, precedence);
}
ConcreteType.prototype = Object.create(Object.prototype);
ConcreteType.prototype.constructor = ConcreteType;
ConcreteType.prototype.equals = function (this: Type, o?: object): boolean {
  if (o instanceof Type) {
    return this.id === o.id && this.precedence === o.precedence;
  }
  return false;
};
ConcreteType.prototype[Symbol.toStringTag] = toString;
ConcreteType.prototype.toString = toString;
ConcreteType.prototype.toJSON = toString;

const Type = ConcreteType as TypeConstructor;
export default Type;
