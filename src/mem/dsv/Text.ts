import { Expression } from "../expression/Expression";
import { Syntax } from "./Syntax";

/**
    A cell value that represents a singly-linked list that only supports forward traversal such that each index is a text node.
    e.g the field: `"Dave ""Mongoose"" Stick"` will be linked thus:
    1. START_FIELD
    1. PLAIN
    1. ESCAPED
    1. TEXT
    1. ESCAPED
    1. TEXT
    1. END_FIELD
    */
export type Text = Expression & {
  /**
   * Returns the string value of this text and it.s siblings.
   * When `syntax` is provided, all escapes are converted to their escaped value. e.g
   * the escaped quotes `""` will be converted to `"` else all escapes are returned
   * 'as is'.
   * @param {Syntax} [syntax] an object provided to properly convert escaped characters
   * @returns {string} the value of this text along with the value of other linked texts.
   */
  (syntax?: Syntax): string;
  /**
   * Gets the sibling of this text or checks if this text has a sibling.
   * @param {boolean} next use `true` value to get the sibling or `false` value to check if this `Text` node has a sibling.
   * @returns {Text|null|boolean} the sibling of this element (or `null`
   * if this node does not have any sibling) or `boolean` to check if this node has any sibling.
   */
  (next: boolean): Text | null | boolean;
  /**
   * Adds, deletes or gets the number of nodes in this text depending on the argument(s)
   * @param {number} index a number value to specify whether to get the number of nodes
   * in this text or insert a new text node. A negative value will cause this method to
   * returns the number of nodes in this node. A zero or positive value will cause the this method
   * to perform an insertion of the second argument into the given index.
   * @param {Text | null} [text] an optional value (a mandatory value if insertion is intended) to be
   * inserted into the non-negative index specified by the first index.
   * @returns {Text | null | number} a number value if the first argument is negative else returns
   * the second argument signifying a successful insert/deletion.
   */
  (index: number, text?: Text | null): Text; //add, delete, length
};


