import { createReadStream, createWriteStream, ReadStream, WriteStream } from "fs";
import { TransformCallback } from "node:stream";
import utility from "../utility.js";
import expression from "./expression.js";
import json from "./json.js";
import parser from "./parser.js";
import iconv from "iconv-lite";
/**
 * #### Examples
 * - .ini
 * - .conf
 * - .cfg
 * - .desktop
 * - git config file
 * - php config file
 * 
 * #### tokens
 * - `[` --> *section start*
 * - `'` --> *quote*
 * - `"` --> *double quote*
 * - **_plain text_** --> *untokenised string of characters*
 * - `'` --> *quote end*
 * - `"` --> *double quote end*
 * - `.` --> *sub-section*
 * - `]` --> *section end*
 * - `;` --> *comment*
 * - `=` --> *assignment*
 * - `\` --> *escape*
 * - **_escaped text_** --> *escaped* - text precede by an *escape*
 * 
 * @summary Defines the constituents of the ini pipeline.
 * @description
 * The ini pipeline constitutes tokenisers (lexers) for tokenising text and json data; a parser which translates the
 * tokens into expressions; formatters which can create file, in-memory and simple string formats; a converter which binds several
 * of the aforementioned components so that the data contained within can be tranferred to other data languages seamlessly. This cannot parse '.cfg' texts.
 * @example ### An example of an ini file:
 * ```ini
 * ; The start of this config
 * [Global]
 * prop1 = 12345
 * prop2 = "string"
 * prop3 = false
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
 * Recfiles and toml are currently unsupported
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
    function processEscapables(text: string, s: Syntax, f: Format): string {
        if(!utility.isValid(s.escape)) return text;
        let val = "";
        let isQuotable = false;
        for (let i = 0; i < text.length; i++) {
            let isEscapable;
            if(!Array.isArray(s.escape!.isSpecial)) isEscapable = (s.escape!.isSpecial as ((e: string) => boolean))(text[i]);
            else isEscapable = s.escape!.isSpecial.indexOf(text[i]) >= 0;
            if(isEscapable) {
                // f.logger!.info(`isEscapable: ${text[i]} --> ${isEscapable}`);
                const escaped = `${s.escape!.char}${text[i]}`;
                if(s.escape!.quoted) {isQuotable = true; val += escaped;}
                else if(s.escape!.nonQuotedEsc) val += escaped;
                else if(utility.isValid(f.logger)) {
                    f.logger!.warn(`The character '${text[i]}' in string "${text}" needs to be escaped but it's not because the syntax does not support escaping special characters. When it is parsed from this format, an error will be thrown`);
                    val += text[i];
                }
            } else {
                val += text[i];
            }
        }
        return isQuotable ? `"${val}"` : val;
    }
    /**
     * Does the same function as {@link Format.append `Format.append`}.
     */
    function append(f: Format<any>, data: Section, s?: Syntax, p?: Params, name = "") {
        let coverSecName = false;
        for (const key in data.map) {
            if (data.map[key] instanceof Section){
                // f.append('\n', s, p);
                append(f, data.map[key] as Section, s, p, name.length > 0 ? `${name}.${processEscapables(key, s!, f)}` : `\n[${processEscapables(key, s!, f)}`);
            } else if (data.map[key] instanceof Property){
                if(name.length > 0 && !coverSecName) {f.append(`${name}]`, s, p); f.append("\n", s, p); coverSecName = true;}
                if(data.comments.inline && data.comments.inline.length > 0)
                f.append(`${data.comments.inline}\n`, s, p);
                f.append((data.map[key] as Property), s, p);
            } else throw new expression.ExpressionError(`Illegal value found at ${name}.${key}`);
            // f.append('\n', s, p);
        }
    }
    function unwrapComments(comments: { preceding: readonly string[] }, s?: Syntax) {
        if(utility.isValid(s)) return s!.comments.chars[0] + comments.preceding.join("\n;").concat("\n");
        return ";" + comments.preceding.join("\n;").concat("\n");
    }
    function isText(e: Expression): e is Text {
        return utility.isValid(e) && e instanceof Text;
    }
    function skipBlankLines(l: MutableLexer<any>, s: Syntax, p: Parser, pa: Params): void {
        while(p.match(EOL, l, s, pa)) p.consume(EOL, l, s, pa);
    }
    function parseComment(l: MutableLexer<any>, s: Syntax, p: Parser, pa: Params): string[] {
        const comments = Array<string>();
        while (true) {
            if(p.match(COMMENT, l, s, pa)) comments.push(p.consume(COMMENT, l, s, pa).value);
            else if(p.match(SECTION_START, l, s, pa)) comments.push(p.consume(SECTION_START, l, s, pa).value);
            else if(p.match(D_QUOTE, l, s, pa)) comments.push(p.consume(D_QUOTE, l, s, pa).value);
            else if(p.match(QUOTE, l, s, pa)) comments.push(p.consume(QUOTE, l, s, pa).value);
            else if(p.match(TEXT, l, s, pa)) comments.push(p.consume(TEXT, l, s, pa).value);
            else if(p.match(SUB_SECTION, l, s, pa)) comments.push(p.consume(SUB_SECTION, l, s, pa).value);
            else if(p.match(SECTION_END, l, s, pa)) comments.push(p.consume(SECTION_END, l, s, pa).value);
            else if(p.match(ASSIGNMENT, l, s, pa)) comments.push(p.consume(ASSIGNMENT, l, s, pa).value);
            else if(p.match(D_QUOTE_END, l, s, pa)) comments.push(p.consume(D_QUOTE_END, l, s, pa).value);
            else if(p.match(QUOTE_END, l, s, pa)) comments.push(p.consume(QUOTE_END, l, s, pa).value);
            else if(p.match(ESCAPE, l, s, pa)) comments.push(p.consume(ESCAPE, l, s, pa).value);
            else if(p.match(ESCAPED, l, s, pa)) comments.push(p.consume(ESCAPED, l, s, pa).value);
            else if(p.match(WHITESPACE, l, s, pa)) comments.push(p.consume(WHITESPACE, l, s, pa).value);
            else if(p.match(EOL, l, s, pa)) break;
        }
        return comments;
    }
    function comments(preceding = Object.freeze(Array<string>()), inline: string = "") {
        return {preceding, inline}
    }
    function emptyComment() {
        return comments();
    }
    function mergeTokens(t: Token[]){
        // return t.reduce((lexeme: string, tk: Token) => lexeme + tk.value, "");
        let text = "";
        for (let i = 0; i < t.length; i++) {
            text += t[i].value;
        }
        return text;
    }
    export class SyntaxBuilder implements utility.Builder<Syntax> {
        private _com: {retain: boolean, chars: string[], inline: boolean} = {retain: true, chars: [';', "#"], inline: true};
        private _del: string[] = [':', '='];
        private _dd = {section: DuplicateDirective.MERGE, property: DuplicateDirective.MERGE};
        private _nes?: {chars: string[], relative: boolean} = {chars: ['.', '/'], relative: true};
        // private _glo: string = "";
        private _isSpecial = (s: string) => {
            return ["\n", "\r", "[", "]", "\"", "'"].indexOf(s) >= 0 || this._com.chars.indexOf(s) >= 0 || this._del.indexOf(s) >= 0 || (utility.isValid(this._esc) && this._esc!.char === s);
        }
        private _esc?: {quoted: boolean, nonQuotedEsc: boolean, unicode: string[], char: string, isSpecial: (((s: string) => boolean) | string[]), parse(e: string): string}
            = {
                char: "\\",
                quoted: true,
                nonQuotedEsc: false,
                unicode: ['x', 'u'],
                isSpecial: this._isSpecial,
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
                        case "0":
                            return "\0";
                        case "a": return "\a";
                        case "b": return "\b";
                        case "t": return "\t"
                        case "r": return "\r"
                        default:
                    }
                    return e;
                }
            };
        private _md = {fileExt: "ini", isStandard: false, standard: "", mediaType: "text/plain, application/textedit, zz-application/zz-winassoc-ini"}
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
        private _ensureUniqueness(s: string, truthy?: any) {
            if(!utility.isValid(s)) throw Error("undefined cannot be used");
            if(truthy && s.length > 1) throw Error("Only a single character is required");
            if(this._com!.chars.indexOf(s) >= 0)
            throw new Error(`${s} is not unique. It is used as a comment`); 
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
        constructor(){
            this.addPrefixCommand(COMMENT, new ParseComment(parser.Direction.PREFIX));
            this.addPrefixCommand(EOL, new EndLine());
            this.addPrefixCommand(ASSIGNMENT, new Assign(parser.Direction.PREFIX));
            this.addPrefixCommand(TEXT, new ParseText());
            this.addPrefixCommand(D_QUOTE, new ParseText());
            this.addPrefixCommand(QUOTE, new ParseText());
            this.addPrefixCommand(SECTION_START, new ParseSection());
            this.addPrefixCommand(WHITESPACE, new ParseSpace());
            this.addPrefixCommand(INIT, new Initializer());
            this.addInfixCommand(COMMENT, new ParseComment(parser.Direction.INFIX));
            this.addInfixCommand(ASSIGNMENT, new Assign(parser.Direction.INFIX));
            // this.addInfixCommand(EOL, new EndLine());
            this.addInfixCommand(WHITESPACE, new ParseSpace());
        }
        public removeSupportForNesting() : SyntaxBuilder{
            this._nes = undefined;
            return this;
        }
        public removeSupportForEscape() : SyntaxBuilder{
            this._esc = undefined;
            return this;
        }
        public removeCommentChar(char: string) : SyntaxBuilder{
            // this._com!.chars = this._com!.chars.reduce((p, c) => c === char ? p : [...p, c], Array<string>());
            let ind = -1;
            for (let i = 0; i < this._com!.chars.length; i++) {
                if(this._com!.chars[i] === char) {ind = i; break;}
            }
            if(ind >= 0) this._com?.chars.splice(ind, 1);
            return this;
        }
        public removeDelimiter(delim: string) : SyntaxBuilder{
            // this._del = this._del.reduce((p, c) => c === delim ? p : [...p, c], Array<string>());
            let ind = -1;
            for (let i = 0; i < this._del.length; i++) {
                if(this._del[i] === delim) {ind = i; break;}
            }
            if(ind >= 0) this._del.splice(ind, 1);
            return this;
        }
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
        public addCommentChar(char: string): SyntaxBuilder{
            this._ensureUniqueness(char, true);
            this._com.chars.push(char);
            return this;
        }
        public addDelimiter(delim: string): SyntaxBuilder{
            this._ensureUniqueness(delim, true);
            this._del.push(delim);
            return this;
        }
        public addNestingChar(char: string): SyntaxBuilder{
            this._ensureUniqueness(char, true);
            try {
                this._nes!.chars.push(char);
            } catch (e) {}
            return this;
        }
        public addUnicodeChar(char: string): SyntaxBuilder{
            this._ensureUniqueness(char, true);
            try {
                this._esc?.unicode.push(char);
            } catch (e) {}
            return this;
        }
        public retainComments(b: boolean) : SyntaxBuilder{
            this._com.retain = b;
            return this;
        }
        public supportNonQuotedEscape(b: boolean): SyntaxBuilder {
            try {
                this._esc!.nonQuotedEsc = b;
            } catch(e: any) {
                throw new Error("Escape object is undefined for this builder", e);
            }
            return this;
        }
        public supportInline(b: boolean) : SyntaxBuilder{
            this._com.inline = b;
            return this;
        }
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
        public supportQuotedText(b: boolean) : SyntaxBuilder{
            try {
                this._esc!.quoted = b;
            } catch(e: any) {
                throw new Error("Escape object is undefined for this builder", e);
            }
            return this;
        }
        public setEscapeChar(char: string) : SyntaxBuilder{
            this._ensureUniqueness(char, true);
            try {
                this._esc!.char = char;
            } catch(e: any) {
                throw new Error("Escape object is undefined for this builder", e);
            }
            return this;
        }
        public setEscapeParser(p: (e: string) => string) : SyntaxBuilder{
            try {
                this._esc!.parse = p??this._esc!.parse;
            } catch (e) {
                throw Error("Escape object is undefined for this Builder");
            }
            return this;
        }
        public setFormatParser(p: (v: string) => json.Value) : SyntaxBuilder{
            this._p = p??this._p;
            return this;
        }
        public setDupDirective(dd: DuplicateDirective, forProperty?: boolean): SyntaxBuilder {
            if(utility.isValid(forProperty)) {
                if(forProperty) this._dd.property = dd;
                else this._dd.section = dd;
            } else {
                this._dd.property = dd??this._dd.property;
                this._dd.section = dd??this._dd.section;
            }
            return this;
        }
        private _pushOrOverite(map: [parser.GType<string>, Command][], t: parser.GType<string>, cmd: Command){
          for (let i = 0; i < map.length; i++)
            if(map[i][0].equals(t)) {
              map[i] = [t, cmd];
              return;
            }
          map.push([t, cmd]);
        }
        public addInfixCommand(type: parser.GType<string>, cmd: Command): SyntaxBuilder {
            // this._infCmdlets.push([type, cmd]);
            this._pushOrOverite(this._infCmdlets, type, cmd);
            return this;
        }
        public removeInfixCommand(type: parser.GType<string>): SyntaxBuilder {
            this._infCmdlets = this._infCmdlets.filter(v => !v[0].equals(type));
            return this;
        }
        public addPrefixCommand(type: parser.GType<string>, cmd: Command): SyntaxBuilder {
            // this._infCmdlets.push([type, cmd]);
            this._pushOrOverite(this._preCmdlets, type, cmd);
            return this;
        }
        public removePrefixCommand(type: parser.GType<string>): SyntaxBuilder {
            this._preCmdlets = this._preCmdlets.filter(v => !v[0].equals(type));
            return this;
        }
        public addPostfixCommand(type: parser.GType<string>, cmd: Command): SyntaxBuilder {
            // this._infCmdlets.push([type, cmd]);
            this._pushOrOverite(this._posCmdlets, type, cmd);
            return this;
        }
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
         * Sets the {@link Syntax.esc.isSpecial isSpecial property} in the syntax to be built.
         * @remark
         * The default is a function that returns `true` if the argument is the comment character, a delimiter, the escape character or is one of the following: `'\r'`, `'\n'`, `'['`, `']'`, `'\''`, `'"'`.
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
        public clear(toDefault = false): SyntaxBuilder {
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
                this._dd = {section: DuplicateDirective.MERGE, property: DuplicateDirective.MERGE};
                this._nes = {chars: ['.', '/'], relative: true};
                this._esc = {
                    char: "\\",
                    quoted: true,
                    nonQuotedEsc: false,
                    unicode: ['x', 'u'],
                    isSpecial: this._isSpecial,
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
                this._com = {retain: false, chars: [], inline: false};
                this._nes = undefined;
                this._esc = undefined;
                this._p = (v: string) => v;
            }
            return this;
        }
        public build(): Syntax {
            if(utility.isValid(this._esc) && this._esc!.nonQuotedEsc)
                this.addPrefixCommand(ESCAPE, new ParseInitialEscape());
            return Object.freeze({
                metadata: {...this._md, encoding: "utf-8"},
                comments: {
                    ...this._com!,
                    chars: Object.freeze(this._com!.chars)
                },
                delimiters: Object.freeze(this._del),
                nesting: utility.isValid(this._nes) ? {...this._nes!, chars: Object.freeze(this._nes!.chars)} : undefined,
                duplicateDirective: this._dd,
                escape: utility.isValid(this._esc) ? {...this._esc!, unicode: Object.freeze(this._esc!.unicode)} : undefined,
                parse: this._p,
                getCommand: this._getCmd
            }) as Syntax;
        }
        public rebuild(from: Syntax): SyntaxBuilder {
            this._md = from.metadata as any;
            this._com = from.comments as typeof this._com;
            this._esc = from.escape as typeof this._esc;
            this._nes = from.nesting as typeof this._nes;
            this._del = from.delimiters as typeof this._del;
            // this._glo = from.globalName;
            this._dd = from.duplicateDirective;
            this._p = from.parse;
            this._getCmd = from.getCommand;
            return this;
        }
    }
    /**
     * Duplicate properties merge values and duplicate sections merge their properties
     */
    export interface Syntax extends parser.GSyntax<Type, Command>{
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
         */
        readonly delimiters: readonly string[];
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
        /**The name for default parent section
         * @type {string}
         * @readonly
         */
        // readonly globalName: string;
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
    export class Params {
        /**
         * The current section's name i.e the name of a property of {@link global} that was last parsed
         * @type {string}
         */
        section: string[] = [];
        /**An array of strings representing consecutiveline of comments. This value is empty the moment a {@link Section} or {@link Property} is parsed. */
        block = Array<string>();
        /**inline comments as a `string`. This value is reset every time */
        inline: string = "";
        /**Defines the state of the parser when parsing inside of a section name as a `boolean` */
        insideSecName = false;
        /**Specifies whether or not an assignment of a value to a key/name has been done */
        assigned = false;
        /**inline comments complete with their line number and actual comment */
        // inline: Map<number, string> = new Map();
    }
    /**
     * - `'['` section start
     * - `']'` section end
     * - `'='` assignment within a property
     * - `';'` `'#'` `'!'` comment start (comment may be retained by configuring the syntax so)
     * - **text** these are the names of sections, properties and the value of a property.
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

    export const EOF: parser.GType<string> = new Type("-1", Number.MIN_SAFE_INTEGER);
    export const EOL: parser.GType<string> = new Type("0", 1);
    export const SECTION_START: parser.GType<string> = new Type("1", 2);
    export const QUOTE: parser.GType<string> = new Type("2", 5);
    export const D_QUOTE: parser.GType<string> = new Type("3", 5);
    export const TEXT: parser.GType<string> = new Type("4", 5);
    export const SUB_SECTION: parser.GType<string> = new Type("5", 3);
    export const SECTION_END: parser.GType<string> = new Type("6", 1);
    export const ASSIGNMENT: parser.GType<string> = new Type("7", 3);//Does not matter the precedence it has will will always be parsed with the `parse(0)` So it will be parsed as long as it's precedence is greater than 0
    export const COMMENT: parser.GType<string> = new Type("8", 5);
    export const QUOTE_END: parser.GType<string> = new Type("9", 5);
    export const D_QUOTE_END: parser.GType<string> = new Type("10", 5);
    export const ESCAPE: parser.GType<string> = new Type("11", 5);
    export const ESCAPED: parser.GType<string> = new Type("12", 5);
    export const WHITESPACE: parser.GType<string> = new Type("13", 5);
    export const INIT: parser.GType<string> = new Type("14", Number.MAX_SAFE_INTEGER);

    class Token implements parser.GToken<string> {
        public readonly length;
        constructor(
            public readonly value: string,
            public readonly type: Type,
            public readonly lineStart: number,
            public readonly lineEnd: number,
            public readonly startPos: number
            // public readonly names?: string[]
        ){
            this.length = value.length;
        }
        public toString() {
          return JSON.stringify(
            { token: this.value, type: this.type.toString() },
            null,
            2
          );
        }
    }
    export interface MutableLexer<CH = string> extends parser.MutableLexer<Token, Syntax, CH> {
      end(syntax: Syntax, p: Params | any): void;
      process(chunk: CH, syntax: Syntax, p: Params | any): void;
    }
    /**
     * - `{}` *maps to* a section with property names that are strings
     * - `[]` *maps to* a section with properties names that are numbers
     * - `null` *maps to* a property name (key) that is an empty string
     * - `'a string'` *maps to* a property name (key) that is a string with the value `'a string'`
     * - `true` *maps to* a property name (key) that is a string with the value `true`
     * - `false` *maps to* a property name (key) that is a string with the value `false`
     * - `-3.4` *maps to* a property name (key) that is a string with the value `-3.4` \
     * 
     * Remember to adjust ParseText to retain leading and trailing whitespaces in a quoted text
     */
    export class JSONLexer implements MutableLexer<json.Value> {
        private _queue;
        private _i = 0;
        private _canProcess = true;
        constructor(){
            this._queue = Array<Token>(new Token("", INIT, -1, -1, -1));
        }
        /*We should only process escapables for output format and not for input parsing because it is in internal form and the parser does not care about escapes when a string is in memory*/
        /*private _processEscapables(text: string, s: Syntax): string {
            if(!utility.isValid(s.escape)) return text;
            let val = "";
            let isQuotable = false;
            for (let i = 0; i < text.length; i++) {
                const isEscapable = Array.isArray(s.escape!.isSpecial) ? s.escape!.isSpecial.indexOf(text[i]) >= 0 : (s.escape!.isSpecial as ((e: string) => boolean))(text[i]);
                if(isEscapable) {
                    const escaped = s.escape!.parse(`${s.escape!.char}${text[i]}`);
                    if(s.escape!.quoted) isQuotable = true;
                    else 
                }
                const escaped = s.escape!.parse(`${s.escape!.char}${text[i]}`);
                if(escaped.length > 1 && escaped[0] === s.escape!.char) val += escaped.substring(1);
                else if(s.escape!.quoted) {val += escaped; isQuotable = true; }
                else throw new parser.ParseError(`Cannot have escapable characters in an unquoted text at: ${this._i}`);
            }
            return isQuotable ? `"${val}"` : val;
        }*/
        private _process(o: json.Value, s: Syntax, name = Array<Token>()) {
            if(json.isAtomic(o)) {
                if(name.length > 0) {
                    do {
                        this.#manufacture(name.shift()!);
                    } while(name.length > 0);
                    this.#manufacture(new Token("]", SECTION_END, 0, 0, this._i++));
                    this.#manufacture(new Token("\n", EOL, 0, 0, this._i++));
                }
                this.#manufacture(new Token(o !== null ? String(o) : "", TEXT, 0, 0, this._i++));
            } else if(Array.isArray(o)) {
                for (let i = 0; i < o.length; i++) {
                    if(json.isAtomic(o[i])) {
                        if(name.length > 0) {
                            do {
                                this.#manufacture(name.shift()!);
                            } while(name.length > 0);
                            this.#manufacture(new Token("]", SECTION_END, 0, 0, this._i++));
                            this.#manufacture(new Token("\n", EOL, 0, 0, this._i++));
                        }
                        this.#manufacture(new Token(i.toString(), TEXT, 0, 0, this._i++));
                        this.#manufacture(new Token(s.delimiters[0], ASSIGNMENT, 0, 0, this._i++));
                        this.#manufacture(new Token(String(o[i]??""), TEXT, 0, 0, this._i++));
                        this.#manufacture(new Token("\n", EOL, 0, 0, this._i++));
                    } else if(Array.isArray(o[i])) {
                        let array = o[i] as any[];
                        if(json.arrayIsAtomic(array)) for(let j = 0; j < array.length; j++) {
                            this.#manufacture(new Token(i.toString(), TEXT, 0, 0, this._i++));
                            this.#manufacture(new Token(s.delimiters[0], ASSIGNMENT, 0, 0, this._i++));
                            this.#manufacture(new Token(String(array[j]??""), TEXT, 0, 0, this._i++));
                            this.#manufacture(new Token("\n", EOL, 0, 0, this._i++));
                        } else if(utility.isValid(s.nesting)) {
                            if(name.length < 1) name.push(new Token("[", SECTION_START, 0, 0, this._i++));
                            else name.push(new Token(s.nesting!.chars[0], SUB_SECTION, 0, 0, this._i++));
                            name.push(new Token(i.toString(), TEXT, 0, 0, this._i++));
                            this._process(o[i], s, name);
                        } else {
                            this.#manufacture(new Token(i.toString(), TEXT, 0, 0, this._i++));
                            this.#manufacture(new Token(s.delimiters[0], ASSIGNMENT, 0, 0, this._i++));
                            this.#manufacture(new Token(JSON.stringify(o[i]), TEXT, 0, 0, this._i++));
                            this.#manufacture(new Token("\n", EOL, 0, 0, this._i++));
                        }
                    } else if(typeof o[i] === "object") {
                        if(utility.isValid(s.nesting)) {
                            if(name.length < 1) name.push(new Token("[", SECTION_START, 0, 0, this._i++));
                            else name.push(new Token(s.nesting!.chars[0], SUB_SECTION, 0, 0, this._i++));
                            name.push(new Token(i.toString(), TEXT, 0, 0, this._i++));
                            this._process(o[i], s, name);
                        } else {
                            this.#manufacture(new Token(i.toString(), TEXT, 0, 0, this._i++));
                            this.#manufacture(new Token(s.delimiters[0], ASSIGNMENT, 0, 0, this._i++));
                            this.#manufacture(new Token(JSON.stringify(o[i]), TEXT, 0, 0, this._i++));
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
                            this.#manufacture(new Token("]", SECTION_END, 0, 0, this._i++));
                            this.#manufacture(new Token("\n", EOL, 0, 0, this._i++));
                        }
                        this.#manufacture(new Token(key, TEXT, 0, 0, this._i++));
                        this.#manufacture(new Token(s.delimiters[0], ASSIGNMENT, 0, 0, this._i++));
                        this.#manufacture(new Token(String(o[key]??""), TEXT, 0, 0, this._i++));
                        this.#manufacture(new Token("\n", EOL, 0, 0, this._i++));
                    } else if(Array.isArray(o[key])) {
                        if(json.arrayIsAtomic(o[key] as any[])) for(let j = 0; j < (o[key] as any[]).length; j++) {
                            this.#manufacture(new Token(key, TEXT, 0, 0, this._i++));
                            this.#manufacture(new Token(s.delimiters[0], ASSIGNMENT, 0, 0, this._i++));
                            this.#manufacture(new Token(String((o[key] as any[])[j]??""), TEXT, 0, 0, this._i++));
                            this.#manufacture(new Token("\n", EOL, 0, 0, this._i++));
                        } else if(utility.isValid(s.nesting)) {
                            if(name.length < 1) name.push(new Token("[", SECTION_START, 0, 0, this._i++));
                            else name.push(new Token(s.nesting!.chars[0], SUB_SECTION, 0, 0, this._i++));
                            name.push(new Token(key, TEXT, 0, 0, this._i++));
                            this._process((o[key] as any[]), s, name);
                        } else {
                            this.#manufacture(new Token(key, TEXT, 0, 0, this._i++));
                            this.#manufacture(new Token(s.delimiters[0], ASSIGNMENT, 0, 0, this._i++));
                            this.#manufacture(new Token(JSON.stringify(o[key]), TEXT, 0, 0, this._i++));
                            this.#manufacture(new Token("\n", EOL, 0, 0, this._i++));
                        }
                    } else if(typeof o[key] === "object") {
                        if(utility.isValid(s.nesting)) {
                            if(name.length < 1) name.push(new Token("[", SECTION_START, 0, 0, this._i++));
                            else name.push(new Token(s.nesting!.chars[0], SUB_SECTION, 0, 0, this._i++));
                            name.push(new Token(key, TEXT, 0, 0, this._i++));
                            this._process(o[key], s, name);
                        } else {
                            this.#manufacture(new Token(key, TEXT, 0, 0, this._i++));
                            this.#manufacture(new Token(s.delimiters[0], ASSIGNMENT, 0, 0, this._i++));
                            this.#manufacture(new Token(JSON.stringify(o[key]), TEXT, 0, 0, this._i++));
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
            if(chunk === null) this.#manufacture(new Token("", TEXT, 0, 0, this._i++));
            else if(typeof chunk === "boolean") this.#manufacture(new Token(chunk ? "true" : "false", TEXT, 0, 0, this._i++));
            else if(typeof chunk === "number") this.#manufacture(new Token(String(chunk), TEXT, 0, 0, this._i++));
            else if(typeof chunk === "string") this.#manufacture(new Token(chunk, TEXT, 0, 0, this._i++));
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
    /**Since this is a line oriented data-serialisation-format, strings are tokenised by lines and not individually */
    export class StringLexer implements MutableLexer{
        #ln: number;
        #li: number;
        #queue: Token[];
        public src: string;
        #esc;//number of escape characters found on a line
        #text;
        #escText;
        #qt = false;//check for quote start. true means the next quote will be a closing one
        #com = "";//comments
        constructor() {
            this.#ln = 0;
            this.#li = 0;
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
            if(this.#queue[this.#queue.length - 1] && !this.#queue[this.#queue.length - 1].type.equals(EOL))
                this.process(this.#eol, syntax, params);
        }
        process(chunk: string = "", syntax: Syntax, p: Params): void {
            this.src += chunk;
            while (this.src.length > 0) {
                const token = this.#shiftSrc(1)!;
                this.#li++;
                if(!this.#escEven()){
                    if(this.#escText.length === 0){
                        this.#escText += token;
                        if(!syntax.escape!.unicode.indexOf(this.#escText[0])){
                            this.#manufacture(new Token(this.#escText, ESCAPED, this.#ln, this.#ln, this.#li));
                            this.#escText = "";
                            this.#esc = 0;
                        }
                    } else if(/[A-Fa-f0-9]/.test(token)) {
                        this.#escText += token;
                        if(this.#escText.length === 4) {
                            this.#manufacture(new Token(this.#escText, ESCAPED, this.#ln, this.#ln, this.#li));
                            this.#escText = "";
                            this.#esc = 0;
                        }
                    } else {
                        this.#manufacture(new Token(this.#escText, ESCAPED, this.#ln, this.#ln, this.#li));
                        this.#escText = "";
                        this.#esc = 0;
                        this.#text += token;
                    }
                    if(this.#escText.length === 0)
                    this.#escText += token;
                    /*If the escape sequence is not a unicode escape sequence, then a single character would suffice to be escaped */
                    if(!syntax.escape!.unicode.indexOf(this.#escText[0])) {
                    } else if(!/[A-Fa-f0-9]/.test(token)) {
                        this.#manufacture(new Token(this.#escText, ESCAPED, this.#ln, this.#ln, this.#li));
                        this.#escText = "";
                        this.#esc = 0;
                    }
                } else if(token === this.#eol) {
                    if(this.#com.length > 0){
                        this.#manufacture(new Token(this.#com, COMMENT, this.#ln, this.#ln, this.#li - this.#com.length));
                        this.#com = "";
                    } else if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, EOL, this.#ln, this.#ln, this.#li - token.length));
                    this.#escText = "";
                    this.#esc = 0;
                } else if(syntax.comments.chars.indexOf(token) > -1 || this.#com.length > 0) {
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#com += token;
                } else if(utility.isValid(syntax.escape) && syntax.escape!.char === token) {//an escape character?
                    this.#esc++;
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, ESCAPE, this.#ln, this.#ln, this.#li - token.length));
                } else if(token === '[') {
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, SECTION_START, this.#ln, this.#ln, this.#li - token.length));
                    this.#escText = "";
                    this.#esc = 0;
                } else if(token === ']') {
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, SECTION_END, this.#ln, this.#ln, this.#li - token.length));
                    this.#escText = "";
                    this.#esc = 0;
                } else if(token === "'" && utility.isValid(syntax.escape) && syntax.escape!.quoted) {
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, this.#qt ? QUOTE_END : QUOTE, this.#ln, this.#ln, this.#li - token.length));
                    this.#qt = !this.#qt;
                    this.#escText = "";
                    this.#esc = 0;
                } else if(token === '"'  && utility.isValid(syntax.escape) && syntax.escape!.quoted) {
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, this.#qt ? D_QUOTE_END : D_QUOTE, this.#ln, this.#ln, this.#li - token.length));
                    this.#qt = !this.#qt;
                    this.#escText = "";
                    this.#esc = 0;
                } else if(utility.isValid(syntax.nesting) && syntax.nesting!.chars.indexOf(token) > -1) {
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, SUB_SECTION, this.#ln, this.#ln, this.#li - token.length));
                    this.#escText = "";
                    this.#esc = 0;
                } else if(syntax.delimiters.indexOf(token) > -1) {
                    if(this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, ASSIGNMENT, this.#ln, this.#ln, this.#li - token.length));
                    this.#escText = "";
                    this.#esc = 0;
                } else if(utility.isWhitespace(token)){
                    if(this.#text.length > 0) {
                        // this.#manufacture(new Token(this.#text, TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
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
    export interface Command extends parser.GCommand<Token, Expression, Syntax, MutableLexer, Parser> {
      parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer, s: Syntax, pa?: Params): Expression;
    }
    abstract class LeftAndRight implements Command {
        constructor(public readonly direction: parser.Direction){}
        /**
         * @virtual
         */
        abstract parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer<string>, s: Syntax, pa?: Params | undefined): Expression;
    }
    class ParseInitialEscape implements Command {
        parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer<string>, s: Syntax, pa?: Params | undefined): Expression {
            let escd = yp.value;
            if(s.escape!.nonQuotedEsc) {
                escd = s.escape!.parse(escd + p.consume(ESCAPED, l, s, pa!).value);
            }
            while(p.match(ESCAPE, l, s, pa)){
                const esc = p.consume(ESCAPE, l, s, pa);
                const escaped = p.consume(ESCAPED, l, s, pa);
                escd += s.escape!.parse(esc.value + escaped.value);
            }
            if(p.match(TEXT, l, s, pa)){
                return s.getCommand(parser.Direction.PREFIX, TEXT)!.parse(ap, new Token(escd, TEXT, yp.lineStart, yp.lineEnd, yp.startPos), p, l, s, pa);
            }
            return new Text(escd);
        }
    }
    class ParseComment extends LeftAndRight {
        parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer<string>, s: Syntax, pa?: Params | undefined): Expression {
            switch (this.direction) {
                case parser.Direction.PREFIX:{
                    pa!.block.push(yp.value);
                    while (!p.match(EOL, l, s, pa!)) {
                        const comment = p.consume(COMMENT, l, s, pa).value;
                        if(s.comments.retain){
                            pa!.block.push(comment);
                        }
                    }
                }
                case parser.Direction.POSTFIX:
                case parser.Direction.INFIX:
                default: {
                    if(s.comments.retain) pa!.inline = yp.value;
                }
            }
            return ap;
        }
    }
    class Assign extends LeftAndRight {
        parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer<string>, s: Syntax, pa?: Params | undefined): Expression {
            // if(pa!.assigned) return s.getCommand(parser.Direction.PREFIX, TEXT)!.parse(ap, new Token(yp.value, TEXT, yp.lineStart, yp.lineEnd, yp.startPos), p, l, s, pa);
            pa!.assigned = true;
            switch(this.direction) {
                case parser.Direction.PREFIX: {
                    const rightExpr = p.parseWithPrecedence(yp.type.precedence, l, s, pa!);
                    const right  = isText(rightExpr) ? (rightExpr as Text).text : "";
                    const preceding = pa!.block;
                    pa!.block = [];
                    if(p.match(EOL, l, s, pa!)) skipBlankLines(l, s, p, pa!);
                    return new KeyValue({preceding: Object.freeze(preceding), inline: pa!.inline}, "", right);
                }
                case parser.Direction.INFIX:
                case parser.Direction.POSTFIX:
                default: {
                    const left  = isText(ap) ? (ap as Text).text : "";
                    const rightExpr = p.parseWithPrecedence(yp.type.precedence, l, s, pa!);
                    if(p.match(EOL, l, s, pa!)) skipBlankLines(l, s, p, pa!);
                    // console.log(p.match(TEXT, l, s, pa));
                    // console.log(yp);
                    // console.log(rightExpr);
                    if(!(rightExpr instanceof Text)) throw new parser.ParseError("Could not parse whatever was after the section nesting operator");
                    const right  = (rightExpr as Text).text;
                    const preceding = pa!.block;
                    pa!.block = [];
                    //parse inline comments
                    // if(p.match(COMMENT, l, s, pa!)) p.parse(l, s, pa);
                    return new KeyValue({preceding: Object.freeze(preceding), inline: pa!.inline}, left, right);
                }
            }
        }
    }
    class ParseSection implements Command {
        parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer<string>, s: Syntax, pa?: Params | undefined): Expression {
            pa!.insideSecName = true;

            //create the section name
            if(utility.isValid(s.nesting) && s.nesting!.relative && p.match(SUB_SECTION, l, s, pa)){
                do {
                    p.consume(SUB_SECTION, l, s, pa);
                    const text = p.parseWithPrecedence(yp.type.precedence, l, s, pa);
                    if(text instanceof Text){
                        pa!.section.push(text.text);
                    }
                    else throw new parser.ParseError("section name not found")
                } while (p.match(SUB_SECTION, l, s, pa));
            } else {
                pa!.section = [];
                while(true) {
                    const text = p.parseWithPrecedence(yp.type.precedence, l, s, pa);
                    if(text instanceof Text) pa!.section.push(text.text);
                    else throw new parser.ParseError("section name not found");
                    if(p.match(SUB_SECTION, l, s, pa)) p.consume(SUB_SECTION, l, s, pa);
                    else {
                        p.consume(SECTION_END, l, s, pa);
                        break;
                    } 
                }
            }

            pa!.insideSecName = false;

            //create and enforce section scope by parsing all properties in the scope
            const scope = new Section({preceding: Object.freeze([...pa!.block]), inline: pa!.inline});
            pa!.block = [];
            pa!.inline = "";
            while((!p.match(SECTION_START, l, s, pa!)) && !p.match(EOF, l, s, pa!)) {
                let prop = p.parse(l, s, pa);
                pa!.assigned = false;
                if(!utility.isValid(prop)) {//a blank or comment line
                    continue;
                } else if(prop instanceof KeyValue || prop instanceof Text) {//see KeyValue class docs
                    if(prop instanceof Text) {
                        prop = new KeyValue({preceding: Object.freeze([...pa!.block]), inline: pa!.inline}, prop.text, "");
                        pa!.block = [];
                        pa!.inline = "";
                    }
                    scope.add(s, [], prop as KeyValue);
                }  else throw new parser.ParseError(`Unexpected value found`);
            }
            // console.log(scope);

            if(utility.isValid(ap)){
                //add this scope to the parent/global scope
                (ap as Section).add(s, pa!.section, scope);
                return ap;//return the parent/global scope
            }
            return scope;
        }
    }
    /**SUB_SECTION (.), ASSIGNMENT (=) and COMMENT (;) are all parsed as text when inside a quote or double quotes */
    class ParseText implements Command {
        parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer<string>, s: Syntax, pa?: Params | undefined): Expression {
            if(yp.type.equals(QUOTE)) {
                const tokens = Array<Token>();
                while(true){
                    if(p.match(TEXT, l, s, pa))
                    tokens.push(p.consume(TEXT, l, s, pa) as Token);
                    else if(p.match(ESCAPE, l, s, pa)){
                        const esc = p.consume(ESCAPE, l, s, pa);
                        const escaped = p.consume(ESCAPED, l, s, pa) as Token;
                        tokens.push(new Token(s.escape!.parse(esc.value + escaped.value), TEXT, escaped.lineStart, escaped.lineEnd, escaped.startPos));
                    } else if(p.match(SUB_SECTION, l, s, pa!)) {
                        tokens.push(p.consume(SUB_SECTION, l, s, pa!) as Token);
                    } else if(p.match(ASSIGNMENT, l, s, pa!)) {
                        tokens.push(p.consume(ASSIGNMENT, l, s, pa!) as Token);
                    } else if(p.match(COMMENT, l, s, pa!)){
                        tokens.push(p.consume(COMMENT, l, s, pa!) as Token);
                    } else if(p.match(SECTION_START, l, s, pa!)){
                        tokens.push(p.consume(SECTION_START, l, s, pa!) as Token);
                    } else if(p.match(SECTION_END, l, s, pa!)){
                        tokens.push(p.consume(SECTION_END, l, s, pa!) as Token);
                    } else if(p.match(WHITESPACE, l, s, pa!)) {
                        tokens.push(p.consume(WHITESPACE, l, s, pa) as Token);
                    } else if(p.match(D_QUOTE, l, s, pa))
                    tokens.push(p.consume(D_QUOTE, l, s, pa) as Token);
                    else if(p.match(D_QUOTE_END, l, s, pa))
                    tokens.push(p.consume(D_QUOTE_END, l, s, pa) as Token);
                    else if(p.match(QUOTE_END, l, s, pa)) {
                        p.consume(QUOTE_END, l, s, pa);
                        break;
                    }
                }
                return new Text(mergeTokens(tokens))
            } else if(yp.type.equals(D_QUOTE)) {
                const tokens = Array<Token>();
                while(true){
                    if(p.match(TEXT, l, s, pa))
                    tokens.push(p.consume(TEXT, l, s, pa) as Token);
                    else if(p.match(ESCAPE, l, s, pa)){
                        const esc = p.consume(ESCAPE, l, s, pa);
                        const escaped = p.consume(ESCAPED, l, s, pa) as Token;
                        tokens.push(new Token(s.escape!.parse(esc.value + escaped.value), TEXT, escaped.lineStart, escaped.lineEnd, escaped.startPos));
                    } else if(p.match(SUB_SECTION, l, s, pa!)) {
                        tokens.push(p.consume(SUB_SECTION, l, s, pa!) as Token);
                    } else if(p.match(ASSIGNMENT, l, s, pa!)) {
                        tokens.push(p.consume(ASSIGNMENT, l, s, pa!) as Token);
                    } else if(p.match(COMMENT, l, s, pa!)){
                        tokens.push(p.consume(COMMENT, l, s, pa!) as Token);
                    } else if(p.match(SECTION_START, l, s, pa!)){
                        tokens.push(p.consume(SECTION_START, l, s, pa!) as Token);
                    } else if(p.match(SECTION_END, l, s, pa!)){
                        tokens.push(p.consume(SECTION_END, l, s, pa!) as Token);
                    } else if(p.match(WHITESPACE, l, s, pa!)) {
                        tokens.push(p.consume(WHITESPACE, l, s, pa) as Token);
                    } else if(p.match(QUOTE, l, s, pa))
                    tokens.push(p.consume(QUOTE, l, s, pa) as Token);
                    else if(p.match(QUOTE_END, l, s, pa))
                    tokens.push(p.consume(QUOTE_END, l, s, pa) as Token);
                    else if(p.match(D_QUOTE_END, l, s, pa)) {
                        p.consume(D_QUOTE_END, l, s, pa);
                        break;
                    }
                }
                return new Text(mergeTokens(tokens))
            }
            let string = yp.value;
            while(true) {
                if(p.match(TEXT, l, s, pa!)) string += p.consume(TEXT, l, s, pa);
                else if(p.match(WHITESPACE, l, s, pa!)) string += p.consume(WHITESPACE, l, s, pa);
                else if(p.match(SUB_SECTION, l, s, pa!) && !pa!.insideSecName) string += p.consume(SUB_SECTION, l, s, pa);
                else if(p.match(ASSIGNMENT, l, s, pa!) && pa!.assigned) string += p.consume(ASSIGNMENT, l, s, pa).value;
                else if(p.match(ESCAPE, l, s, pa!) && utility.isValid(s.escape) && s.escape!.nonQuotedEsc) {
                    const esc = p.consume(ESCAPE, l, s, pa);
                    const escaped = p.consume(ESCAPED, l, s, pa);
                    string += s.escape!.parse(esc.value + escaped.value);
                } else break;
            }
            return new Text(string.trim());
        }
    }
    class EndLine implements Command {
        parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer<string>, s: Syntax, pa?: Params | undefined): Expression {
            skipBlankLines(l,s, p, pa!);
            pa!.assigned = false;
            // console.log(ap);
            // if(p.match(SECTION_START, l, s, pa)) return s.getCommand(parser.Direction.PREFIX, SECTION_START)!.parse(ap, p.consume(SECTION_START, l, s, pa) as Token, p, l, s, pa);
            return ap;
        }
    }
    class Initializer implements Command {
        parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer<string>, s: Syntax, pa?: Params | undefined): Expression {
            ap = new Section(emptyComment());
            while(!p.match(EOF, l, s, pa)){
                let exp = p.parse(l, s, pa);
                if(!utility.isValid(exp)) {//a blank or comment line
                    continue;
                } else if(exp instanceof Text) {
                    exp = new KeyValue({preceding: Object.freeze([...pa!.block]), inline: pa!.inline}, exp.text, "");
                    pa!.block = [];
                    pa!.inline = "";
                }
                (ap as Section).add(s, pa!.section, exp as (Section | KeyValue));
            }
            return ap;
        }
    }
    /**A command to parse prefix whitespace. Because of the way the lexer creates tokens, this will only be called if a whitespace is not a delimiter like {@link PROPERTIES `PROPERTIES`} */
    class ParseSpace implements Command {
        parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer<string>, s: Syntax, pa?: Params | undefined): Expression {
            while(p.match(WHITESPACE, l, s, pa!)){
                p.consume(WHITESPACE, l,s, pa);
            }
            return ap;
        }
    }
    export interface Expression extends expression.GExpression<Format> {
        readonly comments: {
            readonly preceding: readonly string[],
            readonly inline?: string,
        };
      format(format: Format, syntax?: Syntax, params?: Params | any): void;
    }
    /**
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
        compareTo(obj?: expression.Expression | undefined): utility.Compare {
            return utility.compare(this.hashCode32(), obj?.hashCode32());
        }
        equals(obj?: object | undefined): boolean {
            if (obj instanceof Section) return this.compareTo(obj) === 0;
            return false;
        }
        hashCode32(): number {
            return utility.hashCode32(false, utility.asHashable(this.key), utility.asHashable(this.value), utility.asHashable(this.comments));
        }
        toString(): string {
          return JSON.stringify(this);
        }
    }
    class Section implements Expression {
        private readonly _map: {[key: string]: Section | Property};
        constructor(public readonly comments: {
            readonly preceding: readonly string[],
            readonly inline?: string
        } = emptyComment()) { this._map = {}; }
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
                        section._map[name] = value?{...value!}as Section:new Section();
                        return;
                    } else break;
                    case DuplicateDirective.OVERWRITE: break;
                    case DuplicateDirective.DISCARD: if(utility.isValid(section._map[name])) return; else break;
                    case DuplicateDirective.THROW: throw new expression.ExpressionError("Duplicate not supported");
                }
                section._map[name] = value??new Section();
                return;
            }
            const name = names.shift()!;
            if(!utility.isValid(section._map[name])) section._map[name] = new Section();
            else if(!(section._map[name] instanceof Section)) throw new expression.ExpressionError(`The section '${name}' is not of Section type. A name conflict was found`)
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
        compareTo(obj?: expression.Expression | undefined): utility.Compare {
            return utility.compare(this.hashCode32(), obj?.hashCode32());
        }
        equals(obj?: object | undefined): boolean {
            if (obj instanceof Section) return this.compareTo(obj) === 0;
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
                    case DuplicateDirective.THROW: if(this._values.length > 0) throw Error("Duplicate not supported");
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
        compareTo(obj?: expression.Expression | undefined): utility.Compare {
            return utility.compare(this.hashCode32(), obj?.hashCode32());
        }
        equals(obj?: object | undefined): boolean {
            if (obj instanceof Property) return this.compareTo(obj) === 0;
            return false;
        }
        hashCode32(): number {
            return utility.hashCode32(false, utility.asHashable(this.comments), utility.asHashable(this._values));
        }
        toString(): string {
            return JSON.stringify(this);
        }
    }
    class Text implements Expression {
        readonly comments;
        constructor(public readonly text: string){
            this.comments = { preceding: Object.freeze(Array<string>()) };
        }
        format(format: Format<any>, syntax?: Syntax | undefined, params?: any): void {
            format.append(this.text, syntax, params);
        }
        debug(): string {
            return this.text;
        }
        compareTo(obj?: expression.Expression | undefined): utility.Compare {
            return utility.compare(this.hashCode32(), obj?.hashCode32());
        }
        equals(obj?: object | undefined): boolean {
            if (obj instanceof Text) return this.compareTo(obj) === 0;
            return false;
        }
        hashCode32(): number {
            return utility.hashCode32(true, utility.asHashable(this.comments), utility.asHashable(this.text));
        }
        toString() {
            return JSON.stringify(this);
        }
    }
    /**Convenience class to allow for proper return values using `parse` */
    export class Parser extends parser.PrattParser<Expression, Syntax> {}
    export type Appendage = string | Expression;
    /**A base ini format */
    export interface Format<T = any> extends expression.GFormat<Expression, T> {
      append(data: Appendage, s?: Syntax, p?: Params): void;
    }
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
                this.append(data.comments.preceding.length > 0 ? unwrapComments(data.comments, s) : "", s, p);
                this.append(`${processEscapables(data.key, s!, this)} ${s!.delimiters[0]} ${processEscapables(data.value, s!, this)}`, s, p);
                this.append(`${data.comments.inline ? s!.comments.chars[0] + data.comments.inline : ""}`, s, p);
            } else if(data instanceof Property){
                this.append(data.comments.preceding.length > 0 ? unwrapComments(data.comments, s) : "", s, p);
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
            if (another instanceof StringFormat) return this.compareTo(another) === 0;
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
            if (another instanceof StringFormat) return this.compareTo(another) === 0;
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
        compareTo(obj?: expression.GFormat<Expression, json.Value> | undefined): utility.Compare {
            return utility.compare(this.hashCode32(), obj?.hashCode32());
        }
    }
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
                this.append(data.comments.preceding.length > 0 ? unwrapComments(data.comments, s) : "", s, p);
                this.append(`${processEscapables(data.key, s!, this)} ${s!.delimiters[0]} ${processEscapables(data.value, s!, this)}`, s, p);
                this.append(`${data.comments.inline ? s!.comments.chars[0] + data.comments.inline : ""}`, s, p);
            } else if(data instanceof Property){
                this.append(data.comments.preceding.length > 0 ? unwrapComments(data.comments, s) : "", s, p);
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
            if (another instanceof FileFormat) return this.compareTo(another) === 0;
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
        compareTo(obj?: expression.GFormat<Expression, ReadStream> | undefined): utility.Compare {
            return utility.compare(this.hashCode32(), obj?.hashCode32());
        }
    }
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

    export const UNIX = new SyntaxBuilder()
        .removeCommentChar(";")
        .retainComments(false)
        .removeDelimiter(':')
        .setDupDirective(DuplicateDirective.OVERWRITE, true)
        .setDupDirective(DuplicateDirective.MERGE, false)
        .build();

    export const PROPERTIES = new SyntaxBuilder()
        .removeCommentChar(";")
        .addCommentChar("!")
        .supportInline(false)
        .retainComments(true)//Can't decide on this functionality
        .addDelimiter('\t')
        .addDelimiter('\f')
        .setDupDirective(DuplicateDirective.OVERWRITE, true)
        .setDupDirective(DuplicateDirective.THROW, false)
        .removeSupportForNesting()
        .supportQuotedText(false)
        .supportNonQuotedEscape(true)
        .removeUnicodeChar('x')
        .build();

    export const WINAPI = new SyntaxBuilder()
        .removeCommentChar('#')//only ';' are supported
        .supportInline(false)
        .setDupDirective(DuplicateDirective.DISCARD, false)//for sections
        // .setDupDirective(DuplicateDirective.MERGE, true)//for props, already the default
        .retainComments(true)//Can't decide on this functionality
        .removeDelimiter(':')//only ";" will be used
        .removeSupportForNesting()//no nesting char needed
        // .supportRelativeNesting(true)// nesting already the default
        .removeUnicodeChar('x')// Donot support unicode escapes
        .removeUnicodeChar('u')// Donot support unicode escapes
        // .supportNonQuotedEscape(false)//already the default
        // .supportQuotedText(true)//already the default
        .setEscapeChar('\x00')//Prevent escapes. No need to set escape parser as it will never be needed by the parser or formatter as no escape is set
        .setEscapeParser(e => e)// Just for lols
        .build();
    // export const UNIX
}
export default ini;
