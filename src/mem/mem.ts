import util from "../utility.js";
/*
We need a way to convert between in-memory data types. Such as converting a javascript value to a csv in-memory table 
 */
/**
 * @summary in-**mem**ory
 * @description A module for reading, translating/converting and serializing in-memory data. All data read from the file are retained in memory,
 * This is the fastest method for converting between data/binary formats. However (unless one has infinite memory) it is not suited for large
 * data. If the size of a file is more than 80% of free memory, then the device will freeze.
 * @namespace mem
 */
namespace mem {
    export type DataError<C extends unknown = any> = Error & {
        name: string,
        message: string;
        cause?: C;
        stack?: string;
        prototype: typeof Error.prototype;
    };
    export type DataErrorConstructor = {
        new <C extends unknown = any>(msg: string, cause?: C): DataError<C>;
        <C extends unknown = any>(msg: string, cause?: C): DataError<C>;
    }
    export const DataError: DataErrorConstructor = function <C extends unknown = any>(this: DataError<C> | void, msg: string, cause?: C) {
        if (new.target || !(this instanceof DataError)) {
            this!.prototype = Error.prototype;
            (this! as any).prototype.message = msg;
            (this! as any).prototype.name = "DataError";
            (this! as any).prototype.cause = cause;
            (this! as any).prototype.stack = util.isValid(cause) ? ((util.isValid((cause as { stack: string }).stack) ? (cause as { stack: string }).stack : "") + util.eol + ((cause as Error).message ?? String(cause))) : "";
        } else {
            return {
                message: msg,
                name: "DataError",
                cause: cause,
                prototype: DataError.prototype,
                stack: util.isValid(cause) ? ((util.isValid((cause as { stack: string }).stack) ? (cause as { stack: string }).stack : "") + util.eol + ((cause as Error).message ?? String(cause))) : ""
            } as DataError;
        }
        return this as DataError<C>;
    } as DataErrorConstructor;
    export namespace token {
        /**
         * Caused by providing an illegal/unrecognised token to the tokenizer/lexer
         */
        export type TokenError = DataError<undefined> & {
            /**
             * The token that caused the error
             * @type {Token}
             */
            token: Token;
            prototype: typeof DataError.prototype;
        };
        export type TokenErrorConstructor = DataErrorConstructor & {
            new(token: Token): TokenError;
            (token: Token): TokenError;
        };
        export const TokenError: TokenErrorConstructor = function (this: TokenError | void, token: Token) {
            if (new.target || !(this instanceof TokenError)) {
                this!.prototype = DataError.prototype;
                (this! as any).prototype.token = token;
                (this! as any).prototype.name = "TokenError";
                (this! as any).prototype.cause = undefined;
                (this! as any).prototype.stack = undefined;
                (this! as any).prototype.message = (token.type ?? { id: Number.NaN }).id + " is not a valid token" + util.eol + "at: " + token.lineStart + ":" + token.startPos;
            } else {
                return {
                    token,
                    name: "TokenError",
                    cause: undefined,
                    prototype: TokenError.prototype,
                    stack: undefined,
                    message: (token.type ?? { id: Number.NaN }).id + " is not a valid token" + util.eol + "at: " + token.lineStart + ":" + token.startPos
                } as TokenError;
            }
        } as TokenErrorConstructor;
        export type Type = util.Predicatable & {
            readonly id: any;
            readonly precedence: number;
        };
        export type GType<T> = Type & {
            readonly id: T;
        };
        export type TypeConstructor = {
            new(id: string, precedence: number): GType<string>;
            (id: string, precedence: number): GType<string>;
        }
        export const GType: TypeConstructor = function (this: GType<string> | void, id: string, precedence: number) {
            if (new.target || !(this instanceof GType)) {
                (this! as any).prototype = Object.prototype;
                (this! as any).prototype.id = id;
                (this! as any).prototype.precedence = precedence;
                (this! as any).prototype.toString = () => JSON.stringify(this);
                (this! as any).prototype.equals = (o?: object) => (o instanceof GType) ? this!.id === o.id && this!.precedence === o.precedence : false;
            } else {
                const doppleganger: any = { id, precedence };
                doppleganger.prototype = GType.prototype;
                (this! as any).prototype.toString = () => JSON.stringify(this);
                (this! as any).prototype.equals = (o?: object) => (o instanceof GType) ? this!.id === o.id && this!.precedence === o.precedence : false;
                return Object.freeze(doppleganger as GType<string>);
            }
        } as TypeConstructor;
        export type Token = util.Hashable & util.Predicatable & util.Comparable<Token> & {
            /**
             * The begining of the line from which the token
             * was read. The first value is generally 1.
             * @type {number | undefined}
             * @readonly
             */
            readonly lineStart?: number;
            /**
             * The last line from which this token was read.
             * In most cases this will be the same as `lineStart`, except for tokens that represent code blocks, for example the body of a function as a single token.
             * @type {number | undefined}
             * @readonly
             */
            readonly lineEnd?: number;
            /**
             * The index of the position within a line of the initial
             * character that is part of this token. For example
             * if `x + 1234.5` is a read by the lexer, then the token
             * representing `1234.5` will have `4` as the value of
             * this property.
             * @type {number | undefined}
             * @readonly
             */
            readonly startPos?: number;
            /**
             * The length (length of the string or the number of bits)
             * of this token
             * @type {number | undefined}
             * @readonly
             */
            readonly length?: number;
            /**
             * The intrinsic value of this token. This is the value that will be incoporated into an expression.
             * @type {any}
             * @readonly
             */
            readonly value: any;
            // readonly type: Array<Type>;
            /**
             * The type of this token
             * @type {Type | undefined}
             * @readonly
             */
            readonly type?: Type;
        };
        export type GToken<T> = Token & {
            readonly value: T;
        };
        export type TokenConstructor = {
            new(value: string, type: GType<string>, lineStart: number, lineEnd: number, startPos: number): GToken<string>
            (value: string, type: GType<string>, lineStart: number, lineEnd: number, startPos: number): GToken<string>
        }
        export const GToken: TokenConstructor = function (this: GToken<string> | void, value: string, type: GType<string>, lineStart: number, lineEnd: number, startPos: number) {
            if (new.target || !(this instanceof GToken)) {
                (this! as any).prototype = Object.prototype;
                (this! as any).prototype.value = value;
                (this! as any).prototype.length = value.length;
                (this! as any).prototype.type = type;
                (this! as any).prototype.lineStart = lineStart;
                (this! as any).prototype.lineEnd = lineEnd;
                (this! as any).prototype.startPos = startPos;
                (this! as any).prototype.equals = (o?: object) => (o instanceof GToken) ?
                    (this!.lineStart == o.lineStart && this!.lineEnd == o.lineEnd && this!.startPos === o.startPos
                        && this!.type!.equals(o.type) && this!.value === o.value) : false;
                (this! as any).prototype.hashCode32 = () =>
                    util.hashCode32(true, util.asHashable(this!.value), util.asHashable(this!.type!.id), util.asHashable(this!.type!.precedence), util.asHashable(this!.startPos), util.asHashable(this!.lineEnd), util.asHashable(this!.lineStart));
                (this! as any).prototype.compareTo = (o?: Token) => {
                    if (util.isValid(o)) {
                        let by = util.compare(this!.lineStart, o!.lineStart);
                        if (by !== 0) return by;
                        by = util.compare(this!.lineEnd, o!.lineEnd);
                        if (by !== 0) return by;
                        by = util.compare(this!.startPos, o!.startPos);
                        if (by !== 0) return by;
                        by = util.asCompare(util.hashCode32(true, util.asHashable(this!.type!.id), util.asHashable(this!.type!.precedence)));
                        if (by !== 0) return by;
                        return util.compare(this!.value, o!.value);
                    }
                    return 1;
                }

            } else {
                const doppleganger: any = { value, type, lineEnd, lineStart, startPos, length: value.length };
                doppleganger.prototype = GToken.prototype;
                doppleganger.prototype.equals = (o?: object) => (o instanceof GToken) ?
                    (doppleganger.lineStart == o.lineStart && doppleganger.lineEnd == o.lineEnd && doppleganger.startPos === o.startPos
                        && doppleganger.type!.equals(o.type) && doppleganger.value === o.value) : false;
                doppleganger.prototype.hashCode32 = () =>
                    util.hashCode32(true, util.asHashable(doppleganger.value), util.asHashable(doppleganger.type!.id), util.asHashable(doppleganger.type!.precedence), util.asHashable(doppleganger.startPos), util.asHashable(doppleganger.lineEnd), util.asHashable(doppleganger.lineStart));
                doppleganger.prototype.compareTo = (o?: Token) => {
                    if (util.isValid(o)) {
                        let by = util.compare(doppleganger.lineStart, o!.lineStart);
                        if (by !== 0) return by;
                        by = util.compare(doppleganger.lineEnd, o!.lineEnd);
                        if (by !== 0) return by;
                        by = util.compare(doppleganger.startPos, o!.startPos);
                        if (by !== 0) return by;
                        by = util.asCompare(util.hashCode32(true, util.asHashable(doppleganger.type!.id), util.asHashable(doppleganger.type!.precedence)));
                        if (by !== 0) return by;
                        return util.compare(doppleganger.value, o!.value);
                    }
                    return 1;
                }
                return Object.freeze(doppleganger as GToken<string>);
            }
        } as TokenConstructor;
    }
    export namespace parser {
        export type ParseError<C extends unknown = any> = DataError<C> & {
            line?: number,
            pos?: number,
            prototype: typeof DataError.prototype,
            cause?: C
        };
        export type ParseErrorConstructor = DataErrorConstructor & {
            new <C extends unknown = any>(line?: number, pos?: number, cause?: C): ParseError<C>;
            new <C extends unknown = any>(cause?: C): ParseError;
            <C extends unknown = any>(line?: number, pos?: number, cause?: C): ParseError<C>;
            <C extends unknown = any>(cause?: C): ParseError;
        };
        export const ParseError: ParseErrorConstructor = function <C extends unknown = any>(this: ParseError, line?: number, pos?: number, cause?: C) {
            cause ??= line as any;
            if (new.target || !(this instanceof ParseError)) {
                this.message = typeof line === "number" ? "Parse error at: " + line + ":" + pos : "";
                this.name = "ParseError";
                this.prototype = DataError.prototype;
                this.cause = cause ?? line;
                this.line = typeof line === "number" ? line : undefined;
                this.pos = pos;
                this.stack = util.isValid(cause) ? ((util.isValid((cause as { stack: string }).stack) ? (cause as { stack: string }).stack : "") + util.eol + ((cause as Error).message ?? String(cause))) : "";
            }
            else {
                // if(typeof line !== "number" && (!util.isValid(pos)) && (!util.isValid(cause))) {
                //     return ParseError(undefined, undefined, line);
                // }
                return {
                    message: typeof line === "number" ? "Parse error at: " + line + ":" + pos : "",
                    name: "ParseError",
                    prototype: ParseError.prototype,
                    cause: cause ?? line,
                    line: typeof line === "number" ? line : undefined,
                    pos,
                    stack: util.isValid(cause) ? ((util.isValid((cause as { stack: string }).stack) ? (cause as { stack: string }).stack : "") + util.eol + ((cause as Error).message ?? String(cause))) : ""
                } as ParseError
            }
        } as ParseErrorConstructor;
        export type SyntaxError = ParseError & {
            prototype: typeof ParseError.prototype,
            readonly line: number,
            readonly pos: number
        };
        export type SyntaxErrorConstructor = ParseErrorConstructor & {
            new <C extends unknown = any>(line: number, pos: number, cause?: C): ParseError<C>;
            <C extends unknown = any>(line: number, pos: number, cause?: C): ParseError<C>;
        };
        export const SyntaxError: SyntaxErrorConstructor = function <C extends unknown = any>(this: SyntaxError, line: number, pos: number, cause?: C) {
            if (new.target || !(this instanceof SyntaxError)) {
                this.message = "Syntax error at: " + line + ":" + pos;
                this.name = "SyntaxError";
                this.prototype = ParseError.prototype;
                this.cause = cause;
                this.line = line;
                this.pos = pos;
                this.stack = util.isValid(cause) ? ((util.isValid((cause as { stack: string }).stack) ? (cause as { stack: string }).stack : "") + util.eol + ((cause as Error).message ?? String(cause))) : "";
            }
            else {
                return {
                    message: "Syntax error at: " + line + ":" + pos,
                    name: "SyntaxError",
                    prototype: SyntaxError.prototype,
                    cause,
                    line,
                    pos,
                    stack: util.isValid(cause) ? ((util.isValid((cause as { stack: string }).stack) ? (cause as { stack: string }).stack : "") + util.eol + ((cause as Error).message ?? String(cause))) : ""
                } as SyntaxError;
            }
        } as SyntaxErrorConstructor;
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
        export enum Direction {
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
            POSTFIX = 2
        };
        export type Command = {
            (alreadyParsed: expression.Expression, yetToBeParsed: token.Token, parser: Parser, lexer: Lexer, syntax: Syntax): expression.Expression;
        };
        export type GCommand<T extends token.Token, E extends expression.Expression, S extends Syntax, L extends Lexer, P extends Parser> = Command & {
            (alreadyParsed: E, yetToBeParsed: T, parser: P, lexer: L, syntax: S): E;
        };
        /**
         * @summary Builds tokens for a {@linkcode TokenFactory}.
         * @description
         * A token builder that combines strings *character-by-character* in the process of generating a string. It knows how to abort
         * this process when it recieves a syntactically improper character (that will cannot compose the token, for example, to construct
         * a new line in a *windows* system, `\r` is the first item then `\n` is the last. If the `\r` is first recived, the building
         * process will be intiated via `ad()`, however if anything other than the character `\n` is recieved next, this will abort by
         * spawning the resident `\r` as a whitespace token and then calling the appropriate tokenizer for `\n`).\
         * \
         * This object is needed for variable length tokens that may be set by the user of this lexer eg {@linkplain Syntax.eol line terminators}.
         */
        export type Tokenizer = {
            /**
             * Used by *multi character* tokenizers as the result of the appendage done by {@linkcode Tokenizer.ad}.
             * This value is `null` if this is a single character tokenizer, or this multi-character tokenizer is not
             * currently processing any character(s).
             * @type {string | null}
             */
            value: string | null,
            /**
             * @summary adds a character to this tokenizer.
             * @description
             * Adds, appends, combines, creates and concats a single character to/with the existing store, the total of which will form
             * a full token. It processes the given item and decides where to continue building the token, or to abort the building process.
             * If the decision to continue building the token is made, this method may adjuge the process to be complete hence may call
             * {@linkcode Tokenizer.ge ge()}. For tokens that can be created using single characters, this method instantly
             * creates the token, hence it does the work that `Tokenizer.ge()` does for muti-character tokens.
             * @param {string} item The value to be appended. For tokens that can be created using single characters, this parameter may be
             * omitted.
             * @returns {void} an imperative and mutative code, does not return anything.
             */
            ad: (item?: string) => void,
            /**
             * @summary Cancels the tokenizing process.
             * @description
             * Aborts or cancels the process started in {@linkcode Tokenizer.ad ad()} and performs a cleanup operation on the residual
             * items in this tokenizer. For tokens that can be created using single characters, this method does nothing.
             * @returns {void} an imperative and mutative code, does not return anything.
             */
            ca: () => void,
            /**
             * @summary Generates the token.
             * @description
             * Generates or creates the token by calling {@linkcode StringLexer.manufacture} on a fully composed token.
             * @returns {void} an imperative and mutative code, does not return anything.
             */
            ge: () => void
        }
        /**
         * @summary Makes tokens through its tokenizer properties.
         * @description
         * An object that creates single and multi character tokens by abstracting the process and delegating the implementation thereof to
         * it's properties which are {@linkcode Tokenizer} objects. This enables tokens which are not single characters (such as the
         * triple quotes `'''` for toml data formats) to be properly tokenized without hard-coding the process but rather stream-lining
         * it with other tokens types (including single character tokens). \
         * \
         * When values defined as single character tokens are encountered by any of the tokenizers in this object, they are immediately
         * pushed into the queue for manufactured tokens (with the appropriate `Type` tag).\
         * \
         * When values defined in a multi-character token are encountered, they are first appended to the appropriate `Tokenizer`, the name
         * of that tokenizer is set to the {@linkcode ls} property. When the next token is encountered, then the last tokenizer that was
         * used is invoked by using the value of `ls`, the invoked tokenizer will validate whether the incoming value is syntactically proper
         * to be appended and if it is, then it is appended else the process will be aborted, the items in this tokenizer will be spawned
         * as single character tokens and the incoming token will be processed by another tokenizer.
         * @remark
         * The implementation of this type is found in the {@linkcode Lexer} as `Lexer.mill`
         */
        export type TokenFactory = {
            /**
             * @summary *Last saved tokenizer*
             * @description
             * a value that may be a `string` or `null` type. \
             * \
             * As a `string`, it represents the last property (`Tokenizer` object) that
             * was used in appendage, more tecnically as a `string` value, it represents the last tokenizer in this property that called
             * {@linkcode Tokenizer.ad}, but did not create a new token. This is always the key of a *multi-character* tonizer property.\
             * \
             * As a `null` value, it represents either there was no last muti-character tokenizer used, or one was aborted.
             */
            ls: string | null,
            /**
             * Default `Tokenizer` for integers in a given radix. This only appends digits, it does not append separators (such as `_`),
             * exponents (such as `e`) or prefixes (such as `+`, `-`, `0x` etc) and will abort if it encounters one.
             */
            int: Tokenizer,
            /**
             * Default `Tokenizer` for non-whitespace text. Will abort if it encounters numbers or any token that is defined in this factory.
             */
            tx: Tokenizer,
            /**
             * A user-defined tokenizer.
             */
            [name: symbol]: Tokenizer,
            /**
             * Calls (if possible) `ad()` for the property whose name is allocated to the `ls` property,
             * or else calls `ad()` for the property (if available) with the name `item`, or else calls `ad()` for
             * the `int` property (if it is a number) or else calls add for the `tx` property.
             * @param {string | undefined} item the same parameter as {@linkcode Tokenizer.ad}
             * @returns {void}
             */
            ad: (item?: string) => void;
            /**
             * Calls (if possible) `ca()` for the property whose name is allocated to the `ls` property
             * @param {string | undefined} item the same parameter as {@linkcode Tokenizer.ca}
             * @returns {void}
             */
            ca: () => void;
        };
        export type Lexer = {
            readonly src?: any;
            readonly mill: TokenFactory;
            position(): number;
            line(): number;
            // next(syntax: Syntax): token.Token;
            (syntax?: Syntax): token.Token;//callable. Queries the lexer
        };
        export type GLexer<T extends token.Token, S extends Syntax> = Lexer & {
            (syntax?: S): T;
        };
        export type MutableLexer<T extends token.Token, S extends Syntax, CHUNK = string> = GLexer<T, S> & {
            /**
             * @summary Gets and returns the list of tokens that have already been processed.
             * @description
             * Return the token buffer which contains tokens processed from `process` calls
             * Each time `processed` is called, tokens are created and these tokens are pushed into the token buffer awaiting a parser to call the `next` method of this
             * lexer and consume them. This token buffer then returned as an array each time this method is called. Please note that an empty buffer does not mean processing
             * has completed or that processing is yet to begin.
             * @returns {T[]} an array of already processed `Token` objects or an empty array if ther is no token in the token buffer
             */
            processed: () => T[];
            /**The same as {@link src} */
            unprocessed: () => any;
            /**
             * Traverses the token buffer and returns the number of times a `Token` with the given `Type` occurs in the buffer.
             * @param {Type} type The type to search for
             * @returns {number} a value greater than 0 if the specified `Type` occurs at least once else returns 0
             */
            frequency(type: token.Type): number;
            /**
             * Traverses the `Token` buffer and returns the first index (from the start) in which the token with the given type occurs
             * @param {Type} type The type to search for
             * @returns {number} the first index of the token with the given type or returns -1 if no token with the specified type was found
             */
            indexOf(type: token.Type): number;
            /**
             * Traverses the `Token` buffer and returns the last index (from the start) in which the token with the given type occurs
             * @param {Type} type The type to search for
             * @returns {number} the last index of the token with the given type or returns -1 if no token with the specified type was found
             */
            lastIndexOf(type: token.Type): number;
            /**
             * Analyses and processes the provided `chunk` value and (if possible) fills the token buffer with tokens produced from the processing.
             * @param {CHUNK} chunk the piece of data to analyse
             * @param {Syntax} syntax the provided syntax for this operation
             * @param {P} params the provided params object for this operation
             * @template P a mutable visitor that assists in this method by allowing this lexer to read and update it's state
             */
            process(chunk: CHUNK, syntax: S): void;
            /**
             * Finalises this lexer and signals an end to the processing. For some lexers, this will prevent `process`  from ever being called again.
             * @param {Syntax} syntax the provided syntax for this operation
             * @param {P} params the provided params object for this operation
             * @template P a mutable visitor that assists in this method by allowing this lexer to read and update it's state
             */
            end(syntax: S): void;
            /**
             * A check for whether tokens are `waiting` in the buffer
             * @returns {boolean} `true` if there is at least one token in the token buffer otherwise returns `false`
             */
            hasTokens(): boolean;
            /**
             * A check for whether this lexer is in a state where it can accept and process data
             * @returns {boolean} `true` if this can process more data and `false` if otherwise
             */
            canProcess(): boolean;
        }
        export type Syntax = {
            (direction: Direction, type: token.Type): Command | undefined;
            params(): any;
        };
        export type GSyntax<T extends token.Type, C extends Command> = Syntax & {
            (direction: Direction, type: T): C | undefined;
            params<P>(): P;
        };
        export type Parser = {
            (lexer: Lexer, syntax: Syntax): expression.Expression;
        };
        export type GParser<E extends expression.Expression, S extends Syntax, L extends Lexer> = Parser & {
            (lexer: L, syntax: S): E;
        }
        export type PrattParser<E extends expression.Expression, S extends GSyntax<token.Type, GCommand<token.GToken<T>, E, S, GLexer<token.GToken<T>, S>, PrattParser<E, S, T>>>, T = string> = GParser<E, S, GLexer<token.GToken<T>, S>> & {
            (beginingPrecedence: number, lexer: GLexer<token.GToken<T>, S>, syntax: S): E;
            consume(expected: token.GType<T>, lexer: GLexer<token.GToken<T>, S>, syntax: S): token.GToken<T>;
            match(expected: token.GType<T>, lexer: GLexer<token.GToken<T>, S>, syntax: S): boolean;
            readAndPop(lexer: GLexer<token.GToken<T>, S>, syntax: S): token.GToken<T>;
            readAndPeek(distance: number, lexer: GLexer<token.GToken<T>, S>, syntax: S): token.GToken<T>;
        };
        export type PrattParserConstructor = {
            // new <E extends expression.Expression,
            //     S extends GSyntax<token.Type, GCommand<token.GToken<T>, E, S, GLexer<token.GToken<T>, S>, PrattParser<E, S, T>>>,
            //     T = string>(): PrattParser<E, S, T>;
            <E extends expression.Expression, S extends GSyntax<token.Type, GCommand<token.GToken<T>, E, S, GLexer<token.GToken<T>, S>, PrattParser<E, S, T>>>, T = string>(): PrattParser<E, S, T>;
        }
        export const PrattParser: PrattParserConstructor = function <
            E extends expression.Expression,
            S extends GSyntax<token.Type, GCommand<token.GToken<T>, E, S, GLexer<token.GToken<T>, S>, PrattParser<E, S, T>>>,
            T = string>() {
            const stack: token.GToken<T>[] = [];
            const readAndPeek = (distance: number, lexer: GLexer<token.GToken<T>, S>, syntax: S): token.GToken<T> => {
                while (distance >= stack.length) stack.push(lexer(syntax));
                return stack[distance];
            }
            const readAndPop = (lexer: GLexer<token.GToken<T>, S>, syntax: S): token.GToken<T> => {
                readAndPeek(0, lexer, syntax);
                return stack.shift()!;
            }
            const precedence = (lexer: GLexer<token.GToken<T>, S>, syntax: S): number => {
                const cmd = syntax(Direction.INFIX, readAndPeek(0, lexer, syntax).type!);
                if (util.isValid(cmd)) return readAndPeek(0, lexer, syntax).type!.precedence;
                return 0;
            }
            const match = (expected: token.GType<T>, lexer: GLexer<token.GToken<T>, S>, syntax: S): boolean => {
                const t = readAndPeek(0, lexer, syntax);
                if (!t.type!.equals(expected)) return false;
                return true;
            }
            const consume = (expected: token.GType<T>, lexer: GLexer<token.GToken<T>, S>, syntax: S): token.GToken<T> => {
                const t = readAndPeek(0, lexer, syntax);
                if (!t.type!.equals(expected)) throw SyntaxError(t.lineStart, t.startPos, ParseError(`Expected: ${JSON.stringify(expected)} but got ${t.type!.id} as ${t.value}.\n at line: ${t.lineStart}, position: ${t.startPos}`));
                return readAndPop(lexer, syntax);
            }
            const parseOnPrecedence = (beginingPrecedence: number, lexer: GLexer<token.GToken<T>, S>, syntax: S): E => {
                // the first token
                let t = readAndPop(lexer, syntax);
                //must be a prefix
                const prefix = syntax(Direction.PREFIX, t.type!)!;

                if (!util.isValid(prefix)) throw SyntaxError(t.lineStart, t.startPos, `The token after '${t.value}' was not parsed. See stack trace for details`);

                //convert it to an expression
                let left = prefix(undefined as unknown as E, t, pratt as PrattParser<E, S, T>, lexer, syntax);

                //read more tokens with higher precedence than the input
                while (beginingPrecedence < precedence(lexer, syntax)) {
                    //The next token
                    t = readAndPop(lexer, syntax);
                    // is expected to be an infix
                    const infix = syntax(Direction.INFIX, t.type!)!;
                    left = infix(left, t, pratt as PrattParser<E, S, T>, lexer, syntax);
                }
                return left as E;
            }
            const parse = (lexer: GLexer<token.GToken<T>, S>, syntax: S): E => parseOnPrecedence(0, lexer, syntax);
            const pratt: (((x: number, y: GLexer<token.GToken<T>, S>, z: S) => E) |
                        ((x: GLexer<token.GToken<T>, S>, y: S) => E))
            = (x, y, z): E => {
                if (typeof x === "number") return parseOnPrecedence(x, y as GLexer<token.GToken<T>, S>, z as S);
                return parse(x as GLexer<token.GToken<T>, S>, y as any as S);
            };
            (pratt as any).prototype = Object.prototype;
            (pratt as any).prototype.consume = consume;
            (pratt as any).prototype.match = match;
            (pratt as any).prototype.readAndPeek = readAndPeek;
            (pratt as any).prototype.readAndPop = readAndPop;
            return pratt as PrattParser<E, S, T>;
        } as PrattParserConstructor;
    }
    export namespace expression {
        /**
         * Generic expression error that may be thrown after the parsing is completed without error(s) when the user attempt to perform an illegal operation
         * in the expression (such as using `null`/`undeined`).
         */
        export type ExpressionError<C extends unknown = any> = DataError<C>;
        export type ExpressionErrorConstructor = DataErrorConstructor & {
            new <C extends unknown = any>(msg?: string, cause?: C): ExpressionError<C>;
            <C extends unknown = any>(msg?: string, cause?: C): ExpressionError<C>;
        };
        export const ExpressionError: ExpressionErrorConstructor = function <C extends unknown = any>(this: ExpressionError | void, msg?: string, cause?: C) {
            if (new.target || !(this instanceof ExpressionError)) {
                (this! as any).prototype = DataError.prototype;
                (this! as any).prototype.message = msg ?? "";
                (this! as any).prototype.name = "ExpressionError";
                (this! as any).prototype.cause = cause;
                (this! as any).prototype.stack = util.isValid(cause) ? ((util.isValid((cause as { stack: string }).stack) ? (cause as { stack: string }).stack : "") + util.eol + ((cause as Error).message ?? String(cause))) : "";
            }
            else {
                return {
                    message: msg ?? "",
                    name: "ExpressionError",
                    prototype: ExpressionError.prototype,
                    cause,
                    stack: util.isValid(cause) ? ((util.isValid((cause as { stack: string }).stack) ? (cause as { stack: string }).stack : "") + util.eol + ((cause as Error).message ?? String(cause))) : ""
                } as ExpressionError
            }
        } as ExpressionErrorConstructor;
        export type Expression = util.Predicatable & util.Hashable & {
            (format: Format, syntax?: parser.Syntax): void;
            /**
             * for debugging
             * @throws {ExpressionError} if there is any issue encountered
             */
            (previous: string): string;
            (e: Expression): any;//decompose to primitive value such as boolean, null, undefined, object, number, string or array
        }
        export type ExpressionConstructor = {
            translate(e: Expression): Expression;//calls e() to retrieve the primitive value of e and then parses that primitive value into an expression it can understand
        }
        export type GExpression<F extends Format> = Expression & {
            (format: F, syntax: parser.Syntax): void
            <R>(expression: GExpression<F>): R;
        }
        export type FormatError<C extends unknown = any> = DataError<C>;
        export type FormatErrorConstructor = DataErrorConstructor & {
            new <C extends unknown = any>(msg?: string, cause?: C): FormatError<C>;
            <C extends unknown = any>(msg?: string, cause?: C): FormatError<C>;
        };
        export const FormatError: FormatErrorConstructor = function <C extends unknown = any>(this: FormatError | void, msg?: string, cause?: C) {
            if (new.target || !(this instanceof FormatError)) {
                (this! as any).prototype = DataError.prototype;
                (this! as any).prototype.message = msg ?? "";
                (this! as any).prototype.name = "FormatError";
                (this! as any).prototype.cause = cause;
                (this! as any).prototype.stack = util.isValid(cause) ? ((util.isValid((cause as { stack: string }).stack) ? (cause as { stack: string }).stack : "") + util.eol + ((cause as Error).message ?? String(cause))) : "";
            } else {
                return {
                    message: msg ?? "",
                    name: "FormatError",
                    prototype: FormatError.prototype,
                    cause,
                    stack: util.isValid(cause) ? ((util.isValid((cause as { stack: string }).stack) ? (cause as { stack: string }).stack : "") + util.eol + ((cause as Error).message ?? String(cause))) : ""
                } as FormatError
            }
        } as FormatErrorConstructor;
        export type Format = {
            /**
             * A {@link Prettyfier prettyfier} provided by formats that support string streaming such as file formats and string formats.
             * @type {Prettyfier}
             * @readonly
             */
            readonly prettyfier?: Prettyfier;
            /**
             * A {@link Minifier minifier} provided by formats that support string streaming such as file formats and string formats.
             * @type {Minifier}
             * @readonly
             */
            readonly minifier?: Minifier;
            /**
             * A {@link util.Messenger logger} used by formats to log info, errors and warnings during formatting. Note that the `isSealed` property will return `false` for this object when the formatting is yet to be completed and `true` when it is. Hence no logging may take place after the formatting is done.
             * @type {util.Messenger}
             * @readonly
             */
            readonly logger?: util.Messenger;

            /**
             * Parses the argument into a result and appends the result
             * to this object. This is a mutator.
             * @param {string|number|bigint|boolean|object|(string|number|bigint|boolean|object|undefined|null)[]|undefined|null} data the data in a compatible format
             * as this.
             * @returns {void}
             */
            (
                data:
                    string
                    | number
                    | bigint
                    | boolean
                    | object
                    | (string | number | bigint | boolean | object | undefined | null)[]
                    | undefined
                    | null
            ): void;

            data(prev: any): any
        }
        export type GFormat<E extends Expression, D> = Format & {
            (data: string | number | bigint | boolean | E | (string | number | bigint | boolean | E | undefined | null)[] | undefined | null): void;
            data(prev: D): D;
        }
        /**
         * Provided by a {@link Format formatter} to create specialized formats with the intention of increasing the readbility of the format.
         */
        export type Prettyfier = {
            /**
             * The value that represnts the whitespace character `\t`.
             * @type {string}
             * @readonly
             */
            readonly tab: string;
            /**
             * The value that represnts the whitespace character `\x20`.
             * @type {string}
             * @readonly
             */
            readonly space: string;
            /**
             * The value that represnts the whitespace character `\n` (`\r\n` in DOS).
             * @type {string}
             * @readonly
             */
            readonly newLine: string;
        };
        /**
         * Provided by a {@link Format formatter} to create a format that is reduced to only the essential characters
         */
        export type Minifier = {
            /**
             * A flag for allowing comments
             * @type {boolean}
             * @readonly
             */
            readonly retainComments: boolean;
            /**
             * The maximum number of lines a minified format can have
             * @type {boolean}
             * @readonly
             */
            readonly maxNumOfLines: number;
        };
    }
}
// export {parser: mem.parser}
export default mem;

// export = mem;