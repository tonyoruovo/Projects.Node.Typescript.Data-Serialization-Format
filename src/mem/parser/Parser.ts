import { Expression } from "../expression/Expression";
import { Lexer } from "./Lexer";
import { Syntax } from "./Syntax";

/**
 * @summary The parser command's directionality.
 * @description
 * This enum is used as an argument for
 * `Syntax.getCommand`. It's sole purpose is specify the parsing direction
 * when a command is given to parse a token. \
 * \
 * For instance consider the expression:
 * `2x + 8yz!`. If left-to-right parsing is done, then the tokens `2`, `x`, `8`, `y`
 * and `z` will all have a parsing direction of `PREFIX` while `+` will have a parsing
 * direction of `INFIX` and `!` may have the parsing direction of `POSTFIX`.
 * @remark
 * For now {@link Direction.POSTFIX} is not supported in the {@link PrattParser} class, however implementors
 * can use it in custom parsers.
 */
enum Direction {
  /**
   * The command direction for parsing prefix tokens
   */
  PREFIX = 0,
  /**
   * The command direction for parsing infix tokens
   */
  INFIX = 1,
  /**
   * The command direction for parsing postfix tokens. For now the {@link PrattParser} class does not support for this value
   * @alpha
   */
  POSTFIX = 2,
}

export default Direction;
export type Unicode =
  | "utf-1"
  | "utf1"
  | "utf-7"
  | "utf7"
  | "utf-8"
  | "utf8"
  | "utf-16"
  | "utf16"
  | "utf16le"
  | "utf-16le"
  | "utf-32"
  | "utf32"
  | "utf-32le"
  | "utf32le"
  | "utf-64"
  | "utf64"
  | "utf-128"
  | "utf128"
  | "utf-ebcdic"
  | "utfebcdic";
export type Encoding =
  | Unicode
  | "scsu"
  | "bocu-1"
  | "bocu1"
  | "gb18030"
  | BufferEncoding;

  
export type Parser = {
    (lexer: Lexer, syntax: Syntax): Expression;
};
