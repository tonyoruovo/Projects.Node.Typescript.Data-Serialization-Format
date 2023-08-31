import { Decimal } from "decimal.js";
import { EOL } from "node:os";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
/**
 * Sets of useful methods for this API
 */
namespace utility {
  const dirname = resolve(fileURLToPath(new URL(".", import.meta.url).toString()));
  /**
   * Gets this platforms end-of-line `string`
   * @constant {string} a value that represents the end-of-line string on this ooperating system
   */
  export const eol: string = EOL;
  /**
   * A type that encapsulates an enum of 3 values i.e `-1`, `0` and `1` which may be used
   * in comparing values.
   */
  export type Compare = -1 | 0 | 1;
  /**
   * An object that can create a 32 bit integer to represent
   * it's form. This 32 bit integer does not have to be unique
   * to the object, however it does have to be unique to it when
   * a logical classification is applied to it. For example inside
   * of a hashmap with similar objects.
   */
  export interface Hashable {
    /**Gets a 32 bit number that can represent this object as it's unique id 
     * @returns {number} the hascode as a `number` type
    */
    hashCode32(): number;
  }
  /**
   * An extension of the `Hashable` interface that has an additional
   * method which returns the true hashcode of this object if the {@link Hashable.hashCode32}
   * method was not enough to fit it.
   */
  export interface BigHashable extends Hashable {
    /** Gets an integer that can represent this object as it's unique id with arbitrary precision bits.
     * In some cases, this may be the binary form of `this` object
     * @returns {bigint} the hascode as a `bigint` type
     */
    hashCode(): bigint;
  }
  /**
   * An object that can compare itself to another object for equality
   */
  export interface Equalizer {
    /**
     * Compares the given value to `this` and returns a value to specified whether
     * it is equal to `this` or not.
     * @param {object} obj another object
     * @returns {boolean} returns `true` if this value is equal to the argument and
     * `false` if otherwise
     */
    equals(obj?: object): boolean;
  }
  /**
   * @summary A `Comparable` is an object that can create ordering by comparison.
   * @description An object that can compare itself against other objects for the purposes
   * of determining ordering. \
   * It has a single method that returns a {@link Compare} enum. This enum can be used thus
   * ````ts
   * const x: Comparable<any> = ... // assignment to x
   * const y: Comparable<any> = ... // assignment to y
   * const z = x.compareTo(y) as number;// Converts the Compare type to an integer
   * if (z > 0) {//semantically if(x > y)
   *  //body of conditional statement
   * } else if (z < 0) {//semantically if(x < y)
   *  //body of conditional statement
   * } else if (z === 0) {//semantically if(x === y)
   *  //body of conditional statement
   * }
   * ````
   * Classes that implement this interface will support ordering on the objects created from those
   * classes. This means that data structures such as collections and dictionaries will be able to
   * order themselves if they are typed with `Comparable` objects.
   */
  export interface Comparable<T> {
    /**
     * Compare this object with the argument and returns a value
     * that denotes that this object is either greater than, less
     * than or equal to the argument.
     * @param {T} obj the object to which this object is compared
     * @returns {Compare} returns a `Compare` object that represents
     * less than (`-1`), equal to(`0`) or greater than (`1`).
     */
    compareTo(obj?: T): Compare;
  }
  /**
   * An interface for mapping (parsing for non-object types) 2 objects
   * that are logically equivalent. It
   * maps the first generic argument `F` (which
   * represents from) to the second generic
   * argument `T` (which represents to).
   * The reverse mapping may also be done whereby `T` is mapped
   * to `F`.
   * Note that this is intended to work only with states i.e only field values are
   * transferred. \
   * A bulk map is also provided via {@link mapArray}
   * @template F the from type
   * @template T the to type
   */
  export interface Mapper<F, T> {
    /**
     * Maps the argument's states to an object of the return value's type.
     * This method also supports `undefined` values as argument and how it
     * is mapped as a value to the destination.
     * @param {F|undefined} from the value whose state (or format) is parsed (mapped) to
     * the given result.
     * @returns {T} a value of type `T` when the mapping (or parsing) is complete
     */
    map(from: F | undefined): T;
    /**
     * Maps all elements of the input array to the given return type array, this includes
     * all the undefined elements in the argument array. The resultant array is returned. \
     * The default implementation just call `map` for each element of the input array and stores
     * the result in a another array in the same index as the element being mapped, then returns
     * the array of the results.
     * @param {(F|undefined)[]|undefined} from an array of the value whose field(s) is/are mapped to
     * the given result.
     * @returns {T[]} an array of type `T` when mapping is completed
     */
    mapArray(from: (F | undefined)[] | undefined): T[];

    /**
     * Performs the opposite action of the {@link map} method by mapping
     * the argument to the return value.
     * This method also supports `undefined` values as argument and how it
     * is mapped as a value to the destination.
     * @param {T | undefined} to the value whose state (or format) is parsed (mapped) to
     * the given result.
     * @returns {F} a value of type `F` when the mapping (or parsing) is complete
     */
    reverseMap(to: T | undefined): F;
    /**
     * Performs a reverse mapping on all elements of the input array to the given return type array, this includes
     * all the undefined elements in the argument array. The resultant array is returned. \
     * The default implementation just call `reverseMap` for each element of the input array and stores
     * the result in a another array in the same index as the element being mapped, then returns
     * the array of the results.
     * @param {(T|undefined)[]|undefined} to  an array of the value whose field(s) is/are reversed-mapped to
     * the given result.
     * @returns {F[]} an array of type `F` when mapping is completed
     */
    reverseMapArray(to: (T | undefined)[] | undefined): F[];
  }
  /**
   * @summary An object that builds another object with the specifications
   * given by caller of this object.
   * @description The builder interface supports dynamic creation of a destination
   * object such that only the parts of the object that is needed is created and the
   * rest is ignored. This allows for partial loading of an object whereby states that
   * are part of an object but are currently not needed are not loaded. \
   * Most implementors will include extra methods analogous to `setXxx` which allows
   * users to set a field of the resultant object (resultant object here refers to
   * value returned by `build`) and in future updates this builder support the method
   * `set` where underlying worker component nodes will pass the argument to their
   * counterparts until the correct node for which the value was intended receives it. \
   * Although not mandatory, some implementors may check against further configurations
   * after `build` has been called and they may opt to throw.
   */
  export interface Builder<T> {
    /**
     * Applies all the fields that have been configured to the object to be returned
     * and uniquely configures that object as the user intended then returns the object.
     * @returns {T} applies all the configuration to an empty
     * object that was pre-instantiated and returns that object.
     */
    build(): T;
    /**
     * Extracts all the fields in the argument and applies (provided they are not
     * reconfigured using one of the `setXxx` methods or it's equivalent) them
     * when `build` is called.
     * @param {T} from the object whose fields are extracted
     * @returns {Builder<T>} returns this builder for more method chaining
     */
    rebuild(from: T): Builder<T>;
    /**
     * Clears all the internal configurations and returns this builder for more method chaining.
     * Some implementation may have users call this method after `build` has been called before
     * further configuration is done. This may prevent bugs whereby a user may forget that the
     * old configuration still exist and proceed to add further configuration on the basis of
     * configuring a new object and not been aware that old configuartions may pollute the current
     * object being built.
     * @returns {Builder<T>} returns this builder for more method chaining
     */
    clear(): Builder<T>;
  }
  /**Type for an inner variable inside `asHashable` */
  type asHashableParam =
    | boolean
    | number
    | string
    | object
    | undefined
    | null
    | (boolean | number | string | object | undefined | null)[];
  //if the object is large and complex just implement Hashable, If the Array is an Hashable type array, manually create your hashable from the array
  /**
   * Parses the given argument and returns a `Hashable` object. \
   * If the argument is an object and it i large and complex, users should refrain from
   * using this function rather they should implement the `Hashable` interface. \
   * If the argument is an array and the array is a `Hashable` array, then users should
   * write their own function to deal with each element in the `Hashable` array
   * @param {boolean| number| string| object| undefined| null| (boolean | number | string | object | undefined | null)[]} x
   * the value to converted
   * @returns {Hashable} a non-null `Hashable` value
   */
  export function asHashable(
    x:
      | boolean
      | number
      | string
      | object
      | undefined
      | null
      | (boolean | number | string | object | undefined | null)[]
  ): Hashable {
    if (!isValid(x)) return { hashCode32: () => 0 };
    if (typeof x === "boolean") return asHashableBoolean(x as boolean);
    if (typeof x === "number") return asHashableNumber(x as number);
    if (typeof x === "string") return asHashableString(x as string);
    if (typeof x === "bigint") return asHashableNumber(Number(x));
    if (typeof x === "object") return asHashableObject(x as object);
    return asHashableArray(x as unknown as (boolean | number | string | object)[]);
  }
  /**
   * Wraps the given string in a `Hashable` value and returns that value.
   * @param {string} s the string value whose hash is to be returned.
   * is appropriately wrapped in a `Hashable`.
   * @returns {Hashable} a non-null `Hashable` value
   */
  function asHashableString(s: string): Hashable {
    return {
      hashCode32: () => {
        // if (s === undefined || s === null) return 0;
        let b = 0n;
        for (let i = 0; i < s.length; i++) {
          b = BigInt(s.charCodeAt(i)) << BigInt(length(b));
        }
        return Number(length(b) <= 32 ? b : clearMSB(b, 32));
      },
    };
  }
  /**
   * Wraps the given number in a `Hashable` value and returns that value.
   * @param {number} n the number value whose hash is to be returned.
   * is appropriately wrapped in a `Hashable`.
   * @returns {Hashable} a non-null `Hashable` value
   */
  function asHashableNumber(n: number): Hashable {
    return {
      hashCode32: () => {
        // if (n === undefined || n === null) return 0;
        return Math.floor(n);
      },
    };
  }
  /**
   * Wraps the given boolean in a `Hashable` value and returns that value.
   * @param {boolean} b the boolean value whose hash is to be returned.
   * is appropriately wrapped in a `Hashable`.
   * @returns {Hashable} a non-null `Hashable` value
   */
  function asHashableBoolean(b: boolean): Hashable {
    return {
      hashCode32: () => {
        // if (b === undefined || b === null) return 0;
        return b ? 1 : 0;
      },
    };
  }
  /**
   * Wraps the given object in a `Hashable` value and returns that value.
   * When the argument is a `Hashable` type, the argument itself is returned.
   * @param {object} obj the object value whose hash is to be returned.
   * is appropriately wrapped in a `Hashable`.
   * @returns {Hashable} a non-null `Hashable` value
   */
  function asHashableObject(obj: object): Hashable {
    if(!(obj as Hashable).hashCode32 || (obj as Hashable).hashCode32.length !== 1)
      (obj as {[p: string]: any})["hashCode32"] = asHashableString(JSON.stringify(obj)).hashCode32; 
    return obj as Hashable;
  }
  /**
   * Wraps the given array in a `Hashable` value and returns that value.
   * @param {(boolean | number | string | object)[]} obj the array value whose hash is to be returned. When
   * an element is `null` or `undefined` then `0` is appropriately wrapped in a `Hashable`.
   * @returns {Hashable} a non-null `Hashable` value
   */
  function asHashableArray(
    obj: (boolean | number | string | object)[]
  ): Hashable {
    return {
      hashCode32: () => {
        // if (isValid(obj)) return 0;
        let int = 0;
        for (let i = 0; i < obj!.length - 1; i++)
          int |=
            int <<
            length(isValid(obj![i]) ? asHashable(obj![i]).hashCode32() : 0);
        return int;
      },
    };
  }
  /**
   * Wraps the given number in a `Compare` enum type and returns it.
   * @param {number} n the number value to wrapped.
   * @returns {Hashable} a non-null `Compare` value
   */
  export function asCompare(n: number): Compare {
    return n < 0 ? -1 : n > 0 ? 1 : 0;
  }
  /**
   * Combines and calculates the hashcode of the given arguments returns the most or least significant 32 bits of the result as specified
   * by the boolean argument. `undefined` and `null` arguments are supported.
   * @param {boolean} msb specifies whether or not the returned value should be truncated
   * from the left (Most significant bit) or right (Least significant bit) if the final
   * result surpasses 32 bits. A `true` value returns the high order 32 bits while a
   * `false` value returns the low order 32 bits.
   * @param {...(Hashable|undefined|null)[]} m the values to be combined.
   * @returns {number} a value representing the combined hashCode of the argument (excluding the boolean argument)
   */
  export function hashCode32(
    msb: boolean,
    ...m: (Hashable | undefined | null)[]
  ): number {
    let int = 0n;
    const len = 32;
    for (let i = m.length - 1; i >= 0; i--)
      int |=
        (isValid(m[i]) ? toBigInt(m[i]!.hashCode32()) : 0n) <<
        toBigInt(length(int));
    return toNumber(
      length(int) < len ? int : msb ? hi(int, len) : lo(int, len)
    );
  }
  /**
   * Combines and calculates the hashcode of the given array of hashables the result.
   * This is different from {@link hashCode32} because this function accepts array and the former does not.
   * @param {boolean} msb specifies whether or not the returned value should be truncated
   * from the left (Most significant bit) or right (Least significant bit) if the final
   * result surpasses 32 bits. A `true` value returns the high order 32 bits while a
   * `false` value returns the low order 32 bits.
   * @param {(Hashable|undefined|null)[]} m an array of hashables representing the values to be combined.
   * @returns {bigint} a value representing the combined hashCode of the argument (excluding the boolean argument)
   */
  export function hashCode32ForArray(
    msb: boolean,
    m: (Hashable | undefined)[]
  ): number {
    let int = 0n;
    const len = 32;
    for (let i = m.length - 1; i >= 0; i--)
      int |=
        (isValid(m[i]) ? toBigInt(m[i]!.hashCode32()) : 0n) <<
        toBigInt(length(int));
    return Number.parseInt(
      (length(int) < len ? int : msb ? hi(int, len) : lo(int, len)).toString()
    );
  }
  /**
   * Calculates the hashcode of the given arguments the result. This is the unabridged version of {@link hashCode32}.
   * `undefined` and `null` arguments are supported.
   * @param {(Hashable|undefined|null)[]} m the values to be combined.
   * @returns {bigint} a value representing the combined hashCode of the argument(s)
   */
  export function hashCode(...m: (Hashable | undefined)[]): bigint {
    let int = 0n;
    for (let i = m.length - 1; i >= 0; i--)
      int |=
        (isValid(m[i]) ? toBigInt(m[i]!.hashCode32()) : 0n) <<
        toBigInt(length(int));
    return int;
  }
  /**
   * Switches on the number of bits given by the argument and returns the bits as a `bigint` value.
   * @param {number} numOfBits the number of bits to be switched on. a value of 0 results in
   * 0 being returned
   * @returns {bigint} a bigint whise bit length is the same as the argument (except for 0)
   * where all the bits in the result are 1s.
   * @throws {`EvalError`} if `numOfBits < 0`
   */
  export function on(numOfBits: number): bigint {
    if (numOfBits < 0) throw new EvalError("numOfBits was negative");
    return (1n << toBigInt(Math.floor(numOfBits))) - 1n;
  }
  /**
   * Returns 2 to the power of the argument
   * @param {number} numOfTrailingZeros
   * @returns {bigint} a bigint whise bit length is the argument + 1
   * where all the bits in the result are 0s except the most significant bit.
   * @throws {`EvalError`} if `numOfTrailingZeros < 0`
   */
  export function getTrailingZeros(numOfTrailingZeros: number): bigint {
    if (numOfTrailingZeros < 0)
      throw new EvalError("numOfTrailingZeros was negative");
    numOfTrailingZeros = Math.floor(numOfTrailingZeros);
    return 1n << toBigInt(numOfTrailingZeros);
  }
  /**
   * Clears the most significant _n_ bits from the `bigint` argument and returns the result.
   * @param {bigint} i the value to be cleared
   * @param {number} n the number of bits to be cleared
   * @returns {bigint} a value where the most significant _n_ bits have been cleared.
   * @throws {`EvalError`} if `n < 0 || length(i) < n`
   */
  export function clearMSB(i: bigint, n: number): bigint {
    if (n < 0) throw new EvalError("n was negative");
    const l = length(i);
    n = Math.floor(n);
    if (l < n) throw new EvalError("bit length is lesser than is required");
    let mask = on(n) << toBigInt(l - n);
    return (mask | i) ^ mask;
  }
  /**
   * Returns the first _n_ high order bits of the `bigint` argument.
   * @param i the value to be split
   * @param n the number of bits to be returned
   * @returns {bigint} a value which is the high order bits of the argument
   * @throws {`EvalError`} if `n < 0 || length(i) < n`
   */
  export function hi(i: bigint, n: number): bigint {
    if (n < 0) throw new EvalError("n was negative");
    const l = length(i);
    n = Math.floor(n);
    if (l < n) throw new EvalError("bit length is lesser than is required");
    return i >> toBigInt(l - n);
  }
  /**
   * Calculates and returns the bit length of the given value.
   * @param {bigint|number} n the value whose bit length is to be returned
   * @returns {number} a value which is the bit length of the argument
   */
  export function length(n: bigint | number): number {
    let num = n as number;
    if (isValid(num)) {
      // if (num < 0) num = Math.abs(num);
      if (num === 1 || num === 0) return 1;
      let length = 0;
      while (num > 0) {
        num >>= 1;
        ++length;
      }
      return length;
    }
    n = n as bigint;
    // if (n < 0n) n = n * -1n;
    if (n === 1n || n === 0n) return 1;
    let length = 0;
    while (n > 0n) {
      n >>= 1n;
      ++length;
    }
    return length;
  }
  /**
   * Returns the lastt _n_ low order bits of the `bigint` argument.
   * @param i the value to be split
   * @param n the number of bits to be returned
   * @returns {bigint} a value which is the low order bits of the argument
   * @throws {`EvalError`} if `n < 0 || length(i) < n`
   */
  export function lo(i: bigint, n: number): bigint {
    if (n < 0) throw new EvalError("n was negative");
    const l = length(i);
    n = Math.floor(n);
    if (l < n) throw new EvalError("bit length is lesser than is required");
    return clearMSB(i, l - n);
  }
  /**
   * Returns whether or not the argument is a valid value apart from `undefined` and `null`.
   * @param {any} x a value
   * @returns {boolean} `true` if the argument is not `undefined` or `null`
   */
  export function isValid(x: any): boolean {
    return x !== undefined && x !== null;
  }
  /**
   * Capitalises the argument and returns the result.
   * Note that this is for single line strings seperated by horzontal whitespace (\U0020) only.
   * Multi-line, tabs and carriage-returns are not supported and they will be coverted
   * to plain whitespace in the returned format.
   * @param s Any valid string
   * @returns returns the argument after converting the first letter to
   * uppercase and subsequent letters to lowercase
   */
  export function capitalise(s: string): string {
    return s
      .split(/[(\t\n\r\s)]/g)
      .map((st) => capitaliseWord(st))
      .join("\u0020");
  }

  /**
   * Capitalises a string of characters i.e the first character of the string
   * @param s a string
   * @returns returns a capitalised string whereby only the first character is uppercase and
   * the rest are lowercase
   */
  export function capitaliseWord(s: string): string {
    return `${s[0].toUpperCase()}${s.substring(1, s.length).toLowerCase()}`;
  }
  /**
   * Compare 2 boolean values and returns a Compare value that represents their
   * ordering.
   * @param b1 a boolean value
   * @param b2 another boolean value
   * @returns {Compare} a value used for ordering
   * @see {@link Compare}, {@link Comparable}
   */
  function compareBoolean(
    b1: boolean | undefined,
    b2: boolean | undefined
  ): Compare {
    // if (!isValid(b1)) return !isValid(b2) ? 0 : -1;
    return b1 === b2 ? 0 : b1 ? 1 : -1;
  }
  /**
   * Compare 2 number values and returns a Compare value that represents their
   * ordering.
   * @param n1 a number value
   * @param n2 another number value
   * @returns {Compare} a value used for ordering
   * @see {@link Compare}, {@link Comparable}
   */
  function compareNumber(
    n1: number | undefined,
    n2: number | undefined
  ): Compare {
    // if (!isValid(n1)) return !isValid(n2) ? 0 : -1;
    return n1 === n2 ? 0 : n1! > n2! ? 1 : -1;
  }
  /**
   * Compare 2 string values and returns a Compare value that represents their
   * ordering.
   * @param s1 a string value
   * @param s2 another string value
   * @returns {Compare} a value used for ordering
   * @see {@link Compare}, {@link Comparable}
   */
  function compareString(
    s1: string | undefined,
    s2: string | undefined
  ): Compare {
    // if (!isValid(s1)) return !isValid(s2) ? 0 : -1;
    return s1 === s2 ? 0 : (s1!.localeCompare(s2!) as Compare);
  }
  /**
   * Returns a {@link Comparable} object that will compare `Date` object using local time
   * in the following order:
   * 
   * 1. {@link Date.getFullYear} the year as defined in the given date argument(s)
   * 2. {@link Date.getMonth} the month of the year
   * 3. {@link Date.getDate} the actual day of the month
   * 4. {@link Date.getHours} the hour of the day
   * 5. {@link Date.getMinutes} the minute of the day
   * 6. {@link Date.getSeconds} the second of the day
   * 7. {@link Date.getMilliseconds} the millisecond of the day
   * 
   * Note that U.T.C (Universal Coordinated Time) is not supported in this function and none
   * of the comparison considers utc.
   *  
   * @param {Date} x a `Date` argument as an extrinsic state of the returned object. That is, the
   * returned object does not contain the argument as a field.
   * @returns {Comparable<Date>} an object that may be compared with another date using `compareTo`
   * where a single `Date` object is passed as an argument to it.
   */
  function asComparableDate(x:Date):Comparable<Date> {
    return {
      compareTo: function(y: Date) {
        if(x.getFullYear() !== y.getFullYear()) return x.getFullYear() > y.getFullYear() ? 1 : -1;
        if(x.getMonth() !== y.getMonth()) return x.getMonth() > y.getMonth() ? 1 : -1;
        if(x.getDate() !== y.getDate()) return x.getDate() > y.getDate() ? 1 : -1;
        if(x.getHours() !== y.getHours()) return x.getHours() > y.getHours() ? 1 : -1;
        if(x.getMinutes() !== y.getMinutes()) return x.getMinutes() > y.getMinutes() ? 1 : -1;
        if(x.getSeconds() !== y.getSeconds()) return x.getSeconds() > y.getSeconds() ? 1 : -1;
        if(x.getMilliseconds() !== y.getMilliseconds()) return x.getMilliseconds() > y.getMilliseconds() ? 1 : -1;
        return 0;
      }
    };
  }
  /**
   * Returns a {@link Comparable} object that will compare `Date` object using UTC
   * in the following order:
   * 
   * 1. {@link Date.getUTCFullYear} the year as defined in the given date argument(s)
   * 2. {@link Date.getUTCMonth} the month of the year
   * 3. {@link Date.getUTCDate} the actual day of the month
   * 4. {@link Date.getUTCHours} the hour of the day
   * 5. {@link Date.getUTCMinutes} the minute of the day
   * 6. {@link Date.getUTCSeconds} the second of the day
   * 7. {@link Date.getUTCMilliseconds} the millisecond of the day
   * 
   * Note that local time is not supported in this function and none
   * of the comparison considers the current locale. To compare using the current locale time, use
   * {@link compare}.
   *  
   * @param {Date} x a `Date` argument as an extrinsic state of the returned object. That is, the
   * returned object does not contain the argument as a field.
   * @returns {Comparable<Date>} an object that may be compared with another date using `compareTo`
   * where a single `Date` object is passed as an argument to it.
   */
  export function asComparableDateUTC(x: Date): Comparable<Date> {
    return {
      compareTo: function(y: Date) {
        if(x.getUTCFullYear() !== y.getUTCFullYear()) return x.getUTCFullYear() > y.getUTCFullYear() ? 1 : -1;
        if(x.getUTCMonth() !== y.getUTCMonth()) return x.getUTCMonth() > y.getUTCMonth() ? 1 : -1;
        if(x.getUTCDate() !== y.getUTCDate()) return x.getUTCDate() > y.getUTCDate() ? 1 : -1;
        if(x.getUTCHours() !== y.getUTCHours()) return x.getUTCHours() > y.getUTCHours() ? 1 : -1;
        if(x.getUTCMinutes() !== y.getUTCMinutes()) return x.getUTCMinutes() > y.getUTCMinutes() ? 1 : -1;
        if(x.getUTCSeconds() !== y.getUTCSeconds()) return x.getUTCSeconds() > y.getUTCSeconds() ? 1 : -1;
        if(x.getUTCMilliseconds() !== y.getUTCMilliseconds()) return x.getUTCMilliseconds() > y.getUTCMilliseconds() ? 1 : -1;
        return 0;
      }
    }
  }
  /**
   * Compare 2 object values and returns a Compare value that represents their
   * ordering.
   * @param o1 an object value
   * @param o2 another object value
   * @returns {Compare} a value used for ordering
   * @see {@link Compare}, {@link Comparable}
   */
  function compareObject(
    o1: object | undefined,
    o2: object | undefined
  ): Compare {
    return compareString(JSON.stringify(o1), JSON.stringify(o2));
  }
  /**Type for an inner variable inside `compare` */
  type compareParams =
    | boolean
    | number
    | bigint
    | string
    | object
    | undefined
    | null
    | Comparable<any>
    | (boolean
        | number
        | bigint
        | string
        | object
        | undefined
        | null
        | Comparable<any>
      )[];
  /**
   * Compares 2 values of supposedly the same type and returns a Compare value that represents their
   * ordering. \
   * \
   * When `Date` objects are compared, only their local time is compared (and not their UTC)
   * in the following order:
   * 
   * 1. {@link Date.getFullYear} the year as defined in the given date argument(s)
   * 2. {@link Date.getMonth} the month of the year
   * 3. {@link Date.getDate} the actual day of the month
   * 4. {@link Date.getHours} the hour of the day
   * 5. {@link Date.getMinutes} the minute of the day
   * 6. {@link Date.getSeconds} the second of the day
   * 7. {@link Date.getMilliseconds} the millisecond of the day
   * 
   * @param x the first value
   * @param y the second value
   * @returns {Compare} a value used for ordering
   * @see {@link Compare}, {@link Comparable}
   */
  export function compare(
    x:
      boolean
      | number
      | bigint
      | string
      | object
      | undefined
      | null
      | Comparable<any>
      | (
          | boolean
          | number
          | bigint
          | string
          | object
          | undefined
          | null
          | Comparable<any>
        )[],
    y:
      | boolean
      | number
      | bigint
      | string
      | object
      | undefined
      | null
      | Comparable<any>
      | (
          | boolean
          | number
          | bigint
          | string
          | object
          | undefined
          | null
          | Comparable<any>
        )[]
  ): Compare {
    if (!isValid(x)) return !isValid(y) ? 0 : -1;
    if (!isValid(y)) return 1;
    if (typeof x === "boolean") {
      if (typeof y !== "boolean")
        throw new TypeError("both arguments were not the same boolean type");
      return compareBoolean(x as boolean, y as boolean);
    }
    if (typeof x === "number") {
      if (typeof y !== "number")
        throw new TypeError("both arguments were not the same number type");
      return compareNumber(x as number, y as number);
    }
    if(typeof x === "bigint"){
      let z = x as bigint;
      let z2 = y as bigint;
      if(typeof y !== "bigint") throw new TypeError("both arguments were not the same bigint type");
      return (x as bigint) > (y as bigint) ? 1 : (x as bigint) < (y as bigint) ? -1 : 0;
    }
    if (typeof x === "string") {
      if (typeof y !== "string")
        throw new TypeError("both arguments were not the same string type");
      return compareString(x as string, y as string);
    }
    if (Array.isArray(x)) {
      if (!Array.isArray(y))
        throw new TypeError("both argument were not the same array type");
      if (typeof x[0] === "boolean" || typeof x[0] === "bigint" || typeof x[0] === "string" || typeof x[0] === "number" || typeof x[0] === "object" || x[0] instanceof Object) {
        let z2 = y as (string | bigint | number | boolean | object)[];
        if (typeof y[0] !== "boolean" || typeof y[0] !== "bigint" || typeof y[0] !== "string" || typeof y[0] !== "number" || typeof y[0] !== "object" || !(x[0] instanceof Object))
          throw new TypeError("both argument were not the same array type");
        return compareA(x as any[], y as any[]);
      }
      return compareArray(x as Comparable<any>[], y as Comparable<any>[]);
    }
    if (isValid(x as Comparable<any>)) {
      if (!isValid(y as Comparable<any>))
        throw new TypeError("both arguments were not the same Comparable type");
      return (x as Comparable<any>).compareTo(y as Comparable<any>);
    }
    if(isValid(x as Date)){
      let z2 = y as Date;
      if (!isValid(z2))
        throw new TypeError("both arguments were not the same Date type");
      return asComparableDate(x as Date).compareTo(z2);
    }
    try {
      return compareObject(x as object, y as object);
    } catch (e) {
      throw new TypeError("both argument were not the same object type");
    }
  }
  /**
   * Inverts the argument so that a descending `Comparable` is returned whereby
   * calling `compareTo` does the opposite of what the argument's `compareTo` does.
   * This does not change equality.
   * @param c a `Comparable` argument as an extrinsic state of the returned object. That is, the
   * returned object does not contain the argument as a field.
   * @returns {Comparable<T>} a Comparable object that is the descending comparer of the
   * argument.
   */
  export function descending<T>(c: Comparable<T>): Comparable<T> {
    return {
      compareTo: function(t: T){
        let com = c.compareTo(t);
        return com > 0 ? -1 : com < 0 ? 1 : 0;
      }
    };
  }
  /**
   * Compare 2 arrays and returns a Compare value that represents their
   * ordering.
   * @param o1 an array
   * @param o2 another array
   * @returns {Compare} a value used for ordering
   * @see {@link Compare}, {@link Comparable}
   */
  function compareA(
    x: (boolean | number | string | object | undefined | null)[],
    y: (boolean | number | string | object | undefined | null)[]
  ): Compare {
    if (x!.length !== y!.length) return compareNumber(x!.length, y!.length);
    for (let i = 0; i < x!.length; i++) {
      const c = compare(x![i], y![i]);
      if ((c as number) !== 0) return c;
    }
    return 0;
  }
  /**
   * Compare 2 Comparable arrays and returns a Compare value that represents their
   * ordering.
   * @param o1 a Comparable array
   * @param o2 another Comparable array
   * @returns {Compare} a value used for ordering
   * @see {@link Compare}, {@link Comparable}
   */
  function compareArray(
    x: (Comparable<any> | undefined)[],
    y: (Comparable<any> | undefined)[]
  ): Compare {
    if (x.length !== y.length) return compareNumber(x!.length, y!.length);
    for (let i = 0; i < x.length; i++) {
      const c = x[i]!.compareTo(y[i]);
      if ((c as number) !== 0) return c;
    }

    return 0;
  }
  /**
   * Tests whether the argument is within javascript safe integer limits
   * @param n a numerical value
   * @returns {boolean} `true` if the argument is within javascripts safe integer limits
   * or `false` if otherwise
   */
  export function isSafe32(n: number | bigint): boolean {
    let num = n as number;
    if (isValid(num))
      return num <= Number.MAX_SAFE_INTEGER && num >= Number.MIN_SAFE_INTEGER;
    return bigintIsSafeNumber(n as bigint);
  }
  /**
   * Tests whether the argument is within javascript safe integer limits
   * @param n a numerical value
   * @returns {boolean} `true` if the argument is within javascripts safe integer limits
   * or `false` if otherwise
   */
  function bigintIsSafeNumber(b: bigint): boolean {
    if (b >= 0) return length(b) < 32;
    return length(b) <= 32;
  }
  /**
   * Casts the argument to a number type. This method is anlogous to C
   * type casting `long` to `int`, if the argument is bigger than `Number.MAX_SAFE_INTEGER`
   * then only the last 32 high order bits are returned.
   * @param b the value to be cast
   * @returns a number which is the representation of the bigint argument.
   */
  export function toNumber(b: bigint): number {
    if (bigintIsSafeNumber(b)) return Number(b);
    return toNumber(clearMSB(b, length(b) - 32));
  }
  /**
   * Casts the argument to a `bigint` type.
   * @param n the value to be cast
   * @param floor asserts that a `Math.floor` should always be performed
   * on the parameter. the default is `true`, this means that fractional
   * values such as `12.34` can still be cast to `bigint`.
   * @returns {bigint} a bigint cast from the argument.
   * @throws if `floor === false && isInteger(n) === false`
   */
  export function toBigInt(n: number, floor = true): bigint {
    return floor ? BigInt(Math.floor(n)) : BigInt(n);
  }

  /**
   * Computes whether or not the number argument is an integer.
   * @param {number} n a number value
   * @returns {boolean} `true` if the number argument is an integer and `false` if otherwise
   */
  export function isInteger(n: number): boolean {
    return Math.floor(n) === Math.ceil(n) && Number.isFinite(n);
  }
  /**
   * A short hand for {@link Decimal} for the purpose of
   * convenience.
   *
   * @param i a `number` value
   * @return the argument as a `Decimal` type.
   */
  export function i(i: number): Decimal {
    return new Decimal(i);
  }
  /**
   * A short hand for {@link Decimal} for the purpose of
   * convenience.
   *
   * @param s a `string` value
   * @return the argument as a `Decimal` type.
   */
  export function s(s: string): Decimal {
    return new Decimal(s);
  }
  /**
   * A short hand for {@link Decimal} for the purpose of
   * convenience.
   *
   * @param d a `Decimal` value
   * @return the argument as a `Decimal` type.
   */
  export function d(d: Decimal): Decimal {
    return new Decimal(d);
  }

  /**
   * Evaluates the input string and returns whether or not it is a whitespace character
   * @param str the string to be evaluated
   * @returns {boolean} `true` if the input is a whitespace or `false` if otherwise
   */
  export function isWhitespace(str: string): boolean {
    return str.length !== 1 ? false : whitespaces.indexOf(str) >= 0;
  }

  export const whitespaces = [
    // See this link to get understanding of what's considered a white-space
    // characters in .Net 5.0.
    // https://docs.microsoft.com/en-us/dotnet/api/system.char.iswhitespace?view=net-5.0
    "\u0009",
    "\u000A",
    "\u000B",
    "\u000C",
    "\u000D",
    "\u0085",
    "\u2028",
    "\u2029",
    "\u0020",
    "\u00A0",
    "\u1680",
    "\u2000",
    "\u2001",
    "\u2002",
    "\u2003",
    "\u2004",
    "\u2005",
    "\u2006",
    "\u2007",
    "\u2008",
    "\u2009",
    "\u200A",
    "\u202F",
    "\u205F",
    "\u3000",
  ];
  /**The users default locale */
  export const LOCALE = new Intl.DateTimeFormat().resolvedOptions().locale
  /**
   * Capitalises the argument and returns the result preserving all whitespaces
   * @param {string} sentence Any valid string including multi-line strings
   * @param {string | undefined} locale any locale identifier as a string
   * @returns {string | undefined} returns the argument after converting the first letter to
   * uppercase and subsequent letters to lowercase
   */
  export function localeCapitalise(
    sentence: string,
    locale: string = "en"
  ): string | undefined {
    /**@todo needs optimisation*/
    if (!sentence) return undefined;
    if (sentence.length === 0) return "";
    return localeSplitWord(sentence, locale)
      .map((x) => capitaliseWord(x))
      .join("");
  }

  /**
   * Performs the job of `string.split` but in a locale-specific way.
   * @param {string} str the input string to be split
   * @param {string} locale the locale in which the splitting is done. If undefined then it defaults to `en`
   * @returns {string[]} an array of strings
   */
  export function localeSplitWord(str: string, locale: string = LOCALE): string[] {
    /**@todo needs optimisation*/
    return Array.from(
      new Intl.Segmenter(locale, { granularity: "word" }).segment(str)
    ).map((x) => x.segment);
  }
  /**
   * Duplicates the first argument the specified number of _n_ times
   * @param {string} char the string to be duplicated
   * @param {number} n the number of times that the string will be duplicated. values
   * less than or equal to `0` will return an empty string
   * @returns {string} returns the first argument duplicated the specified number of
   * times given by the second argument
   */
  export function chars(char: string, n: number = 0): string {
    return n <= 0 ? "" : `${char}${chars(char, n - 1)}`;
  }
  /**
   * Fills the given array with the specified argument `val` from the specified `start` position
   * until `numOfIndexes` is reached. This may not fill a blank index within the array if the index
   * is not within `start` and `start + numOfIndexes`.
   * @param {V[]} array any array
   * @param {V} val the value with which to fill blank indexes
   * @param {number} start the index from which to start the filling. The default is `0`
   * @param {number} numOfIndexes the number of indexes that will be filled starting from the start index. The default is the length of the given array.
   * @template V the type of value to fill this array with.
   * @return {void} a mutable operation. does not return a value.
   */
  export function fill<V>(array: V[], val: V, start?: number, numOfIndexes?: number): void {
    start ??= 0;
    numOfIndexes ??= array.length;
    for (let i = start; i < start + numOfIndexes; i++) {
      array[i] = val;
    }
  }
  /**
   * Escape special regular expressions characters in the given string and return it. This function assumes that
   * the string is meant to be used as an argument for the `RegExp` function (or constructor).
   * @param {string} str the regex string to be escaped.
   * @returns {string} the argument after escaping has been done.
   */
  export function escSRCh(str: string): string {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  }
 /**
   * Performs backward recursion from the given `current` and returns the path to the first folder where a `package.json` exists.
   * @param { string } start the directory from which path traversal begins.
   * @returns {string} the path to the folder where the first `package.json` file was found
   */
  export function rootFolder(start: string = dirname): string {
    while(!existsSync(join(start, 'package.json'))) {
      start = join(start, '..');
    }
    return start;
  }
}

export default utility;
