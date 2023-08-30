import { Transform } from "node:stream";
import { TransformStream, CountQueuingStrategy, ByteLengthQueuingStrategy } from "node:stream/web";
import util from "../utility.js";
/**
 * @summary One of 2 foundational api for the mathaid-data-interchange project
 * @description
 * The documentation of this namespace features a pseudocode informally dubbed mathaid,
 * it is just the math syntax most people who encountered elementary math will be used to.
 * @remark
 * **Extrinsicity** (the act of using extrinsic states on an object) This
 * is used throughout the mathaid api to allow for limited memory objects.
 * Without extrinsic states, objects such as the {@link exp.Expression} interface
 * will have their memory baloon out of sizeable proportion preventing runs on
 * "potato" devices. It is recommended that implementors of the interfaces consider
 * using this design pattern frequently as this cause applications to be scalable
 * memorywise (in terms of RAM).
 */
var parser;
(function (parser_1) {
    /**
     * Parses the given `text` argument into a type given by the `format.data()` and returns that value. Althogh this method can probably be used to parse complex textual data, it is meant for simple single text.
     * @param {string} text the value to be parsed
     * @param {(text: string) => () => Token} tokenizer a functor that tokenizes the lexeme(s) and identifiers of `text` into valid {@link Token `Token`} objects and then returns a function that can retrive the tokens with each successive call.
     * @param {{data: () => any, append: (input: any, syntax: Syntax, params?: P) => void}} format a formatter of sorts. Please see the docs of the `expression` namespace for more about formatters.
     * @param {Syntax} syntax the syntax that will provide commands for the parsing
     * @param {P} [params] an object that complements the work of the `syntax` parameter. Can be left undefined, however if present, then `format.append` will recieve this object.
     * @template P a type of an object that may be used during parsing and formatting to update their states
     * @returns {any} the result of parsing `text`
     */
    function parseText(text, tokenizer, format, syntax, params) {
        const p = new PrattParser();
        const l = tokenizer(text);
        const e = p.parse(l, syntax, params);
        e.format(format, syntax, params);
        return format.data();
    }
    parser_1.parseText = parseText;
    /**
     * Class for throwing an error if the parser or lexer encounters one such
     * as an illegal token or character or wrong syntax.
     */
    class ParseError extends TypeError {
        /**
         * Constructs a `ParseError` object
         * @param {string} msg A message detailing the cause
         * @param {Error|undefined} cause the error that caused this object to be thrown
         */
        constructor(msg = "", cause) {
            super(msg + "\r\n" + cause?.stack);
        }
    }
    parser_1.ParseError = ParseError;
    /**
     * A specific type of `ParseError` that target syntax misuse.
     */
    class SyntaxError extends ParseError {
        token;
        /**
         * Constructs a `SyntaxError` object.
         * @param {Token} token a {@link Token} object
         * @param {Error|undefined} cause the error that caused this object to be thrown
         */
        constructor(token, cause) {
            super(`Unexpected token "${token.value}" at line: ${token.lineStart}, position: ${token.startPos}`, cause);
            this.token = token;
        }
    }
    parser_1.SyntaxError = SyntaxError;
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
    let Direction;
    (function (Direction) {
        /**
         * The command direction for parsing prefix tokens
         */
        Direction[Direction["PREFIX"] = 0] = "PREFIX";
        /**
         * The command direction for parsing infix tokens
         */
        Direction[Direction["INFIX"] = 1] = "INFIX";
        /**
         * The command direction for parsing postfix tokens. For now the {@link PrattParser} class does not support for this value
         * @alpha
         */
        Direction[Direction["POSTFIX"] = 2] = "POSTFIX";
    })(Direction = parser_1.Direction || (parser_1.Direction = {}));
    /**
     * @summary An implementation of the Vaughn Pratt's parser, which parses {@link Token tokens} into an Abstract Syntax Tree (AST).
     * @description
     * This is a typescript implementation of Vaughn Pratt's recursive descent parser. It implements the {@link GParser} interface.
     * @template E the type of expression returned by `parse`
     * @template S the type of syntax to use
     * @template TV the type of {@link GToken.value token value}. The default is a `string`
     */
    class PrattParser {
        // parse(lexer: GLexer<GToken<TV>, S>, syntax: S): E;
        /**
         * Prompts the provided Lexer for tokens and parses the results into an expression.
         * @ignore
         * 1. The first token parsed by this method is expected to be a prefix token. Prefix tokens are tokens that will always start an expression such numbers
         * variable names, prefix (such as pre-increment/decrement) operators and prefix keywords. If this token fails to retrieve the corresponding prefix command,
         * a syntactic error is thrown.
         * 2. The command for this type is retrieved from the syntax and the parsed into an expression. This expression becomes the left-side expression.
         * 3. The parser continues to search for the next token whose precedence is greater than zero. When a token's type's precedence is less than zero, then a valid AST is returned.
         * \
         * \
         * Note that for the above to work properly, the following should generally be observed:
         * - all prefix commands (a prefix command is a command that is retrieved from the syntax using `syntax.getCommand(Direction.PREFIX, type)`)
         * should not call this method and should not query the lexer (to query the lexer is to call it's next method).
         * - all infix commands (an infix command is a command that is retrieved from the syntax using `syntax.getCommand(Direction.INFIX, type)`)
         * should call {@link parseWithPrecedence this method} instead if another token is ahead of them otherwise they are considered postfix and should act like prefix command. These
         * should not also query the lexer. When calling the {@link parseWithPrecedence recommended parse method}, the precedence of the token about to be parsed should be the argument
         * for the first parameter of that method.
         * - all postfix commands (a postfix command is an infix command that acts like a prefix and does not call `parse` within) can
         * not call this method but should act like prefix commands.
         * @param {GLexer<GToken<TV>, S>} lexer The token generator
         * @param {S} syntax The comand factory
         * @param  {P} params parameter object that contains data for the parse commands
         * @template P the type of params object. A params object is an options object that is specific
         * to the current value being parsed. This is also a mutable visitor that allows this parser to read and update it's state during `parse()`, `parseWithPrecedence()`, `consume()`, `match()`, `readAndPop()` and `readAndPeek()`, so that other methods can gain access to the same state thereby creating a global state extrinsically.
         * @returns {E} a specific type of expression created by this parser that is
         * the AST of the values parsed
         */
        parse(lexer, syntax, params) {
            return this.parseWithPrecedence(0, lexer, syntax, params);
        }
        /**
         * Parses tokens generated by the provided Lexer into an expression
         * where the parsing will go as long as the next token generated by
         * the token factory is a type that has higher precedence (as
         * specified by {@link Type.precedence}) then the provided `beginingPrecedence`
         * argument.
         * @param {number} beginingPrecedence the smallest precedence this parser may regard. When
         * the parser encounters values with precedence equal to or less than this value,
         * the parsing stops and the generated AST is returned.
         * @param {GLexer<GToken<TV>, S>} l the token factory
         * @param {Syntax} s the command factory
         * @param {P} params parameter object that contains data for the parse commands
         * @template P the type of params object
         * @returns {E} a specific type of expression created by this parser that is
         * the AST of the values parsed
         */
        parseWithPrecedence(beginingPrecedence, l, s, params) {
            // the first token
            let t = this.readAndPop(l, s, params);
            // console.log("first");
            // console.table(t);
            //must be a prefix
            const prefix = s.getCommand(Direction.PREFIX, t.type);
            if (prefix === null || prefix === undefined)
                throw new SyntaxError(t);
            //convert it to an expression
            let left = prefix.parse(undefined, t, this, l, s, params);
            //read more tokens with higher precedence than the input
            while (beginingPrecedence < this.getPrecedence(l, s, params)) {
                //The next token
                t = this.readAndPop(l, s, params);
                // console.log('second');
                // console.table(t);
                // is expected to be an infix
                const infix = s.getCommand(Direction.INFIX, t.type);
                //!!!Expreimental!!!
                // if(infix) left = infix.parse(left, t, this, l, s, params);
                //or a postfix which ends the expression
                // else {
                //   const postfix = s.getCommand(Direction.POSTFIX, t.type!);
                //   if(util.isValid(postfix)) left = postfix!.parse(left, t, this, l, s, params);
                //   break;
                // }
                left = infix.parse(left, t, this, l, s, params);
            }
            return left;
        }
        /**
         * Requests the given Lexer object to generate a token, pushes it into the waiting stack awaiting processing,
         * inspects the waiting token whether it is the same as the expected token, if it is, then removes the waiting token
         * from the stack into the processing queue to be parse, if it isn't, then a `SyntaxError` is thrown.
         * @param expected the type of token this parser expects to consume
         * @param l the token generator
         * @param s a syntax for the token generator
         * @param {P} params parameter object that contains data for the parse commands
         * @template P the type of params object. A params object is an options object that is specific
         * to the current value being parsed.
         * @returns {GToken<string, string>} a valid token ready to be processed
         * @throws {Error} throws if `expected` was not found in the {@link GLexer} argument
         */
        consume(expected, l, s, params) {
            const t = this.readAndPeek(0, l, s, params);
            // if (!t.type!.equals(expected)) throw new SyntaxError(t);
            if (!t.type.equals(expected))
                throw new Error(`Expected: ${expected} but got ${t.type} as ${t.value}.\n at line: ${t.lineStart}, position: ${t.startPos}`);
            return this.readAndPop(l, s, params);
        }
        /**
         * Tests whether the given next token is the same as the argument
         * and returns `true` if it is otherwise returns `false`
         * @param expected the type of token this parser expects to consume
         * @param l the token generator
         * @param s a syntax for the token generator
         * @param {P} params parameter object that contains data for the parse commands
         * @template P the type of params object. A params object is an options object that is specific
         * to the current value being parsed.
         * @returns {boolean} a truthy for a match found
         */
        match(expected, l, s, params) {
            const t = this.readAndPeek(0, l, s, params);
            if (!t.type.equals(expected))
                return false;
            return true;
        }
        /**
         * Gets the precedence of the next token to be consumed. That is basically
         * the token on the processing queue.
         * @param l the token generator
         * @param s a syntax for the token generator
         * @param {P} params parameter object that contains data for the parse commands
         * @template P the type of params object. A params object is an options object that is specific
         * to the current value being parsed.
         * @returns {number} the precedence of the next token to be consumes
         */
        getPrecedence(l, s, params) {
            // const token = this.readAndPeek(0, l, s, params);
            const cmd = s.getCommand(Direction.INFIX, this.readAndPeek(0, l, s, params).type);
            // const cmd = s.getCommand(Direction.INFIX, token.type!);
            // || s.getCommand(Direction.POSTFIX, token.type!);
            if (util.isValid(cmd))
                return this.readAndPeek(0, l, s, params).type.precedence;
            return 0;
        }
        /**
         * Removes a token from the preocessing queue, discards it and returns the next token on the
         * waiting stack
         * @param l the token generator
         * @param s a syntax for the token generator
         * @param {P} params parameter object that contains data for the parse commands
         * @template P the type of params object. A params object is an options object that is specific
         * to the current value being parsed.
         * @returns {GToken<string, string>} return the topmost token on the waiting stack
         */
        readAndPop(l, s, params) {
            this.readAndPeek(0, l, s, params);
            return this.#stack.shift();
            // return this.#stack.pop()!;
        }
        /**
         * Causes the token generator to generate a token and then pushes it into the stack
         * and returns that same token.
         * @param distance the number of tokens to generate
         * @param l the token generator
         * @param s a syntax for the token generator
         * @param {P} params parameter object that contains data for the parse commands
         * @template P the type of params object. A params object is an options object that is specific
         * to the current value being parsed.
         * @returns {GToken<string, string>} returns the last token generated that is also the topmost token
         * on the stack but does not remove it from the stack
         */
        readAndPeek(distance, l, s, params) {
            while (distance >= this.#stack.length)
                this.#stack.push(l.next(s, params));
            return this.#stack[distance];
        }
        /**
         * The token stack
         * @readonly
         * @type {GToken<string, string>[]}
         */
        #stack = [];
    }
    parser_1.PrattParser = PrattParser;
    /**
     * @summary A class that converts data from one stream into expression in another
     * @description
     * An abstract class that extends the {@link Transform} class to provide basic support for `NodeJS.ReadableStream` and `NodeJS.WritableStream` which means that objects
     * created from this class can be involved in a stream in the `stream` module of node.js. It's purpose is to enable users to parse data directly from the web or any stream
     * source as opposed to getting the data to be come locally available first before conversion. The following example demonstrates a basic usage:
     * @example
     * #### create a concrete implementation and instantiate it
     * ```ts
     * type MyOptions = {readableObjectMode: boolean, writableObjectMode: boolean, readableHighWaterMark: number, writableHighWaterMark: number, allowHalfOpen: boolean}
     * class MyConverter extends AbstractConverter<MySyntax, MyParams> {
     *  constructor(options: MyOptions = {}, s: MySyntax, p: MyParams){
     *    super(options, s, p);
     *  }
     * //... implement both _flush and _transform
     * }
     * const o = //.. create a valid options object
     * const s = new MySyntax();
     * const p = new MyParams();
     * const conv = new MyConverter(o, s, p);
     * ```
     * #### Usage in node https
     * ```ts
     * //https is from the 'node:https' module
     * https.get("http://www.example.com/resource/a_certain_json", res => {
     *  res.pipe(conv).pipe(process.stdout);
     * });
     * ```
     * #### Usage in node stream
     * ```ts
     * const fileName = "file.json";
     * //fs is from the 'node:fs' module
     * const stream = fs.createReadStream(fileName);
     * stream.pipe(conv).pipe(process.stdout);
     * ```
     * #### Usage in the `fetch` api (WHATWG web streams)
     * ```ts
     * const url = "http://www.example.com/resource/a_certain_json";
     * //Duplex is found in the 'node:stream' module
     * //TransformStream and ReadableWritablePair are found in the 'node:stream/web' module
     * const webStream = Duplex.toWeb(conv) as any as ReadableWritablePair<any, any>;
     * //or
     * //const webStream = Duplex.toWeb(conv) as any as TransformStream<any, any>;
     * const res = await fetch(url);
     * await res.body.pipeThrough(webStream).pipeTo(Duplex.toWeb(Duplex.from(process.stdout)));
     * ```
     * The outputs of this stream are expected to be {@link exp.Expression expression} objects \
     * \
     * For suituations where a user may need to bypass usage of a lexer and parser
     * to work with data, this class should be favoured over {@link Converter}
     * @template S the type of {@link Syntax} object to be used
     * @template P the type of {@link AbstractConverter.params} object to be used
     */
    class AbstractConverter extends Transform {
        syntax;
        params;
        /**
         * Abstract constructor to instantiate properties of the `AbstractConverter` class.
         * @param {TransformOptions} options a standin object that may act as the implementation of the {@link Transoform} class. When implementors extend this class,
         * They do not need to provide this option as the only useful properties of this option are `readableObjectMode`, `writableObjectMode`, `readableHighWaterMark`,
         * `writableHighWaterMark` and `allowHalfOpen`.
         * @param {S} syntax an internal `Syntax` object that controls the conversion process
         * @param {P} params an object that may act as a mutable visitor
         */
        constructor(options, syntax, params) {
            super(options);
            this.syntax = syntax;
            this.params = params;
        }
    }
    parser_1.AbstractConverter = AbstractConverter;
    /**
     * @summary A less basic extension of the {@link Transform} class
     * @description
     * A class that divides the load of conversion between a given lexer and a parser. The Lexer process the data from {@link _transform} and the Parser produces
     * {@link exp.Expression expression} objects from the lexer's results.
     * @template Tk the type of token that the lexer will create
     * @template E the type of expression that the parse will produce
     * @template S the type of Syntax used by this class
     * @template P the type of PrattParser to be used by this class
     * @template PARAMS the type of params object for this class
     * @template ML the type of MutableLexer for this class
     * @template C the type of data to be recieved by the lexer
     * @template TV the type of value within the tokens produced by the lexer
     */
    class Converter extends AbstractConverter {
        lexer;
        parser;
        constructor(options, lexer, parser, syntax, params) {
            super(options, syntax, params);
            this.lexer = lexer;
            this.parser = parser;
        }
    }
    parser_1.Converter = Converter;
    /**
     * @summary A basic `Transformer` interface implementation to provide support for the `fetch` api.
     * @description An abstract class which provides the basic structure for implementation of a [WHATWG streams standard](https://streams.spec.whatwg.org) that can be
     * used with the `fetch` api both in node and javascript web.
     * @remark
     * All the documentation for the members of this class have been copied from <https://nodejs.org>
     * ### COPIED FROM [NODEJS.ORG](https://nodejs.org)
     *
     * A `TransformStream` consists of a {@link ReadableStream} and a {@link WritableStream} that are connected such that the data
     * written to the `WritableStream` is received, and potentially transformed, before being pushed into the `ReadableStream`'s queue.
     * @see {@link AbstractConverter} for examples on how to use with the fetch api. Note that no conversion to a `Duplex` object is required.
     */
    class AbstractTransformer {
        /**
         * The `readableType` option is reserved for future use and must be `undefined`.
         * @type {undefined}
         * @readonly
         */
        readableType = undefined;
        /**
         * The `writableType` option is reserved for future use and must be `undefined`.
         * @type {undefined}
         * @readonly
         */
        writableType = undefined;
    }
    parser_1.AbstractTransformer = AbstractTransformer;
    class BasicQueuingStrategy extends CountQueuingStrategy {
        constructor(highWaterMark = 256) {
            super({ highWaterMark });
        }
    }
    parser_1.BasicQueuingStrategy = BasicQueuingStrategy;
    class BitQueuingStrategy extends ByteLengthQueuingStrategy {
        constructor(highWaterMark = 512) {
            super({ highWaterMark });
        }
    }
    parser_1.BitQueuingStrategy = BitQueuingStrategy;
    class BasicTransformer extends TransformStream {
        constructor(transformer, readableStrategy, writableStrategy = new BasicQueuingStrategy()) {
            super(transformer, writableStrategy, readableStrategy);
        }
    }
    parser_1.BasicTransformer = BasicTransformer;
})(parser || (parser = {}));
export default parser;
