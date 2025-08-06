/**
 * A location within a {@linkcode Table}.
 * \
 * A valid value means that the value is a
 * `number` type and can be located on the table without being `undefined` \
 * \
 * A convention of using a `CellIndex` specify a location within a `Table` is as follows:
 * - If both `row` and `col` have valid values, then a cell location has been specified.
 * - If `col` is not valid, then a row location has been specified.
 * - If `row` is not valid, then a column location has been specified.
 */
export type CellIndex = {
  /**
   * The position of the row in which the cell is located
   */
  row: number;
  /**
   * The position of the column in which the cell is located
   */
  col: number;
};

export type CellIndexConstructor = {
  new (row?: number | null, col?: number | null): CellIndex;
  (row?: number | null, col?: number | null): CellIndex;
  prototype: typeof Object.prototype &
    CellIndex & { constructor: CellIndexConstructor };
};

function ConcreteCellIndex(
  this: CellIndex,
  row?: number | null,
  col?: number | null
) {
    if(new.target) {
        Object.call(this, true)
        this.row = row || 0,
        this.col = col || 0
    } else return new CellIndex(row, col)
}
ConcreteCellIndex.prototype = Object.create(Object.prototype, {
  constructor: {
    value: ConcreteCellIndex,
  },
});

const CellIndex = ConcreteCellIndex as CellIndexConstructor
export default CellIndex
