import { createReadStream, createWriteStream, ReadStream, WriteStream } from "fs";
import { TransformCallback } from "node:stream";
import utility from "../utility.js";
import expression from "./expression.js";
import json from "./json.js";
import parser from "./parser.js";
import iconv from "iconv-lite";
/** 
 * @summary Defines the constituents of the ini pipeline.
 * @description
 * The ini pipeline constitutes tokenisers (lexers) for tokenising text and json data; a parser which translates the
 * tokens into expressions; formatters which can create file, in-memory and simple string formats; a converter which binds several
 * of the aforementioned components so that the data contained within can be tranferred to other data languages seamlessly. This cannot parse '.cfg' texts.
 * @example ### An example of an ini file:
 * ```ini
 * ; The start of this config
 * \u2023\u0020\u053b\uabe0ReallyNot=\x3abc\uabcd\xfadeTrue life\u0a20
 * [Global]
 * prop1 = 12345
 * prop1=12345
 * prop2="string"
 * prop2 = "string"
 * prop3 = false
 * prop3=false
 * [Paths]
 * "\=unix\=" = "C:\\path\\to\\file\\"
 * config = {unix}/config
 * [.Relative]
 * empty
 * [Paths.SubPaths]
 * light = 3.33
 * dark = | ;an inline comment
 * [.Relative]
 * mostly = great
 * ```
 * @remarks
 * All new lines must be `\n`. `\r\n` is not supported and is bound to cause errors during parsing.
 * Recfiles and toml are currently unsupported.\
 * \
 * Although a syntax object can be configured to parse `.properties` files, files using more than one space as a delimiter cannot be parsed. Hence `.properties` files need their own parsing pipeline.
 */
namespace ini {
    /**
     * An enum to specify the action a parser should take when it encounters duplicate sections and/or properties
     * @enum {number}
     */
    export enum DuplicateDirective {
        /**A directive for the parser to merge duplicate properties and store them as an array instead of a single string value */
        MERGE = 0,
        /**A directive for the parser to replace the original with the duplicate */
        OVERWRITE = 1,
        /**A directive for the parser to discard the duplicate and keep the original */
        DISCARD = 2,
        /**A directive for the parser to throw if a duplicate property is found */
        THROW = 3
    }
    /**
     * Preocess the given text by escaping all characters that need to be escaped using {@link Syntax.escape.isSpecial `Syntax.escape.isSpecial`} as a check.
     * @param {string} text the source text to be escaped
     * @param {Syntax} s a reference to a valid syntax with definition for escape
     * @param {Format} f a format for it's logger reference
     * @returns {string} the `string` argument escaped
     */
    function processEscapables(text: string, s: Syntax, f: Format): string {
        if(!utility.isValid(s.escape)) return text;
        let val = "";
        let isQuotable = false;
        for (let i = 0; i < text.length; i++) {
            let isEscapable;
            if(!Array.isArray(s.escape!.isSpecial)) isEscapable = (s.escape!.isSpecial as ((e: string) => boolean))(text[i]);
            else isEscapable = s.escape!.isSpecial.indexOf(text[i]) >= 0;

            if(isEscapable) {
                const c = text[i].codePointAt(0)!.toString(16);
                const escaped = s.escape!.unicode.length > 0 ? `${s.escape!.char}${s.escape!.unicode[0]}${utility.chars('0', 4 - c.length)}${c}` : text[i];
                if(s.escape!.quoted) {isQuotable = true; val += escaped;}
                else if(s.escape!.nonQuotedEsc) val += escaped;
                else {
                    if(utility.isValid(f.logger)) {
                        f.logger!.warn(`The character '${text[i]}' in string "${text}" needs to be escaped but it's not because the syntax does not support escaping special characters. The next time it is parsed from this format, an error will be thrown`);
                    }
                    val += text[i];
                }
            } else {
                val += text[i];
            }
        }
        return isQuotable ? `"${val}"` : val;
    }
    /**
     * Does the same function as {@link Format.append `Format.append`}. The code here is called by {@link StringFormat.append `StringFormat.append`} and {@link FileFormat.append `FileFormat.append`}
     */
    function append(f: Format<any>, data: Section, s?: Syntax, p?: Params) {
        for (const key in data.map) {
            if (data.map[key] instanceof Section){
                f.append(data.map[key].comments.preceding.length > 0 ? unwrapComments(data.map[key].comments, s) : "", s, p);
                if((data.map[key] as Section).fullname.length > 0)
                f.append(`${s!.sectionOperators[0]}${(data.map[key] as Section).fullname.join((s!.nesting??{chars: [""]}).chars[0])}${s!.sectionOperators[1]}\n`);
                append(f, data.map[key] as Section, s, p);
            } else if (data.map[key] instanceof Property){
                f.append((data.map[key] as Property), s, p);
            } else throw new expression.ExpressionError(`Illegal value found at ${key}`);
        }
    }
    /**
     * Stringifies the comment from an expression so that it is attached to a section, properties and texts of a `.ini` data
     * @param {{ preceding: readonly string[] }} comments the comment to be unwrapped
     * @param {Syntax} s a reference to a valid syntax
     * @returns {string} the comment as a `string`
     */
    function unwrapComments(comments: { preceding: readonly string[] }, s?: Syntax) {
        // if(utility.isValid(s)) return s!.comments.chars[0] + comments.preceding.join("\n;").concat("\n");
        return comments.preceding.join("\n");
    }
    /**
     * Checks if the argument is an instance of `Text`.
     * @param {Expression} e the expression to tested.
     * @returns {boolean} whether or not the expression is an instance of {@link Text `Text`}.
     */
    function isText(e: Expression): e is Text {
        return utility.isValid(e) && e instanceof Text;
    }
    /**
     * Skips the parsing a number of consequtive blank lines on a `.ini` data format
     * @param {MutableLexer<any>} l a reference for a lexer
     * @param {Syntax} s a reference for a syntax
     * @param {Parser} p a reference for a parser
     * @param {Params} pa a reference for a Params
     * @returns {string} the lines that were skipped as a string
     */
    function skipBlankLines(l: MutableLexer<any>, s: Syntax, p: Parser, pa: Params) {
        let x = "";
        while(true) {
            if(p.match(EOL, l, s, pa))
            x += p.consume(EOL, l, s, pa).value;
            else if(p.match(WHITESPACE, l, s, pa))
            x += p.consume(WHITESPACE, l, s, pa).value;
            else break;
        }
        return x;
    }
    /**
     * Skips the parsing a number of consequtive whitespaces on a `.ini` data format
     * @param {MutableLexer<any>} l a reference for a lexer
     * @param {Syntax} s a reference for a syntax
     * @param {Parser} p a reference for a parser
     * @param {Params} pa a reference for a Params
     * @returns {string} the whitespaces that were skipped as a string
     */
    function skipWhiteSpace(l: MutableLexer<any>, s: Syntax, p: Parser, pa: Params) {
        let x = "";
        while(p.match(WHITESPACE, l, s, pa)) x += p.consume(WHITESPACE, l, s, pa).value;
        return x;
    }
    /**
     * Properly formats `.ini` comments to a string.
     * @param {MutableLexer<any>} l a reference for a lexer
     * @param {Syntax} s a reference for a syntax
     * @param {Parser} p a reference for a parser
     * @param {Params} pa a reference for a Params
     * @param {string} com any pre parsed comment(s) to which the results will be contatenated
     * @returns {string} all parsed comments as a `.ini` format string
     */
    function parseComment(l: MutableLexer<any>, s: Syntax, p: Parser, pa: Params, com: string): string {
        let c = com;
       while (true) {
            if(p.match(COMMENT, l, s, pa)) c += (p.consume(COMMENT, l, s, pa).value);
            else if(p.match(SECTION_START, l, s, pa)) c += (p.consume(SECTION_START, l, s, pa).value);
            else if(p.match(D_QUOTE, l, s, pa)) c += (p.consume(D_QUOTE, l, s, pa).value);
            else if(p.match(QUOTE, l, s, pa)) c += (p.consume(QUOTE, l, s, pa).value);
            else if(p.match(IDENTIFIER, l, s, pa)) c += (p.consume(IDENTIFIER, l, s, pa).value);
            else if(p.match(SUB_SECTION, l, s, pa)) c += (p.consume(SUB_SECTION, l, s, pa).value);
            else if(p.match(SECTION_END, l, s, pa)) c += (p.consume(SECTION_END, l, s, pa).value);
            else if(p.match(ASSIGNMENT, l, s, pa)) c += (p.consume(ASSIGNMENT, l, s, pa).value);
            else if(p.match(D_QUOTE_END, l, s, pa)) c += (p.consume(D_QUOTE_END, l, s, pa).value);
            else if(p.match(QUOTE_END, l, s, pa)) c += (p.consume(QUOTE_END, l, s, pa).value);
            else if(p.match(ESCAPE, l, s, pa)) c += (p.consume(ESCAPE, l, s, pa).value);
            else if(p.match(ESCAPED, l, s, pa)) c += (p.consume(ESCAPED, l, s, pa).value);
            else if(p.match(WHITESPACE, l, s, pa)) c += (p.consume(WHITESPACE, l, s, pa).value);
            else if(p.match(EOL, l, s, pa) || p.match(EOF, l, s, pa)) break;
        }
        return c;
    }
    /**
     * Constructs a comment object to be used for an expression
     * @param {readonly string[]} preceding the preceding (possibly clock) comments
     * @param {string} inline the inline comments
     * @returns {{preceding: readonly string[], inline: string}} a properly constructed expression comment object
     */
    function comments(preceding = Object.freeze(Array<string>()), inline: string = "") {
        return {preceding, inline}
    }
    /**
     * Returns a default empty comment object
     * @returns {{preceding: readonly string[], inline: string}} a empty constructed expression comment object
     */
    function emptyComment() {
        return comments();
    }
    /**
     * Creates a `.ini` string by concatenating and formatting the argument to a `string`.
     * @param {Token[]} t a liste of tokens to be concatenated
     * @returns {string} a formatted `.ini` string
     */
    function mergeTokens(t: Token[]): string{
        // return t.reduce((lexeme: string, tk: Token) => lexeme + tk.value, "");
        let text = "";
        for (let i = 0; i < t.length; i++) {
            text += t[i].value;
        }
        return text;
    }
    /**
     * @summary A builder for a {@link Syntax `Syntax`}
     * @description
     * An object that builds a proper `Syntax` object and attempts to prevent ambiguity of `Syntax` during the process. It is strongly recommended that `Syntax` objects be created using this
     * builder as certain bugs that would otherwise exists will be detectied in by this class e.g, a using a character as a {@link Syntax.nesting.chars nesting operator} and as a
     * {@link Syntax.delimiters delimiter}\
     * \
     * The `Syntax` returned is readonly and may not be modified in any way. This includes it's properties. Any modification attempt made will either not hasve any effect or will throw an error.\
     * \
     * The following is the default object created by this builder when {@linkcode SyntaxBuilder.build} is called without any changes to the builder:
     * @example
     * ```js
     * {
     *   comments: {
     *     retain: true,
     *     chars: [';', '#'],
     *     inline: true
     *   },
     *   duplicateDirective: {
     *     section: DuplicateDirective.MERGE,
     *     property: DuplicateDirective.MERGE
     *   },
     *   delimiters: [':', '='],
     *   sectionOperators: ['[', ']'],
     *   nesting: {
     *     chars: ['.', '/'],
     *     relative: true
     *   },
     *   escape: {
     *     char: '\\',
     *     quoted: true,
     *     nonQuotedEsc: false,
     *     isSpecial: s => ["\n", "\r", "\"", "'"].indexOf(s) >= 0 || this.sectionOperators.indexOf(s) >= 0 || this.comments.chars.indexOf(s) >= 0 || this._del.indexOf(s) >= 0 || this.escape.char === s;
     *     parse: s => {}//very long implementation here
     *   },
     *   parse: v => v.length > 0 ? v : null
     * }
     * ```
     * @remark
     * Whenever 'syntax' is mentioned in the docs of this class, it refers to the final object that will be returned when {@link SyntaxBuilder.build `SyntaxBuilder.build`} is called.
     */
    export class SyntaxBuilder implements utility.Builder<Syntax> {
        /**Represent the comment part*/
        private _com: {retain: boolean, chars: string[], inline: boolean} = {retain: true, chars: [';', "#"], inline: true};
        /**the delimiters part*/
        private _del: string[] = [':', '='];
        /**The section operators where the first index is the section start and the next is the section end token */
        private _so = ["[", "]"] as [string, string];
        /**the duplicate directives for section and property respectively */
        private _dd = {section: DuplicateDirective.MERGE, property: DuplicateDirective.MERGE};
        /**A nullable section nesting part of a syntax*/
        private _nes?: {chars: string[], relative: boolean} = {chars: ['.', '/'], relative: true};
        /**A nullable escape part of a syntax*/
        private _esc?: {quoted: boolean, nonQuotedEsc: boolean, unicode: string[], char: string, isSpecial: (((s: string) => boolean) | string[]), parse: (e: string) => string}
            = {
                char: "\\",
                quoted: true,
                nonQuotedEsc: false,
                unicode: ['x', 'X', 'u', 'U'],
                isSpecial: null as any,
                parse: null as any
            };
            /**metadata part of a syntax*/
        private _md = {fileExt: "ini", isStandard: false, standard: "", mediaType: "text/plain, application/textedit, zz-application/zz-winassoc-ini"}
        /**the parser function of this syntax*/
        private _p: (v: string) => json.Value = (v: string) => v.length > 0 ? v : null;
        /**the infix array that hold a 2-length tuple of `parser.GType<string>` and `Command`
         * the default is `[]`
         * @defaultValue `[]`*/
        private _infCmdlets: [parser.GType<string>, Command][] = [];
        /**the prefix array that hold a 2-length tuple of `parser.GType<string>` and `Command`
         * the default is `[]`
         * @defaultValue `[]`*/
        private _preCmdlets: [parser.GType<string>, Command][] = [];
        /**the postfix array that hold a 2-length tuple of `parser.GType<string>` and `Command`
         * the default is `[]`
         * @defaultValue `[]`*/
        private _posCmdlets: [parser.GType<string>, Command][] = [];
        /**A function for getting the correct command based on the direction */
        private _getCmd = (d: parser.Direction, type: parser.GType<string>): Command | undefined => {
            switch (d) {
            case parser.Direction.PREFIX:
            default: {
                const x = this._preCmdlets.filter((x) => x[0].equals(type))[0];
                return x ? x[1] : undefined;
            }
            case parser.Direction.INFIX: {
                const x = this._infCmdlets.filter((x) => x[0].equals(type))[0];
                return x ? x[1] : undefined;
            }
            case parser.Direction.POSTFIX:
                const x = this._posCmdlets.filter((x) => x[0].equals(type))[0];
                return x ? x[1] : undefined;
            }
        };
        /**
         * A check used by setter methods of this class to ensure that the argument is not a value already assigned to another token.
         * @param {string} s the value to be checked
         * @param {any} truthy a value, when truthy, asserts that the first argument is a string has a length of 1
         * @returns {boolean}
         * @throws {Error} if any of the properties has the value of the argument or if the length of the argument is greater than 1 and the second argument is truthy
         */
        private _ensureUniqueness(s: string, truthy?: any): asserts s is string {
            if(!utility.isValid(s)) throw Error("undefined cannot be used");
            else if(typeof s !== "string" || (typeof s === "object" && !((s as String) instanceof String))) throw Error("only strings can be used");
            if(truthy && s.length > 1) throw Error("Only a single character is required");
            if(this._com!.chars.indexOf(s) >= 0)
            throw new Error(`${s} is not unique. It is used as a comment`); 
            if(this._so.indexOf(s) >= 0)
            throw new Error(`${s} is not unique. It is the section name operator`); 
            if(this._del.indexOf(s) >= 0)
            throw new Error(`${s} is not unique. It is used as a delimeter`); 
            if(utility.isValid(this._nes) && this._nes!.chars.indexOf(s) >= 0)
            throw new Error(`${s} is not unique. It is used as a nesting operator`); 
            if(utility.isValid(this._esc)) if(Array.isArray(this._esc!.isSpecial) && this._esc!.isSpecial.indexOf(s) >= 0)
            throw new Error(`${s} is not unique. It is a special character`); 
            if(utility.isValid(this._esc) && this._esc!.unicode.indexOf(s) >= 0)
            throw new Error(`${s} is not unique. It is used as a unicode prefix`); 
            if(utility.isValid(this._esc) && this._esc!.char === s)
            throw new Error(`${s} is not unique. It is used as the escape character`); 
        }
        /**
         * Constructs a `SyntaxBuilder`. This specifically compiles all the prefix and infix commands needed by the syntax
         */
        constructor(){
            this.addPrefixCommand(COMMENT, new ParseComment(parser.Direction.PREFIX));
            this.addPrefixCommand(EOL, new EndLine());//for blank line
            this.addPrefixCommand(ASSIGNMENT, new Assign(parser.Direction.PREFIX));//for lines that start with the assignment token
            this.addPrefixCommand(IDENTIFIER, new ParseText());
            this.addPrefixCommand(D_QUOTE, new ParseText());
            this.addPrefixCommand(QUOTE, new ParseText());
            this.addPrefixCommand(SECTION_START, new ParseSection());
            // this.addPrefixCommand(SUB_SECTION, new ParseSubSection());
            this.addPrefixCommand(SUB_SECTION, new ParseText());
            // this.addPrefixCommand(WHITESPACE, new ParseSpace());
            this.addPrefixCommand(INIT, new Initialize());
            this.addInfixCommand(COMMENT, new ParseComment(parser.Direction.INFIX));// for inline
            this.addInfixCommand(ASSIGNMENT, new Assign(parser.Direction.INFIX));
            this.addInfixCommand(EOL, new EndLine());
            // this.addInfixCommand(WHITESPACE, new ParseSpace());
        }
        /**
         * Removes support in the syntax for nesting in a section name by preventing setting of any of the {@link Syntax.nesting `Syntax.nesting`} properties.
         * After this method returns, calling {@link addNestingChar `addNestingChar`} or {@link supportRelativeNesting `supportRelativeNesting`}
         * will throw. Note that the `Syntax` built will have {@linkcode Syntax.nesting} as `undefined`.
         *
         * @returns {SyntaxBuilder} this same builder object for method chaining
         */
        public removeSupportForNesting() : SyntaxBuilder {
            this._nes = undefined;
            return this;
        }
        /**
         * Removes escape support for the syntax by preventing setting of any of the {@link Syntax.escape `Syntax.escape`} properties.
         * After this method returns, calling any of the following:
         * - {@link supportQuotedText `supportQuotedText`}
         * - {@link supportNonQuotedEscape `supportNonQuotedEscape`}
         * - {@link addUnicodeChar `addUnicodeChar`}
         * - {@link setEscapeChar `setEscapeChar`}
         * - {@link setIsSpecial `setIsSpecial`}
         * - {@link setEscapeParser `setEscapeParser`}
         * 
         * will throw. \
         * Note that the `Syntax` built will have {@linkcode Syntax.escape} as `undefined`.
         *
         * @returns {SyntaxBuilder} this same builder object for method chaining
         */
        public removeSupportForEscape() : SyntaxBuilder{
            this._esc = undefined;
            return this;
        }
        /**
         * Prevents a character -- that was previously configured (default or otherwise) to be a one of the values used as a token for starting a comment, block or inline -- from being used as a {@link Syntax.comments.chars comment character}.
         * @param {string} char the character to be removed from the syntax
         * @returns {SyntaxBuilder} this same builder object for method chaining
         * @see {@link addCommentChar `addCommentChar`}
         * @see {@linkcode Syntax.comments.chars}
         */
        public removeCommentChar(char: string) : SyntaxBuilder{
            // this._com!.chars = this._com!.chars.reduce((p, c) => c === char ? p : [...p, c], Array<string>());
            let ind = -1;
            for (let i = 0; i < this._com!.chars.length; i++) {
                if(this._com!.chars[i] === char) {ind = i; break;}
            }
            if(ind >= 0) this._com?.chars.splice(ind, 1);
            return this;
        }
        /**
         * Prevents a character -- that was previously configured (default or otherwise) to be a one of the values used as a token for delimiting between keys and values -- from being used as a {@link Syntax.delimiters delimiter}.
         * @param {string} delim the character to be removed from the syntax
         * @returns {SyntaxBuilder} this same builder object for method chaining
         * @see {@link addDelimiter `addDelimiter`}
         * @see {@linkcode Syntax.delimiters}
         */
        public removeDelimiter(delim: string) : SyntaxBuilder{
            // this._del = this._del.reduce((p, c) => c === delim ? p : [...p, c], Array<string>());
            let ind = -1;
            for (let i = 0; i < this._del.length; i++) {
                if(this._del[i] === delim) {ind = i; break;}
            }
            if(ind >= 0) this._del.splice(ind, 1);
            return this;
        }
        /**
         * Prevents a character -- that was previously configured (default or otherwise) to be a one of the values used as a token for subsectioning -- from being used as a {@link Syntax.nesting.chars nesting operator}.
         * May do nothing if {@link removeSupportForNesting `removeSupportForNesting`} was called on this builder instance and {@link clear `clear`} (with no falsy argument)
         * or {@link rebuild `rebuild`} was not called after that and before this.
         * @param {string} char the character to be removed from the syntax
         * @returns {SyntaxBuilder} this same builder object for method chaining
         * @see {@link addNestingChar `addNestingChar`}
         * @see {@linkcode Syntax.nesting.chars}
         */
        public removeNestingChar(char: string) : SyntaxBuilder{
            // this._nes.chars = this._nes.chars.reduce((p, c) => c === char ? p : [...p, c], Array<string>());
            try {
                let ind = -1;
                for (let i = 0; i < this._nes!.chars.length; i++) {
                    if(this._nes!.chars[i] === char) {ind = i; break;}
                }
                if(ind >= 0) this._nes!.chars.splice(ind, 1);
            } catch (e) {}
            return this;
        }
        /**
         * Prevents a character -- that was previously configured (default or otherwise) to be a one of the values used as a token for specifying unicode characters -- from being used as a {@link Syntax.escape.unicode unicode character}.
         * May do nothing if {@link removeSupportForEscape `removeSupportForEscape`} was called on this builder instance and {@link clear `clear`} (with no falsy argument)
         * or {@link rebuild `rebuild`} was not called after that and before this.
         * @param {string} char the character to be removed from the syntax
         * @returns {SyntaxBuilder} this same builder object for method chaining
         * @see {@link addUnicodeChar `addUnicodeChar`}
         * @see {@linkcode Syntax.escape.unicode}
         */
        public removeUnicodeChar(char: string) : SyntaxBuilder{
            try {
                // this._esc!.unicode = this._esc!.unicode.reduce((p, c) => c === char ? p : [...p, c], Array<string>());
                let ind = -1;
                for (let i = 0; i < this._esc!.unicode.length; i++) {
                    if(this._esc!.unicode[i] === char) {ind = i; break;}
                }
                if(ind >= 0) this._esc!.unicode.splice(ind, 1);
            }catch(e) {}
            return this;
        }
        /**
         * Enables support for the string argument to be used as a {@linkcode Syntax.comments} character. This means that when
         * the syntax is built, it will allow this value to be used to as a token to start block and inline comments.
         * @param {string} char the value to be added. It is expected to be a single character not used anywhere else in this builder
         * @returns {SyntaxBuilder} this same builder object for method chaining
         * @throws {Error} if the argument assigned to another token elsewhere in this builder
         * @see {@link removeCommentChar `removeCommentChar`}
         * @see {@linkcode Syntax.comments.chars}
         */
        public addCommentChar(char: string): SyntaxBuilder{
            this._ensureUniqueness(char, true);
            this._com.chars.push(char);
            return this;
        }
        /**
         * Enables support for the string argument to be used as a {@linkcode Syntax.delimiters} character. This means that when
         * the syntax is built, it will allow this value to be used to as a token to delimit keys from values.
         * @param {string} delim the value to be added. It is expected to be a single character not used anywhere else in this builder
         * @returns {SyntaxBuilder} this same builder object for method chaining
         * @throws {Error} if the argument assigned to another token elsewhere in this builder
         * @see {@link removeDelimiter `removeDelimiter`}
         * @see {@linkcode Syntax.delimiters}
         */
        public addDelimiter(delim: string): SyntaxBuilder{
            this._ensureUniqueness(delim, true);
            this._del.push(delim);
            return this;
        }
        /**
         * Enables support for the string argument to be used as a {@linkcode Syntax.nesting.chars} character. This means that when
         * the syntax is built, it will allow this value to be used to as a token delimit subsections in a section declaration.\
         * May do nothing if {@link removeSupportForNesting `removeSupportForNesting`} was called on this builder instance and {@link clear `clear`} (with no falsy argument)
         * or {@link rebuild `rebuild`} was not called after that and before this.
         * @param {string} char the value to be added. It is expected to be a single character not used anywhere else in this builder
         * @returns {SyntaxBuilder} this same builder object for method chaining
         * @throws {Error} if the argument assigned to another token elsewhere in this builder
         * @see {@link removeNestingChar `removeNestingChar`}
         * @see {@linkcode Syntax.nesting.chars}
         */
        public addNestingChar(char: string): SyntaxBuilder{
            this._ensureUniqueness(char, true);
            try {
                this._nes!.chars.push(char);
            } catch (e) {}
            return this;
        }
        /**
         * Enables support for the string argument to be used as a {@linkcode Syntax.escape.unicode} character. This means that when
         * the syntax is built, it will allow this value to be used to as a token to specify that an escape is a unicode escape.\
         * May do nothing if {@link removeSupportForEscape `removeSupportForEscape`} was called on this builder instance and {@link clear `clear`} (with no falsy argument)
         * or {@link rebuild `rebuild`} was not called after that and before this.
         * @param {string} char the value to be added. It is expected to be a single character not used anywhere else in this builder
         * @returns {SyntaxBuilder} this same builder object for method chaining
         * @throws {Error} if the argument assigned to another token elsewhere in this builder
         * @see {@link removeUnicodeChar `removeUnicodeChar`}
         * @see {@linkcode Syntax.escape.unicode}
         */
        public addUnicodeChar(char: string): SyntaxBuilder{
            this._ensureUniqueness(char, true);
            try {
                this._esc?.unicode.push(char);
            } catch (e) {}
            return this;
        }
        /**
         * Retains and allows comments to be formatted during formatting.
         * @param {boolean} b `true` to retain comments `false` otherwise
         * @defaultValue `true`
         * @default {true}
         * @returns {SyntaxBuilder} this same builder object for method chaining
         * @see {@linkcode Syntax.comments.retain}
         */
        public retainComments(b: boolean) : SyntaxBuilder{
            this._com.retain = b;
            return this;
        }
        /**
         * Allows or disallows support for non-quoted text to have escaped characters/unicode
         * @param {boolean} b `true` to allow escape for non-quoted text `false` otherwise
         * @defaultValue `false`
         * @default {false}
         * @returns {SyntaxBuilder} this same builder object for method chaining
         * @throws if {@link removeSupportForEscape `removeSupportForEscape`} was called on this builder instance and {@link clear `clear`} (with no falsy argument)
         * or {@link rebuild `rebuild`} was not called after that and before this.
         * @see {@linkcode Syntax.escape.nonQuotedEsc}
         */
        public supportNonQuotedEscape(b: boolean): SyntaxBuilder {
            try {
                this._esc!.nonQuotedEsc = b;
            } catch(e: any) {
                throw new Error("Escape object is undefined for this builder", e);
            }
            return this;
        }
        /**
         * Allows or disallows support for inline comments
         * @param {boolean} b `true` to allow inline comments `false` otherwise
         * @defaultValue `true`
         * @default {true}
         * @returns {SyntaxBuilder} this same builder object for method chaining
         * @see {@linkcode Syntax.comments.inline}
         */
        public supportInline(b: boolean) : SyntaxBuilder{
            this._com.inline = b;
            return this;
        }
        /**
         * Allows or disallows support for relative nesting within a section declaration
         * @param {boolean} b `true` to allow relative nesting `false` otherwise
         * @defaultValue `true`
         * @default {true}
         * @returns {SyntaxBuilder} this same builder object for method chaining
         * @throws if {@link removeSupportForNesting `removeSupportForNesting`} was called on this builder instance and {@link clear `clear`} (with no falsy argument)
         * or {@link rebuild `rebuild`} was not called after that and before this.
         * @see {@linkcode Syntax.nesting.relative}
         */
        public supportRelativeNesting(b: boolean) : SyntaxBuilder{
            try {
                this._nes!.relative = b;
            } catch (e) {
                throw Error("Nesting object is undefined for this builder");
            }
            return this;
        }
        // public setGlobalName(g: string) : SyntaxBuilder{
        //     this._ensureUniqueness(g);
        //     this._glo = g;
        //     return this;
        // }
        /**
         * Allows or disallows support for quoted text
         * @param {boolean} b `true` to allow quoted text `false` will parse quotes and duouble quotes along with the text.
         * @defaultValue `true`
         * @default {true}
         * @returns {SyntaxBuilder} this same builder object for method chaining
         * @throws if {@link removeSupportForEscape `removeSupportForEscape`} was called on this builder instance and {@link clear `clear`} (with no falsy argument)
         * or {@link rebuild `rebuild`} was not called after that and before this.
         * @see {@linkcode Syntax.escape.quoted}
         */
        public supportQuotedText(b: boolean) : SyntaxBuilder{
            try {
                this._esc!.quoted = b;
            } catch(e: any) {
                throw new Error("Escape object is undefined for this builder", e);
            }
            return this;
        }
        /**
         * Sets the character used for {@link Syntax.escape.char `escaping`}.
         * @param {string} char the value to be used for escaping
         * @defaultValue `'\\'`
         * @default {'\\'}
         * @returns {SyntaxBuilder} this same builder object for method chaining
         * @throws if {@link removeSupportForEscape `removeSupportForEscape`} was called on this builder instance and {@link clear `clear`} (with no falsy argument)
         * or {@link rebuild `rebuild`} was not called after that and before this.
         * @throws {Error} if the argument has been assigned to another token in this builder
         * @see {@linkcode Syntax.escape.char}
         */
        public setEscapeChar(char: string) : SyntaxBuilder{
            this._ensureUniqueness(char, true);
            try {
                this._esc!.char = char;
            } catch(e: any) {
                throw new Error("Escape object is undefined for this builder", e);
            }
            return this;
        }
        /**
         * Sets the function that will parse escapes. See class declaration doc for the default.
         * @param {(esc: string) => string} p a non-null value that is a function with a single string argument that returns a string
         * @returns {SyntaxBuilder} this same builder object for method chaining
         * @throws if {@link removeSupportForEscape `removeSupportForEscape`} was called on this builder instance and {@link clear `clear`} (with no falsy argument)
         * or {@link rebuild `rebuild`} was not called after that and before this.
         * @see {@linkcode Syntax.escape.parse}
         */
        public setEscapeParser(p: (e: string) => string) : SyntaxBuilder{
            try {
                this._esc!.parse = p??this._esc!.parse;
            } catch (e) {
                throw Error("Escape object is undefined for this Builder");
            }
            return this;
        }
        /**
         * Sets the function that will format text. Will not set anything if the argument is `null` or `undefined`.
         * @param {(esc: string) => json.Value} p a non-null value that is a function with a single string argument that returns a `json.Value` type.
         * @returns {SyntaxBuilder} this same builder object for method chaining
         * @see {@linkcode Syntax.parse}
         */
        public setFormatParser(p: (v: string) => json.Value) : SyntaxBuilder{
            this._p = p??this._p;
            return this;
        }
        /**
         * Sets the {@linkplain Syntax.duplicateDirective} for properties and/or sections. See calss declaration docs for the defaults.
         * @param {DuplicateDirective} dd a non-null {@linkcode DuplicateDirective} value
         * @param {boolean | undefined} forProperty a value when `undefined` sets both the section and property to the first argument
         * else if it is `true` set for the property only while `false` sets for the section only.
         * @returns {SyntaxBuilder} this same builder object for method chaining
         * @see {@linkcode Syntax.duplicateDirective}
         */
        public setDuplicateDirective(dd: DuplicateDirective, forProperty?: boolean): SyntaxBuilder {
            if(utility.isValid(forProperty)) {
                if(forProperty) this._dd.property = dd;
                else this._dd.section = dd;
            } else {
                this._dd.property = dd??this._dd.property;
                this._dd.section = dd??this._dd.section;
            }
            return this;
        }
        /**
         * Attempts to push the second and third argument into the given array. If the non-array arguments already exist in the array, then an overwrite operation is performed.
         * @param {[parser.GType<string>, Command][]} map an array for type/command tuples
         * @param { parser.GType<string>} t the type to be added to the array
         * @param {Command} cmd the command to be added with the type
         * @returns {void} does not return anything
         */
        private _pushOrOverite(map: [parser.GType<string>, Command][], t: parser.GType<string>, cmd: Command): void{
          for (let i = 0; i < map.length; i++)
            if(map[i][0].equals(t)) {
              map[i] = [t, cmd];
              return;
            }
          map.push([t, cmd]);
        }
        /**
         * @summary registers an infix {@link Command}
         * @description
         * Registers a {@link parser.GType<string>} (which is compatible with infix tokens) with the corresponding {@link Command} that can parse that `parser.GType<string>`.
         * This method should not be called more than once for the same `parser.GType<string>` as that would cause ambiguity on the built {@link Syntax `Syntax`}
         * object such that each query for a `Command` may have undefined behaviour, as such, consecutive calls of this method with the same `parser.GType<string>` invalidates
         * the previous call with that `parser.GType<string>`.
         * @remark
         * There are no defaults for infix commands, if there are not available by the time {@link build} is called the built `Syntax` will have no access to
         * infix `Command`s
         * @param {parser.GType<string>} type the type with which to query this command. This is expected to be a compatible infix type.
         * @param {Command} cmd the command which can parse infix tokens into {@link Expression expression(s)}
         * @returns {SyntaxBuilder} the same builder object for method chaining
         * @see parser.Syntax.getCommand
         */
        public addInfixCommand(type: parser.GType<string>, cmd: Command): SyntaxBuilder {
            // this._infCmdlets.push([type, cmd]);
            this._pushOrOverite(this._infCmdlets, type, cmd);
            return this;
        }
        /**
         * Removes the infix command registered with the given type
         * @param {parser.GType<string>} type the type of command to be removed
         * @returns {SyntaxBuilder} the same builder object for method chaining
         * @see addInfixCommand
         */
        public removeInfixCommand(type: parser.GType<string>): SyntaxBuilder {
            this._infCmdlets = this._infCmdlets.filter(v => !v[0].equals(type));
            return this;
        }
        /**
         * @summary registers a prefix {@link Command}
         * @description
         * Registers a {@link parser.GType<string>} (which is compatible with prefix tokens) with the corresponding {@link Command} that can parse that `parser.GType<string>`.
         * This method should not be called more than once for the same `parser.GType<string>` as that would cause ambiguity on the built {@link Syntax `Syntax`}
         * object such that each query for a `Command` may have undefined behaviour, as such, consecutive calls of this method with the same `parser.GType<string>` invalidates
         * the previous call with that `parser.GType<string>`.
         * @remark
         * There are no defaults for prefix commands, if there are not available by the time {@link build} is called the built `Syntax` will have no access to
         * prefix `Command`s
         * @param {parser.GType<string>} type the type with which to query this command. This is expected to be a compatible prefix type.
         * @param {Command} cmd the command which can parse prefix tokens into {@link Expression expression(s)}
         * @returns {SyntaxBuilder} the same builder object for method chaining
         * @see parser.Syntax.getCommand
         */
        public addPrefixCommand(type: parser.GType<string>, cmd: Command): SyntaxBuilder {
            // this._infCmdlets.push([type, cmd]);
            this._pushOrOverite(this._preCmdlets, type, cmd);
            return this;
        }
        /**
         * Removes the prefix command registered with the given type
         * @param {parser.GType<string>} type the type of command to be removed
         * @returns {SyntaxBuilder} the same builder object for method chaining
         * @see addPrefixCommand
         */
        public removePrefixCommand(type: parser.GType<string>): SyntaxBuilder {
            this._preCmdlets = this._preCmdlets.filter(v => !v[0].equals(type));
            return this;
        }
        /**
         * @summary registers a postfix {@link Command}
         * @description
         * Registers a {@link parser.GType<string>} (which is compatible with postfix tokens) with the corresponding {@link Command} that can parse that `parser.GType<string>`.
         * This method should not be called more than once for the same `parser.GType<string>` as that would cause ambiguity on the built {@link Syntax `Syntax`}
         * object such that each query for a `Command` may have undefined behaviour, as such, consecutive calls of this method with the same `parser.GType<string>` invalidates
         * the previous call with that `parser.GType<string>`.
         * @remark
         * Calling this method has no effect on the built `Syntax` as {@link Parser} does not support {@link parser.Direction.POSTFIX} therefore ignore this
         * method. \
         * \
         * There are no defaults for postfix commands, if there are not available by the time {@link build} is called the built `Syntax` will have no access to
         * postfix `Command`s
         * @param {parser.GType<string>} type the type with which to query this command. This is expected to be a compatible postfix type.
         * @param {Command} cmd the command which can parse postfix tokens into {@link Expression expression(s)}
         * @returns {SyntaxBuilder} the same builder object for method chaining
         * @see Syntax.getCommand
         */
        public addPostfixCommand(type: parser.GType<string>, cmd: Command): SyntaxBuilder {
            // this._infCmdlets.push([type, cmd]);
            this._pushOrOverite(this._posCmdlets, type, cmd);
            return this;
        }
        /**
         * Removes the postfix command registered with the given type. In practice, this method does nothing
         * @param {parser.GType<string>} type the type of command to be removed
         * @returns {SyntaxBuilder} the same builder object for method chaining
         * @see addPostfixCommand
         */
        public removePostfixCommand(type: parser.GType<string>): SyntaxBuilder {
            this._posCmdlets = this._posCmdlets.filter(v => !v[0].equals(type));
            return this;
        }
        /**
         * Sets the extension string associated with the syntax as specified by {@link `Syntax.metadata.fileExt`}
         * @remark
         * The default is `'ini'`.
         * @param {string} ext the file extension as a string. This should not have any trailing dot(s). An undefined or null value has no effect
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        public setFileExt(ext: string): SyntaxBuilder {
          this._md.fileExt = ext??this._md.fileExt;
          return this;
        }
        /**
         * Sets the {@link Syntax.metadata.isStandard isStandard property} in the syntax to be built.
         * @remark
         * The default is `false`.
         * @param {boolean} b `true` if the syntax is a web standard `false` if otherwise. A truthy value will be converted to a boolean.
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        public setIsStandard(b: boolean) : SyntaxBuilder {
          this._md.isStandard = !!b;
          return this;
        }
        /**
         * Sets the {@link Syntax.metadata.mediaType media type} associated with the data for which the syntax is being built.
         * @remark
         * The default is `'text/plain, application/textedit, zz-application/zz-winassoc-ini'`
         * @param {string} mediaType the MIME type for the syntax
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        public setMediaType(mediaType: string) : SyntaxBuilder {
          this._md.mediaType = mediaType??this._md.mediaType;
          return this;
        }
        /**
         * Sets the {@link Syntax.metadata.standard standard} associated with the data for which the syntax is being built.
         * The standard is a string associated with the media type, web specification, schema or syntax definition e.g a **R**equest **F**or **C**ommenid.t
         * @remark
         * The default is `''`
         * @param {string} standard a string representing the standard specification for the data that this syntax will be created for.
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        public setStandard(standard: string) : SyntaxBuilder {
          this._md.standard = standard??this._md.standard;
          return this;
        }
        /**
         * Sets the {@link Syntax.escape.isSpecial isSpecial property} in the syntax to be built.
         * @remark
         * The default is a function that returns `true` if the argument is the comment character, a {@link Syntax.sectionOperators section name operator}, a delimiter, the escape character or is one of the following: `'\r'`, `'\n'`, `'\''`, `'"'`.
         * @param {string[] | ((e: string) => boolean)} s an array of special characters or a function which returns `true` if a special character is the argument
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        public setIsSpecial(s: string[] | ((e: string) => boolean)): SyntaxBuilder {
            try {
                this._esc!.isSpecial = s;
            } catch (e) {
                throw Error("Escape object is undefined for this builder");
            }
            return this;
        }
        /**
         * Sets the first index of the {@link Syntax.sectionOperators `Syntax.sectionOperators`} array in the syntax to be built.
         * @remark
         * The default is a `[`.
         * @param {string} sectionStart  A single string used for starting the section name declaration of an `ini` section
         * @returns {SyntaxBuilder} the same builder object for method chaining
         * @throws {Error} throws if the argument is `undefined`, `null`, length > 0, is not a string or has been used elsewhere in this builder.
         */
        public setSectionStart(sectionStart: string) : SyntaxBuilder {
            this._ensureUniqueness(sectionStart, true);
            this._so[0] = sectionStart??this._so[0];
            return this;
        }
        /**
         * Sets the second index of the {@link Syntax.sectionOperators `Syntax.sectionOperators`} array in the syntax to be built.
         * @remark
         * The default is a `]`.
         * @param {string} sectionEnd A single string used for ending the section name declaration of an `ini` section
         * @returns {SyntaxBuilder} the same builder object for method chaining
         * @throws {Error} throws if the argument is `undefined`, `null`, length > 0, is not a string or has been used elsewhere in this builder.
         */
        public setSectionEnd(sectionEnd: string) : SyntaxBuilder {
            this._ensureUniqueness(sectionEnd);
            this._so[1] = sectionEnd??this._so[1];
            return this;
        }
        /**
         * Clears this builder of all the values set into it by either reseting to the default or completely wiping all values. If the latter is chosen then Every value has to manually set again or this might not build. 
         * @param toDefault `true` for a reset `false` for a complete wipe. This is an optional value that defaults to `true`.
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        public clear(toDefault = true): SyntaxBuilder {
            // this._glo = "";
            this._getCmd = (d: parser.Direction, type: parser.GType<string>): Command | undefined => {
                switch (d) {
                case parser.Direction.PREFIX:
                default: {
                    const x = this._preCmdlets.filter((x) => x[0].equals(type))[0];
                    return x ? x[1] : undefined;
                }
                case parser.Direction.INFIX: {
                    const x = this._infCmdlets.filter((x) => x[0].equals(type))[0];
                    return x ? x[1] : undefined;
                }
                case parser.Direction.POSTFIX:
                    const x = this._posCmdlets.filter((x) => x[0].equals(type))[0];
                    return x ? x[1] : undefined;
                }
            };
            if(toDefault) {
                this._md = {fileExt: "ini", isStandard: false, standard: "", mediaType: "text/plain, application/textedit, zz-application/zz-winassoc-ini"};
                this._com = {retain: true, chars: [';', "#"], inline: true};
                this._del = [':', '='];
                this._so = ['[', ']'];
                this._dd = {section: DuplicateDirective.MERGE, property: DuplicateDirective.MERGE};
                this._nes = {chars: ['.', '/'], relative: true};
                this._esc = {
                    char: "\\",
                    quoted: true,
                    nonQuotedEsc: false,
                    unicode: ['x', 'u'],
                    isSpecial: null as any,
                    parse(e: string) {
                        let esc = e[1];
                        switch(e){
                            case "\\":
                            case "'":
                            case "\"":
                            case ";":
                            case "#":
                            case "=":
                            case ".":
                            case "/":return e.length === 2 ? esc : e
                            case "\n":
                            case "n": return e.length === 2 ? "\n" : e;
                            case "x":
                            case "u":{
                                const code = e.substring(2);
                                if(code.length > 4 || !(/^[A-Fa-f-0-9]$/.test(code))) return e;
                                return String.fromCodePoint(Number.parseInt(code));
                            }
                            case "0": return "\0";
                            case "a": return "\a";
                            case "b": return "\b";
                            case "t": return "\t"
                            case "r": return "\r"
                            case "f": return "\f"
                            case " ": return " "
                            default:
                        }
                        return e;
                    }
                };
                this._p = (v: string) => v.length > 0 ? v : null;
            } else {
                this._md = {fileExt: "", isStandard: false, standard: "", mediaType: ""};
                this._dd = {section: DuplicateDirective.THROW, property: DuplicateDirective.THROW};
                this._del = [];
                this._so = [undefined as any, undefined as any];
                this._com = {retain: false, chars: [], inline: false};
                this._nes = undefined;
                this._esc = undefined;
                this._p = (v: string) => v;
            }
            return this;
        }
        /**
         * @inheritdoc
         * @returns {Syntax}
         */
        public build(): Syntax {
            if(utility.isValid(this._esc)){
                if(this._esc!.nonQuotedEsc)
                    this.addPrefixCommand(ESCAPE, new ParseText/*ParseInitialEscape*/());
                if(!utility.isValid(this._esc!.isSpecial))
                    this._esc!.isSpecial = (s: string) => ["\n", "\r", "\"", "'"].indexOf(s) >= 0 || this._so.indexOf(s) >= 0 || this._com.chars.indexOf(s) >= 0 || this._del.indexOf(s) >= 0 || this._esc!.char === s;
                if(!utility.isValid(this._esc!.parse))
                    this._esc!.parse = (e: string) => {
                        let esc = e[1];
                        switch(esc){
                            case "\\":
                            case "'":
                            case '"':return e.length === 2 ? esc : e
                            case "\n":
                            case "n": return e.length === 2 ? "\n" : e;
                            case "0":
                                return "\0";
                            case "a": return "\a";
                            case "b": return "\b";
                            case "t": return "\t"
                            case "r": return "\r"
                            default:
                        }
                        if(this._com.chars.indexOf(esc) && e.length === 2) return esc;
                        else if(this._del.indexOf(esc) && e.length === 2) return esc;
                        else if(this._so.indexOf(esc) && e.length === 2) return esc;
                        else if(utility.isValid(this._nes) && this._nes!.chars.indexOf(esc) && e.length === 2) return esc;
                        else if(this._esc!.unicode.indexOf(esc) >= 0) {
                            const code = e.substring(2);
                            if(code.length > 4 || !(/^[A-Fa-f-0-9]+$/.test(code))) return e;
                            return String.fromCodePoint(Number.parseInt(code, 16));
                        }
                        return e;
                    }
            }
            return Object.freeze({
                metadata: {...this._md, encoding: "utf-8"},
                comments: {
                    ...this._com!,
                    chars: Object.freeze(this._com!.chars)
                },
                delimiters: Object.freeze(this._del),
                sectionOperators: Object.freeze(this._so),
                nesting: utility.isValid(this._nes) ? {...this._nes!, chars: Object.freeze(this._nes!.chars)} : undefined,
                duplicateDirective: Object.freeze(this._dd),
                escape: utility.isValid(this._esc) ? {...this._esc!, unicode: Object.freeze(this._esc!.unicode)} : undefined,
                parse: this._p,
                getCommand: this._getCmd
            }) as Syntax;
        }
        //Note that the 'encoding' property will not be copied
        //none of the copied property are type-checked or checked for compatibility
        //all null and undefined properties will be replaced by an empty vallue as an empty array or string
        //the arg 'from' cannot be null or undefined or this will throw
        /**
         * @summary assigns all values from the syntax argument to the properties of this builder.
         * @remark
         * Note that the
         * - `encoding` property will not be copied
         * - none of the copied property are type-checked or checked for compatibility
         * - all null and undefined properties will be replaced by an empty vallue as an empty array or string
         * - the argument `from` cannot be `null` or `undefined` or this will throw
         * @param {Syntax} from the syntax from which this builder will be built
         * @returns {SyntaxBuilder} the same builder object for method chaining
         * @throws {TypeError} if the argument is not a valud object
         */
        public rebuild(from: Syntax): SyntaxBuilder {
            if(!utility.isValid(from)) throw new Error("undefined not allowed here")
            //metadata
            this._md.fileExt = (from.metadata??{fileExt: ""}).fileExt;
            this._md.isStandard = (from.metadata??{isStandard: false}).isStandard;
            this._md.mediaType = (from.metadata??{mediaType: ""}).mediaType;
            this._md.standard = (from.metadata??{standard: ""}).standard;
            
            //comments
            this._com.chars = [...(from.comments??{chars: []}).chars];
            this._com.retain = (from.comments??{retain: false}).retain;
            this._com.inline = (from.comments??{inline: false}).inline;
            
            //escape
            (this._esc ??= {} as any).nonQuotedEsc = (from.escape??{nonQuotedEsc: false}).nonQuotedEsc;
            (this._esc ??= {} as any).quoted = (from.escape??{quoted: false}).quoted;
            (this._esc ??= {} as any).char = (from.escape??{char: ""}).char;
            (this._esc ??= {} as any).unicode = [...(from.escape??{unicode: []}).unicode];
            (this._esc ??= {} as any).isSpecial = (from.escape??{isSpecial: []}).isSpecial;
            (this._esc ??= {} as any).parse = (from.escape??{parse: (s: string) => s}).parse;

            //nesting
            (this._nes ??= {} as any).chars = [...(from.nesting??{chars: []}).chars];
            (this._nes ??= {} as any).relative = (from.nesting??{relative: false}).relative;

            //delimiters
            this._del = [...from.delimiters] as typeof this._del;

            //section operators
            this._so = [...from.sectionOperators];

            //duplicate directive
            this._dd = {...from.duplicateDirective};

            this._p = from.parse;
            this._getCmd = from.getCommand;
            return this;
        }
    }
    /**
     * @summary Defines how an ini data format is parsed.
     * @description
     * A specialized `.ini` data extension of the {@linkcode parser.Syntax} interface that defines the
     * `.ini` syntax that this pipeline uses. This can also be used to create a syntax for `.proprties` data format. \
     * \
     * Because of the complex nature of the `Syntax` interface (and all it's responsibilities), it is recommended
     * that users instantiate it through the use of the {@linkcode SyntaxBuilder} class, as there are checks that exist in
     * `SyntaxBuilder` that may prevent instantiating an invalid `Syntax` object.
     */
    export interface Syntax extends parser.GSyntax<Type, Command> {
        /**
         * An object that specifies how comments are parsed
         */
        readonly comments: {
            /**
             * A check that specifies whether to store comments. If `true`, comments can be found in the {@link Expression} it precedes
             * @type {boolean}
             * @readonly
             */
            readonly retain: boolean,
            /**
             * The single characters that starts an inline comment. For example [pacman.conf](https://archlinux.org/pacman/pacman.conf.5.html) uses the `'#'` character, windows uses the `';'` character
             * and [apache commons configuration api](https://commons.apache.org/proper/commons-configuration/apidocs/org/apache/commons/configuration2/INIConfiguration.html) supports both
             */
            readonly chars: readonly string[]
            /**
             * Enables support for inline comments where a comment may exit on any line. A `false` value ensures that all comments are the only tokens on a line. For example:
             * a `true` value enables parsing of:
             * ```ini
             * ; a comment on it's own line
             * [section]
             * name = value
             * another = anotherValue ; an inline comment
             * ```
             * but a `false` will cause the parser to add the inline comment as part of the property `another`'s value i.e `anotherValue ; an inline comment` will be regarded as a single value, hence
             * all comments must occur on lines by themslves.
             */
            readonly inline: boolean;
        };
        /**Specifies how the parser will handle sections and properties with duplicate names*/
        readonly duplicateDirective: {
            /**For duplicate section names*/
            readonly section: DuplicateDirective,
            /**For duplicate property names */
            readonly property: DuplicateDirective
        };
        /**
         * The characters used for delimiting a name from it's value within a property. As an example, most ini file use:
         * ```ini
         * [section]
         * name1 = value1
         * name2 = value2
         * ; ... and so on
         * ```
         * but some may use
         * ```txt
         * [section]
         * name1 : value1
         * name2 : value2
         * ; ... and so on
         * ```
         * and some supports both syntax such that
         * ```txt
         * [section]
         * name1 : = value1
         * name2 = : value2
         * ; ... and so on
         * ```
         * is a valid syntax
         * @type {string[]}
         * @readonly
         */
        readonly delimiters: readonly string[];
        /**
         * A 2-length tuple that specifies the operators used for starting and ending a section identifier. For instance, vanilla `ini` uses `[sectionName]`, hence the first index contains `[` and the second contains `]`.
         * @type {[string, string]}
         * @readonly
         */
        readonly sectionOperators: readonly [string, string];
        /**If this is `null` or `undefined`, nesting is not considered, else if it is in a quoted string, then it must be escaped or an error is thrown */
        readonly nesting?: {
            /**
             * All the characters used for delimiting child sections from their parent
             * @type {string[]}
             * @readonly
             */
            readonly chars: readonly string[],
            /**
             * Allows for a syntax that uses nesting chars at the start of a section name e.g `[.section]`. A `false`value will parse `[.section]` as a single
             * section name disregarding the "parent" section and will only assign a section as a child of another if it is written as `'[section.subsection]'`.
             * @type {boolean}
             * @readonly
             */
            readonly relative: boolean
        };
        /**An object that specifies how escaped sequences are parsed. If `undefined` or `null`, then no escape will be supported */
        readonly escape?: {
            /**
             * Allows quoted values to be used to escape whitespaces and special characters. A single or double quotes can be used but a quoted text must be
             * enclosed with the same quote type i.e single quoted text can only strt with single quote and end with single quote, the same for double quote.
             * @type {boolean}
             * @readonly
             */
            readonly quoted: boolean;
            /**
             * Allows support for esc that are allowed for non quoted text e.g in `.properties` files
             * @type {boolean}
             * @readonly
             */
            readonly nonQuotedEsc: boolean;
            /**
             * The characters, when placed after an {@link Syntax.escape.char escape character} tells the parser that a unicode hex literal follows.
             * The standard values includes `'u'` and `'x'` such that `'\u20'` and `'\x20'` are equal. This enables the ini parser to be compatible
             * with properties documents.
             * @type {string}
             * @readonly
             */
            readonly unicode: readonly string[],
            /**
             * The single character `string` used for escaping special and escapable characters. A list of escapable characters include:
             * |Character|Standard escaped meaning|Standard unescaped meaning|
             * |---|:---:|:---:|
             * |`\`|A single backslash|Used as the escaped character to escape the character that comes after it|
             * |`'`|An apostrophe|1 of 2 characters used for quoting property names/values to enable embeding of escapable characters in the name/values without being explicitly being escaped|
             * |`"`|Double quotes|1 of 2 characters used for quoting property names/values to enable embeding of escapable characters in the name/values without being explicitly being escaped|
             * |`0`|ascii null character `\u0000`|The digit `0`|
             * |`a`|Bell/Alert/Audible|the letter `'a'`|
             * |`b`|Backspace, Bell for some applications|the letter `'b'`|
             * |`t`|tab|the letter `'t'`|
             * |`r`|Carriage return|the letter `'r'`|
             * |`n`|Line feed|the letter `'n'`|
             * |`;`|Semicolon|the start of a comment|
             * |`#`|Number sign|the start of a comment|
             * |`=`|Equals sign|Operator that assigns a value to a property|
             * |`:`|Colon|Operator that assigns a value to a property|
             * |`x????`|A unicode character whose hex representation is `????`|As is|
             * 
             * @type {string}
             * @readonly
             */
            readonly char: string,
            /**
             * An array of strings where each character must be escaped for it to be used in a text especially none-quoted text. This can also be a function where the argument returns `true` if it must be escaped in a text
             * @type {string}
             * @readonly
             */
            readonly isSpecial: readonly string[] | ((e: string) => boolean);
            /**
             * Parses the 2-length string (and if the `unicode` property has at least 1 element, parses unicode escapes as well such as `\x20`) and returns an appropriate string for an escaped character
             * @param esc a 2-length string given as the escape character, and the character it escapes
             * @returns {string} a `string` which is defined as the in-memory representation of the argument
             */
            parse(esc: string): string
        }
        /**
         * User defined parsing of a property's value to determine the json data type. This enables users to define the in-memory data type they want for a specific
         * value
         * @remark
         * This is only for the value part of a property.
         * @param value a property value
         * @returns {json.Value} the in-memory data to be associated with the argument.
         */
        parse(value: string): json.Value;
    }
    /**
     * @summary An object that holds variables for the parsing process.
     * 
     * @description A mutable visitor object used by the {@linkcode Parser} as a container for variables,
     * 'a notice board' for the {@link Format formatter}. It is used by the formatter as a container object for
     * reading neccessary values that give information about the parsing process. For example,
     * during parsing, this object can specify if the parser is on the left or right side of an assingment.
     */
    export class Params {
        /**
         * The current section's name i.e the name of a property of {@link global} that was last parsed
         * @type {string}
         */
        section: string[] = [];
        /**An array of strings representing the most recent consecutive line of comments parsed. This value is empty the moment a {@link Section} or {@link Property} is parsed. */
        block = Array<string>();
        /**The most recent parsed inline comments as a `string`. This value is reset every time a new section, text or property is parsed */
        inline: string = "";
        /**Defines themost recent state of the parser when parsing inside of a section name as a `boolean` */
        insideSecName = false;
        /**Specifies whether or not an assignment of a value to a key/name has been done */
        assigned = false;
    }
    /**
     * A concrete implementation of the {@link parser.GType `GType`}
     */
    class Type implements parser.GType<string> {
        /**
         * Constructs a `Type` with an assigned unique id and precedence.
         * @param {string} id a unique id associated with this {@link parser.Type}
         * @param {number} precedence the precedence of this type. This determines how it will be evaluated in the evaluation hierarchy (per se)
         */
        public constructor(
          public readonly id: string,
          public readonly precedence: number
        ) {}
    
        /**
         * Test the equality of this `Type` to the given input
         * @param {(object|undefined)} obj any object to test against `this`
         * @returns {boolean} `true` if `this` is equal to the input and `false` if otherwise.
         */
        public equals(obj?: object): boolean {
          if (obj instanceof Type)
            return this.id === obj.id && this.precedence === obj.precedence;
          return false;
        }
    }
    /**
     * The type used for end-of-file tokens.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const EOF: parser.GType<string> = new Type("-1", Number.MIN_SAFE_INTEGER);
    /**
     * The type used for end-of-line tokens.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const EOL: parser.GType<string> = new Type("0", 1);
    /**
     * The type used for tokens that start a section's name. Used to signify the start of a section declaration.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const SECTION_START: parser.GType<string> = new Type("1", 2);
    /**
     * The type used for single quote tokens.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const QUOTE: parser.GType<string> = new Type("2", 5);
    /**
     * The type used for double quote tokens.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const D_QUOTE: parser.GType<string> = new Type("3", 5);
    /**
     * The type used for text tokens such as section names, keys and values.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const IDENTIFIER: parser.GType<string> = new Type("4", 5);
    /**
     * The type used for delimiting section names to show section nesting.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const SUB_SECTION: parser.GType<string> = new Type("5", 3);
    /**
     * The type used for ending a section declaraction.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const SECTION_END: parser.GType<string> = new Type("6", 1);
    /**
     * The type used for tokens that delimit between keys and their values.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const ASSIGNMENT: parser.GType<string> = new Type("7", 3);//Does not matter the precedence it has will will always be parsed with the `parse(0)` So it will be parsed as long as it's precedence is greater than 0
    /**
     * The type used for the comment tokens.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const COMMENT: parser.GType<string> = new Type("8", 0);
    /**
     * The type used for single quote tokens that end an identifier when the same identifier was declared begining with a single quote.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const QUOTE_END: parser.GType<string> = new Type("9", 5);
    /**
     * The type used for double quotes tokens that end an identifier when the same identifier was declared begining with a double quotes.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const D_QUOTE_END: parser.GType<string> = new Type("10", 5);
    /**
     * The type used for escape tokens.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const ESCAPE: parser.GType<string> = new Type("11", 5);
    /**
     * The type used for tokens preceded by the escape token.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const ESCAPED: parser.GType<string> = new Type("12", 5);
    /**
     * The type used for whitespace tokens.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const WHITESPACE: parser.GType<string> = new Type("13", 1);
    /**
     * A special type that creates the global section where unamed properties and all sections are stored.
     * There will always be at most one token with this type in every given lexer.
     * @type {parser.GType<string>}
     * @constant
     * @readonly
     */
    export const INIT: parser.GType<string> = new Type("14", Number.MAX_SAFE_INTEGER);
    /**
     * @summary An object representing a valid lexeme in a `.ini` data format.
     * @description
     * A `Token` is concrete implementation of the {@link parser.GToken} interface where each token maps to a one or more lexeme in `.ini` data.
     * A token contains all the data that helps describe it's payload's distinction in a data. It represents a string of characters that individually
     * represent a logical portion of an ini document. Although each {@link Token.value value} is unique, there are expected to be 16 types of token
     * and accounted for in this documentation.
     */
    class Token implements parser.GToken<string> {
        /**
         * The length of a token
         * @type {number}
         * @readonly
         * @constant
         */
        public readonly length;
        /**
         * Constructs a `Token`, giving details such as the line and position (within the data format) from which it was formed
         * @param {string} value the payload of this token containing the actual value of the data it carries
         * @param {Type} type the type of the token. This is the main determinant of a token that differentiates one from another
         * @param {number} lineStart the line within the data format that this token was assembled from
         * @param {number} lineEnd the line within the data format that this token was assembled from
         * @param {number} startPos the position within the line from which this token was assembled.
         */
        constructor(
            public readonly value: string,
            public readonly type: Type,
            public readonly lineStart: number,
            public readonly lineEnd: number,
            public readonly startPos: number
        ){
            this.length = value.length;
        }
        /**
         * Test if the argument is the same `Token` object as `this`.
         * @param {object | undefined} obj 
         * @returns {boolean} `true` if the argument is a `Token` and is the same type, is in the same line, position as `this`. 
         */
        equals(obj?: object | undefined): boolean {
          if(obj instanceof Token)
          return (this.lineStart == obj.lineStart && this.lineEnd == obj.lineEnd && this.startPos === obj.startPos
          && this.type.equals(obj.type));
          return false;
        }
        /**
         * Returns the hascode of this `Token`
         * @returns {number} the hashcode of this token
         */
        hashCode32(): number {
          return utility.hashCode32(true, utility.asHashable(this.value), utility.asHashable(this.type.id), utility.asHashable(this.type.precedence), utility.asHashable(this.startPos), utility.asHashable(this.lineEnd), utility.asHashable(this.lineStart));
        }
        /**
         * Takes an optional {@linkcode parser.Token} argument and returns a value that specifies the ordering between `this` and the argument.
         * @param {parser.Token | undefined} obj the value which `this` is tobe compared
         * @returns {utility.Compare} a numerical value to specify ordering after comparison has been done.
         * @see {@linkcode utility.Comparable}
         */
        compareTo(obj?: parser.Token | undefined): utility.Compare {
          if(utility.isValid(obj)){
            let by = utility.compare(this.lineStart, obj!.lineStart);
            if(by !== 0) return by;
            by = utility.compare(this.lineEnd, obj!.lineEnd);
            if(by !== 0) return by;
            by = utility.compare(this.startPos, obj!.startPos);
            if(by !== 0) return by;
            by = utility.asCompare(utility.hashCode32(true, utility.asHashable(this.type.id), utility.asHashable(this.type.precedence)));
            if(by !== 0) return by;
            return utility.compare(this.value, obj!.value);
          }
          return 1;
        }
        /**
         * Gets a debug value for this `Token`.
         * @returns {string} a debug string for this `Token`
         */
        public toString() {
          return JSON.stringify(
            { token: this.value, type: this.type.toString() },
            null,
            2
          );
        }
    }
    /**
     * @summary An interface that extends {@link parser.MutableLexer} for convenience and documentation purposes.
     * @description
     * An object that creates `Token` objects from a `.ini` data format. It is a specialised implementation of the {@linkcode parser.MutableLexer} interface.
     * It allows new data to be added even after the initial one has been transformed into tokens. This enables the {@linkcode StringLexer} to be plugged
     * into a stream of characters and never fail.
     */
    export interface MutableLexer<CH = string> extends parser.MutableLexer<Token, Syntax, CH> {
      end(syntax: Syntax, p: Params | any): void;
      process(chunk: CH, syntax: Syntax, p: Params | any): void;
    }
    /**
     * @summary Creates tokens from a json value such as a `string`, `number`, `boolean`, `null`, arrays and objects.
     * @description A {@linkcode MutableLexer} that processes json in-memory values into tokens that can be extracted
     * via {@linkcode next}. The tokens are ordered in the way the {@linkcode StringLexer} orders its tokens.\
     * \
     * This is the direct opposite of {@link JSFormat `JSFormat`}
     */
    export class JSONLexer implements MutableLexer<json.Value> {
        private _queue;
        private _i = 0;
        private _canProcess = true;
        constructor(){
            this._queue = Array<Token>(new Token("", INIT, -1, -1, -1));
        }
        /**Called by {@linkcode process} */
        private _process(o: json.Value, s: Syntax, name = Array<Token>()) {
            if(json.isAtomic(o)) {
                if(name.length > 0) {
                    do {
                        this.#manufacture(name.shift()!);
                    } while(name.length > 0);
                    this.#manufacture(new Token(s.sectionOperators[1], SECTION_END, 0, 0, this._i++));
                    this.#manufacture(new Token("\n", EOL, 0, 0, this._i++));
                }
                this.#manufacture(new Token(o !== null ? String(o) : "", IDENTIFIER, 0, 0, this._i++));
            } else if(Array.isArray(o)) {
                for (let i = 0; i < o.length; i++) {
                    if(json.isAtomic(o[i])) {
                        if(name.length > 0) {
                            do {
                                this.#manufacture(name.shift()!);
                            } while(name.length > 0);
                            this.#manufacture(new Token(s.sectionOperators[1], SECTION_END, 0, 0, this._i++));
                            this.#manufacture(new Token("\n", EOL, 0, 0, this._i++));
                        }
                        this.#manufacture(new Token(i.toString(), IDENTIFIER, 0, 0, this._i++));
                        this.#manufacture(new Token(s.delimiters[0], ASSIGNMENT, 0, 0, this._i++));
                        this.#manufacture(new Token(String(o[i]??""), IDENTIFIER, 0, 0, this._i++));
                        this.#manufacture(new Token("\n", EOL, 0, 0, this._i++));
                    } else if(Array.isArray(o[i])) {
                        let array = o[i] as any[];
                        if(json.arrayIsAtomic(array)) for(let j = 0; j < array.length; j++) {
                            this.#manufacture(new Token(i.toString(), IDENTIFIER, 0, 0, this._i++));
                            this.#manufacture(new Token(s.delimiters[0], ASSIGNMENT, 0, 0, this._i++));
                            this.#manufacture(new Token(String(array[j]??""), IDENTIFIER, 0, 0, this._i++));
                            this.#manufacture(new Token("\n", EOL, 0, 0, this._i++));
                        } else if(utility.isValid(s.nesting)) {
                            if(name.length < 1) name.push(new Token(s.sectionOperators[0], SECTION_START, 0, 0, this._i++));
                            else name.push(new Token(s.nesting!.chars[0], SUB_SECTION, 0, 0, this._i++));
                            name.push(new Token(i.toString(), IDENTIFIER, 0, 0, this._i++));
                            this._process(o[i], s, name);
                        } else {
                            this.#manufacture(new Token(i.toString(), IDENTIFIER, 0, 0, this._i++));
                            this.#manufacture(new Token(s.delimiters[0], ASSIGNMENT, 0, 0, this._i++));
                            this.#manufacture(new Token(JSON.stringify(o[i]), IDENTIFIER, 0, 0, this._i++));
                            this.#manufacture(new Token("\n", EOL, 0, 0, this._i++));
                        }
                    } else if(typeof o[i] === "object") {
                        if(utility.isValid(s.nesting)) {
                            if(name.length < 1) name.push(new Token(s.sectionOperators[0], SECTION_START, 0, 0, this._i++));
                            else name.push(new Token(s.nesting!.chars[0], SUB_SECTION, 0, 0, this._i++));
                            name.push(new Token(i.toString(), IDENTIFIER, 0, 0, this._i++));
                            this._process(o[i], s, name);
                        } else {
                            this.#manufacture(new Token(i.toString(), IDENTIFIER, 0, 0, this._i++));
                            this.#manufacture(new Token(s.delimiters[0], ASSIGNMENT, 0, 0, this._i++));
                            this.#manufacture(new Token(JSON.stringify(o[i]), IDENTIFIER, 0, 0, this._i++));
                            this.#manufacture(new Token("\n", EOL, 0, 0, this._i++));
                        }
                    }
                }
            } else if(typeof o === "object") {
                for (const key in o) {
                    if(json.isAtomic(o[key])) {
                        if(name.length > 0) {
                            do {
                                this.#manufacture(name.shift()!);
                            } while(name.length > 0);
                            this.#manufacture(new Token(s.sectionOperators[1], SECTION_END, 0, 0, this._i++));
                            this.#manufacture(new Token("\n", EOL, 0, 0, this._i++));
                        }
                        this.#manufacture(new Token(key, IDENTIFIER, 0, 0, this._i++));
                        this.#manufacture(new Token(s.delimiters[0], ASSIGNMENT, 0, 0, this._i++));
                        this.#manufacture(new Token(String(o[key]??""), IDENTIFIER, 0, 0, this._i++));
                        this.#manufacture(new Token("\n", EOL, 0, 0, this._i++));
                    } else if(Array.isArray(o[key])) {
                        if(json.arrayIsAtomic(o[key] as any[])) for(let j = 0; j < (o[key] as any[]).length; j++) {
                            this.#manufacture(new Token(key, IDENTIFIER, 0, 0, this._i++));
                            this.#manufacture(new Token(s.delimiters[0], ASSIGNMENT, 0, 0, this._i++));
                            this.#manufacture(new Token(String((o[key] as any[])[j]??""), IDENTIFIER, 0, 0, this._i++));
                            this.#manufacture(new Token("\n", EOL, 0, 0, this._i++));
                        } else if(utility.isValid(s.nesting)) {
                            if(name.length < 1) name.push(new Token(s.sectionOperators[0], SECTION_START, 0, 0, this._i++));
                            else name.push(new Token(s.nesting!.chars[0], SUB_SECTION, 0, 0, this._i++));
                            name.push(new Token(key, IDENTIFIER, 0, 0, this._i++));
                            this._process((o[key] as any[]), s, name);
                        } else {
                            this.#manufacture(new Token(key, IDENTIFIER, 0, 0, this._i++));
                            this.#manufacture(new Token(s.delimiters[0], ASSIGNMENT, 0, 0, this._i++));
                            this.#manufacture(new Token(JSON.stringify(o[key]), IDENTIFIER, 0, 0, this._i++));
                            this.#manufacture(new Token("\n", EOL, 0, 0, this._i++));
                        }
                    } else if(typeof o[key] === "object") {
                        if(utility.isValid(s.nesting)) {
                            if(name.length < 1) name.push(new Token(s.sectionOperators[0], SECTION_START, 0, 0, this._i++));
                            else name.push(new Token(s.nesting!.chars[0], SUB_SECTION, 0, 0, this._i++));
                            name.push(new Token(key, IDENTIFIER, 0, 0, this._i++));
                            this._process(o[key], s, name);
                        } else {
                            this.#manufacture(new Token(key, IDENTIFIER, 0, 0, this._i++));
                            this.#manufacture(new Token(s.delimiters[0], ASSIGNMENT, 0, 0, this._i++));
                            this.#manufacture(new Token(JSON.stringify(o[key]), IDENTIFIER, 0, 0, this._i++));
                            this.#manufacture(new Token("\n", EOL, 0, 0, this._i++));
                        }
                    }
                }
            }
        }
        #manufacture(t: Token) {
            this._queue.push(t);
            this._canProcess = false;
        }
        end(): void {}
        /**
         * Calling this method when {@link JSONLexer.canProcess `canProcess`} returns `false` puts this `JSONLexer` object in an undefined state.
         * @inheritdoc
         */
        process(chunk: json.Value, syntax: Syntax, p: any): void {
            this.src = chunk;
            if(chunk === null) this.#manufacture(new Token("", IDENTIFIER, 0, 0, this._i++));
            else if(typeof chunk === "boolean") this.#manufacture(new Token(chunk ? "true" : "false", IDENTIFIER, 0, 0, this._i++));
            else if(typeof chunk === "number") this.#manufacture(new Token(String(chunk), IDENTIFIER, 0, 0, this._i++));
            else if(typeof chunk === "string") this.#manufacture(new Token(chunk, IDENTIFIER, 0, 0, this._i++));
            else if(typeof chunk === "object") {
                const array = Array<Token>();
                this._process(chunk, syntax, array);
                if(array.length > 0) do {
                    this.#manufacture(array.shift()!);
                } while (array.length > 0);
            }
            this.#manufacture(new Token("\n", EOL, 0, 0, this._i++));
        }
        processed = () => this._queue;
        unprocessed = () => this.src;
        frequency(type: parser.Type): number {
            let frqy = 0;
            for (let i = 0; i < this._queue.length; i++) {
              if (this._queue[i].type.equals(type)) frqy++;
            }
            return frqy;
        }
        indexOf(type: parser.Type): number {
            for (let i = 0; i < this._queue.length; i++) {
              if (this._queue[i].type.equals(type)) return i;
            }
            return -1;
        }
        public lastIndexOf(type: parser.Type) {
          for (let i = this._queue.length - 1; i >= 0; i--) {
            if (this._queue[i].type.equals(type)) return i;
          }
          return -1;
        }
        hasTokens(): boolean {
          return this._queue.length > 0;
        }
        canProcess(): boolean {
            return this._canProcess;
        }
        next(): Token {
          while (true) {
            if (!this.hasTokens()) break;
            return this._queue!.shift()!;
          }
          return new Token("", EOF, this.line(), this.line(), this.position());
        }
        /**
         * Will be `undefined` if `process` is yet to be called
         * @inheritdoc
         */
        public src?: json.Value;
        position(): number {
          return this._i;
        }
        line(): 0 {
          return 0;
        }
    }
    /**
     * @summary Creates tokens from updatable text recieved.
     * @description A {@linkcode MutableLexer} that processes strings (probably from a file or network) in the `.ini` format
     * into tokens meant to be parsed by a {@linkcode PrattParser}.
     */
    export class StringLexer implements MutableLexer{
        #ln: number;
        #li: number;
        #queue: Token[];
        public src: string;
        #esc;//number of escape characters found on a line
        #text;
        #escText;
        #quoteType = null as any as Type;//check for quote start. null means the next quote will be a starting one else the next is an end one
        // #com = "";//comments
        constructor() {
            this.#ln = 1;
            this.#li = 1;
            this.#queue = [new Token("", INIT, -1, -1, -1)];
            this.src = "";
            this.#esc = 0;
            this.#text = "";
            this.#escText = "";
        }
        #eol = '\n';//utility.eol;
        #isStart() {
            return this.#ln === 0 && this.#li === 0;
        }
        #escEven(){
            return this.#esc % 2 == 0;
        }
        #shiftSrc(distance: number) {
            if(distance > this.src.length) return undefined;
            const rv = this.src.substring(0, distance);
            this.src = this.src.substring(distance);
            return rv;
        }
        #manufacture(t: Token) {
            this.#queue.push(t);
        }
        end(syntax: Syntax, params: Params): void {
            if(this.canProcess()) this.process("", syntax, params);
            this.process("\n", syntax, params);
            // if(this.#queue[this.#queue.length - 1] && !this.#queue[this.#queue.length - 1].type.equals(EOL))
            //     this.process(this.#eol, syntax, params);
        }
        process(chunk: string = "", syntax: Syntax, p: Params): void {
            this.src += chunk;
            while (this.src.length > 0) {
                const token = this.#shiftSrc(1)!;
                this.#li++;
				if(token === this.#eol) {this.#ln++; this.#li = 0}
                if(!this.#escEven()) {
                    if(this.#escText.length === 0) {
                        this.#escText += token;
                        if(syntax.escape!.unicode.indexOf(this.#escText[0]) < 0) {
                            if(this.#text.length > 0) {
                                this.#manufacture(new Token(this.#text, IDENTIFIER, this.#ln, this.#ln, this.#li - this.#text.length));
                                this.#text = "";
                            }
                            this.#manufacture(new Token(this.#escText, ESCAPED, this.#ln, this.#ln, this.#li));
                            this.#escText = "";
                            this.#esc = 0;
                        }
                    } else if(/[A-Fa-f0-9]/.test(token)) {
                        this.#escText += token;
                        if(this.#escText.length === 5) {
                            if(this.#text.length > 0) {
                                this.#manufacture(new Token(this.#text, IDENTIFIER, this.#ln, this.#ln, this.#li - this.#text.length));
                                this.#text = "";
                            }
                            this.#manufacture(new Token(this.#escText, ESCAPED, this.#ln, this.#ln, this.#li));
                            this.#escText = "";
                            this.#esc = 0;
                        }
                    } else {
                        if(this.#text.length > 0) {
                            this.#manufacture(new Token(this.#text, IDENTIFIER, this.#ln, this.#ln, this.#li - this.#text.length));
                            this.#text = "";
                        }
                        this.#manufacture(new Token(this.#escText, ESCAPED, this.#ln, this.#ln, this.#li));
                        this.#escText = "";
                        this.#esc = 0;
                        this.#text += token;
                    }
                    // if(this.#escText.length === 0)
                    // this.#escText += token;
                    /*If the escape sequence is not a unicode escape sequence, then a single character would suffice to be escaped */
                    // if(syntax.escape!.unicode.indexOf(this.#escText[0]) < 0 || !/[A-Fa-f0-9]/.test(token)) {
                    //     this.#manufacture(new Token(this.#escText, ESCAPED, this.#ln, this.#ln, this.#li));
                    //     this.#escText = "";
                    //     this.#esc = 0;
                    // }
                } else if(token === this.#eol) {
                    // if(this.#text[this.#text.length - 1] === "\r") this.#text = this.#text.substring(0, this.#text.length - 1);
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, IDENTIFIER, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, EOL, this.#ln, this.#ln, this.#li - token.length));
                    this.#escText = "";
                    this.#esc = 0;
                    this.#quoteType = null as any;
                } else if(syntax.comments.chars.indexOf(token) >= 0) {
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, IDENTIFIER, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, COMMENT, this.#ln, this.#ln, this.#li - token.length));
                    this.#escText = "";
                    this.#esc = 0;
                } else if(utility.isValid(syntax.escape) && syntax.escape!.char === token) {//an escape character?
                    this.#esc++;
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, IDENTIFIER, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, ESCAPE, this.#ln, this.#ln, this.#li - token.length));
                } else if(token === syntax.sectionOperators[0]) {
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, IDENTIFIER, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, SECTION_START, this.#ln, this.#ln, this.#li - token.length));
                    this.#escText = "";
                    this.#esc = 0;
                } else if(token === syntax.sectionOperators[1]) {
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, IDENTIFIER, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, SECTION_END, this.#ln, this.#ln, this.#li - token.length));
                    this.#escText = "";
                    this.#esc = 0;
                } else if(token === "'" && utility.isValid(syntax.escape) && syntax.escape!.quoted) {
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, IDENTIFIER, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    // console.log({quoteType_before_assign: this.#quoteType});
                    this.#manufacture(new Token(token, QUOTE.equals(this.#quoteType) ? QUOTE_END : QUOTE, this.#ln, this.#ln, this.#li - token.length));
                    // console.log({lastInsertedToken: this.#queue[this.#queue.length - 1]});
                    // this.#qt = !this.#qt;
                    if(QUOTE.equals(this.#quoteType)) this.#quoteType = null as any as Type;
                    else if(!utility.isValid(this.#quoteType)) this.#quoteType = QUOTE;
                    // console.log({quoteType_after_assign: this.#quoteType});
                    this.#escText = "";
                    this.#esc = 0;
                } else if(token === '"' && utility.isValid(syntax.escape) && syntax.escape!.quoted) {
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, IDENTIFIER, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    // console.log({quoteType_before_assign: this.#quoteType});
                    this.#manufacture(new Token(token, D_QUOTE.equals(this.#quoteType) ? D_QUOTE_END : D_QUOTE, this.#ln, this.#ln, this.#li - token.length));
                    // console.log({lastInsertedToken: this.#queue[this.#queue.length - 1]});
                    if(D_QUOTE.equals(this.#quoteType)) this.#quoteType = null as any as Type;
                    else if(!utility.isValid(this.#quoteType)) this.#quoteType = D_QUOTE;
                    // console.log({quoteType_after_assign: this.#quoteType});
                    this.#escText = "";
                    this.#esc = 0;
                } else if(utility.isValid(syntax.nesting) && syntax.nesting!.chars.indexOf(token) > -1) {
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, IDENTIFIER, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, SUB_SECTION, this.#ln, this.#ln, this.#li - token.length));
                    this.#escText = "";
                    this.#esc = 0;
                } else if(syntax.delimiters.indexOf(token) > -1) {
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, IDENTIFIER, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, ASSIGNMENT, this.#ln, this.#ln, this.#li - token.length));
                    this.#escText = "";
                    this.#esc = 0;
                } else if(utility.isWhitespace(token)){
                    if(this.#text.length > 0) {
                        // this.#manufacture(new Token(this.#text, IDENTIFIER, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text += token;
                    } else {
                        this.#manufacture(new Token(token, WHITESPACE, this.#ln, this.#ln, this.#li - token.length));
                        this.#escText = "";
                        this.#esc = 0;
                    }
                } else {
                    this.#text += token;
                }
            }
        }
        processed = () => this.#queue;
        unprocessed = () => this.src;
        frequency(type: parser.Type): number {
            let frqy = 0;
            for (let i = 0; i < this.#queue.length; i++) {
              if (this.#queue[i].type.equals(type)) frqy++;
            }
            return frqy;
        }
        indexOf(type: parser.Type): number {
            for (let i = 0; i < this.#queue.length; i++) {
              if (this.#queue[i].type.equals(type)) return i;
            }
            return -1;
        }
        lastIndexOf(type: parser.Type): number {
            for (let i = this.#queue.length - 1; i >= 0; i--) {
              if (this.#queue[i].type.equals(type)) return i;
            }
            return -1;
        }
        hasTokens(): boolean {
            return this.#queue.length > 0;
        }
        canProcess(): boolean {
            return this.src.length > 0;
        }
        next(): Token {
            while (true) {
              if (!this.hasTokens()) break;
              return this.#queue!.shift()!;
            }
            return new Token("", EOF, this.line(), this.line(), this.position());
        }
        position(): number {
            return this.#li;
        }
        line(): number {
            return this.#ln
        }
    }
    /**
     * @summary A specialised mini-parser that is `.ini` syntax-specific.
     * @description An object that can parse {@link parser.GType type(s)} of `.ini` {@link parser.Token tokens} effectively in a way
     * that is specific to the `.ini` data format and produces an expression for the tokens it parsed.
     */
    export interface Command extends parser.GCommand<Token, Expression, Syntax, MutableLexer, Parser> {
      parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer, s: Syntax, pa?: Params): Expression;
    }
    /**
     * A command that can parse prefix and infix tokens. A prefix token is a token located after an {@linkcode EOL}. An infix token
     * is a token located between after another token such that it is syntactically correct.
     */
    abstract class LeftAndRight implements Command {
        constructor(public readonly direction: parser.Direction){}
        /**
         * @virtual
         */
        abstract parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer<string>, s: Syntax, pa?: Params | undefined): Expression;
    }
    /**
     * A command to parse the comment token when the parser encounters one. It returns `undefined` and depending on whether this was
     * called as a prefix (block comments) or as an infix (inline comments), may assign the comments parsed either to {@linkcode Params.block}
     * or {@linkcode Params.inline} respectively.
     */
    class ParseComment extends LeftAndRight {
        parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer<string>, s: Syntax, pa?: Params | undefined): Expression {
            let c = parseComment(l, s, p, pa!, yp.value);
            switch (this.direction) {
                case parser.Direction.PREFIX:{
                    if(s.comments.retain) pa!.block.push(c);
                    break;
                }
                case parser.Direction.POSTFIX:
                case parser.Direction.INFIX:
                default: {
                    if(s.comments.retain) pa!.inline = c;
					// // console.log(`Inline: ${pa!.inline}`);
                }
            }
            return ap;
        }
    }
    /**
     * A command to parse the assignment token when the parser encounters one creating a {@linkcode KeyValue} in the process.\
     * \
     * It will throw away any white space before the right hand side value and asserts that if the right handside value is truthy,
     * then it must be an expression of {@linkcode Text} type. 
     */
    class Assign extends LeftAndRight {
        parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer<string>, s: Syntax, pa?: Params | undefined): Expression {
            // if(pa!.assigned) return s.getCommand(parser.Direction.PREFIX, IDENTIFIER)!.parse(ap, new Token(yp.value, IDENTIFIER, yp.lineStart, yp.lineEnd, yp.startPos), p, l, s, pa);
            pa!.assigned = true;
            let left: string = "", right: string, preceding: string[];
            // // console.log("assignment with '" + yp.value + "'");

            skipWhiteSpace(l, s, p, pa!);
            
            try {
                const rightExpr = p.match(EOL, l, s, pa) ? null as any as Expression : p.parseWithPrecedence(yp.type.precedence, l, s, pa!);
                switch(this.direction) {
                    case parser.Direction.PREFIX: {
                        if(utility.isValid(rightExpr) && !(rightExpr instanceof Text)) throw new parser.ParseError(`Could not parse whatever was after the assignment operator at line ${yp.lineStart}, position ${yp.startPos}`);
                        right  = isText(rightExpr) ? rightExpr.text : "";
                        preceding = pa!.block;
                        pa!.block = [];
                        break;
                    }
                    case parser.Direction.INFIX:
                    case parser.Direction.POSTFIX:
                    default: {
                        left  = isText(ap) ? (ap as Text).text : "";
                        if(utility.isValid(rightExpr) && !(rightExpr instanceof Text)) throw new parser.ParseError(`Could not parse whatever was after the assignment operator at line ${yp.lineStart}, position ${yp.startPos}`);
                        right  = isText(rightExpr) ? rightExpr.text : "";
                        preceding = pa!.block;
                        pa!.block = [];
                    }
                }
            } catch (e: any) {
                throw new parser.SyntaxError(yp, e);
            }
            pa!.assigned = false;
            // // console.log(`Assign; token: ${yp.value}, result: left > ${left}, right >${right}`);
            return new KeyValue({preceding: Object.freeze(preceding), inline: pa!.inline}, left, right);
        }
    }
    /**
     * A command to parse the section declaration tokens (such as the brackets surrounding the section identifier, the section identifier
     * and the subsection operators) and all properties declared under the given declaration when the parser encounters them creating a
     * {@linkcode Section} in the process.\
     * \
     * It will throw away any white space after the section declaration.
     */
    class ParseSection implements Command {
        parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer<string>, s: Syntax, pa?: Params | undefined): Expression {
            pa!.insideSecName = true;

            //create the section name
            if(utility.isValid(s.nesting) && s.nesting!.relative && p.match(SUB_SECTION, l, s, pa)){
                do {
                    p.consume(SUB_SECTION, l, s, pa);
                    try {
                        const text = p.parseWithPrecedence(yp.type.precedence, l, s, pa);
                        if(text instanceof Text){
                            pa!.section.push(text.text);
                        } else if(text instanceof KeyValue) {
                            pa!.section.push(text.key + text.value);
                        } else throw new parser.ParseError("section name not found")
                    } catch (e: any) {
                        throw new parser.SyntaxError(yp, e);
                    }
                } while (p.match(SUB_SECTION, l, s, pa));
                p.consume(SECTION_END, l, s, pa);
            } else {
                pa!.section = [];
                while(true) {
                    try {
                        const text = p.parseWithPrecedence(yp.type.precedence, l, s, pa);
                        // // console.log(JSON.stringify(text));
                        if(text instanceof Text) pa!.section.push(text.text);
                        else if(text instanceof KeyValue) {
                            pa!.section.push(text.key + text.value);
                        } else throw new parser.ParseError("section name not found");
                    } catch (e: any) {
                        throw new parser.SyntaxError(yp, e);
                    }
                    if(p.match(SUB_SECTION, l, s, pa)) p.consume(SUB_SECTION, l, s, pa);
                    else {
                        p.consume(SECTION_END, l, s, pa);
                        break;
                    } 
                }
            }

            pa!.insideSecName = false;

            skipWhiteSpace(l, s, p, pa!);

            //create and enforce section scope by parsing all properties in the scope
            const scope = new Section({preceding: Object.freeze([...pa!.block]), inline: pa!.inline}, pa!.section);
            pa!.block = [];
            pa!.inline = "";
            while((!p.match(SECTION_START, l, s, pa!)) && !p.match(EOF, l, s, pa!)) {
                let prop;
                try {
                    /* low enough to parse assignments but high enough to stop just before an eol */
                    prop = p.parseWithPrecedence(2, l, s, pa);
                } catch (e: any) {
                    throw new parser.SyntaxError(yp, e);   
                }
                pa!.assigned = false;
                if(!utility.isValid(prop)) {//a blank or comment line
                    continue;
                } else if(prop instanceof KeyValue || prop instanceof Text) {//see KeyValue class docs
                    if(prop instanceof Text) {
                        prop = new KeyValue({preceding: Object.freeze([...pa!.block]), inline: pa!.inline}, prop.text, "");
                        pa!.block = [];
                        pa!.inline = "";
                    }
                    try {
                        // console.log('adding', prop);
                        scope.add(s, [], prop as KeyValue);
                    } catch (e: any) {
                        throw new parser.SyntaxError(yp, e);
                    }
                }  else throw new parser.ParseError(`Unexpected value found`);
                skipBlankLines(l, s, p, pa!);
            }

            if(utility.isValid(ap)){
                try {
                    //add this scope to the parent/global scope
                    (ap as Section).add(s, [...pa!.section], scope);
                } catch (e: any) {
                    throw new parser.SyntaxError(yp, e);
                }
                return ap;//return the parent/global scope
            }
            return scope;
        }
    }
    /**
     * A command to parse the lexeme (identifier or textual) tokens when the parser encounters them creating a
     * {@linkcode Text} in the process.\
     * \
     * All whitespaces are thrown away except this was called for quoted text. 
     */
    class ParseText implements Command {
        parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer<string>, s: Syntax, pa?: Params | undefined): Expression {
            let text = "";
            let src = yp.value;
            if(yp.type.equals(QUOTE)) {
                while(true){
                    if(p.match(IDENTIFIER, l, s, pa)) {let val = p.consume(IDENTIFIER, l, s, pa).value; text += val; src += val}
                    else if(p.match(SUB_SECTION, l, s, pa!)) {let val = p.consume(SUB_SECTION, l, s, pa).value; text += val; src += val}
                    else if(p.match(ASSIGNMENT, l, s, pa!)) {let val = p.consume(ASSIGNMENT, l, s, pa).value; text += val; src += val}
                    else if(p.match(COMMENT, l, s, pa!)) {let val = p.consume(COMMENT, l, s, pa).value; text += val; src += val}
                    else if(p.match(SECTION_START, l, s, pa!)) {let val = p.consume(SECTION_START, l, s, pa).value; text += val; src += val}
                    else if(p.match(SECTION_END, l, s, pa!)) {let val = p.consume(SECTION_END, l, s, pa).value; text += val; src += val}
                    else if(p.match(WHITESPACE, l, s, pa!)) {let val = p.consume(WHITESPACE, l, s, pa).value; text += val; src += val}
                    else if(p.match(D_QUOTE, l, s, pa)) {let val = p.consume(D_QUOTE, l, s, pa).value; text += val; src += val}
                    else if(p.match(D_QUOTE_END, l, s, pa)) {let val = p.consume(D_QUOTE_END, l, s, pa).value; text += val; src += val}
                    else if(p.match(ESCAPE, l, s, pa)) {
                        const esc = p.consume(ESCAPE, l, s, pa);
                        const escaped = p.consume(ESCAPED, l, s, pa);
                        let val = "";
                        if(escaped.value === "\r" && p.match(EOL, l, s, p)) {
                            val = p.consume(EOL, l, s, pa!).value;
                            text += s.escape!.parse(esc.value + val);
                            src += val;
                        } else {
                            text += s.escape!.parse(esc.value + escaped.value);
                        }
                        src += esc.value + escaped.value + val;
                    } else if(p.match(QUOTE_END, l, s, pa)) {
                        src += p.consume(QUOTE_END, l, s, pa).value;
                        break;
                    } else if(p.match(QUOTE, l, s, pa)) {
                        // console.log("p.match(D_QUOTE) = true");
                        const e = new parser.ParseError(`Lexer is in an unsupported state. Parser matched quotes twice on ${text}`);
                        throw new parser.SyntaxError(yp, e);
                    } else {
                        // console.log(`p.match(EOL) = ${p.match(EOL,l,s,pa)}`);
                        const e = new parser.ParseError("was unable to match the next token");
                        throw new parser.SyntaxError(yp, e);
                    }
                }
                src += skipWhiteSpace(l, s, p, pa!);
            } else if(yp.type.equals(D_QUOTE)) {
                while(true){
                    if(p.match(IDENTIFIER, l, s, pa)) {let val = p.consume(IDENTIFIER, l, s, pa).value; text += val; src += val}
                    else if(p.match(SUB_SECTION, l, s, pa!)) {let val = p.consume(SUB_SECTION, l, s, pa).value; text += val; src += val}
                    else if(p.match(ASSIGNMENT, l, s, pa!)) {let val = p.consume(ASSIGNMENT, l, s, pa).value; text += val; src += val}
                    else if(p.match(COMMENT, l, s, pa!)) {let val = p.consume(COMMENT, l, s, pa).value; text += val; src += val}
                    else if(p.match(SECTION_START, l, s, pa!)) {let val = p.consume(SECTION_START, l, s, pa).value; text += val; src += val}
                    else if(p.match(SECTION_END, l, s, pa!)) {let val = p.consume(SECTION_END, l, s, pa).value; text += val; src += val}
                    else if(p.match(WHITESPACE, l, s, pa!)) {let val = p.consume(WHITESPACE, l, s, pa).value; text += val; src += val}
                    else if(p.match(QUOTE, l, s, pa)) {let val = p.consume(QUOTE, l, s, pa).value; text += val; src += val}
                    else if(p.match(QUOTE_END, l, s, pa)) {let val = p.consume(QUOTE_END, l, s, pa).value; text += val; src += val}
                    else if(p.match(ESCAPE, l, s, pa)) {
                        const esc = p.consume(ESCAPE, l, s, pa);
                        const escaped = p.consume(ESCAPED, l, s, pa);
                        let val = "";
                        if(escaped.value === "\r" && p.match(EOL, l, s, p)) {
                            val = p.consume(EOL, l, s, pa!).value;
                            text += s.escape!.parse(esc.value + val);
                            src += val;
                        } else {
                            text += s.escape!.parse(esc.value + escaped.value);
                        }
                        src += esc.value + escaped.value + val;
                    } else if(p.match(D_QUOTE_END, l, s, pa)) {
                        src += p.consume(D_QUOTE_END, l, s, pa).value;
                        break;
                    } else if(p.match(D_QUOTE, l, s, pa)) {
                        const e = new parser.ParseError(`Lexer is in an unsupported state. Parser matched double quotes twice on ${text}`);
                        throw new parser.SyntaxError(yp, e);
                    } else {
                        // console.log(`p.match(EOL) = ${p.match(EOL,l,s,pa)}`);
                        const e = new parser.ParseError("was unable to match the next token");
                        throw new parser.SyntaxError(yp, e);
                    }
                    // console.log(p.match(D_QUOTE, l, s, pa));
                    
                    // console.log(`Parsed text: ${text}`);
                }
                src += skipWhiteSpace(l, s, p, pa!);
            } else if(yp.type.equals(ESCAPE)) {
				const esc0 = yp.value;
                const escaped0 = p.consume(ESCAPED, l, s, pa);
                let val = ""
                if(escaped0.value === "\r" && p.match(EOL, l, s, p)) {
                    val = p.consume(EOL, l, s, pa!).value;
                    text += s.escape!.parse(esc0 + val);
                } else {
                    text += s.escape!.parse(esc0 + escaped0.value);
                }
                src += escaped0.value + val;
                while(true) {
                    if(p.match(IDENTIFIER, l, s, pa!)) {val = p.consume(IDENTIFIER, l, s, pa).value; text += val; src += val;}
                    else if(p.match(WHITESPACE, l, s, pa!)) {val = p.consume(WHITESPACE, l, s, pa).value; text += val; src += val;}
                    else if(p.match(SUB_SECTION, l, s, pa!) && !pa!.insideSecName) {val = p.consume(SUB_SECTION, l, s, pa).value; text += val; src += val;}
                    else if((p.match(ASSIGNMENT, l, s, pa!) && pa!.assigned) || (p.match(ASSIGNMENT, l, s, pa) && pa!.insideSecName)) {val = p.consume(ASSIGNMENT, l, s, pa).value; text += val; src += val;}
                    else if(p.match(COMMENT, l, s, pa!) && !s.comments.inline) {val = p.consume(COMMENT, l, s, pa).value; text += val; src += val;}
                    else if(p.match(QUOTE, l, s, pa!)) {val = p.consume(QUOTE, l, s, pa).value; text += val; src += val;}
                    else if(p.match(QUOTE_END, l, s, pa!)) {val = p.consume(QUOTE_END, l, s, pa).value; text += val; src += val;}
                    else if(p.match(D_QUOTE, l, s, pa!)) {val = p.consume(D_QUOTE, l, s, pa).value; text += val; src += val;}
                    else if(p.match(D_QUOTE_END, l, s, pa!)) {val = p.consume(D_QUOTE_END, l, s, pa).value; text += val; src += val;}
                    else if(p.match(ESCAPE, l, s, pa!) && utility.isValid(s.escape) && s.escape!.nonQuotedEsc) {
                        const esc = p.consume(ESCAPE, l, s, pa);
                        const escaped = p.consume(ESCAPED, l, s, pa);
                        val = "";
                        if(escaped.value === "\r" && p.match(EOL, l, s, p)) {
                            val = p.consume(EOL, l, s, pa!).value;
                            text += s.escape!.parse(esc.value + val);
                            src += val;
                        } else {
                            text += s.escape!.parse(esc.value + escaped.value);
                        }
                        src += esc.value + escaped.value + val;
                    } else break;
                }
                // console.log({text});
                text = text.trim();
            } else {
				text += yp.value;
                while(true) {
                    if(p.match(IDENTIFIER, l, s, pa!)) {let val = p.consume(IDENTIFIER, l, s, pa).value; text += val; src += val;}
                    else if(p.match(WHITESPACE, l, s, pa!)) {let val = p.consume(WHITESPACE, l, s, pa).value; text += val; src += val;}
                    else if(p.match(SUB_SECTION, l, s, pa!) && !pa!.insideSecName) {let val = p.consume(SUB_SECTION, l, s, pa).value; text += val; src += val;}
                    else if((p.match(ASSIGNMENT, l, s, pa!) && pa!.assigned) || (p.match(ASSIGNMENT, l, s, pa) && pa!.insideSecName)) {let val = p.consume(ASSIGNMENT, l, s, pa).value; text += val; src += val;}
                    else if(p.match(COMMENT, l, s, pa!) && !s.comments.inline) {let val = p.consume(COMMENT, l, s, pa).value; text += val; src += val;}
                    else if(p.match(QUOTE, l, s, pa!)) {let val = p.consume(QUOTE, l, s, pa).value; text += val; src += val;}
                    else if(p.match(QUOTE_END, l, s, pa!)) {let val = p.consume(QUOTE_END, l, s, pa).value; text += val; src += val;}
                    else if(p.match(D_QUOTE, l, s, pa!)) {let val = p.consume(D_QUOTE, l, s, pa).value; text += val; src += val;}
                    else if(p.match(D_QUOTE_END, l, s, pa!)) {let val = p.consume(D_QUOTE_END, l, s, pa).value; text += val; src += val;}
                    else if(p.match(ESCAPE, l, s, pa!) && utility.isValid(s.escape) && s.escape!.nonQuotedEsc) {
                        const esc = p.consume(ESCAPE, l, s, pa);
                        const escaped = p.consume(ESCAPED, l, s, pa);
                        let val = "";
                        if(escaped.value === "\r" && p.match(EOL, l, s, p)) {
                            val = p.consume(EOL, l, s, pa!).value;
                            text += s.escape!.parse(esc.value + val);
                            src += val;
                        } else {
                            text += s.escape!.parse(esc.value + escaped.value);
                        }
                        src += esc.value + escaped.value + val;
                    } else break;
                }
                text = text.trim();
            }
            return new Text(text, src);
        }
    }
    /**
     * A command to parse the eol token when the parser encounters one. It returns `undefined` after consuming all whitespaces and blank lines.
     */
    class EndLine implements Command {
        parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer<string>, s: Syntax, pa?: Params | undefined): Expression {
            skipBlankLines(l, s, p, pa!);
            pa!.assigned = false;
            // console.log("Endline");
            // if(p.match(SECTION_START, l, s, pa)) return s.getCommand(parser.Direction.PREFIX, SECTION_START)!.parse(ap, p.consume(SECTION_START, l, s, pa) as Token, p, l, s, pa);
            return ap;
        }
    }
    /**A special command that parses the whole data*/
    class Initialize implements Command {
        parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer<string>, s: Syntax, pa?: Params | undefined): Expression {
            ap = new Section(emptyComment());
            // console.log("Intialize");
            while(!p.match(EOF, l, s, pa)){
                let exp = p.parse(l, s, pa);
                if(!utility.isValid(exp)) {//a blank or comment line
                    continue;
                } else if(exp instanceof Text) {
                    exp = new KeyValue({preceding: Object.freeze([...pa!.block]), inline: pa!.inline}, exp.text, "");
                    pa!.block = [];
                    pa!.inline = "";
                }
                (ap as Section).add(s, [...pa!.section], exp as (Section | KeyValue));
                // skipWhiteSpace(l, s, p, pa!);
                // skipBlankLines(l, s, p, pa!);
            }
            return ap;
        }
    }
    /**
     * @summary A representation of parsed `Token` objects.
     * @description The result after the parser has returned. This is especially for convenience and documentation purposes.
     */
    export interface Expression extends expression.GExpression<Format> {
        readonly comments: {
            readonly preceding: readonly string[],
            readonly inline?: string,
        };
      format(format: Format, syntax?: Syntax, params?: Params | any): void;
    }
    /**
     * @summary
     * A representation of a key assigned to a value.
     * @description
     * An example of all the different scenarios with a key-value pair
     * ```ini
     * [section]
     * ;Just a text
     * keyWithoutValue
     * = valueWithoutKey
     * = anotherKeyWithoutValue
     * ;blank line
     * 
     * key=value
     * key=anotherValue #Repeated value creates an array where key: ["value", "anotherValue"]
     * ```
     */
    class KeyValue implements Expression {
        constructor(public readonly comments: { preceding: readonly string[], inline?: string}, public readonly key: string, public readonly value: string){}
        format(format: Format, syntax?: Syntax | undefined, params?: any): void {
            format.append(this, syntax, params);
        }
        debug(): string {
            return `${this.comments.preceding.length > 0 ? unwrapComments(this.comments) : ""}${this.key} = ${this.value} ${this.comments.inline ? ";" + this.comments.inline : ""}\n`;
        }
        equals(obj?: object | undefined): boolean {
            if (obj instanceof KeyValue) return this.key === obj!.key && this.value === obj!.value;
            return false;
        }
        hashCode32(): number {
            return utility.hashCode32(false, utility.asHashable(this.key), utility.asHashable(this.value), utility.asHashable(this.comments));
        }
        toString(): string {
          return JSON.stringify(this);
        }
    }
    /**
     * A representation of a section name along with it's properties.
     */
    class Section implements Expression {
        private readonly _map: {[key: string]: Section | Property};
        constructor(public readonly comments: {
            readonly preceding: readonly string[],
            readonly inline?: string
        } = emptyComment(), public readonly fullname: readonly string[] = Object.freeze([])) { this._map = {}; }
        private static _addProp(section: Section, s: Syntax, names: string[], value: KeyValue): void {
            if(names.length === 0) {
                const key = value.key;//Section._getProperKey(value);
                if(!utility.isValid(section._map[key])) section._map[key] = new Property();
                else if(!(section._map[key] instanceof Property)) throw new expression.ExpressionError(`The property '${key}' is not of Property type. A name conflict was found`);
                (section._map[key] as Property).add(s, value);
                return;
            }
            const name = names.shift()!;
            if(!utility.isValid(section._map[name])) section._map[name] = new Section();
            else if(!(section._map[name] instanceof Section)) throw new expression.ExpressionError(`The section '${name}' is not of Section type. A name conflict was found`)
            return Section._addProp(section._map[name] as Section, s, names, value);
        }
        private static _addSec(section: Section, s: Syntax, names: string[], value?: Section): void {
            if(names.length === 1) {
                const name = names.pop()!;
                switch(s.duplicateDirective.section){
                    case DuplicateDirective.MERGE:
                    default: if(utility.isValid(section._map[name])) {
                        if(!utility.isValid(value)) section._map[name] = new Section();
                        // section._map[name] = value?{...value!}as Section:new Section();
                        else {
                            for (const key in value!._map) {
                                const element = value!._map[key];
                                if(element instanceof Property){
                                    for(let i = 0; i < element.values.length; i++) (section._map[name] as Section).add(s, [key], element.values[i]);
                                } else (section._map[name] as Section).add(s, key, element); 
                            }
                        }
                        return;
                    } else break;
                    case DuplicateDirective.OVERWRITE: break;
                    case DuplicateDirective.DISCARD: if(utility.isValid(section._map[name])) return; else break;
                    case DuplicateDirective.THROW: throw new expression.ExpressionError("Duplicate not supported for section '" + name + "'");
                }
                section._map[name] = value??new Section();
                return;
            }
            const name = names.shift()!;
            if(!utility.isValid(section._map[name])) section._map[name] = new Section();
            else if(!(section._map[name] instanceof Section)) throw new expression.ExpressionError(`The section '${name}' is not of Section type. A name conflict was found`);
            return Section._addSec(section._map[name] as Section, s, names, value);
        }
        public add(s: Syntax, name: string | string[]): void;
        public add(s: Syntax, name: string | string[], e: KeyValue): void;
        public add(s: Syntax, name: string | string[], e: Section): void;
        public add(s: Syntax, name: string | string[], e: KeyValue | Section): void;
        public add(s: Syntax, name: unknown, e?: unknown){
            if(Array.isArray(name)){
                if(e instanceof KeyValue)
                Section._addProp(this, s, name, e);
                else Section._addSec(this, s, name, e as Section);
            } else this.add(s, [name as string], e as any);
        }
        format(format: Format, syntax?: Syntax | undefined, params?: any): void {
            format.append(this, syntax, params);
        }
        private _debug(name = "", section: Section = this): string{
            let rv = "";
            for (const key in section._map) {
                if(section._map[key] instanceof Section) {
                    return section._debug(name.length > 0 ? `${name}.${key}` : `[${key}`, section._map[key] as Section);
                } else if (section._map[key] instanceof Property){
                    rv += `${name}]${this.comments.inline && this.comments.inline.length > 0 ? this.comments.inline : ""}\n${(section._map[key] as Property).debug()}`;
                } else throw new expression.ExpressionError(`Illegal value found at ${name}.${key}`);
            }
            return rv;
        }
        debug(): string {
            return (this.comments.preceding.length > 0 ? unwrapComments(this.comments) : "") + this._debug();
        }
        equals(obj?: object | undefined): boolean {
            if (obj instanceof Section) return this._map === obj!._map;
            return false;
        }
        hashCode32(): number {
            return utility.hashCode32(false, utility.asHashable(this._map), utility.asHashable(this.comments), /*utility.asHashable(utility.hashCode32ForArray(false, this.#props))*/);
        }
        public get(name: string): Expression{
            return this._map[name];
        }
        public remove(name: string) {
            delete this._map[name];
        }
        public get map() {
            return Object.freeze(this._map);
        }
        toString(): string {
            return JSON.stringify(this);
        }
    }
    /**
     * A representation of a property whereby it may contain multiple assignments to various values.
     */
    class Property implements Expression {
        private readonly _values: KeyValue[];
        public comments: { readonly preceding: readonly string[]; readonly inline?: string | undefined; };
        constructor(initialValue?: KeyValue) {
            this.comments = emptyComment();
            this._values = [];
            if(utility.isValid(initialValue)) this._values.push(initialValue!);
        }
        public add(s: Syntax, kv: KeyValue): void;
        public add(s: Syntax, key: string): void;
        public add(s: Syntax, key: Text): void;
        public add(s: Syntax, param: KeyValue|string|Text): void;
        public add(s: Syntax, param: unknown) {
            if(param instanceof KeyValue) {
                switch(s.duplicateDirective.property){
                    case DuplicateDirective.MERGE:
                    default: break;
                    case DuplicateDirective.OVERWRITE: {
                        if(this._values.length > 0) do {this._values.pop()}while(this._values.length > 0);
                        break;
                    }
                    case DuplicateDirective.DISCARD: if(this._values.length > 0) return; else break;
                    case DuplicateDirective.THROW: if(this._values.length > 0) throw Error("Duplicate not supported for property '" + param.key + "'");
                }
                this._values.push(param);
            } else if(param instanceof Text) {
                this.add(s, new KeyValue(emptyComment(), param.text, ""));
            } else if(typeof param === "string") {
                this.add(s, new KeyValue(emptyComment(), param, ""));
            }
        }
        public get values(): readonly KeyValue[] {
            return Object.freeze([...this._values]);
        }
        public value(index = 0): KeyValue | undefined {
            return this.values[index];
        }
        public remove(index = 0): void {
            this._values.splice(index, 1);
        }
        format(format: Format, syntax?: Syntax | undefined, params?: any): void {
            format.append(this, syntax, params);
        }
        debug(): string {
            return `${this.comments.preceding.length > 0 ? unwrapComments(this.comments) : ""}${this._values.map(x => x.debug()).join("")}`;
        }
        equals(obj?: object | undefined): boolean {
            if (obj instanceof Property) return this._values === obj!._values;
            return false;
        }
        hashCode32(): number {
            return utility.hashCode32(false, utility.asHashable(this.comments), utility.asHashable(this._values));
        }
        toString(): string {
            return JSON.stringify(this);
        }
    }
    /**
     * A representation of a text
     */
    class Text implements Expression {
        readonly comments;
        constructor(public readonly text: string, public readonly src?: string){
            this.comments = { preceding: Object.freeze(Array<string>()) };
        }
        format(format: Format<any>, syntax?: Syntax | undefined, params?: any): void {
            format.append((!utility.isValid(this.src)) ? this.text : this.src!, syntax, params);
        }
        debug(): string {
            return this.text;
        }
        equals(obj?: object | undefined): boolean {
            if (obj instanceof Text) return this.text === obj.text;
            return false;
        }
        hashCode32(): number {
            return utility.hashCode32(true, utility.asHashable(this.comments), utility.asHashable(this.text));
        }
        toString() {
            return JSON.stringify(this);
        }
    }
    /**
     * @summary Convenience class to allow for proper return values using `parse` and for namepsace documentation
     * @description The `.ini` variant of the {@link parser.PrattParser Vaughn Pratt's parser}
     */
    export class Parser extends parser.PrattParser<Expression, Syntax> {}
    /**
     * @summary The type of value accepted by the {@linkcode Format.append} method.
     * @description The value that will be sent to (and expected by) {@linkcode Format} objects
     */
    export type Appendage = string | Expression;
    /**
     * @summary A base `.csv` format
     * @description Defines how the {@link Expression parsed expression(s)} is/are outputted.
     */
    export interface Format<T = any> extends expression.GFormat<Expression, T> {
      append(data: Appendage, s?: Syntax, p?: Params): void;
    }
    /**
     * @summary The {@linkcode Expression} output as a string.
     * @description Builds and stores the parsed `.ini` data as a formatted string, good for quick formatting and testing purposes.
     */
    export class StringFormat implements Format<string> {
        public readonly logger;
        private _data = "";
        constructor() {
            //Some classic js code
            this.logger = console as any as utility.Messenger;
            /* We will be using 0x7 because it is the smallest value that has all 3 msb on. */
            (this.logger as any)._bit = 0x0;//the msb is error, the mid bit is warn and the lsb is info
            this.logger.seal = l => {
                if(this.logger.isSealed(l)) return;
                if(l === 0) {
                    ((this.logger as any)._bit as number) = 0x1 & ((this.logger as any)._bit as number);
                    this.logger.error = m => {throw Error("Sealed")}
                } else if(l === 1) {
                    ((this.logger as any)._bit as number) = 0x2 & ((this.logger as any)._bit as number);
                    this.logger.info = m => {throw Error("Sealed")}
                } else if(l === 2) {
                    ((this.logger as any)._bit as number) = 0x4 & ((this.logger as any)._bit as number);
                    this.logger.warn = m => {throw Error("Sealed")}
                }
            };
            this.logger.isSealed = l => {
                if(l === 0) {
                    return (0x1 & ((this.logger as any)._bit as number)) !== 0;
                } else if(l === 1) {
                    return (0x2 & ((this.logger as any)._bit as number)) !== 0;
                } else if(l === 2) {
                    return (0x4 & ((this.logger as any)._bit as number)) !== 0;
                }
                return false;
            };
        }
        append(data: Appendage, s?: Syntax | undefined, p?: Params | undefined): void {
            if(typeof data === "string"){
                this._data +=  data;
                this.modifications++;
            } else if(data instanceof KeyValue) {
                this.append(data.comments.preceding.length > 0 ? unwrapComments(data.comments, s) + "\n" : "", s, p);
                if(data.value.length > 0)
                    this.append(`${processEscapables(data.key, s!, this)} ${s!.delimiters[0]} ${processEscapables(data.value, s!, this)}`, s, p);
                else this.append(`${processEscapables(data.key, s!, this)}`, s, p);
                this.append(`${data.comments.inline ? data.comments.inline : ""}`, s, p);
            } else if(data instanceof Property){
                this.append(data.comments.preceding.length > 0 ? unwrapComments(data.comments, s) + "\n" : "", s, p);
                for (let i = 0; i < data.values.length; i++) {
                    this.append(data.values[i], s, p);
                    if(i < data.values.length - 1) this.append("\n", s, p);
                }
                this.append("\n", s, p);
                // this.append(`${data.comments.inline ? s!.comments.chars[0] + data.comments.inline : ""}\n`, s, p);
            } else if(data instanceof Section){
                append(this, data, s, p);
            } else if(data instanceof Text) {
                this._data += data.text;
                this.modifications++;
            } else throw new expression.FormatError("format not supported");
        }
        data(): string {
            this.logger.seal(0);
            this.logger.seal(1);
            this.logger.seal(2);
            return this._data;
        }
        reverse(): this {
            this._data.split("").reverse().join("");
            return this;
        }
        equals(another: expression.GFormat<Expression, string>): boolean {
            if (another instanceof StringFormat) return this._data === another._data;
            return false;
        }
        modifications: number = 0;
        readonly bpc: number = 8;
        readonly bpn: number = 32;
        hashCode32(): number {
            return utility.hashCode32(false, utility.asHashable(this.modifications), utility.asHashable(this.bpc), utility.asHashable(this.bpn), utility.asHashable(this._data));
        }
        toJSON(): string {
            return JSON.stringify(this);
        }
        compareTo(obj?: expression.GFormat<Expression, string> | undefined): utility.Compare {
            return utility.compare(this.hashCode32(), obj?.hashCode32());
        }
    }
    /**
     * @summary The {@linkcode Expression} output as an in-memory value format.
     * @description Builds and stores the parsed `.ini` data as a json object.
     */
    export class JSFormat implements Format<json.Value> {
        private _data: json.Pair = null as unknown as {};
        private _append(data: Section, rv: any, s?: Syntax, p?: Params) {
            for (const key in data.map) {
                if (data.map[key] instanceof Section){
                    rv[key] = {};
                    this._append(data.map[key] as Section, rv[key], s, p);
                } else if (data.map[key] instanceof Property) {
                    const prop = data.map[key] as Property;
                    if(prop.values.length < 2) {
                        rv[key] = prop.values.length === 0 ? null : s?.parse(prop.values[0].value);
                    } else {
                        rv[key] = Array<string>();
                        for (let i = 0; i < prop.values.length; i++) {
                            rv[key].push(s?.parse(prop.values[i].value));
                        }
                    }
                } else throw new expression.ExpressionError(`Illegal value found at ${key}`);
            }
        }
        append(data: Appendage, s?: Syntax | undefined, p?: Params | undefined): void {
            /*if(typeof data === "string"){
                this._data[data] = null;
                this.modifications++;
            } else if(data instanceof KeyValue) {
                if(!utility.isValid(this._data[data.key])) this._data[data.key] = Array<any>();
                (this._data[data.key] as any[]).push(s!.parse(data.value));
            } else if(data instanceof Property){
                for (let i = 0; i < data.values.length; i++) {
                    this.append(data.values[i], s, p);
                }
            } else */if(data instanceof Section){
                // const keys = Object.keys(data.map);
                if(!utility.isValid(this._data))//{
                    this._data = {};
                //     this._append(data.map[s!.globalName] as Section, this._data, s, p);
                // } else
                this._append(data, this._data, s, p);
            }/* else if(data instanceof Text) {
                this._data[data.text] = null;
                this.modifications++;
            } */else throw new expression.FormatError("format not supported", data as any);
        }
        data(): json.Pair {
            return this._data;
        }
        reverse(): this {
            return this;
        }
        equals(another: expression.GFormat<Expression, json.Value>): boolean {
            if (another instanceof JSFormat) return this._data === another._data;
            return false;
        }
        modifications: number = 0;
        readonly bpc: number = 8;
        readonly bpn: number = 32;
        hashCode32(): number {
            return utility.hashCode32(false, utility.asHashable(this.modifications), utility.asHashable(this.bpc), utility.asHashable(this.bpn), utility.asHashable(this._data));
        }
        toJSON(): string {
            return JSON.stringify(this);
        }
    }
    /**
     * @summary The {@linkcode Expression} output written to a file system.
     * @description Writes the parsed `.ini` data to a file system.
     */
    export class FileFormat implements Format<ReadStream> {
        public readonly logger;
        private _str: WriteStream;
        constructor(filename: string){
            this._str = createWriteStream(filename, {
                autoClose: true,
                emitClose: false,
                encoding: "utf-8"
            });
            //Some classic js code
            this.logger = console as any as utility.Messenger;
            // (this.logger as any)._bitMask = 0x7;//because it is the smallest value that has all 3 msb on.
            (this.logger as any)._bit = 0x0;//the msb is error, the mid bit is warn and the lsb is info
            this.logger.seal = l => {
                if(this.logger.isSealed(l)) return;
                if(l === 0) {
                    ((this.logger as any)._bit as number) = 0x1 & ((this.logger as any)._bit as number);
                    this.logger.error = m => {throw Error("Sealed")}
                } else if(l === 1) {
                    ((this.logger as any)._bit as number) = 0x2 & ((this.logger as any)._bit as number);
                    this.logger.info = m => {throw Error("Sealed")}
                } else if(l === 2) {
                    ((this.logger as any)._bit as number) = 0x4 & ((this.logger as any)._bit as number);
                    this.logger.warn = m => {throw Error("Sealed")}
                }
            };
            this.logger.isSealed = l => {
                if(l === 0) {
                    return (0x1 & ((this.logger as any)._bit as number)) !== 0;
                } else if(l === 1) {
                    return (0x2 & ((this.logger as any)._bit as number)) !== 0;
                } else if(l === 2) {
                    return (0x4 & ((this.logger as any)._bit as number)) !== 0;
                }
                return false;
            };
        }
        public endWrite() {
            this.logger.seal(0);
            this.logger.seal(1);
            this.logger.seal(2);
          this._str!.end();
          this._str!.close();
        }
        append(data: Appendage, s?: Syntax | undefined, p?: Params | undefined): void {
            if(typeof data === "string"){
                this._str.write(data);
                this.modifications++;
            } else if(data instanceof KeyValue) {
                this.append(data.comments.preceding.length > 0 ? unwrapComments(data.comments, s) + "\n" : "", s, p);
                if(data.value.length > 0)
                    this.append(`${processEscapables(data.key, s!, this)} ${s!.delimiters[0]} ${processEscapables(data.value, s!, this)}`, s, p);
                else this.append(`${processEscapables(data.key, s!, this)}`, s, p);
                this.append(`${data.comments.inline ? data.comments.inline : ""}`, s, p);
            } else if(data instanceof Property){
                this.append(data.comments.preceding.length > 0 ? unwrapComments(data.comments, s) + "\n" : "", s, p);
                for (let i = 0; i < data.values.length; i++) {
                    this.append(data.values[i], s, p);
                    if(i < data.values.length - 1) this.append("\n", s, p);
                }
                this.append("\n", s, p);
                // this.append(`${data.comments.inline ? s!.comments.chars[0] + data.comments.inline : ""}\n`, s, p);
            } else if(data instanceof Section){
                this.append(data.comments.preceding.length > 0 ? unwrapComments(data.comments, s) : "", s, p);
                append(this, data, s, p);
            } else if(data instanceof Text) {
                this._str.write(data.text);
                this.modifications++;
            } else throw new expression.FormatError("format not supported");
        }
        data(): ReadStream {
            this.logger.seal(0);
            this.logger.seal(1);
            this.logger.seal(2);
            return createReadStream(this._str.path, {
              autoClose: true,
              encoding: "utf-8"
            });
        }
        reverse(): this {
            return this;
        }
        equals(another: expression.GFormat<Expression, ReadStream>): boolean {
            if (another instanceof FileFormat) return this._str.path === another._str.path;
            return false;
        }
        modifications: number = 0;
        readonly bpc: number = 8;
        readonly bpn: number = 32;
        hashCode32(): number {
            return utility.hashCode32(false, utility.asHashable(this.modifications), utility.asHashable(this.bpc), utility.asHashable(this.bpn), utility.asHashable(this._str));
        }
        toJSON(): string {
            return JSON.stringify(this);
        }
    }
    /**
     * @summary The `.ini` port of the converter class.
     */
    export class Converter extends parser.Converter<parser.GToken<string>, Expression, Syntax, Parser, Params, MutableLexer, any> {
        _transform(
          chunk: any,
          encoding: BufferEncoding,
          callback: TransformCallback
        ): void {
          if (!this.writableObjectMode) {
            chunk = Buffer.isBuffer(chunk)
              ? iconv.decode(chunk as Buffer, this.syntax.metadata!.encoding)
              : String(chunk);
          }
          try {
            this.lexer.process(chunk, this.syntax, this.params);
            callback();
          } catch (e) {
            return callback(e as Error);
          }
        }
        _flush(callback: TransformCallback): void {
          this.lexer.end(this.syntax, this.params);
          if (this.lexer.hasTokens()) {
            try {
                const e = this.parser.parse(this.lexer, this.syntax, this.params);
              return callback(null, e);
            } catch (e) {
              return callback(e as Error);
            }
          }
        }
    }

    /**
     * @summary A generic syntax
     * @description A syntax that retains all the defaults of the `SyntaxBuilder` class except that it does not retain comments.
     */
    export const GENERIC = new SyntaxBuilder().retainComments(false).build();


        /**
         * @summary A syntax for a parser that can parse `.ini` data with syntax prevalent in the unix circles.
         * @description
         * A syntax for the data resembling those found frequently unix config files. It has the following features:
         * - Comments are lines that begin with `'#'`. Inline comments are supported, however,
         * the parser does not retain comments, hence {@linkcode FileFormat} will not write
         * comments to a file. To support comment retention do:
         * ```ts
         * var syntax = new SyntaxBuilder().rebuild(UNIX).retainComments(true).build();
         * ```
         * - `'='` assigns a value to the declared key.
         * - `'['` begins a section name declaration and `']'` ends it.
         * - This syntax does supports nesting for section names, and {@linkcode JSFormat} will recognise
         * them as a nested objects.
         * - Quoted text is supported and will be parsed as such, either single (`'`) or double (`"`).
         * Escapes are supported including
         *  - `\n` for line feed
         *  - `\t` for tabs
         *  - `\r` for carriage return
         *  - `\'` for apostrophes
         *  - `\"` for double quotes
         *  - `\\` for backslahes
         *  - `\0` for the null character
         *  - `\=` for equals
         *  - `\[` for left bracket
         *  - `\]` for right bracket
         *  - `\#` for number sign
         *  - `\b` for backspace
         *  - `\a` for the bell character?
         *  - and `\` followed by a new line to literarily place a new line within a quoted text.
         * 
         * - Escapes are not allowed in none quoted text, they will be parsed as literal.
         * - Unicode escapes are unsupported.
         * - The escape character is `'\'`.
         * - All escaped characters are special characters. All special characters in a quoted text
         * will be parsed as part of the text irrespective of it's special status.
         * - All identifiers are of the string type hence {@linkcode Syntax.parse} will always return a `string`.
         * - Declaring a section more than once with the same identifier will cause the properties of the duplicate
         * to be merged with into the original. Declaring a property with the same key more than once
         * will the original to be overridden by the copy.
         */
    export const UNIX = new SyntaxBuilder()
        .removeCommentChar(";")
        .retainComments(false)
        .supportNonQuotedEscape(true)
        .supportQuotedText(true)
        .removeDelimiter(':')
        .removeNestingChar('/')
        .setDuplicateDirective(DuplicateDirective.OVERWRITE, true)
        .setDuplicateDirective(DuplicateDirective.MERGE, false)
        .build();


        /**
         * @summary A syntax for a parser that can parse `.properties` data.
         * @description
         * A syntax that for the data that can be parsed by the JDK's (Java Development Kit) java.util.Properties class.
         * It has the following features:
         * - Comments are lines that begin with `'#'` or `'!'`. Inline comments are not supported,
         * the parser does not retain comments, hence {@linkcode FileFormat} will not write
         * comments to a file.
         * - `'='`, `':'`, `'\t'` and `'\f'` assigns a value to the declared key.
         * - section names cannot be declared
         * - Quoted text is not supported and will be parsed as a literal. However, non quoted escapes
         * are supported and they include
         *  - `\n` for line feed
         *  - `\t` for tabs
         *  - `\r` for carriage return
         *  - `\'` for apostrophes
         *  - `\"` for double quotes
         *  - `\\` for backslahes
         *  - `\0` for the null character
         *  - `\=` for equals
         *  - `\:` for colon
         *  - `\#` for hash symbol
         *  - `\!` for exclamation mark
         *  - `\` followed by a literal tab for a literal tab
         *  - `\b` for backspace
         *  - `\a` for the bell character?
         *  - and `\` followed by a new line to literarily place a new line within a quoted text.
         * 
         * - Unicode escapes are supported. All unicode escape follow the java convention, where
         * `'u'` (case insensitive) is the escape and at most 4 hex numerals follow after.
         * - The escape character is `'\'`.
         * - All escaped characters are special characters.
         * - All identifiers are of the string type hence {@linkcode Syntax.parse} will always return a `string`.
         * - Declaring a property with the same key more than once
         * will cause the orignal value to be overwritten by the duplicate.
         */
    export const PROPERTIES = new SyntaxBuilder()
        .removeCommentChar(";")
        .setSectionStart(utility.specialCharacters[0])
        .setSectionEnd(utility.specialCharacters[1])
        .addCommentChar("!")
        .supportInline(false)
        .retainComments(false)//Can't decide on this functionality
        .addDelimiter('\t')
        .addDelimiter('\f')
        .setDuplicateDirective(DuplicateDirective.OVERWRITE, true)
        .setDuplicateDirective(DuplicateDirective.THROW, false)
        .removeSupportForNesting()
        .supportQuotedText(false)
        .supportNonQuotedEscape(true)
        .removeUnicodeChar('x')
        .removeUnicodeChar('X')
        .build();

        /**
         * @summary A syntax for a parser that can parse `.ini` file like the winapi.
         * @description
         * A syntax for the data parsable by the winapi. It has the following features:
         * - Comments are lines that begin with `';'`. Inline comments are not supported,
         * the parser does not retain comments, hence {@linkcode FileFormat} will not write
         * comments to a file.
         * - `'='` assigns a value to the declared key.
         * - `'['` begins a section name declaration and `']'` ends it.
         * - This syntax does not support nesting for section names, however, when they are used,
         * they will be parsed as a single identifier and {@linkcode JSFormat} will not recognise
         * them as a nested objects.
         * - Quoted text is supported and will be parsed as such, either single (`'`) or double (`"`).
         * Escapes are supported including
         *  - `\n` for line feed
         *  - `\t` for tabs
         *  - `\r` for carriage return
         *  - `\'` for apostrophes
         *  - `\"` for double quotes
         *  - `\\` for backslahes
         *  - `\0` for the null character
         *  - `\=` for equals
         *  - `\[` for left bracket
         *  - `\]` for right bracket
         *  - `\;` for semicolon
         *  - `\b` for backspace
         *  - `\a` for the bell character?
         *  - and `\` followed by a new line to literarily place a new line within a quoted text.
         * 
         * - Escapes are not allowed in none quoted text, they will be parsed as literal.
         * - Unicode escapes are unsupported.
         * - The escape character is `'\'`.
         * - All escaped characters are special characters. All special characters in a quoted text
         * will be parsed as part of the text irrespective of it's special status.
         * - All identifiers are of the string type hence {@linkcode Syntax.parse} will always return a `string`.
         * - Declaring a section more than once with the same identifier will cause the
         * duplicate to be ignored. Declaring a property with the same key more than once
         * will cause the duplicate's value to be merged with the original, creating an array of
         * values mapped to the given key.
         */
    export const WINAPI = new SyntaxBuilder()
        .removeCommentChar('#')//only ';' is supported
        .supportInline(false)
        .setDuplicateDirective(DuplicateDirective.DISCARD, false)//for sections
        // .setDuplicateDirective(DuplicateDirective.MERGE, true)//for props, already the default
        .retainComments(false)//Can't decide on this functionality
        .removeDelimiter(':')//only "=" will be used
        .removeSupportForNesting()//no nesting char needed
        // .supportRelativeNesting(true)// nesting already removed
        .removeUnicodeChar('x')// Donot support unicode escapes
        .removeUnicodeChar('X')// Donot support unicode escapes
        .removeUnicodeChar('U')// Donot support unicode escapes
        .removeUnicodeChar('u')// Donot support unicode escapes
        // .supportNonQuotedEscape(false)//already the default
        // .supportQuotedText(true)//already the default
        .setEscapeChar('\x00')//Prevent escapes. No need to set escape parser as it will never be needed by the parser or formatter as no escape is set
        .setEscapeParser(e => e)// Just for lols
        .build();
    // export const UNIX
}
export default ini;
