import { Expression } from "../expression/Expression";
import { Token } from "../token/Token";
import { Lexer } from "./Lexer";
import { Parser } from "./Parser";
import { Syntax } from "./Syntax";

export type Command = {
  (
    alreadyParsed: Expression,
    yetToBeParsed: Token,
    parser: Parser,
    lexer: Lexer,
    syntax: Syntax
  ): Expression;
};
