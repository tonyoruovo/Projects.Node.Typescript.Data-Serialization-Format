import { Expression } from "../expression/Expression";
import { Lexer } from "./Lexer";
import { Parser } from "./Parser";
import { Syntax } from "./Syntax";

export type GParser<
  E extends Expression,
  S extends Syntax,
  L extends Lexer
> = Parser & {
  (lexer: L, syntax: S): E;
};
