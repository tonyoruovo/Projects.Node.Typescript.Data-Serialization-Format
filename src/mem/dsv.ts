import util from "../utility.js";
import mem from "./mem.js";
/**
 * @summary **d**ecimal-**s**eparated-**v**alues
 * @description
 * A generic parser/converter/serializer for comma/decimal/dot/tab separated values. 
 */
namespace dsv {
    const Type = mem.token.GType;
    export const SEPARATOR = Type("1", 2);
    export const EOL = Type("2", 1);
    export const FIELD = Type("3", 2);
    export const EOF = Type("-1", 2);
    export type CellIndex = {row: number; col: number};
    export type Row = mem.expression.Expression & {
        (): readonly string[];//primitive
        (c: CellIndex): readonly Cell[];
        (col: number): Cell;
        (cell: Cell): void;//append to this row
        (cell: readonly Cell[]): void;//overwrite/replace this row
        (cell: Cell, col: false): void;//prepend to this row
        (cell: Cell, col: number): void;//insert/overwrite
        (parsers: []): (<T>(raw: string) => T)[];//parsers for this row
        <T>(parse: null): T;//reduce this row
        (r: Row, merger?: (c1: Cell, c2: Cell) => Cell): boolean; // merge
    };
    export type Cell = mem.expression.Expression & {
        /**
         * @param {util.Truthy} parse a truthy value specifying whether the to be value retrieved should be parsed before this retrieval
         * @template {*} T the type of value to be retrieved if a truthy value was used as the argument.
         * @returns {T | string} a value of type `T` if a truthy was passed as the argument or else the raw value of the cell
         * will be returned as a `string`.
         */
        <T>(parse: null): T;
        (): string;//raw data
        (raw: string): string;//overwrite data
        (row: true): number;//row num
        (col: false): number;//col num
        (parsers: []): (<T>(raw: string) => T)[];//parsers for this cell
    };
    export const transpose = Symbol("transpose");
    export const flip = Symbol("flip");
    export const swap = Symbol("swap");
    export const html = Symbol("html");
    export type Table = mem.expression.GExpression<Serializer> & {//table headers are at row 0
        (): readonly string[][];//primitive
        (c: {}): readonly Row[];//table
        (row: number): Row;//row
        (row: undefined | null, col: number): readonly Cell[];// col
        (row: number, col: number): Cell;//cell
        (row: number, col: number, cell: Cell): boolean;//replace the cell
        (c1: CellIndex, c2: CellIndex): readonly [Cell, Cell];//swap cells
        (cell: false, row: number): boolean;//row delete
        (cell: Cell, row: number): void;//row append
        (cell: undefined | null, row: undefined, col: number): void;//col append
        (cell: false, row: undefined, col: number): void;//col delete
        (cell: Cell, row: undefined, col: number): void;//col append
        (cell: undefined | null, row: number, col: number): void;//delete
        (cell: Cell, row: number, col: number): void;//insert/overwrite
        (col1: util.NumericString, col2: util.NumericString, merger: (c1: Cell, c2: Cell) => Cell): boolean//merge cols
        (r1: number, r2: number, merger: (c1: Cell, c2: Cell) => Cell): boolean//merge cols
        (row: number, splitter: (cell: Cell) => [Cell, Cell]): boolean//split row
        (col: util.NumericString, splitter: (cell: Cell) => [Cell, Cell]): boolean//split col
        [transpose](reverse: boolean): void;//transposes table
        [flip](reverse: boolean): void;//flips table
        [swap](r1: number, r2: number): void;//swaps rows in table
        [swap](cl1: util.NumericString, cl2: util.NumericString): void;//swaps col in table
        [swap](c1: Cell, c2: Cell): void;//swaps cells in table
        [html](previous?: string): string;//pretty print a html table
    };
    export type Serializer = mem.expression.GFormat<Cell, string>;
}
export default dsv; 