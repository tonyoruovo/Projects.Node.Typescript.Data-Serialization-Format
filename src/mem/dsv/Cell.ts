import { Expression } from "../expression/Expression";
import { CellIndex } from "./CellIndex";
import { Syntax } from "./Syntax";
import { Text } from "./Text";

export type Cell = Expression & {
  /**
   * Gets the parsed value whereby the initial value of this cell has been processed by all the available parsers
   * (row, column and cell-wise)
   */
  <T>(): T;
  /**
   * Gets the initial value with all escapes intact 'as is'.
   * @param {Syntax} syntax the `Syntax` that was used to create this value.
   * @returns {string} the raw data as a string.
   */
  (syntax?: Syntax): string; //raw data (primitive)
  /**
   * Replaces this cell's value with the second argument, using the first argument as a guide.
   * @param {T} prev the previous value
   * @param {T} value the replacement value
   * @returns {T} the new value.
   */
  <T>(prev: T, value: T): T; //overwrite data
  /**
   * Gets the row, column or cell index of this cell depending on the argument.
   * @param {CellIndex} cell an object representing the type of return value.
   * - If both the `row` and `col` properties are truthy, then the same object is populated with the
   * actual row and column indices (indexes) of this cell.
   * - If only the `row` is truthy, then the row index of this cell is returned as a number.
   * - If only the `col` is truthy, then the column index is returned as a number.
   * @returns {number | CellIndex} a `number` representing either the row or column index
   * of this cell. It may also return a `CellIndex` representing the complete cell location
   * within the given table.
   */
  (cell: CellIndex): number | CellIndex;
  /**
   * Immutable retrieval of all parsers for this cell. Only parsers specifically to this cell are returned.
   * Row-wide and column-wide parsers are not returned.
   * @template T the input data type of the data parameter of the returned functor
   * @template R the output data type of the returned functor
   * @param {never[]} parsers an empty array which will be populated with the parsers for this cell and returned.
   * @returns {(<T, R>((s: Syntax, data: T) => R))[]} an array of all parsers for this cell
   */
  <T, R>(parsers: never[]): ((syntax: Syntax, data?: T) => R)[]; //parsers for this cell
  /**
   * Adds (or removes) a parser at the given index. If this is a delete operation, the last argument needs not
   * be given.
   * @param {number} index the index within the list of parser to add this parser. It is also the index (from the
   * list if parsers) from which to remove the parser.
   * @param {boolean} add `true` if an insertion is to be done. `false` if otherwise.
   * @param {(<T, R>(syntax: Syntax, data?: T) => R)} [parser] the parser to be added. This can be ignored if
   * `add` is set to `false`.
   * @returns {boolean} `true` if the operation was successful, `false` if not.
   */
  (
    index: number,
    add: boolean,
    parser?: <T, R>(syntax: Syntax, data?: T) => R
  ): boolean;
};
export type CellConstructor = {
  // new (cell: CellIndex, text?: Text): Cell;
  (cell: CellIndex, text?: Text): Cell;
};
