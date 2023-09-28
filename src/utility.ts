import { Decimal } from "decimal.js";
import { EOL, type } from "node:os";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
/**
 * Sets of useful methods for this API. Unless otherwise stated, all numbers are in big endian.
 */
namespace utility {
  /**
   * Represents the directory from which this constant was used, which is typically from {@link rootFolder `rootFolder`} if no argument was passed.
   * @type {string}
   * @constant {string}
   * @readonly
   * @private {string}
   */
  const dirname: string = resolve(
    fileURLToPath(new URL(".", import.meta.url).toString())
  );
  /**
   * An array of unprintable characters.
   * @type {readonly string[]}
   * @constant {readonly string[]}
   * @readonly
   */
  export const specialCharacters: readonly string[] = (() => {
    let c = Array<string>();
    for (let i = 0; i < 32; i++) {
      c.push(String.fromCodePoint(i));
    }
    c.push(String.fromCodePoint(Math.pow(2, 7) - 1)); //8 bit max positive
    c.push(String.fromCodePoint(Math.pow(2, 15) - 1)); //16 bit max positive
    return Object.freeze(c);
  })();
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
   * A functor that may be used as a replacement for {@link Comparable `Comparable`} when extrinsic comparison is desired as one must implement the `Comparable` interface to be able to do comparisons with it.
   * @template T the type of the arguments for this functor
   * @see Comparable
   */
  export type Comparator<T> =
  /**
   * Compares the arguments for order. `undefined` and `null` values are assumed to be the below valid types except when being compared to each other, in which case they are equal. A 'valid type' here refers to a value that is not `null` or `undefined`.
   * @param {T | undefined} lhs the left hand side of the comparison
   * @param {T | undefined} rhs the right hand side of the comparison
   * @returns {Compare}
   */
  (lhs?: T, rhs?: T) => Compare;
  /**
   * A functor that may be used as a replacement for {@link Predicatable `Predicatable`} when extrinsic comparison is desired as one must implement the `Predicatable` interface to be able to do comparisons with it.
   * @template T the type for which the equality will be applied
   * @see Predicatable
   */
  export type Predicate<T> =
  /**
   * Compares the arguments for equality. `undefined` and `null` values are assumed to be the below valid types except when being compared to each other, in which case they are equal. A 'valid type' here refers to a value that is not `null` or `undefined`.
   * @param {T | undefined} lhs the left hand side of the comparison
   * @param {any} rhs the right hand side of the comparison
   * @returns {boolean}
   */
  (lhs?: T, rhs?: any) => boolean;
  /**
   * A functor that welds 2 values of the same type into one. The order of the welding does not matter be it pre-concatenate or pos-concatenate all are covered by this type.
   * The convention is to not modify any of the argument and return a new one.
   * @template T the type of the value to be concatenated
   * @see {@link String.concat `String.concat`}, {@link Array.concat `Array.concat`}, {@link Buffer.concat `Buffer.concat`}
   */
  export type Concatenator<T> =
  /**
   * Concatenates both arguments and returns a new value which is the result of the concatenation operation
   * @param {T} lhs the left hand side of the concatenation
   * @param {T} rhs the right hand side of the concatenation
   * @returns {T} the result of the concatenation
   */
  (lhs: T, rhs?: T) => T;
  export type Binary = number | bigint | number[] | bigint[] | Buffer;
  export type UnaryBitwise<T extends Binary> = (val?: T) => T;
  export type BinaryBitwise<T extends Binary> = (operand1: T, operand2?: T) => T;
  export type BitWise<T extends Binary> = Concatenator<T>;
  export type SIMD<T extends Binary> = (...data: T[]) => T;
  export type MIMD<T extends Binary[]> = (...data: T[]) => T;
  export interface Streamable<T = any> extends Disposable {
    readonly length: number | bigint;
    readonly tempBytes: bigint | number;//allocated bytes for the temp buffer
    readonly parent: string;
    temp(): any;
    read(location: string): T | undefined;
    update<S extends Streamable<any>>(data: T, location: string, owner: S): void;
    delete(location: string): T | undefined;
  }
  export interface AsyncStreamable<T = any> extends AsyncDisposable {
    readonly length: number | bigint;
    readonly tempBytes: bigint | number;//allocated bytes for the temp buffer
    readonly parent: string;
    temp(): any;
    read(location: string): Promise<T | undefined>
    update<S extends Streamable<any>>(data: T, location: string, owner: S): Promise<void>;
    delete(location: string): Promise<T | undefined>;
  }
  export type Keyable<E> =
  (key: string) => E | undefined;
  export type AsyncKeyable<E> =
  (key: string) => Promise<E | undefined>;
  export type Indexable<E> =
  (index: number, value?: E) => E | undefined;
  export type BigIndexable<E> =
  (index: bigint, value?: E) => E | undefined;
  export type AsyncIndexable<E> =
  (index: number, value?: E) => Promise<E | undefined>;
  export type BigAsyncIndexable<E> =
  (index: bigint, value?: E) => Promise<E | undefined>;
  export type ForEachCallback<E, A> =
  (element: E, index: number | bigint, thisArray: A) => void;
  export type MapCallback<E, A, R> =
  (element: E, index: number | bigint, thisArray: A) => R;
  export type ReduceCallback<E, A, R> =
  (previous: R, current: E, currentIndex: number | bigint, thisArray: A) => R;
  export type FilterCallback<E, A, R extends E> =
  (element: E, index: number | bigint, array: A) => element is R;
  export interface StreamableArray<E = any> extends Generator<E, any, E | undefined>, Streamable<E>, Indexable<E>, BigIndexable<E> {
    [Symbol.isConcatSpreadable](): boolean;
    temp(): E[];
    forEach(callback: ForEachCallback<E, StreamableArray<E>>, bindee?: any): void;
    map<R>(callback: MapCallback<E, StreamableArray<E>, R>, bindee?: any): StreamableArray<R>;
    reduce<R>(callback: ReduceCallback<E, StreamableArray<E>, R>, initial?: R, bindee?: any): R;
    filter<R extends E>(predicate: FilterCallback<E, StreamableArray<E>, R>, bindee?: any): StreamableArray<E>;
    every<R extends E>(predicate: FilterCallback<E, StreamableArray<E>, R>, bindee?: any): this is StreamableArray<E>;
    some(predicate: FilterCallback<E, StreamableArray<E>, E>, bindee?: any): boolean;
    sort(comparator?: Comparator<E>): this;
    push(...items: E[]): number | bigint;
    pop(): E | undefined;
    shift(): E | undefined;
    slice(start: number, end?: number): StreamableArray<E>;
    splice(start: number, deleteCount?: number, ...items: E[]): StreamableArray<E>;
    unshift(...items: E[]): number | bigint;
  }
  export interface AsyncStreamableArray<E = any> extends AsyncGenerator<E, any, E | undefined>, AsyncStreamable<E>, AsyncIndexable<E>, BigAsyncIndexable<E> {
    temp(): E[];//Promise<E[]>;
    forEach(callback: ForEachCallback<E, StreamableArray<E>>, bindee?: any): Promise<void>;
    map<R>(callback: MapCallback<E, StreamableArray<E>, R>, bindee?: any): Promise<StreamableArray<R>>;
    reduce<R>(callback: ReduceCallback<E, StreamableArray<E>, R>, initial?: R, bindee?: any): Promise<R>;
    filter<R extends E>(predicate: FilterCallback<E, StreamableArray<E>, R>, bindee?: any): Promise<StreamableArray<E>>;
    every<R extends E>(predicate: FilterCallback<E, StreamableArray<E>, R>, bindee?: any): Promise<boolean>;
    some(predicate: FilterCallback<E, StreamableArray<E>, E>, bindee?: any): Promise<boolean>;
    sort(comparator?: Comparator<E>): Promise<this>;
    push(...items: E[]): Promise<number | bigint>;
    pop(): Promise<E | undefined>;
    shift(): Promise<E | undefined>;
    slice(start: number, end?: number): Promise<StreamableArray<E>>;
    splice(start: number, deleteCount?: number, ...items: E[]): Promise<StreamableArray<E>>;
    unshift(...items: E[]): Promise<number | bigint>;
  }
  export interface StreamableMap<T = any> extends Streamable<T>, Keyable<T> {
    [Symbol.hasInstance](): boolean;
    temp(): {[key: string]: T | undefined};
    keys(): Generator<string, any, undefined>;
    values(): Generator<T, any, T | undefined>;
    entries(): Generator<[string, T], any, [string, T] | undefined>;
    has(key: string): boolean;
  }
  export interface AsyncStreamableMap<T = any> extends AsyncStreamable<T>, AsyncKeyable<T> {
    [Symbol.hasInstance](): boolean;
    temp(): {[key: string]: T | undefined};//Promise<{[key: string]: T | undefined}>;
    keys(): Generator<Promise<string>, any, undefined>;
    values(): Generator<Promise<T>, any, T | undefined>;
    entries(): Generator<Promise<[string, T]>, any, [string, T] | undefined>;
    has(key: string): Promise<boolean>;
  }
  /**
   * A scribe object for logging messages. The destination is deliberately unknown but it may generally be a stream.
   * For quick (maybe temporary) implementations, this may be interfaced with the {@link console `console`} object
   * like so:
   * ```ts
   * //Some classic js code
   * this.logger = console as any as utility.Messenger;
   * // We will be using 0x7 because it is the smallest value that has all 3 msb on.
   * (this.logger as any)._bit = 0x0;//the msb is error, the mid bit is warn and the lsb is info
   * this.logger.seal = l => {
   *     if(this.logger.isSealed(l)) return;
   *     if(l === 0) {
   *         ((this.logger as any)._bit as number) = 0x1 & ((this.logger as any)._bit as number);
   *         this.logger.error = m => {throw Error("Sealed")}
   *     } else if(l === 1) {
   *         ((this.logger as any)._bit as number) = 0x2 & ((this.logger as any)._bit as number);
   *         this.logger.info = m => {throw Error("Sealed")}
   *     } else if(l === 2) {
   *         ((this.logger as any)._bit as number) = 0x4 & ((this.logger as any)._bit as number);
   *         this.logger.warn = m => {throw Error("Sealed")}
   *     }
   * };
   * this.logger.isSealed = l => {
   *     if(l === 0) {
   *         return (0x1 & ((this.logger as any)._bit as number)) !== 0;
   *     } else if(l === 1) {
   *         return (0x2 & ((this.logger as any)._bit as number)) !== 0;
   *     } else if(l === 2) {
   *         return (0x4 & ((this.logger as any)._bit as number)) !== 0;
   *     }
   *     return false;
   * };
   * ```
   */
  export interface Messenger {
    /**
     * Logs the given string(s) as an information message.
     * @param {...any[]} message a series of strings in the same format as C's `printf`
     * @returns {boolean} `true` for a successful info log `false` otherwise.
     */
    info(...message: any[]): boolean;
    /**
     * Logs the given string(s) as a warning message.
     * @param {...any[]} message a series of strings in the same format as C's `printf`
     * @returns {boolean} `true` for a successful warning log `false` otherwise.
     */
    warn(...message: any[]): boolean;
    /**
     * Logs the given string(s) as an error message.
     * @param {...any[]} message a series of strings in the same format as C's `printf`
     * @returns {boolean} `true` for a successful error log `false` otherwise.
     */
    error(...message: any[]): boolean;
    /**
     * Prevents further messages to be written to a specific log. Once sealed a log may recieve messages no more and can no longer be opened from this instance.
     * @param { 0 | 1 | 2 } logType The type of log to be closed/sealed. The valid values include: *0* - the error log which seals {@link error `error`}, *1* - the info log which seals {@link info `info`} and *2* - the warning log which seals {@link warn `warn`}.
     */
    seal(logType: 0 | 1 | 2): void;
    /**
     * Checks whether the given log is in a sealed state.
     * @param { 0 | 1 | 2 } logType The type of log to be checked. The valid values include: *0* - the error log, *1* - the info log and *2* - the warning log.
     * @returns {boolean} `true` if the given log is sealed `false` if otherwise
     */
    isSealed(logType: 0 | 1 | 2): boolean;
  }
  /**
   * An object that can create a 32 bit integer to represent
   * it's form. This 32 bit integer does not have to be unique
   * to the object, however it does have to be unique to it when
   * a logical classification is applied to it. For example inside
   * of a hashmap with similar objects.
   */
  export interface Hashable {
    /**
     * Gets a 32 bit number that can represent this object' hash or it's unique id.
     * It is assumed that this method returns in constant time.
     * @returns {number} the hashcode as a `number` type
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
     * In some cases, this may be the binary form of `this` object.
     * It is assumed that this method returns in constant time.
     * @returns {bigint} the hashcode as a `bigint` type
     */
    hashCode(): bigint;
  }
  /**Data structure for a hoffman encoder */
  export interface HofDat<T> {
    encode(): Buffer;
    encode(t: T): number;
    count(t: T): number; // the frequency
    compare: Comparator<T>;
    forEach(
      callback: (value: T, frequency: number, data: HofDat<T>) => void
    ): void;
    // enc
  }
  export class StrDat implements HofDat<string> {
    /**The frequency table */
    private readonly data;
    constructor(private readonly s: string) {
      this.data = {} as {[k: string]: number};
      for (const c of s) {
        this.data[c] = (this.data[c] ?? 0) + 1;
      }
    }
    compare(x?: string, y?: string) {
      if(!isValid(x)) return isValid(y) ? -1 : 0;
      else if(!isValid(y)) return isValid(x) ? 1 : 0;
      return x! < y! ? 1 : x! > y! ? -1 : 0;
    }
    count(ch: string): number {
      if (typeof ch === "string") return this.data[ch];
      return 0;
    }
    length(): number {
      return Object.keys(this.data).length;
    }
    encode(): Buffer;
    encode(character: string): number
    encode(x?: unknown): number | Buffer {
      if(typeof x === "string") return x.codePointAt(0)!;
      else if(typeof x === "undefined") {
        const b = Buffer.alloc(this.s.length);
        b.write(this.s);
        return b;
      } 
      return Buffer.alloc(0);
    }
    forEach(
      callback: (value: string, frequency: number, data: StrDat) => void
    ): void {
      //sorted entries
      const se = Object.entries(this.data).sort((a, b) => a[1] > b[1] ? 1 : a[1] < b[1] ? -1 : 0);
      // let fq = 0;
      // do {
      //   const elem = se.shift()!;
      //   if(se[1].)
      // } while (se.length > 0);
      for (const e of se) {
        callback(e[0], e[1], this);
      }
    }
  }
  type BHTKey<K> = Hashable & { key: K };
  /**
   * Basic ordered hash table as a standin for the {@link Map `Map`} class so as to support non-string/non-number keys. `undefined` can be used as a key but not as a value as it is a special value used for checking abscency of value.
   * Key collisions though rare, may occur.
   * @template K The key type of this hash table. Any type can be a key, but `symbol` types will be treated as `string` types and instatiating a `symbol` with the same argument will result in an overwrite.
   * Note that for objects used as keys and mutated afterwards, will cause them to also be mutated in their position as keys. 
   * @template V the type of value associated with a key.
   */
  export class Table<K, V = any> implements Predicatable, Hashable {
    /**
     * an array of all the keys. Future version will have both key and value as an array of `Entry<K, V>` where entry is defined as:
     * ```ts
     * type Entry<K, V> = [K, V];
     * ```
     */
    private k = [] as BHTKey<K>[];
    /**an array of all the indices of the keys*/
    private i = [] as number[];
    /**an array of all the values*/
    private v = [] as V[];
    /**the current insertion index*/
    private ci = 0; //current index
    /**
     * Constructs a `Table` with an optional functor for checking duplicates.
     * Future versions will have a hash functor as a parameter where
     * ```ts
     * type Hash<K> = (key: K) => number;
     * ```
     * and the constructor will look like this:
     * ```ts
     * constructor(public readonly hash = k => asHashable(k as any).hashCode32()) {
     * }
     * ```
     * @param {(left: K, right?: K) => boolean} isEqual a function used for checking duplicate keys
     */
    constructor(
      public isEqual: Predicate<K> = (l?: K, r?: K) => compare(l as any, r as any) === 0
    ) {}
    /**
     * @inheritdoc
     */
    equals(obj?: object | undefined): boolean {
      if (obj instanceof Table) {
        return (
          this.size() === obj.size() &&
          this.k === obj.k &&
          this.i === obj.i &&
          this.v === obj.v
        );
      }
      return false;
    }
    /**
     * @inheritdoc
     */
    hashCode32(): number {
      return utility.hashCode32(
        false,
        asHashable(this.k.length),
        asHashable(this.i.length),
        asHashable(this.v.length),
        asHashable(this.ci)
      );
    }
    /**
     * Performs a sort on the specified section of this table using the merge sort algorithm.
     * @param {number} low the lower bound in a merge sort function
     * @param {number} high the upper bound in a merge sort function
     * @param {Comparator<[K, V]>} c a function that will be used for the sorting. Please see {@link Comparable `Comparable`}, {@link compare `compare`}
     * @returns {void} does not return
     */
    private mergeSort(
      low: number,
      high: number,
      c: Comparator<[K, V]>
    ): void {
      if (low >= high) {
        return;
      }
      const mid = Math.floor((low + high) / 2);
      this.mergeSort(low, mid, c);
      this.mergeSort(mid + 1, high, c);
      this.merge(low, high, mid, c);
    }
    /**
     * Called by {@link mergeSort `mergeSort`} to sort this table.
     * @param {number} low the lower bound in a merge sort function
     * @param {number} high the upper bound in a merge sort function
     * @param {number} mid the middle point in a merge sort function
     * @param {Comparator<[K, V]>} c a function that will be used for the sorting. Please see {@link Comparable `Comparable`}, {@link compare `compare`}
     * @returns {void} does not return
     */
    private merge(
      low: number,
      high: number,
      mid: number,
      c: Comparator<[K, V]>
    ): void {
      /*Temporary keys */
      let tk = new Array<BHTKey<K>>();
      /*Temporary values */
      let tv = new Array<V>();
      let i = low;
      let j = mid + 1;
      let k = 0;

      while (i <= mid && j <= high) {
        const z = k++;
        if (
          c(
            [(this.k[i] ?? { key: undefined }).key, this.v[i]],
            [(this.k[j] ?? { key: undefined }).key, this.v[j]]
          ) < 0
        ) {
          tk[z] = this.k[i];
          tv[z] = this.v[i];
          // ti[this.k[i].hashCode32()] = i;
          i++;
        } else {
          tk[z] = this.k[j];
          tv[z] = this.v[j];
          // ti[this.k[j].hashCode32()] = j;
          j++;
        }
      }

      while (i <= mid) {
        const z = k++;
        tk[z] = this.k[i];
        tv[z] = this.v[i];
        // ti[this.k[i].hashCode32()] = i;
        i++;
      }

      while (j <= high) {
        const z = k++;
        tk[z] = this.k[j];
        tv[z] = this.v[j];
        // ti[this.k[j].hashCode32()] = j;
        j++;
      }

      for (let m = 0, n = low; m < tk.length; m++, n++) {
        this.k[n] = tk[m];
        this.v[n] = tv[m];
        if(this.k[n] !== undefined) this.i[this.k[n].hashCode32()] = n;
      }
    }
    /**
     * Retrieve the index where the given key is stored and returns it. Will return `undefined` if the specified key is not in this table.
     * This function is public solely for disambiguition of this table from an unordered table.
     * @param {K} key the key to search for
     * @returns {number | undefined} the index of the given key in this table or returns `undefined` if the key does not exist.
     */
    getIndex(key: K): number | undefined {
      const k = { hashCode32: asHashable(key as any).hashCode32, key }
      if (k === undefined) return k;
      return this.i[k.hashCode32()];
    }
    /**
     * Maps the given key to the value and stores them in this table if the key does not exist, if it does, it will overwrite it's value with the value given here.
     * @param {K} key the key of the value to be stored
     * @param {V} value the value to be stored
     * @returns {Table<K, V>} as a convention of the {@link Map.set `Map.set`} object, returns this table
     * @ignore
     * Take the key, hash it, then use the hash to attempt a read operation for potential keys with the same hash.
     * If the value read is invalid then this operation is a set, else if the value read is valid, then compare the value to the
     * argument key, if they are unequal, then this operation will be a set else if they are equal then a collison hash ocurred and
     * another hash has to be calculated for the new value and the hash function need to change for values begining and ending with
     * the same string as the argument.
     */
    set(key: K, value: V): Table<K, V> {
      const index = this.getIndex(key);
      if(index === undefined){
        const k = { hashCode32: asHashable(key as any).hashCode32, key };
        const i = this.ci++;
        this.k[i] = k;
        this.i[k.hashCode32()] = i;
        this.v[i] = value;
      } else {
        this.v[index] = value;
      }
      return this;
    }

    /**
     * Deletes the given key alongside it's corresponding value if the key exists. Will return `true` for a successful removalof the given key.
     * @param {K} key the key of the value to be deleted
     * @returns {boolean} `true` for a successful deletion else `false`
     */
    delete(key: K): boolean {
      const i = this.getIndex(key);
      if (i === undefined) return false;
      (this.i as any)[this.k[i].hashCode32()] = undefined;
      (this.k as any)[i] = undefined;
      (this.v as any)[i] = undefined;
      --this.ci;
      return true;
    }
    /**
     * Removes all entries from this table
     */
    clear() {
      this.k = [];
      this.i = [];
      this.v = [];
      this.ci = 0;
    }
    /**
     * Atempts to reorder this table using the given function for ordering of the keys. This will affect the order of bulk operations
     * on this table such as `for..of` loops, {@link keys `keys`}, {@link values `values`}, {@link entries `entries`} and {@link foreach `foreach`}
     * @param {Comparator<[K, V]>} c a function that will be used for ordering the keys. The default orders this table in perceived ascending order.
     * Please see {@link Comparable `Comparable`}, {@link compare `compare`}
     */
    sort(c: Comparator<[K, V]> = compare) {
      this.mergeSort(0, this.size() - 1, c);
    }
    /**
     * Retrives the value stored in this table.
     * @param {K} key the key of the value to be retrieved
     * @returns {V | undefined} the value stored with this key or `undefined` if the key does not exist in this table
     */
    get(key: K): V | undefined {
      const i = this.getIndex(key);
      if (i === undefined) return undefined;
      return this.v[i];
    }
    /**
     * Gets the generator for all keys in this table.
     * @returns {Generator<K, void, undefined>} a generator of all the keys in this table
     * @generator
     * @yields {K} the next key
     */
    *keys(): Generator<K, void, undefined> {
      let i = 0;
      do {
        if (this.k[i] === undefined) continue;
        yield this.k[i].key;
      } while (i++ < this.size());
    }
    /**
     * Gets the generator for all values in this table.
     * @returns {Generator<K, void, undefined>} a generator of all the values in this table
     */
    *values(): Generator<V, void, undefined> {
      let i = 0;
      // let v = null as any as V;
      do {
        // v = this.v[i];
        if (this.v[i] === undefined) continue;
        yield this.v[i];
      } while (i++ < this.size());
      // return v;
    }
    /**
     * Enables `for..of` loops to be performed on this table
     */
    [Symbol.iterator]() {
      return this.entries();
    }
    /**
     * Gets the generator for all key/value pairs (as a 2-length tuple in the form `[key, value]`) in this table.
     * @returns {Generator<K, void, undefined>} a generator of all the key/value pairs in this table
     */
    *entries(): Generator<[K, V], void, undefined> {
      let i = 0;
      // let e = null as any as [K, V];
      do {
        if (this.k[i] === undefined) continue;
        yield [this.k[i].key, this.v[i]];
      } while (i++ < this.size() - 1);
      // return e;
    }
    /**
     * Calls the argument function for each key/value mapping in this table.
     * @param {(value: V, key: K, table: Table<K, V>) => void} callback a function whose first parameter is a value present in this table, second is the key to that value and the third is this table.
     */
    forEach(callback: (value: V, key: K, table: Table<K, V>) => void) {
      for (let i = 0; i < this.ci; i++) {
        if (this.k[i] === undefined) continue;
        callback(this.v[i], this.k[i].key, this);
      }
    }
    /**
     * Checks if this table has a mapping for the given key.
     * @param {K} key the key with which the check is made
     * @returns {boolean} `true` if the argument exists as a key in this table otherwise `false`
     */
    has(key: K): boolean {
      return this.getIndex(key) !== undefined;
    }
    /**
     * Returns the number of key/value pairs in this table
     * @returns {number} the number of key/value entries in this table
     */
    size(): number {
      return this.ci;
    }
    /**
     * Gets the plain object representation of this table where the hash of the keys in this table are the keys in the objct
     * and the values are themselves the values in the returned object. 
     * @returns {[key: string]: V } an object where the hash of all the keys are the property names and the values in this table are the values
     */
    asHashedMap(): {[key: string]: V} {
      let o = {} as { [k: string]: V };
      this.k.forEach((k, i) => {
        if (k !== undefined) o[k.hashCode32().toString(16)] = this.v[i];
      });
      return o;
    }
    toString() {
      return JSON.stringify(this.asHashedMap(), null, 2);
    }
  }
  export class SortedArray<T> {
    private h = [] as T[];
    private parent = (index: number) => Math.floor((index - 1) / 2);
    private left = (index: number) => 2 * index + 1;
    private right = (index: number) =>  2 * index + 2;
    private hasLeft = (index: number) => this.left(index) < this.h.length;
    private hasRight = (index: number) => this.right(index) < this.h.length;
    private swap = (a: number, b: number) => {
      const tmp = this.h[a];
      this.h[a] = this.h[b];
      this.h[b] = tmp;
    }

    constructor(private sorter: Comparator<T> = compare as any){}
    asArray(): T[] {
      return this.h;
    }
    isEmpty(): boolean {
      return this.h.length === 0;
    }
    peek(): T {
      return !this.isEmpty() ? this.h[0] : undefined as any;
    }
    size(): number {
      return this.length;
    }
    insert(item: T) {
      this.h.push(item);
      let i = this.h.length - 1;
      while(i > 0) {
        const p = this.parent(i);
        if(this.sorter(this.h[p], this.h[i]) < 0) break;
        const tmp = this.h[i];
        this.h[i] = this.h[p];
        this.h[p] = tmp;
        i = p;
      }
    }
    get length(): number { return this.h.length; }
    toString(): string {
      return this.h.toString();
    }
    toLocaleString(): string {
      return this.h.toLocaleString();
    }
    pop(): T | undefined {
      if(this.h.length == 0) return undefined;
      
      this.swap(0, this.h.length - 1);
      const item = this.h.pop();

      let current = 0;
      while(this.hasLeft(current)) {
        let smallerChild = this.left(current);
        if(this.hasRight(current) && this.sorter(this.h[this.right(current)], this.h[this.left(current)]) < 0)
          smallerChild = this.right(current);

        if(this.sorter(this.h[smallerChild], this.h[current]) > 0) break;

        this.swap(current, smallerChild);
        current = smallerChild;
      }

      return item;
    }
    push(...items: T[]): number {
      for (let i = 0; i < arguments.length; i++) {
        this.insert(arguments[i]);
      }
      return this.length;
    }
    join(separator?: string | undefined): string {
      return this.h.join(separator);
    }
    shift(): T | undefined {
      return this.h.shift();
    }
    slice(start?: number | undefined, end?: number | undefined): T[] {
      return this.h.slice(start, end);
    }
    sort(compareFn?: ((a: T, b: T) => number) | undefined): this {
      if(!isValid(compareFn)) return this;
      let s = new SortedArray<T>(compareFn! as Comparator<T>);
      this.forEach(x => s.push(x));
      return s as any;
    }
    indexOf(searchElement: T, fromIndex?: number | undefined): number {
      let index = -1;
      for (let i = 0; i < this.h.length; i++) {
        index = i;
        if(this.sorter(searchElement, this.h[i]) === 0) break;
      }
      return index;
    }
    lastIndexOf(searchElement: T, fromIndex?: number | undefined): number {
      let index = -1;
      for (let i = this.h.length - 1; i >= 0; i--) {
        if(this.sorter(searchElement, this.h[i]) === 0) {
          index = i;
          break;
        }
      }
      return index;
    }
    every<S extends T>(predicate: (value: T, index: number, array: T[]) => value is S, thisArg?: any): this is S[];
    every(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): boolean;
    every(predicate: unknown, thisArg?: unknown): boolean {
      return this.h.every(predicate as any, this.h);
    }
    some(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): boolean {
      return this.h.some(predicate as any, this.h);
    }
    forEach(callbackfn: (value: T, index: number, array: T[]) => void, thisArg?: any): void {
      return this.h.forEach(callbackfn, this.h);
    }
    map<U>(callbackfn: (value: T, index: number, array: T[]) => U, thisArg?: any): U[] {
      return this.h.map(callbackfn, this.h);
    }
    filter<S extends T>(predicate: (value: T, index: number, array: T[]) => value is S, thisArg?: any): S[];
    filter<S extends T>(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): T[];
    filter<S extends T>(predicate: unknown, thisArg?: unknown): T[] | S[] {
      return this.h.filter(predicate as any, this.h);
    }
    find<S extends T>(predicate: (this: void, value: T, index: number, obj: T[]) => value is S, thisArg?: any): S | undefined;
    find<S extends T>(predicate: (value: T, index: number, obj: T[]) => unknown, thisArg?: any): T | undefined;
    find<S extends T>(predicate: unknown, thisArg?: unknown): T | S | undefined {
      return this.h.find(predicate as any, this.h);
    }
    findIndex(predicate: (value: T, index: number, obj: T[]) => unknown, thisArg?: any): number {
      return this.h.findIndex(predicate, this.h);
    }
    entries(): IterableIterator<[number, T]> {
      return this.h.entries();
    }
    keys(): IterableIterator<number> {
      return this.h.keys();
    }
    values(): IterableIterator<T> {
      return this.h.values();
    }
    includes(searchElement: T, fromIndex: number = 0): boolean {
      for (let i = 0; i < this.h.length; i++) {
        if(this.sorter(searchElement, this.h[i]) === 0) return true;
      }
      return false;
    }
    flatMap<U, This = undefined>(callback: (this: This, value: T, index: number, array: T[]) => U | readonly U[], thisArg?: This | undefined): U[] {
      return this.h.flatMap(callback, this.h as any);
    }
    at(index: number): T | undefined {
      return this.h[index];
    }
    [Symbol.iterator](): IterableIterator<T> {
      return this.values();
    }
    [Symbol
      .unscopables](): { copyWithin: boolean; entries: boolean; fill: boolean; find: boolean; findIndex: boolean; keys: boolean; values: boolean; } {
        return this.h[Symbol.unscopables]();
    }
  }
  /**Hoffman encode */
  export class HofEnc<T> {
    static readonly binary = Symbol();
    private pa;
    private code?: Array<[T, number]> | T;
    constructor(private data: HofDat<T>) {
      const a = [] as HofNode<T>[];
      this.pa = undefined as any as HofNode<T>;
      const c = (l: HofNode<T>, r: HofNode<T>) => (l.frequency - r.frequency) as Compare;
      data.forEach((value, frequency) => {
        if(!isValid(a[0])) push(a, new HofNode({frequency, value}), c as any);
        else {
          const n = a.shift()!;
          push(a, new HofNode({left: n, right: new HofNode({frequency, value})}), c as any)
        }
      });
      this.pa = a.shift()!;
    }
    getCode(t: T): number {
      return this.encode().filter((x) => this.data.compare(x[0], t) === 0)[0][1];
    }
    encode() {
      const table = Array<[T, number]>();
      this.pa.enc(table);
      return (this.code = table);
    }
    value(bin: number): T {
      return this.pa[HofEnc.binary](bin);
    }
    dec(concatenate: Concatenator<T>): T {
      if (Array.isArray(this.code)) {
        let t = null as any as T;
        this.code!.forEach((x) => (t = concatenate(t, x[0])));
        return t;
      }
      return null as unknown as T;
    }
  }
  class HofNode<V> implements Comparable<HofNode<V>> {
    public readonly left?;
    public readonly right?;
    public value?;
    public readonly frequency: number;
    constructor({
      left,
      right,
      frequency = (left ?? { frequency: 0 }).frequency +
        (right ?? { frequency: 0 }).frequency,
      value,
    }: {
      left?: HofNode<V>;
      right?: HofNode<V>;
      frequency?: number;
      value?: V;
    }) {
      this.left = left;
      this.right = right;
      this.value = value;
      this.frequency = frequency;
    }
    compareTo(obj?: HofNode<V> | undefined): Compare {
      if (!isValid(obj)) return 1;
      return this.frequency > obj!.frequency
        ? 1
        : this.frequency < obj!.frequency
        ? -1
        : 0;
    }
    isLeaf() {
      return isValid(this.value);
    }
    [HofEnc.binary](bin: number): V {
      if (!this.isLeaf()) {
        try {
          if (nth(bin, length(bin)))
            return this.right![HofEnc.binary](
              Number(clearMSB(toBigInt(bin), 1))
            );
          return this.left![HofEnc.binary](Number(clearMSB(toBigInt(bin), 1)));
        } catch (e: any) {
          throw Error("code not found", e);
        }
      }
      return this.value!;
    }
    enc(table: [V, number][], n: [bigint] = [1n]) {
      if (!this.isLeaf()) {
        n[0] <<= 1n;
        this.left!.enc(table, n);
        n[0] = (n[0] << 1n) | 1n;
        this.right!.enc(table, n);
      }
      if(isValid(this.value)) {
        table.push([this.value!, Number(n[0])]);
        n[0] = 1n;
      }
    }
  }
  /**
   * An object that can compare itself to another object for equality
   */
  export interface Predicatable {
    /**
     * Compares the given value to `this` and returns a value to specified whether
     * it is equal to `this` or not. It is assumed that this method returns in constant time.
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
     * than or equal to the argument. It is assumed that this method returns in constant time.
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
    /**
     * Checks if the argument is an instance of `Comparable` as node lacks interface and the `instanceof` operator does not exists for interfaces in typescript.
     * @param {any} x the value to be checked
     * @returns {boolean} `true` if the argument is an instance of the `Comparable` interface or else returns `false`
     */
  function isComparable<T>(x: any): x is Comparable<T> {
    return isValid(x.compareTo) && (x.compareTo as Function).length === 1;
  }
  /**
   * Checks if the argument is an instance of `Predicatable` as node lacks interface and the `instanceof` operator does not exists for interfaces in typescript.
   * @param {any} x the value to be checked
   * @returns {boolean} `true` if the argument is an instance of the `Predicatable` interface or else returns `false`
   */
  function isEqualizer(x: any): x is Predicatable {
    return isValid(x.equals) && (x.equals as Function).length === 1;
  }
  /**
   * Checks if the argument is an instance of `Hashable` as node lacks interface and the `instanceof` operator does not exists for interfaces in typescript.
   * @param {any} x the value to be checked
   * @returns {boolean} `true` if the argument is an instance of the `Hashable` interface or else returns `false`
   */
  function isHashable(x: any): x is Hashable {
    return isValid(x.hashcode32) && (x.hashcode32 as Function).length === 0;
  }
  /**
   * Modifies the array argument so that it may no longer accept or delete elements, however can still be mutated with the `delete a[index]` and `a[index] = element` syntax.
   * @param {T[]} a an array of values
   * @returns {Readonly<T[]>} the argument after going being made unmodifiable
   * @template T the type of the array
   */
  export function unModifiable<T>(a: T[]): Readonly<T[]> {
    if (Object.isFrozen(a)) return a;
    a.fill = (value, start?, end?) => {
      throw Error("cannot modify this array");
    };
    a.push = (...items) => {
      throw Error("cannot modify this array");
    };
    a.pop = () => {
      throw Error("cannot modify this array");
    };
    a.reverse = () => {
      throw Error("cannot modify this array");
    };
    a.shift = () => {
      throw Error("cannot modify this array");
    };
    a.slice = (start?, end?) => {
      throw Error("cannot modify this array");
    };
    a.sort = (compareFn) => {
      throw Error("cannot modify this array");
    };
    a.splice = (start, deleteCount?, ...items) => {
      throw Error("cannot modify this array");
    };
    a.unshift = (...items) => {
      throw Error("cannot modify this array");
    };
    return a as Readonly<T[]>;
  }
  /**
   * Parses the given argument and returns a `Hashable` object. \
   * If the argument is an object and is large and complex, users should refrain from
   * using this function rather they should implement the `Hashable` interface as that may be faster. \
   * If the argument is an array and the array is a `Hashable` array, then users should
   * write their own function to deal with each element in the `Hashable` array
   * @param {boolean| number|bigint| string|symbol|Function| object| undefined| null| (boolean | number | bigint | string | symbol | Function | object | undefined | null)[]} x
   * the value to converted
   * @returns {Hashable} a non-null `Hashable` value
   */
  export function asHashable(
    x:
      | boolean
      | number
      | bigint
      | string
      | symbol
      | Function
      | object
      | undefined
      | null
      | (boolean | number | bigint | string | symbol | Function | object | undefined | null)[]
  ): Hashable {
    if (!isValid(x)) return { hashCode32: () => 0 };
    if (isHashable(x)) return x;
    if (typeof x === "boolean") return asHashableBoolean(x as boolean);
    if (typeof x === "number") return asHashableNumber(x as number);
    if (typeof x === "bigint") return asHashableBigInt(x);
    if (typeof x === "string") return asHashableString(x as string);
    if (typeof x === "function") return asHashableFunction(x);
    if (typeof x === "symbol") return asHashableSymbol(x);
    if (typeof x === "object") return asHashableObject(x as object);
    return asHashableArray(
      x as unknown as (boolean | number | string | object)[]
    );
  }
  /**
  /**
   * Parses the arguments and creates a concrete `Hashable` object consistently unique to the value
   * @param {string} s the value for which a `Hashable` object will be generated
   * @returns {Hashable} a concrete `Hashable` instance for the argument
   * @todo In future versions, I will use bit folding or base128 enc to reduce the memory footprint of the string by doing:
   * #### Base128:
   * - convert the string to base 128 string
   * - hash that base 128 string using the algorithm implemented {@link asHashableString here}.
   *
   * #### bit folding
   * - convert the string to bits
   * - examine the bits for patterns and fold at a given index such that the new evaluated bits is the exact same pattern of the set that was folded. e.g the bit pattern
   * `101101101` can be folded to `101` preceded by extra 2 bits describing the original length of the fold hence `101101101` becomes `11101` which is more efficient.
   * 
   * #### Secure random
   * - implement a function that returns a random integer
   * - every value returned by this function must be unique, unrecreatable and independent of the platform
   * - the difference between each random value must be small enough. An ideal range is [0, 10]. Such a difference may or may not be constant i.e the difference between
   * the consecutive hashes may vary but it should fall within the given range.
   * 
   * In addition to using the base128 method, I may create a unique string by contatenating the system specs (as found in the `node:os` module), the current time, the time
   * zone, location info and the string to be hashed. All these elements will occupy random indexes in the given string and will be compressed by an algorithm, thus,
   * creating a unique string.
   */
  function asHashableString(s: string): Hashable {
    return {
      hashCode32: () => {
        if (!isValid(s)) return 0;
        //The following code is copied from the JDK String.hashCode implementation
        // let b = 0n;
        // const lg = s.length >> 1;
        // for (let i = 0; i < lg; i++) {
        //   b = 31n * b + BigInt(s[i].codePointAt(0)! & 0xff);
        // }
        let b = createHash("md5").update(s, "utf-8").digest().readBigUInt64BE();
        let l = length(b);
        return Number(l <= 32 ? b : clearMSB(b, l - 32));
      },
    };
  }
  /**
   * Parses the arguments and creates a concrete `Hashable` object consistently unique to the value
   * @param {number} n the value for which a `Hashable` object will be generated
   * @returns {Hashable} a concrete `Hashable` instance for the argument
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
   * Parses the arguments and creates a concrete `Hashable` object consistently unique to the value
   * @param {boolean} b the value for which a `Hashable` object will be generated
   * @returns {Hashable} a concrete `Hashable` instance for the argument
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
   * Parses the arguments and creates a concrete `Hashable` object consistently unique to the value
   * @param {object} obj the value for which a `Hashable` object will be generated
   * @returns {Hashable} a concrete `Hashable` instance for the argument
   */
  function asHashableObject(obj: object): Hashable {
    if (isHashable(obj)) {
      return obj;
    }
    // (obj as { [p: string]: any }).hashCode32 = () =>{
    //   let b = 0n;
    //   for (const key in obj) {
    //     b |= BigInt(asHashableString(key).hashCode32()) << BigInt(length(b));
    //   }
    //   let l = length(b);
    //   return l <= 32 ? Number(b) : Number(clearMSB(b, l - 32));
    // }
    (obj as { [p: string]: any }).hashCode32 = asHashableString(
      JSON.stringify(obj)
    ).hashCode32;
    return obj as Hashable;
  }
  /**
   * Wraps the given array in a `Hashable` value and returns that value.
   * @param {(boolean | number | bigint | string | symbol | Function | object | null | undefined)[]} obj the array value whose hash is to be returned. When
   * an element is `null` or `undefined` then `0` is appropriately wrapped in a `Hashable`.
   * @returns {Hashable} a non-null `Hashable` value
   */
  function asHashableArray(
    obj: (boolean | number | bigint | string | symbol | Function | object | null | undefined)[]
  ): Hashable {
    return {
      hashCode32: () => {
        if (!isValid(obj)) return 0;
        //The following code is copied from the JDK String.hashCode implementation
        let b = 0n;
        const getElem = (val: any[], index: number) => {
          index <<= 1;
          return (((asHashable(val[index++]).hashCode32() & 0xffff) << 16) | ((asHashable(val[index]).hashCode32() & 0xffff) << 0))
        }
        const lg = obj.length >> 1;
        for (let i = 0; i < lg; i++) {
          b = 31n * b + BigInt(getElem(obj, i));
        }
        let l = length(b);
        const m = obj.length <= 10_000 ? 32 : 52;
        return Number(l <= m ? b : clearMSB(b, l - m));
      }
    };
  }
  /**
   * Parses the arguments and creates a concrete `Hashable` object consistently unique to the value
   * @param {bigint} i the value for which a `Hashable` object will be generated
   * @returns {Hashable} a concrete `Hashable` instance for the argument
   */
  function asHashableBigInt(i: bigint): Hashable{
    return {
      hashCode32: () => {
        const l = length(i);
        return Number(l <= 32 ? i : clearMSB(i, l - 32));
      }
    };
  }
  /**
   * Parses the arguments and creates a concrete `Hashable` object consistently unique to the value
   * @param {Function} f the value for which a `Hashable` object will be generated
   * @returns {Hashable} a concrete `Hashable` instance for the argument
   */
  function asHashableFunction(f: Function){
    (f as any).hashCode32 = asHashableString(f.name + f.toString()).hashCode32;
    return f as any;
  }
  /**
   * Parses the arguments and creates a concrete `Hashable` object consistently unique to the value
   * @param {symbol} s the value for which a `Hashable` object will be generated
   * @returns {Hashable} a concrete `Hashable` instance for the argument
   */
  function asHashableSymbol(s: symbol){
    return asHashableString(s.description??s.toString());
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
    let b = 0n;
    const getElem = (val: any[], index: number) => {
      index <<= 1;
      return (((asHashable(val[index++]).hashCode32() & 0xff) << 8) | ((asHashable(val[index]).hashCode32() & 0xff) << 0))
    }
    const lg = m.length >> 1;
    for (let i = 0; i < lg; i++) {
      b = 31n * b + BigInt(getElem(m, i));
    }
    let l = length(b);
    const mk = m.length <= 10_000 ? 32 : 52;
    return Number(l < mk ? b : msb ? hi(b, mk) : lo(b, mk));
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
    return Number(length(int) < len ? int : msb ? hi(int, len) : lo(int, len));
  }
  /**
   * Calculates the hashcode of the given arguments the result. This is the unabridged version of {@link hashCode32}.
   * `undefined` and `null` arguments are supported.
   * @param {(Hashable|undefined|null)[]} m the values to be combined.
   * @returns {bigint} a value representing the combined hashCode of the argument(s)
   */
  export function hashCode(...m: (Hashable | undefined)[]): bigint {
    let b = 0n;
    for (let i = 0; i < m.length; i++) {
      b |= BigInt((m[i]??{hashCode32: () => 0}).hashCode32()) << BigInt(length(b));
    }
    return b;
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
   * Evaluates the bit at the nth index within *n* and returns `true` if the bit is set or `false` if otherwise.
   * @param {number|bigint} n the value to be evaluated
   * @param {number} index the index from which the bit will be retrived.
   * @returns {boolean} `true` if the at the given in the first argument is set or else returns `false`.
   * @throws {EvalError} if n is a `number` type and `index > 52` as the value {@link Number.MIN_SAFE_INTEGER `Number.MIN_SAFE_INTEGER`} has only 53 bits.
   * @throws {TypeError} if n is not a `number` or `bigint` type.
   */
  export function nth(n: number | bigint, index: number): number {
    if (typeof n === "number") {
      if (index > 52)
        throw EvalError(
          `The index: ${index} is out of bounds for ${n}, the max is 31 for number types. Use bigint types for bigger indices`
        );
      n >>>= 0;
      return ((n & (0x1 << index)) >>> index) & 0x1;
    } else if (typeof n === "bigint") {
      if(n < 0n) n *= -1n;
      return Number((n & (1n << toBigInt(index))) >> BigInt(index));
    }
    throw TypeError("Input type not supported");
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
   * @param {number} n the number of bits to be cleared. To be within a safe 32 bits mark do `clearMSB(i, length(i) - 32)`
   * @returns {bigint} a value where the most significant _n_ bits have been cleared.
   * @throws {`EvalError`} if `n < 0 || length(i) < n`
   */
  export function clearMSB(i: bigint, n: number): bigint {
    if (n < 0) throw new EvalError("n was negative");
    const l = length(i);
    n = Math.floor(n);
    // if (l < n) throw new EvalError("bit length is lesser than is required");
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
    if (typeof n === "number") {
      n >>>= 0;
      let l = 0;
      do{
        n >>>= 1;
        ++l;
      } while(n > 0);
      return l;
    }
    if (n < 0n) n *= -1n;
      let l = 0;
      do {
        n >>= 1n;
        ++l;
      } while (n > 0n);
    return l;
  }
  /**
   * Returns the last _n_ low order bits of the `bigint` argument.
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
  export function shiftLeft(n: number, by: number) {
    return Number(toBigInt(n) << toBigInt(by));
  }
  export function shiftRight(n: number, by: number) {
    return Number(toBigInt(n) >> toBigInt(by));
  }
  export function and(lhs: number, rhs: number) {
    return Number(toBigInt(lhs) & toBigInt(rhs));
  }
  export function or(lhs: number, rhs: number) {
    return Number(toBigInt(lhs) | toBigInt(rhs));
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
  function asComparableDate(x: Date): Comparable<Date> {
    return {
      compareTo: function (y: Date) {
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
      },
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
      compareTo: function (y: Date) {
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
      },
    };
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
    | (
        | boolean
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
    if(isComparable(x)) return x.compareTo(y);
    if(isComparable(y)) return invert(y).compareTo(x);
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
    if (typeof x === "bigint") {
      let z = x as bigint;
      let z2 = y as bigint;
      if (typeof y !== "bigint")
        throw new TypeError("both arguments were not the same bigint type");
      return (x as bigint) > (y as bigint)
        ? 1
        : (x as bigint) < (y as bigint)
        ? -1
        : 0;
    }
    if (typeof x === "string") {
      if (typeof y !== "string")
        throw new TypeError("both arguments were not the same string type");
      return compareString(x as string, y as string);
    }
    if (Array.isArray(x)) {
      if (!Array.isArray(y))
        throw new TypeError("both argument were not the same array type");
      if (
        typeof x[0] === "boolean" ||
        typeof x[0] === "bigint" ||
        typeof x[0] === "string" ||
        typeof x[0] === "number" ||
        typeof x[0] === "object" ||
        x[0] instanceof Object
      ) {
        let z2 = y as (string | bigint | number | boolean | object)[];
        if (
          typeof y[0] !== "boolean" ||
          typeof y[0] !== "bigint" ||
          typeof y[0] !== "string" ||
          typeof y[0] !== "number" ||
          typeof y[0] !== "object" ||
          !(x[0] instanceof Object)
        )
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
    if (isValid(x as Date)) {
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
   * Inverts the argument so that an opposite `Comparable` is returned whereby
   * calling `compareTo` does the opposite of what the argument's `compareTo` does.
   * This does not change equality.
   * @param {Comparable<T>} c a `Comparable` argument as an extrinsic state of the returned object. That is, the
   * returned object does not contain the argument as a field.
   * @returns {Comparable<T>} a `Comparable` object that is then opposite comparer of the argument.
   * @template T the type of comparable
   */
  export function invert<T>(c: Comparable<T>): Comparable<T>;
  /**
   * Inverts the logic inside the {@link Comparator `Comparator`} the argument and returns the iverted copy whereby
   * calling it does the opposite of what the argument does.
   * This does not change equality.
   * @param {Comparator<T>} c a `Comparator` to be inverted
   * @returns {Comparator<T>} the argument whose comparison logic has been inverted
   * @template T the type of the comparator
   */
  export function invert<T>(c: Comparator<T>): Comparator<T>;
  /**
   * Attempt to invert the compararison logic of the argument
   * @param {unknown} c the argument
   * @returns {Comparable | Comparator | void} a void if the argument provided is not a `Comparable` or `Comparator` else returns the argument with it,s comparison logic inverted.
   * @template T the type of `Comparable` or `Comparator` to be returned.
   */
  export function invert<T>(c: unknown): unknown {
    if(isComparable(c))
    return {
      compareTo: function (t: T) {
        let com = c.compareTo(t);
        return com > 0 ? -1 : com < 0 ? 1 : 0;
      },
    };
    return (x: T, y?: T) => {
      const c0 = (c as Comparator<T>)(x, y);
      return c0 > 0 ? -1 : c0 < 0 ? 1 : 0;
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
    if (typeof num === "number")
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
    return length(b) <= 52;
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
    return toNumber(clearMSB(b, length(b) % 52));
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
   * @param {string} str the string to be evaluated
   * @returns {boolean} `true` if the input is a whitespace or `false` if otherwise
   */
  export function isWhitespace(str: string): boolean {
    return str.length !== 1 ? false : whitespaces.indexOf(str) >= 0;
  }
  /**
   * A list of characters considered to be whitespaces.
   * @type {string[]}
   * @constant
   * @see
   * [this link](https://docs.microsoft.com/en-us/dotnet/api/system.char.iswhitespace?view=net-5.0) to get understanding of what's considered a white-space
   * characters in .Net 5.0.
   */
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
  export const LOCALE = new Intl.DateTimeFormat().resolvedOptions().locale;
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
  export function localeSplitWord(
    str: string,
    locale: string = LOCALE
  ): string[] {
    /**@todo needs optimisation*/
    return Array.from(
      new Intl.Segmenter(locale, { granularity: "word" }).segment(str)
    ).map((x) => x.segment);
  }
  /**
   * Duplicates the first argument the specified number of *n* times. Will return an empty string if `n` is less than or equal to 0.
   * @param {string} char the string to be duplicated
   * @param {number} n the number of times that the string will be duplicated.
   * @defaultValue
   * The default is `0`
   * @default 0
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
  export function fill<V>(
    array: V[],
    val: V,
    start: number = 0,
    numOfIndexes: number = array.length
  ): void {
    for (let i = start; i < start + numOfIndexes; i++) {
      array[i] = val;
    }
  }
  /**
   * Performs a Priority-List insertion into the given array using the provided *sorter* for ordering. Note that this does not sort the array.
   * @param {E[]} array the array in which insertion is to be done
   * @param {E} element the value to be inserted
   * @param {Comparator<E>} sorter the algorithm that will provide comparative ordering during the insertion
   * @returns {number} the length of the array after insertion is done. Note that undefined and null will be inserted if they are the *element* argument
   * @template E the type of the given array
   */
  export function push<E>(array: E[], element: E, sorter: Comparator<E> = compare as Comparator<E>): ReturnType<Array<E>["push"]> {
    let i = 0;
    for (; i < array.length; i++) {
      if(sorter(element, array[i]) < 0) break;
    }
    array.splice(i, 0, element);
    return array.length;
  }
  /**
   * Sorts the array in the given order (provided by the second argument) using a merge sort. This midifies the array.
   * @param {any[]} array the array to be sorted, after which the indices of the elements contained therein may change
   * @param {Comparator<any>} sorter the value that provides the ordering. A default value is provided. It uses ascending order.
   */
  export function sort(array: any[], sorter: Comparator<any> = compare) {
    mergeSort(array, 0, array.length - 1, sorter);
  }
  /**
   * Performs a sort on the specified section of this table using the merge sort algorithm.
   * @param {number} low the lower bound in a merge sort function
   * @param {number} high the upper bound in a merge sort function
   * @param {Comparator} c a function that will be used for the sorting. Please see {@link Comparable `Comparable`}, {@link compare. `compare`}. This is a function that provides ordering by comparing 2 value of the same/`undefined` type 
   * @returns {void} does not return
   */
  function mergeSort(arr: any[], low: number, high: number, c: Comparator<any> = compare): void {
    if (low >= high) {
      return;
    }
    const mid = Math.floor((low + high) / 2);
    mergeSort(arr, low, mid, c);
    mergeSort(arr, mid + 1, high, c);
    merge(arr, low, high, mid, c);
  }
  /**
   * Called by {@link mergeSort `mergeSort`} to sort this table.
   * @param {number} low the lower bound in a merge sort function
   * @param {number} high the upper bound in a merge sort function
   * @param {number} mid the middle point in a merge sort function
   * @param {Comparator} c a function that will be used for the sorting. Please see {@link Comparable `Comparable`}, {@link compare. `compare`}. This is a function that provides ordering by comparing 2 value of the same/`undefined` type 
   * @returns {void} does not return
   */
  function merge(
    arr: any[],
    low: number,
    high: number,
    mid: number,
    c: Comparator<any> = compare
  ): void {
    let temp = new Array();
    let i = low;
    let j = mid + 1;
    let k = 0;

    while (i <= mid && j <= high) {
      // if(arr[i]<arr[j]){
      if (c(arr[i], arr[j]) < 0) {
        temp[k++] = arr[i];
        i++;
      } else {
        temp[k++] = arr[j];
        j++;
      }
    }

    while (i <= mid) {
      temp[k++] = arr[i];
      i++;
    }

    while (j <= high) {
      temp[k++] = arr[j];
      j++;
    }

    for (let m = 0, n = low; m < temp.length; m++, n++) {
      arr[n] = temp[m];
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
   * Performs backward recursion from the given `start` directory and returns the path to the first folder where a `package.json` exists.
   * @param { string } start the directory from which path traversal begins.
   * @returns {string} the path to the folder where the first `package.json` file was found
   */
  export function rootFolder(start: string = dirname): string {
    while (!existsSync(join(start, "package.json"))) {
      start = join(start, "..");
    }
    return start;
  }
  /**
   * @summary Pseudorandom string
   */
}

export default utility;
