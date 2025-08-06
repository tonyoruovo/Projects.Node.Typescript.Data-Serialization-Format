import {Token} from "../token/Token"
import {Lexer} from "./Lexer"
import { Syntax } from "./Syntax";

export type GLexer<T extends Token, S extends Syntax> = Lexer & {
  (syntax?: S): T;
};
