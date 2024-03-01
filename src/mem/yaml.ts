import mem from "./mem.js";

namespace yaml {
    const Type = mem.token.GType;
    export interface Syntax extends mem.parser.GSyntax<mem.token.GType<string>, Command> {
    };
    export type Lexer = mem.parser.MutableLexer<mem.token.GToken<string>, Syntax, string>;
    export type Command = mem.parser.GCommand<mem.token.GToken<string>, Expression, Syntax, Lexer, Parser>;
    export type Parser = mem.parser.PrattParser<Expression, Syntax, string>;
    export type Expression = mem.expression.GExpression<Serializer>;
    export interface Serializer extends mem.expression.GFormat<Expression, string> {
        (data?: Expression | string): void;
    }
}
export default yaml;