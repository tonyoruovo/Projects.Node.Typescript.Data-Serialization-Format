import { Expression } from "../expression/Expression";
import {Token} from "../token/Token"
import {Command} from "./Command"
import { Lexer } from "./Lexer";
import { Parser } from "./Parser";
import { Syntax } from "./Syntax";

export type GCommand<
  T extends Token,
  E extends Expression,
  S extends Syntax,
  L extends Lexer,
  P extends Parser
> = Command & {
  (alreadyParsed: E, yetToBeParsed: T, parser: P, lexer: L, syntax: S): E;
};
