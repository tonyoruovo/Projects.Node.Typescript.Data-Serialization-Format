import { Decimal } from "decimal.js";
import { EOL } from "node:os";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
/**
 * Sets of useful methods for this API
 */
var utility;
(function (utility) {
    const dirname = resolve(fileURLToPath(new URL(".", import.meta.url).toString()));
    /**
     * Gets this platforms end-of-line `string`
     * @constant {string} a value that represents the end-of-line string on this ooperating system
     */
    utility.eol = EOL;
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
    function asHashable(x) {
        if (!isValid(x))
            return { hashCode32: () => 0 };
        if (typeof x === "boolean")
            return asHashableBoolean(x);
        if (typeof x === "number")
            return asHashableNumber(x);
        if (typeof x === "string")
            return asHashableString(x);
        if (typeof x === "bigint")
            return asHashableNumber(Number(x));
        if (typeof x === "object")
            return asHashableObject(x);
        return asHashableArray(x);
    }
    utility.asHashable = asHashable;
    /**
     * Wraps the given string in a `Hashable` value and returns that value.
     * @param {string} s the string value whose hash is to be returned.
     * is appropriately wrapped in a `Hashable`.
     * @returns {Hashable} a non-null `Hashable` value
     */
    function asHashableString(s) {
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
    function asHashableNumber(n) {
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
    function asHashableBoolean(b) {
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
    function asHashableObject(obj) {
        if (!obj.hashCode32 || obj.hashCode32.length !== 1)
            obj["hashCode32"] = asHashableString(JSON.stringify(obj)).hashCode32;
        return obj;
    }
    /**
     * Wraps the given array in a `Hashable` value and returns that value.
     * @param {(boolean | number | string | object)[]} obj the array value whose hash is to be returned. When
     * an element is `null` or `undefined` then `0` is appropriately wrapped in a `Hashable`.
     * @returns {Hashable} a non-null `Hashable` value
     */
    function asHashableArray(obj) {
        return {
            hashCode32: () => {
                // if (isValid(obj)) return 0;
                let int = 0;
                for (let i = 0; i < obj.length - 1; i++)
                    int |=
                        int <<
                            length(isValid(obj[i]) ? asHashable(obj[i]).hashCode32() : 0);
                return int;
            },
        };
    }
    /**
     * Wraps the given number in a `Compare` enum type and returns it.
     * @param {number} n the number value to wrapped.
     * @returns {Hashable} a non-null `Compare` value
     */
    function asCompare(n) {
        return n < 0 ? -1 : n > 0 ? 1 : 0;
    }
    utility.asCompare = asCompare;
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
    function hashCode32(msb, ...m) {
        let int = 0n;
        const len = 32;
        for (let i = m.length - 1; i >= 0; i--)
            int |=
                (isValid(m[i]) ? toBigInt(m[i].hashCode32()) : 0n) <<
                    toBigInt(length(int));
        return toNumber(length(int) < len ? int : msb ? hi(int, len) : lo(int, len));
    }
    utility.hashCode32 = hashCode32;
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
    function hashCode32ForArray(msb, m) {
        let int = 0n;
        const len = 32;
        for (let i = m.length - 1; i >= 0; i--)
            int |=
                (isValid(m[i]) ? toBigInt(m[i].hashCode32()) : 0n) <<
                    toBigInt(length(int));
        return Number.parseInt((length(int) < len ? int : msb ? hi(int, len) : lo(int, len)).toString());
    }
    utility.hashCode32ForArray = hashCode32ForArray;
    /**
     * Calculates the hashcode of the given arguments the result. This is the unabridged version of {@link hashCode32}.
     * `undefined` and `null` arguments are supported.
     * @param {(Hashable|undefined|null)[]} m the values to be combined.
     * @returns {bigint} a value representing the combined hashCode of the argument(s)
     */
    function hashCode(...m) {
        let int = 0n;
        for (let i = m.length - 1; i >= 0; i--)
            int |=
                (isValid(m[i]) ? toBigInt(m[i].hashCode32()) : 0n) <<
                    toBigInt(length(int));
        return int;
    }
    utility.hashCode = hashCode;
    /**
     * Switches on the number of bits given by the argument and returns the bits as a `bigint` value.
     * @param {number} numOfBits the number of bits to be switched on. a value of 0 results in
     * 0 being returned
     * @returns {bigint} a bigint whise bit length is the same as the argument (except for 0)
     * where all the bits in the result are 1s.
     * @throws {`EvalError`} if `numOfBits < 0`
     */
    function on(numOfBits) {
        if (numOfBits < 0)
            throw new EvalError("numOfBits was negative");
        return (1n << toBigInt(Math.floor(numOfBits))) - 1n;
    }
    utility.on = on;
    /**
     * Returns 2 to the power of the argument
     * @param {number} numOfTrailingZeros
     * @returns {bigint} a bigint whise bit length is the argument + 1
     * where all the bits in the result are 0s except the most significant bit.
     * @throws {`EvalError`} if `numOfTrailingZeros < 0`
     */
    function getTrailingZeros(numOfTrailingZeros) {
        if (numOfTrailingZeros < 0)
            throw new EvalError("numOfTrailingZeros was negative");
        numOfTrailingZeros = Math.floor(numOfTrailingZeros);
        return 1n << toBigInt(numOfTrailingZeros);
    }
    utility.getTrailingZeros = getTrailingZeros;
    /**
     * Clears the most significant _n_ bits from the `bigint` argument and returns the result.
     * @param {bigint} i the value to be cleared
     * @param {number} n the number of bits to be cleared
     * @returns {bigint} a value where the most significant _n_ bits have been cleared.
     * @throws {`EvalError`} if `n < 0 || length(i) < n`
     */
    function clearMSB(i, n) {
        if (n < 0)
            throw new EvalError("n was negative");
        const l = length(i);
        n = Math.floor(n);
        if (l < n)
            throw new EvalError("bit length is lesser than is required");
        let mask = on(n) << toBigInt(l - n);
        return (mask | i) ^ mask;
    }
    utility.clearMSB = clearMSB;
    /**
     * Returns the first _n_ high order bits of the `bigint` argument.
     * @param i the value to be split
     * @param n the number of bits to be returned
     * @returns {bigint} a value which is the high order bits of the argument
     * @throws {`EvalError`} if `n < 0 || length(i) < n`
     */
    function hi(i, n) {
        if (n < 0)
            throw new EvalError("n was negative");
        const l = length(i);
        n = Math.floor(n);
        if (l < n)
            throw new EvalError("bit length is lesser than is required");
        return i >> toBigInt(l - n);
    }
    utility.hi = hi;
    /**
     * Calculates and returns the bit length of the given value.
     * @param {bigint|number} n the value whose bit length is to be returned
     * @returns {number} a value which is the bit length of the argument
     */
    function length(n) {
        let num = n;
        if (isValid(num)) {
            // if (num < 0) num = Math.abs(num);
            if (num === 1 || num === 0)
                return 1;
            let length = 0;
            while (num > 0) {
                num >>= 1;
                ++length;
            }
            return length;
        }
        n = n;
        // if (n < 0n) n = n * -1n;
        if (n === 1n || n === 0n)
            return 1;
        let length = 0;
        while (n > 0n) {
            n >>= 1n;
            ++length;
        }
        return length;
    }
    utility.length = length;
    /**
     * Returns the lastt _n_ low order bits of the `bigint` argument.
     * @param i the value to be split
     * @param n the number of bits to be returned
     * @returns {bigint} a value which is the low order bits of the argument
     * @throws {`EvalError`} if `n < 0 || length(i) < n`
     */
    function lo(i, n) {
        if (n < 0)
            throw new EvalError("n was negative");
        const l = length(i);
        n = Math.floor(n);
        if (l < n)
            throw new EvalError("bit length is lesser than is required");
        return clearMSB(i, l - n);
    }
    utility.lo = lo;
    /**
     * Returns whether or not the argument is a valid value apart from `undefined` and `null`.
     * @param {any} x a value
     * @returns {boolean} `true` if the argument is not `undefined` or `null`
     */
    function isValid(x) {
        return x !== undefined && x !== null;
    }
    utility.isValid = isValid;
    /**
     * Capitalises the argument and returns the result.
     * Note that this is for single line strings seperated by horzontal whitespace (\U0020) only.
     * Multi-line, tabs and carriage-returns are not supported and they will be coverted
     * to plain whitespace in the returned format.
     * @param s Any valid string
     * @returns returns the argument after converting the first letter to
     * uppercase and subsequent letters to lowercase
     */
    function capitalise(s) {
        return s
            .split(/[(\t\n\r\s)]/g)
            .map((st) => capitaliseWord(st))
            .join("\u0020");
    }
    utility.capitalise = capitalise;
    /**
     * Capitalises a string of characters i.e the first character of the string
     * @param s a string
     * @returns returns a capitalised string whereby only the first character is uppercase and
     * the rest are lowercase
     */
    function capitaliseWord(s) {
        return `${s[0].toUpperCase()}${s.substring(1, s.length).toLowerCase()}`;
    }
    utility.capitaliseWord = capitaliseWord;
    /**
     * Compare 2 boolean values and returns a Compare value that represents their
     * ordering.
     * @param b1 a boolean value
     * @param b2 another boolean value
     * @returns {Compare} a value used for ordering
     * @see {@link Compare}, {@link Comparable}
     */
    function compareBoolean(b1, b2) {
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
    function compareNumber(n1, n2) {
        // if (!isValid(n1)) return !isValid(n2) ? 0 : -1;
        return n1 === n2 ? 0 : n1 > n2 ? 1 : -1;
    }
    /**
     * Compare 2 string values and returns a Compare value that represents their
     * ordering.
     * @param s1 a string value
     * @param s2 another string value
     * @returns {Compare} a value used for ordering
     * @see {@link Compare}, {@link Comparable}
     */
    function compareString(s1, s2) {
        // if (!isValid(s1)) return !isValid(s2) ? 0 : -1;
        return s1 === s2 ? 0 : s1.localeCompare(s2);
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
    function asComparableDate(x) {
        return {
            compareTo: function (y) {
                if (x.getFullYear() !== y.getFullYear())
                    return x.getFullYear() > y.getFullYear() ? 1 : -1;
                if (x.getMonth() !== y.getMonth())
                    return x.getMonth() > y.getMonth() ? 1 : -1;
                if (x.getDate() !== y.getDate())
                    return x.getDate() > y.getDate() ? 1 : -1;
                if (x.getHours() !== y.getHours())
                    return x.getHours() > y.getHours() ? 1 : -1;
                if (x.getMinutes() !== y.getMinutes())
                    return x.getMinutes() > y.getMinutes() ? 1 : -1;
                if (x.getSeconds() !== y.getSeconds())
                    return x.getSeconds() > y.getSeconds() ? 1 : -1;
                if (x.getMilliseconds() !== y.getMilliseconds())
                    return x.getMilliseconds() > y.getMilliseconds() ? 1 : -1;
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
    function asComparableDateUTC(x) {
        return {
            compareTo: function (y) {
                if (x.getUTCFullYear() !== y.getUTCFullYear())
                    return x.getUTCFullYear() > y.getUTCFullYear() ? 1 : -1;
                if (x.getUTCMonth() !== y.getUTCMonth())
                    return x.getUTCMonth() > y.getUTCMonth() ? 1 : -1;
                if (x.getUTCDate() !== y.getUTCDate())
                    return x.getUTCDate() > y.getUTCDate() ? 1 : -1;
                if (x.getUTCHours() !== y.getUTCHours())
                    return x.getUTCHours() > y.getUTCHours() ? 1 : -1;
                if (x.getUTCMinutes() !== y.getUTCMinutes())
                    return x.getUTCMinutes() > y.getUTCMinutes() ? 1 : -1;
                if (x.getUTCSeconds() !== y.getUTCSeconds())
                    return x.getUTCSeconds() > y.getUTCSeconds() ? 1 : -1;
                if (x.getUTCMilliseconds() !== y.getUTCMilliseconds())
                    return x.getUTCMilliseconds() > y.getUTCMilliseconds() ? 1 : -1;
                return 0;
            }
        };
    }
    utility.asComparableDateUTC = asComparableDateUTC;
    /**
     * Compare 2 object values and returns a Compare value that represents their
     * ordering.
     * @param o1 an object value
     * @param o2 another object value
     * @returns {Compare} a value used for ordering
     * @see {@link Compare}, {@link Comparable}
     */
    function compareObject(o1, o2) {
        return compareString(JSON.stringify(o1), JSON.stringify(o2));
    }
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
    function compare(x, y) {
        if (!isValid(x))
            return !isValid(y) ? 0 : -1;
        if (!isValid(y))
            return 1;
        if (typeof x === "boolean") {
            if (typeof y !== "boolean")
                throw new TypeError("both arguments were not the same boolean type");
            return compareBoolean(x, y);
        }
        if (typeof x === "number") {
            if (typeof y !== "number")
                throw new TypeError("both arguments were not the same number type");
            return compareNumber(x, y);
        }
        if (typeof x === "bigint") {
            let z = x;
            let z2 = y;
            if (typeof y !== "bigint")
                throw new TypeError("both arguments were not the same bigint type");
            return x > y ? 1 : x < y ? -1 : 0;
        }
        if (typeof x === "string") {
            if (typeof y !== "string")
                throw new TypeError("both arguments were not the same string type");
            return compareString(x, y);
        }
        if (Array.isArray(x)) {
            if (!Array.isArray(y))
                throw new TypeError("both argument were not the same array type");
            if (typeof x[0] === "boolean" || typeof x[0] === "bigint" || typeof x[0] === "string" || typeof x[0] === "number" || typeof x[0] === "object" || x[0] instanceof Object) {
                let z2 = y;
                if (typeof y[0] !== "boolean" || typeof y[0] !== "bigint" || typeof y[0] !== "string" || typeof y[0] !== "number" || typeof y[0] !== "object" || !(x[0] instanceof Object))
                    throw new TypeError("both argument were not the same array type");
                return compareA(x, y);
            }
            return compareArray(x, y);
        }
        if (isValid(x)) {
            if (!isValid(y))
                throw new TypeError("both arguments were not the same Comparable type");
            return x.compareTo(y);
        }
        if (isValid(x)) {
            let z2 = y;
            if (!isValid(z2))
                throw new TypeError("both arguments were not the same Date type");
            return asComparableDate(x).compareTo(z2);
        }
        try {
            return compareObject(x, y);
        }
        catch (e) {
            throw new TypeError("both argument were not the same object type");
        }
    }
    utility.compare = compare;
    /**
     * Inverts the argument so that a descending `Comparable` is returned whereby
     * calling `compareTo` does the opposite of what the argument's `compareTo` does.
     * This does not change equality.
     * @param c a `Comparable` argument as an extrinsic state of the returned object. That is, the
     * returned object does not contain the argument as a field.
     * @returns {Comparable<T>} a Comparable object that is the descending comparer of the
     * argument.
     */
    function descending(c) {
        return {
            compareTo: function (t) {
                let com = c.compareTo(t);
                return com > 0 ? -1 : com < 0 ? 1 : 0;
            }
        };
    }
    utility.descending = descending;
    /**
     * Compare 2 arrays and returns a Compare value that represents their
     * ordering.
     * @param o1 an array
     * @param o2 another array
     * @returns {Compare} a value used for ordering
     * @see {@link Compare}, {@link Comparable}
     */
    function compareA(x, y) {
        if (x.length !== y.length)
            return compareNumber(x.length, y.length);
        for (let i = 0; i < x.length; i++) {
            const c = compare(x[i], y[i]);
            if (c !== 0)
                return c;
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
    function compareArray(x, y) {
        if (x.length !== y.length)
            return compareNumber(x.length, y.length);
        for (let i = 0; i < x.length; i++) {
            const c = x[i].compareTo(y[i]);
            if (c !== 0)
                return c;
        }
        return 0;
    }
    /**
     * Tests whether the argument is within javascript safe integer limits
     * @param n a numerical value
     * @returns {boolean} `true` if the argument is within javascripts safe integer limits
     * or `false` if otherwise
     */
    function isSafe32(n) {
        let num = n;
        if (isValid(num))
            return num <= Number.MAX_SAFE_INTEGER && num >= Number.MIN_SAFE_INTEGER;
        return bigintIsSafeNumber(n);
    }
    utility.isSafe32 = isSafe32;
    /**
     * Tests whether the argument is within javascript safe integer limits
     * @param n a numerical value
     * @returns {boolean} `true` if the argument is within javascripts safe integer limits
     * or `false` if otherwise
     */
    function bigintIsSafeNumber(b) {
        if (b >= 0)
            return length(b) < 32;
        return length(b) <= 32;
    }
    /**
     * Casts the argument to a number type. This method is anlogous to C
     * type casting `long` to `int`, if the argument is bigger than `Number.MAX_SAFE_INTEGER`
     * then only the last 32 high order bits are returned.
     * @param b the value to be cast
     * @returns a number which is the representation of the bigint argument.
     */
    function toNumber(b) {
        if (bigintIsSafeNumber(b))
            return Number(b);
        return toNumber(clearMSB(b, length(b) - 32));
    }
    utility.toNumber = toNumber;
    /**
     * Casts the argument to a `bigint` type.
     * @param n the value to be cast
     * @param floor asserts that a `Math.floor` should always be performed
     * on the parameter. the default is `true`, this means that fractional
     * values such as `12.34` can still be cast to `bigint`.
     * @returns {bigint} a bigint cast from the argument.
     * @throws if `floor === false && isInteger(n) === false`
     */
    function toBigInt(n, floor = true) {
        return floor ? BigInt(Math.floor(n)) : BigInt(n);
    }
    utility.toBigInt = toBigInt;
    /**
     * Computes whether or not the number argument is an integer.
     * @param {number} n a number value
     * @returns {boolean} `true` if the number argument is an integer and `false` if otherwise
     */
    function isInteger(n) {
        return Math.floor(n) === Math.ceil(n) && Number.isFinite(n);
    }
    utility.isInteger = isInteger;
    /**
     * A short hand for {@link Decimal} for the purpose of
     * convenience.
     *
     * @param i a `number` value
     * @return the argument as a `Decimal` type.
     */
    function i(i) {
        return new Decimal(i);
    }
    utility.i = i;
    /**
     * A short hand for {@link Decimal} for the purpose of
     * convenience.
     *
     * @param s a `string` value
     * @return the argument as a `Decimal` type.
     */
    function s(s) {
        return new Decimal(s);
    }
    utility.s = s;
    /**
     * A short hand for {@link Decimal} for the purpose of
     * convenience.
     *
     * @param d a `Decimal` value
     * @return the argument as a `Decimal` type.
     */
    function d(d) {
        return new Decimal(d);
    }
    utility.d = d;
    /**
     * Evaluates the input string and returns whether or not it is a whitespace character
     * @param str the string to be evaluated
     * @returns {boolean} `true` if the input is a whitespace or `false` if otherwise
     */
    function isWhitespace(str) {
        return str.length !== 1 ? false : utility.whitespaces.indexOf(str) >= 0;
    }
    utility.isWhitespace = isWhitespace;
    utility.whitespaces = [
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
    utility.LOCALE = new Intl.DateTimeFormat().resolvedOptions().locale;
    /**
     * Capitalises the argument and returns the result preserving all whitespaces
     * @param {string} sentence Any valid string including multi-line strings
     * @param {string | undefined} locale any locale identifier as a string
     * @returns {string | undefined} returns the argument after converting the first letter to
     * uppercase and subsequent letters to lowercase
     */
    function localeCapitalise(sentence, locale = "en") {
        /**@todo needs optimisation*/
        if (!sentence)
            return undefined;
        if (sentence.length === 0)
            return "";
        return localeSplitWord(sentence, locale)
            .map((x) => capitaliseWord(x))
            .join("");
    }
    utility.localeCapitalise = localeCapitalise;
    /**
     * Performs the job of `string.split` but in a locale-specific way.
     * @param {string} str the input string to be split
     * @param {string} locale the locale in which the splitting is done. If undefined then it defaults to `en`
     * @returns {string[]} an array of strings
     */
    function localeSplitWord(str, locale = utility.LOCALE) {
        /**@todo needs optimisation*/
        return Array.from(new Intl.Segmenter(locale, { granularity: "word" }).segment(str)).map((x) => x.segment);
    }
    utility.localeSplitWord = localeSplitWord;
    /**
     * Duplicates the first argument the specified number of _n_ times
     * @param {string} char the string to be duplicated
     * @param {number} n the number of times that the string will be duplicated. values
     * less than or equal to `0` will return an empty string
     * @returns {string} returns the first argument duplicated the specified number of
     * times given by the second argument
     */
    function chars(char, n = 0) {
        return n <= 0 ? "" : `${char}${chars(char, n - 1)}`;
    }
    utility.chars = chars;
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
    function fill(array, val, start, numOfIndexes) {
        start ??= 0;
        numOfIndexes ??= array.length;
        for (let i = start; i < start + numOfIndexes; i++) {
            array[i] = val;
        }
    }
    utility.fill = fill;
    /**
     * Escape special regular expressions characters in the given string and return it. This function assumes that
     * the string is meant to be used as an argument for the `RegExp` function (or constructor).
     * @param {string} str the regex string to be escaped.
     * @returns {string} the argument after escaping has been done.
     */
    function escSRCh(str) {
        return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    }
    utility.escSRCh = escSRCh;
    /**
      * Performs backward recursion from the given `current` and returns the path to the first folder where a `package.json` exists.
      * @params { string } currentDir the directory from which path traversal begins.
      * @returns {string} the path to the folder where the first `package.json` file was found
      */
    function rootFolder(currentDir = dirname) {
        while (!existsSync(join(currentDir, 'package.json'))) {
            currentDir = join(currentDir, '..');
        }
        return currentDir;
    }
    utility.rootFolder = rootFolder;
})(utility || (utility = {}));
export default utility;
