import utility from "../../utility"
import { Expression } from "../expression/Expression"
import { GToken } from "../token/GToken"
import { GType } from "../token/GType"
import { Type } from "../token/Type"
import { GCommand } from "./GCommand"
import { GLexer } from "./GLexer"
import { GParser } from "./GParser"
import { GSyntax } from "./GSyntax"
import Direction from "./Parser"
import SyntaxError from "./SyntaxError"

export type PrattParser<
  E extends Expression,
  S extends GSyntax<
    Type,
    GCommand<GToken<T>, E, S, GLexer<GToken<T>, S>, PrattParser<E, S, T>>
  >,
  T = string
> = GParser<E, S, GLexer<GToken<T>, S>> & {
  (beginningPrecedence: number, lexer: GLexer<GToken<T>, S>, syntax: S): E
  consume(
    expected: GType<T>,
    lexer: GLexer<GToken<T>, S>,
    syntax: S
  ): GToken<T>
  match(expected: GType<T>, lexer: GLexer<GToken<T>, S>, syntax: S): boolean
  readAndPop(lexer: GLexer<GToken<T>, S>, syntax: S): GToken<T>
  readAndPeek(
    distance: number,
    lexer: GLexer<GToken<T>, S>,
    syntax: S
  ): GToken<T>
}

const stack = [] as GToken<any>[]

function readAndPeek<
    E extends Expression,
    S extends GSyntax<Type, GCommand<GToken<T>, E, S, GLexer<GToken<T>, S>, PrattParser<E, S, T>>>,
    T = string
>(distance: number, lexer: GLexer<GToken<T>, S>, syntax: S) {
    while(distance >= stack.length) stack.push(lexer(syntax) as GToken<T>)
    return stack[distance]
}

function readAndPop<
    E extends Expression,
    S extends GSyntax<Type, GCommand<GToken<T>, E, S, GLexer<GToken<T>, S>, PrattParser<E, S, T>>>,
    T = string
>(lexer: GLexer<GToken<T>, S>, syntax: S) {
    readAndPeek(0, lexer, syntax)
    return stack.shift()!
}

function precedence<
    E extends Expression,
    S extends GSyntax<Type, GCommand<GToken<T>, E, S, GLexer<GToken<T>, S>, PrattParser<E, S, T>>>,
    T = string
>(lexer: GLexer<GToken<T>, S>, syntax: S) {
    const command = syntax(Direction.INFIX, readAndPeek(0, lexer, syntax).type)
    if(utility.isValid(command)) return readAndPeek(0, lexer, syntax).type!.precedence
    return 0
}

function match<
    E extends Expression,
    S extends GSyntax<Type, GCommand<GToken<T>, E, S, GLexer<GToken<T>, S>, PrattParser<E, S, T>>>,
    T = string
>(expected: GType<T>, lexer: GLexer<GToken<T>, S>, syntax: S) {
    const token = readAndPeek(0, lexer, syntax)
    if(!token.type!.equals(expected)) return false
    return true
}

function consume<
    E extends Expression,
    S extends GSyntax<Type, GCommand<GToken<T>, E, S, GLexer<GToken<T>, S>, PrattParser<E, S, T>>>,
    T = string
>(expected: GType<T>, lexer: GLexer<GToken<T>, S>, syntax: S) {
    const token = readAndPeek(0, lexer, syntax)
    if(!token.type!.equals(expected)) throw new SyntaxError(token.lineStart, token.startPos)
    return readAndPop(lexer, syntax)
}

function parseOnPrecedence<
    E extends Expression,
    S extends GSyntax<Type, GCommand<GToken<T>, E, S, GLexer<GToken<T>, S>, PrattParser<E, S, T>>>,
    T = string
>(beginningPrecedence: number, lexer: GLexer<GToken<T>, S>, syntax: S) {
    // the first token
    let token = readAndPop(lexer, syntax)
    // must be a prefix or throw
    const prefix =  syntax(Direction.PREFIX, token.type)!
    if(!utility.isValid(prefix)) throw new SyntaxError(token.lineStart, token.startPos)

    // convert it to an expression
    let left = prefix(undefined as unknown as E, token, PrattParser, lexer, syntax)

    // read more tokens with higher precedence than the input
    while (beginningPrecedence < precedence(lexer, syntax)) {
        // the next token
        token = readAndPop(lexer, syntax)
        // is expected to be an infix
        const infix = syntax(Direction.INFIX, token.type)!
        left = infix(left, token, PrattParser, lexer, syntax)
    }
    return left
}

function ConcretePrattParser<
    E extends Expression,
    S extends GSyntax<Type, GCommand<GToken<T>, E, S, GLexer<GToken<T>, S>, PrattParser<E, S, T>>>,
    T = string
>(lexer: GLexer<GToken<T>, S>, syntax: S) {
    return parseOnPrecedence(0, lexer, syntax)
}
ConcretePrattParser.prototype = Object.create(Function.prototype)
ConcretePrattParser.prototype.constructor = Function

ConcretePrattParser.consume = consume
ConcretePrattParser.match = match
ConcretePrattParser.readAndPop = readAndPop
ConcretePrattParser.readAndPeek = readAndPeek

export type StringType = GType<string>
export type StringToken = GToken<string>
export interface StringLexer extends GLexer<StringToken, StringSyntax> {}
export interface StringCommand extends GCommand<StringToken, Expression, StringSyntax, StringLexer, PrattParser<Expression, StringSyntax>> {}
export type StringSyntax = GSyntax<StringType, StringCommand>
const PrattParser = ConcretePrattParser as PrattParser<Expression, StringSyntax, PrattParser<Expression, StringSyntax>>;
export default PrattParser
