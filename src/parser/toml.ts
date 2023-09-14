import { ReadStream } from "fs";
import utility from "../utility.js";
import expression from "./expression.js";
import json from "./json.js";
import parser from "./parser.js";
/**
 * @summary Defines the constituents of the toml pipeline.
 * @description The toml pipeline constitutes tokenisers (lexers) for tokenising text and json data; a parser which translates the
 * tokens into expressions; formatters which can create file, in-memory and simple string formats; a converter which binds several
 * of the aforementioned components so that the data contained within can be tranferred to other data languages seamlessly.
 */ 
namespace toml {
    export class SyntaxBuilder implements utility.Builder<Syntax> {}
    export interface Syntax extends parser.GSyntax<Type, Command>{}
    export class Params {}
    class Type implements parser.GType<string> {}
    class Token implements parser.GToken<string> {}
    export interface MutableLexer<CH = string> extends parser.MutableLexer<Token, Syntax, CH> {
      end(syntax: Syntax, p: Params | any): void;
      process(chunk: CH, syntax: Syntax, p: Params | any): void;
    }
    export class JSONLexer implements MutableLexer<json.Value>{}
    export class StringLexer implements MutableLexer{}
    export interface Command extends parser.GCommand<Token, Expression, Syntax, MutableLexer, Parser> {
      parse( ap: Expression, yp: Token, p: Parser, l: MutableLexer, s: Syntax, pa?: Params ): Expression;
    }
    export interface Expression extends expression.GExpression<Format> {
      format(format: Format, syntax?: Syntax, params?: Params | any): void;
    }
    /**Convenience class to allow for proper return values using `parse` */
    export class Parser extends parser.PrattParser<Expression, Syntax> {}
    export type Appendage = string | Expression;
    /**A base toml format */
    export interface Format<T = any> extends expression.GFormat<Expression, T> {
      append(data: Appendage, s?: Syntax, p?: Params): void;
    }
    export class StringFormat implements Format<string> {}
    export class JSFormat implements Format<json.Value> {}
    export class FileFormat implements Format<ReadStream> {}
    export class Converter extends parser.Converter< parser.GToken<string>, Expression, Syntax, Parser, Params, MutableLexer, any > {}
}
export default toml;