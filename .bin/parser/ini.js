import { createReadStream, createWriteStream } from "fs";
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
var ini;
(function (ini) {
    /**
     * An enum to specify the action a parser should take when it encounters duplicate sections and/or properties
     * @enum {number}
     */
    let DuplicateDirective;
    (function (DuplicateDirective) {
        /**A directive for the parser to merge duplicate properties and store them as an array instead of a single string value */
        DuplicateDirective[DuplicateDirective["MERGE"] = 0] = "MERGE";
        /**A directive for the parser to replace the original with the duplicate */
        DuplicateDirective[DuplicateDirective["OVERWRITE"] = 1] = "OVERWRITE";
        /**A directive for the parser to discard the duplicate and keep the original */
        DuplicateDirective[DuplicateDirective["DISCARD"] = 2] = "DISCARD";
        /**A directive for the parser to throw if a duplicate property is found */
        DuplicateDirective[DuplicateDirective["THROW"] = 3] = "THROW";
    })(DuplicateDirective = ini.DuplicateDirective || (ini.DuplicateDirective = {}));
    /**
     * Does the same function as {@link Format.append}.
     */
    function append(f, data, s, p, name = "") {
        for (const key in data.map) {
            if (data.map[key] instanceof Section)
                append(f, data.map[key], s, p, name.length > 0 ? `${name}.${key}` : "");
            else if (data.map[key] instanceof Property) {
                f.append(`${name}]`, s, p);
                f.append(`${data.comments.inline && data.comments.inline.length > 0 ? data.comments.inline : ""}\n` ? "]" : "", s, p);
                f.append(data.map[key], s, p);
            }
            else
                throw new expression.ExpressionError(`Illegal value found at ${name}.${key}`);
        }
    }
    function unwrapComments(comments, s) {
        if (utility.isValid(s))
            return s.comments.chars[0] + comments.preceding.join("\n;").concat("\n");
        return ";" + comments.preceding.join("\n;").concat("\n");
    }
    function isText(e) {
        return utility.isValid(e) && e instanceof Text;
    }
    function skipBlankLines(l, s, p, pa) {
        while (p.match(ini.EOL, l, s, pa))
            p.consume(ini.EOL, l, s, pa);
    }
    function parseComment(l, s, p, pa) {
        const comments = Array();
        while (true) {
            if (p.match(ini.COMMENT, l, s, pa))
                comments.push(p.consume(ini.COMMENT, l, s, pa).value);
            else if (p.match(ini.SECTION_START, l, s, pa))
                comments.push(p.consume(ini.SECTION_START, l, s, pa).value);
            else if (p.match(ini.D_QUOTE, l, s, pa))
                comments.push(p.consume(ini.D_QUOTE, l, s, pa).value);
            else if (p.match(ini.QUOTE, l, s, pa))
                comments.push(p.consume(ini.QUOTE, l, s, pa).value);
            else if (p.match(ini.TEXT, l, s, pa))
                comments.push(p.consume(ini.TEXT, l, s, pa).value);
            else if (p.match(ini.SUB_SECTION, l, s, pa))
                comments.push(p.consume(ini.SUB_SECTION, l, s, pa).value);
            else if (p.match(ini.SECTION_END, l, s, pa))
                comments.push(p.consume(ini.SECTION_END, l, s, pa).value);
            else if (p.match(ini.ASSIGNMENT, l, s, pa))
                comments.push(p.consume(ini.ASSIGNMENT, l, s, pa).value);
            else if (p.match(ini.D_QUOTE_END, l, s, pa))
                comments.push(p.consume(ini.D_QUOTE_END, l, s, pa).value);
            else if (p.match(ini.QUOTE_END, l, s, pa))
                comments.push(p.consume(ini.QUOTE_END, l, s, pa).value);
            else if (p.match(ini.ESCAPE, l, s, pa))
                comments.push(p.consume(ini.ESCAPE, l, s, pa).value);
            else if (p.match(ini.ESCAPED, l, s, pa))
                comments.push(p.consume(ini.ESCAPED, l, s, pa).value);
            else if (p.match(ini.WHITESPACE, l, s, pa))
                comments.push(p.consume(ini.WHITESPACE, l, s, pa).value);
            else if (p.match(ini.EOL, l, s, pa))
                break;
        }
        return comments;
    }
    function comments(preceding = Object.freeze(Array()), inline = "") {
        return { preceding, inline };
    }
    function emptyComment() {
        return comments();
    }
    function mergeTokens(t) {
        // return t.reduce((lexeme: string, tk: Token) => lexeme + tk.value, "");
        let text = "";
        for (let i = 0; i < t.length; i++) {
            text += t[i].value;
        }
        return text;
    }
    class SyntaxBuilder {
        _com = { retain: true, chars: [';', "#"], inline: true };
        _del = [':', '='];
        _dd = { section: DuplicateDirective.MERGE, property: DuplicateDirective.MERGE };
        _nes = { chars: ['.', '/'], relative: true };
        // private _glo: string = "";
        _esc = {
            char: "\\",
            quoted: true,
            nonQuotedEsc: false,
            unicode: ['x', 'u'],
            parse(e) {
                let esc = e[1];
                switch (e) {
                    case "\\":
                    case "'":
                    case "\"":
                    case ";":
                    case "#":
                    case "=":
                    case ".":
                    case "/": return e.length === 2 ? esc : e;
                    case "\n":
                    case "n": return e.length === 2 ? "\n" : e;
                    case "x":
                    case "u": {
                        const code = e.substring(2);
                        if (code.length > 4 || !(/^[A-Fa-f-0-9]$/.test(code)))
                            return e;
                        return String.fromCodePoint(Number.parseInt(code));
                    }
                    case "0":
                        return "\0";
                    case "a": return "\a";
                    case "b": return "\b";
                    case "t": return "\t";
                    case "r": return "\r";
                    default:
                }
                return e;
            }
        };
        _md = { fileExt: "ini", isStandard: false, standard: "", mediaType: "text/plain, application/textedit, zz-application/zz-winassoc-ini" };
        _p = (v) => v.length > 0 ? v : null;
        /**the infix array that hold a 2-length tuple of `parser.GType<string>` and `Command`
         * the default is `[]`
         * @defaultValue `[]`*/
        _infCmdlets = [];
        /**the prefix array that hold a 2-length tuple of `parser.GType<string>` and `Command`
         * the default is `[]`
         * @defaultValue `[]`*/
        _preCmdlets = [];
        /**the postfix array that hold a 2-length tuple of `parser.GType<string>` and `Command`
         * the default is `[]`
         * @defaultValue `[]`*/
        _posCmdlets = [];
        /**A function for getting the correct command based on the direction */
        _getCmd = (d, type) => {
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
        _ensureUniqueness(s, truthy) {
            if (!utility.isValid(s))
                throw Error("undefined cannot be used");
            if (truthy && s.length > 1)
                throw Error("Only a single character is required");
            if (this._com.chars.indexOf(s) >= 0)
                throw new Error(`${s} is not unique. It is used as a comment`);
            if (this._del.indexOf(s) >= 0)
                throw new Error(`${s} is not unique. It is used as a delimeter`);
            if (utility.isValid(this._nes) && this._nes.chars.indexOf(s) >= 0)
                throw new Error(`${s} is not unique. It is used as a nesting operator`);
            // if(this._glo === s)
            // throw new Error(`${s} is not unique. It is used as the keyword for the global section name`); 
            if (utility.isValid(this._esc) && this._esc.unicode.indexOf(s) >= 0)
                throw new Error(`${s} is not unique. It is used as a unicode prefix`);
            if (utility.isValid(this._esc) && this._esc.char === s)
                throw new Error(`${s} is not unique. It is used as the escape character`);
        }
        constructor() {
            this.addPrefixCommand(ini.COMMENT, new ParseComment(parser.Direction.PREFIX));
            this.addPrefixCommand(ini.EOL, new EndLine());
            this.addPrefixCommand(ini.ASSIGNMENT, new Assign(parser.Direction.PREFIX));
            this.addPrefixCommand(ini.TEXT, new ParseText());
            this.addPrefixCommand(ini.D_QUOTE, new ParseText());
            this.addPrefixCommand(ini.QUOTE, new ParseText());
            this.addPrefixCommand(ini.SECTION_START, new ParseSection());
            this.addPrefixCommand(ini.WHITESPACE, new ParseSpace());
            this.addPrefixCommand(ini.INIT, new Initializer());
            this.addInfixCommand(ini.COMMENT, new ParseComment(parser.Direction.INFIX));
            this.addInfixCommand(ini.ASSIGNMENT, new Assign(parser.Direction.INFIX));
            this.addInfixCommand(ini.EOL, new EndLine());
            this.addInfixCommand(ini.WHITESPACE, new ParseSpace());
        }
        removeSupportForNesting() {
            this._nes = undefined;
            return this;
        }
        removeSupportForEscape() {
            this._esc = undefined;
            return this;
        }
        removeCommentChar(char) {
            // this._com!.chars = this._com!.chars.reduce((p, c) => c === char ? p : [...p, c], Array<string>());
            let ind = -1;
            for (let i = 0; i < this._com.chars.length; i++) {
                if (this._com.chars[i] === char) {
                    ind = i;
                    break;
                }
            }
            if (ind >= 0)
                this._com?.chars.splice(ind, 1);
            return this;
        }
        removeDelimiter(delim) {
            // this._del = this._del.reduce((p, c) => c === delim ? p : [...p, c], Array<string>());
            let ind = -1;
            for (let i = 0; i < this._del.length; i++) {
                if (this._del[i] === delim) {
                    ind = i;
                    break;
                }
            }
            if (ind >= 0)
                this._del.splice(ind, 1);
            return this;
        }
        removeNestingChar(char) {
            // this._nes.chars = this._nes.chars.reduce((p, c) => c === char ? p : [...p, c], Array<string>());
            try {
                let ind = -1;
                for (let i = 0; i < this._nes.chars.length; i++) {
                    if (this._nes.chars[i] === char) {
                        ind = i;
                        break;
                    }
                }
                if (ind >= 0)
                    this._nes.chars.splice(ind, 1);
            }
            catch (e) { }
            return this;
        }
        removeUnicodeChar(char) {
            try {
                // this._esc!.unicode = this._esc!.unicode.reduce((p, c) => c === char ? p : [...p, c], Array<string>());
                let ind = -1;
                for (let i = 0; i < this._esc.unicode.length; i++) {
                    if (this._esc.unicode[i] === char) {
                        ind = i;
                        break;
                    }
                }
                if (ind >= 0)
                    this._esc.unicode.splice(ind, 1);
            }
            catch (e) { }
            return this;
        }
        addCommentChar(char) {
            this._ensureUniqueness(char, true);
            this._com.chars.push(char);
            return this;
        }
        addDelimiter(delim) {
            this._ensureUniqueness(delim, true);
            this._del.push(delim);
            return this;
        }
        addNestingChar(char) {
            this._ensureUniqueness(char, true);
            try {
                this._nes.chars.push(char);
            }
            catch (e) { }
            return this;
        }
        addUnicodeChar(char) {
            this._ensureUniqueness(char, true);
            try {
                this._esc?.unicode.push(char);
            }
            catch (e) { }
            return this;
        }
        retainComments(b) {
            this._com.retain = b;
            return this;
        }
        supportNonQuotedEscape(b) {
            try {
                this._esc.nonQuotedEsc = b;
            }
            catch (e) {
                throw new Error("Escape object is undefined for this builder", e);
            }
            return this;
        }
        supportInline(b) {
            this._com.inline = b;
            return this;
        }
        supportRelativeNesting(b) {
            try {
                this._nes.relative = b;
            }
            catch (e) {
                throw Error("Nesting object is undefined for this builder");
            }
            return this;
        }
        // public setGlobalName(g: string) : SyntaxBuilder{
        //     this._ensureUniqueness(g);
        //     this._glo = g;
        //     return this;
        // }
        supportQuotedText(b) {
            try {
                this._esc.quoted = b;
            }
            catch (e) {
                throw new Error("Escape object is undefined for this builder", e);
            }
            return this;
        }
        setEscapeChar(char) {
            this._ensureUniqueness(char, true);
            try {
                this._esc.char = char;
            }
            catch (e) {
                throw new Error("Escape object is undefined for this builder", e);
            }
            return this;
        }
        setEscapeParser(p) {
            try {
                this._esc.parse = p ?? this._esc.parse;
            }
            catch (e) {
                throw Error("Escape object is undefined for this Builder");
            }
            return this;
        }
        setFormatParser(p) {
            this._p = p ?? this._p;
            return this;
        }
        setDupDirective(dd, forProperty) {
            if (utility.isValid(forProperty)) {
                if (forProperty)
                    this._dd.property = dd;
                else
                    this._dd.section = dd;
            }
            else {
                this._dd.property = dd ?? this._dd.property;
                this._dd.section = dd ?? this._dd.section;
            }
            return this;
        }
        _pushOrOverite(map, t, cmd) {
            for (let i = 0; i < map.length; i++)
                if (map[i][0].equals(t)) {
                    map[i] = [t, cmd];
                    return;
                }
            map.push([t, cmd]);
        }
        addInfixCommand(type, cmd) {
            // this._infCmdlets.push([type, cmd]);
            this._pushOrOverite(this._infCmdlets, type, cmd);
            return this;
        }
        removeInfixCommand(type) {
            this._infCmdlets = this._infCmdlets.filter(v => !v[0].equals(type));
            return this;
        }
        addPrefixCommand(type, cmd) {
            // this._infCmdlets.push([type, cmd]);
            this._pushOrOverite(this._preCmdlets, type, cmd);
            return this;
        }
        removePrefixCommand(type) {
            this._preCmdlets = this._preCmdlets.filter(v => !v[0].equals(type));
            return this;
        }
        addPostfixCommand(type, cmd) {
            // this._infCmdlets.push([type, cmd]);
            this._pushOrOverite(this._posCmdlets, type, cmd);
            return this;
        }
        removePostfixCommand(type) {
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
        setFileExt(ext) {
            this._md.fileExt = ext ?? this._md.fileExt;
            return this;
        }
        /**
         * Sets the {@link Syntax.metadata.isStandard isStandard property} in the syntax to be built.
         * @remark
         * The default is `false`.
         * @param {boolean} b `true` if the syntax is a web standard `false` if otherwise. A truthy value will be converted to a boolean.
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        setIsStandard(b) {
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
        setMediaType(mediaType) {
            this._md.mediaType = mediaType ?? this._md.mediaType;
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
        setStandard(standard) {
            this._md.standard = standard ?? this._md.standard;
            return this;
        }
        clear(toDefault = false) {
            // this._glo = "";
            this._getCmd = (d, type) => {
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
            if (toDefault) {
                this._md = { fileExt: "ini", isStandard: false, standard: "", mediaType: "text/plain, application/textedit, zz-application/zz-winassoc-ini" };
                this._com = { retain: true, chars: [';', "#"], inline: true };
                this._del = [':', '='];
                this._dd = { section: DuplicateDirective.MERGE, property: DuplicateDirective.MERGE };
                this._nes = { chars: ['.', '/'], relative: true };
                this._esc = {
                    char: "\\",
                    quoted: true,
                    nonQuotedEsc: false,
                    unicode: ['x', 'u'],
                    parse(e) {
                        let esc = e[1];
                        switch (e) {
                            case "\\":
                            case "'":
                            case "\"":
                            case ";":
                            case "#":
                            case "=":
                            case ".":
                            case "/": return e.length === 2 ? esc : e;
                            case "\n":
                            case "n": return e.length === 2 ? "\n" : e;
                            case "x":
                            case "u": {
                                const code = e.substring(2);
                                if (code.length > 4 || !(/^[A-Fa-f-0-9]$/.test(code)))
                                    return e;
                                return String.fromCodePoint(Number.parseInt(code));
                            }
                            case "0": return "\0";
                            case "a": return "\a";
                            case "b": return "\b";
                            case "t": return "\t";
                            case "r": return "\r";
                            case "f": return "\f";
                            case " ": return " ";
                            default:
                        }
                        return e;
                    }
                };
                this._p = (v) => v.length > 0 ? v : null;
            }
            else {
                this._md = { fileExt: "", isStandard: false, standard: "", mediaType: "" };
                this._dd = { section: DuplicateDirective.THROW, property: DuplicateDirective.THROW };
                this._del = [];
                this._com = { retain: false, chars: [], inline: false };
                this._nes = undefined;
                this._esc = undefined;
                this._p = (v) => v;
            }
            return this;
        }
        build() {
            if (utility.isValid(this._esc) && this._esc.nonQuotedEsc)
                this.addPrefixCommand(ini.ESCAPE, new ParseInitialEscape());
            return Object.freeze({
                metadata: { ...this._md, encoding: "utf-8" },
                comments: {
                    ...this._com,
                    chars: Object.freeze(this._com.chars)
                },
                delimiters: Object.freeze(this._del),
                nesting: utility.isValid(this._nes) ? { ...this._nes, chars: Object.freeze(this._nes.chars) } : undefined,
                // globalName: this._glo,
                duplicateDirective: this._dd,
                escape: utility.isValid(this._esc) ? { ...this._esc, unicode: Object.freeze(this._esc.unicode) } : undefined,
                parse: this._p,
                getCommand: this._getCmd
            });
        }
        rebuild(from) {
            this._md = from.metadata;
            this._com = from.comments;
            this._esc = from.escape;
            this._nes = from.nesting;
            this._del = from.delimiters;
            // this._glo = from.globalName;
            this._dd = from.duplicateDirective;
            this._p = from.parse;
            this._getCmd = from.getCommand;
            return this;
        }
    }
    ini.SyntaxBuilder = SyntaxBuilder;
    class Params {
        /**
         * The current section's name i.e the name of a property of {@link global} that was last parsed
         * @type {string}
         */
        section = [];
        /**An array of strings representing consecutiveline of comments. This value is empty the moment a {@link Section} or {@link Property} is parsed. */
        block = Array();
        /**inline comments as a `string`. This value is reset every time */
        inline = "";
        /**Defines the state of the parser when parsing inside of a section name as a `boolean` */
        insideSecName = false;
        /**Specifies whether or not an assignment of a value to a key/name has been done */
        assigned = false;
    }
    ini.Params = Params;
    /**
     * - `'['` section start
     * - `']'` section end
     * - `'='` assignment within a property
     * - `';'` `'#'` `'!'` comment start (comment may be retained by configuring the syntax so)
     * - **text** these are the names of sections, properties and the value of a property.
     */
    class Type {
        id;
        precedence;
        /**
         * Constructs a `Type` with an assigned unique id and precedence.
         * @param {string} id a unique id associated with this {@link parser.Type}
         * @param {number} precedence the precedence of this type. This determines how it will be evaluated in the evaluation hierarchy (per se)
         */
        constructor(id, precedence) {
            this.id = id;
            this.precedence = precedence;
        }
        /**
         * Test the equality of this `Type` to the given input
         * @param {(object|undefined)} obj any object to test against `this`
         * @returns {boolean} `true` if `this` is equal to the input and `false` if otherwise.
         */
        equals(obj) {
            if (obj instanceof Type)
                return this.id === obj.id && this.precedence === obj.precedence;
            return false;
        }
    }
    ini.EOF = new Type("-1", Number.MIN_SAFE_INTEGER);
    ini.EOL = new Type("0", 5);
    ini.SECTION_START = new Type("1", 2);
    ini.QUOTE = new Type("2", 5);
    ini.D_QUOTE = new Type("3", 5);
    ini.TEXT = new Type("4", 5);
    ini.SUB_SECTION = new Type("5", 3);
    ini.SECTION_END = new Type("6", 1);
    ini.ASSIGNMENT = new Type("7", 3); //Does not matter the precedence it has will will always be parsed with the `parse(0)` So it will be parsed as long as it's precedence is greater than 0
    ini.COMMENT = new Type("8", 5);
    ini.QUOTE_END = new Type("9", 5);
    ini.D_QUOTE_END = new Type("10", 5);
    ini.ESCAPE = new Type("11", 5);
    ini.ESCAPED = new Type("12", 5);
    ini.WHITESPACE = new Type("13", 5);
    ini.INIT = new Type("14", Number.MAX_SAFE_INTEGER);
    class Token {
        value;
        type;
        lineStart;
        lineEnd;
        startPos;
        length;
        constructor(value, type, lineStart, lineEnd, startPos
        // public readonly names?: string[]
        ) {
            this.value = value;
            this.type = type;
            this.lineStart = lineStart;
            this.lineEnd = lineEnd;
            this.startPos = startPos;
            this.length = value.length;
        }
        toString() {
            return JSON.stringify({ token: this.value, type: this.type.toString() }, null, 2);
        }
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
    class JSONLexer {
        _queue;
        _i = 0;
        _canProcess = true;
        constructor() {
            this._queue = Array(new Token("", ini.INIT, -1, -1, -1));
        }
        _processEscapables(text, s) {
            if (!utility.isValid(s.escape))
                return text;
            let val = "";
            let isQuotable = false;
            for (let i = 0; i < text.length; i++) {
                const escaped = s.escape.parse(`${s.escape.char}${text[i]}`);
                if (escaped.length > 1 && escaped[0] === s.escape.char)
                    val += escaped.substring(1);
                else if (s.escape.quoted) {
                    val += escaped;
                    isQuotable = true;
                }
                else
                    throw new parser.ParseError(`Cannot have escapable characters in an unquoted text at: ${this._i}`);
            }
            return isQuotable ? `"${val}"` : val;
        }
        _process(o, s, name = Array()) {
            if (json.isAtomic(o)) {
                if (name.length > 0) {
                    do {
                        this.#manufacture(name.shift());
                    } while (name.length > 0);
                    this.#manufacture(new Token("]", ini.SECTION_END, 0, 0, this._i++));
                    this.#manufacture(new Token("\n", ini.EOL, 0, 0, this._i++));
                }
                this.#manufacture(new Token(this._processEscapables(o !== null ? String(o) : "", s), ini.TEXT, 0, 0, this._i++));
            }
            else if (Array.isArray(o)) {
                for (let i = 0; i < o.length; i++) {
                    if (json.isAtomic(o[i])) {
                        if (name.length > 0) {
                            do {
                                this.#manufacture(name.shift());
                            } while (name.length > 0);
                            this.#manufacture(new Token("]", ini.SECTION_END, 0, 0, this._i++));
                            this.#manufacture(new Token("\n", ini.EOL, 0, 0, this._i++));
                        }
                        this.#manufacture(new Token(i.toString(), ini.TEXT, 0, 0, this._i++));
                        this.#manufacture(new Token(s.delimiters[0], ini.ASSIGNMENT, 0, 0, this._i++));
                        this.#manufacture(new Token(this._processEscapables(String(o[i] ?? ""), s), ini.ASSIGNMENT, 0, 0, this._i++));
                        this.#manufacture(new Token("\n", ini.EOL, 0, 0, this._i++));
                    }
                    else if (Array.isArray(o[i])) {
                        let array = o[i];
                        if (json.arrayIsAtomic(array))
                            for (let j = 0; j < array.length; j++) {
                                this.#manufacture(new Token(i.toString(), ini.TEXT, 0, 0, this._i++));
                                this.#manufacture(new Token(s.delimiters[0], ini.ASSIGNMENT, 0, 0, this._i++));
                                this.#manufacture(new Token(this._processEscapables(String(array[j] ?? ""), s), ini.TEXT, 0, 0, this._i++));
                                this.#manufacture(new Token("\n", ini.EOL, 0, 0, this._i++));
                            }
                        else if (utility.isValid(s.nesting)) {
                            if (name.length < 1)
                                name.push(new Token("[", ini.SECTION_START, 0, 0, this._i++));
                            else
                                name.push(new Token(s.nesting.chars[0], ini.SUB_SECTION, 0, 0, this._i++));
                            name.push(new Token(i.toString(), ini.TEXT, 0, 0, this._i++));
                            this._process(o[i], s, name);
                        }
                        else {
                            this.#manufacture(new Token(i.toString(), ini.TEXT, 0, 0, this._i++));
                            this.#manufacture(new Token(s.delimiters[0], ini.ASSIGNMENT, 0, 0, this._i++));
                            this.#manufacture(new Token(this._processEscapables(JSON.stringify(o[i]), s), ini.TEXT, 0, 0, this._i++));
                            this.#manufacture(new Token("\n", ini.EOL, 0, 0, this._i++));
                        }
                    }
                    else if (typeof o[i] === "object") {
                        if (utility.isValid(s.nesting)) {
                            if (name.length < 1)
                                name.push(new Token("[", ini.SECTION_START, 0, 0, this._i++));
                            else
                                name.push(new Token(s.nesting.chars[0], ini.SUB_SECTION, 0, 0, this._i++));
                            name.push(new Token(i.toString(), ini.TEXT, 0, 0, this._i++));
                            this._process(o[i], s, name);
                        }
                        else {
                            this.#manufacture(new Token(i.toString(), ini.TEXT, 0, 0, this._i++));
                            this.#manufacture(new Token(s.delimiters[0], ini.ASSIGNMENT, 0, 0, this._i++));
                            this.#manufacture(new Token(this._processEscapables(JSON.stringify(o[i]), s), ini.TEXT, 0, 0, this._i++));
                            this.#manufacture(new Token("\n", ini.EOL, 0, 0, this._i++));
                        }
                    }
                }
            }
            else if (typeof o === "object") {
                for (const key in o) {
                    if (json.isAtomic(o[key])) {
                        if (name.length > 0) {
                            do {
                                this.#manufacture(name.shift());
                            } while (name.length > 0);
                            this.#manufacture(new Token("]", ini.SECTION_END, 0, 0, this._i++));
                            this.#manufacture(new Token("\n", ini.EOL, 0, 0, this._i++));
                        }
                        this.#manufacture(new Token(this._processEscapables(key, s), ini.TEXT, 0, 0, this._i++));
                        this.#manufacture(new Token(s.delimiters[0], ini.ASSIGNMENT, 0, 0, this._i++));
                        this.#manufacture(new Token(this._processEscapables(String(o[key] ?? ""), s), ini.ASSIGNMENT, 0, 0, this._i++));
                        this.#manufacture(new Token("\n", ini.EOL, 0, 0, this._i++));
                    }
                    else if (Array.isArray(o[key])) {
                        if (json.arrayIsAtomic(o[key]))
                            for (let j = 0; j < o[key].length; j++) {
                                this.#manufacture(new Token(this._processEscapables(key, s), ini.TEXT, 0, 0, this._i++));
                                this.#manufacture(new Token(s.delimiters[0], ini.ASSIGNMENT, 0, 0, this._i++));
                                this.#manufacture(new Token(this._processEscapables(String(o[key][j] ?? ""), s), ini.TEXT, 0, 0, this._i++));
                                this.#manufacture(new Token("\n", ini.EOL, 0, 0, this._i++));
                            }
                        else if (utility.isValid(s.nesting)) {
                            if (name.length < 1)
                                name.push(new Token("[", ini.SECTION_START, 0, 0, this._i++));
                            else
                                name.push(new Token(s.nesting.chars[0], ini.SUB_SECTION, 0, 0, this._i++));
                            name.push(new Token(this._processEscapables(key, s), ini.TEXT, 0, 0, this._i++));
                            this._process(o[key], s, name);
                        }
                        else {
                            this.#manufacture(new Token(this._processEscapables(key, s), ini.TEXT, 0, 0, this._i++));
                            this.#manufacture(new Token(s.delimiters[0], ini.ASSIGNMENT, 0, 0, this._i++));
                            this.#manufacture(new Token(this._processEscapables(JSON.stringify(o[key]), s), ini.TEXT, 0, 0, this._i++));
                            this.#manufacture(new Token("\n", ini.EOL, 0, 0, this._i++));
                        }
                    }
                    else if (typeof o[key] === "object") {
                        if (utility.isValid(s.nesting)) {
                            if (name.length < 1)
                                name.push(new Token("[", ini.SECTION_START, 0, 0, this._i++));
                            else
                                name.push(new Token(s.nesting.chars[0], ini.SUB_SECTION, 0, 0, this._i++));
                            name.push(new Token(this._processEscapables(key, s), ini.TEXT, 0, 0, this._i++));
                            this._process(o[key], s, name);
                        }
                        else {
                            this.#manufacture(new Token(this._processEscapables(key, s), ini.TEXT, 0, 0, this._i++));
                            this.#manufacture(new Token(s.delimiters[0], ini.ASSIGNMENT, 0, 0, this._i++));
                            this.#manufacture(new Token(this._processEscapables(JSON.stringify(o[key]), s), ini.TEXT, 0, 0, this._i++));
                            this.#manufacture(new Token("\n", ini.EOL, 0, 0, this._i++));
                        }
                    }
                }
            }
        }
        #manufacture(t) {
            this._queue.push(t);
            this._canProcess = false;
        }
        end() { }
        /**
         * Calling this method when {@link JSONLexer.canProcess `canProcess`} returns `false` puts this `JSONLexer` object in an undefined state.
         * @inheritdoc
         */
        process(chunk, syntax, p) {
            this.src = chunk;
            if (chunk === null)
                this.#manufacture(new Token("", ini.TEXT, 0, 0, this._i++));
            else if (typeof chunk === "boolean")
                this.#manufacture(new Token(chunk ? "true" : "false", ini.TEXT, 0, 0, this._i++));
            else if (typeof chunk === "number")
                this.#manufacture(new Token(String(chunk), ini.TEXT, 0, 0, this._i++));
            else if (typeof chunk === "string")
                this.#manufacture(new Token(chunk, ini.TEXT, 0, 0, this._i++));
            else if (typeof chunk === "object") {
                const array = Array();
                this._process(chunk, syntax, array);
                if (array.length > 0)
                    do {
                        this.#manufacture(array.shift());
                    } while (array.length > 0);
            }
            this.#manufacture(new Token("\n", ini.EOL, 0, 0, this._i++));
        }
        processed = () => this._queue;
        unprocessed = () => this.src;
        frequency(type) {
            let frqy = 0;
            for (let i = 0; i < this._queue.length; i++) {
                if (this._queue[i].type.equals(type))
                    frqy++;
            }
            return frqy;
        }
        indexOf(type) {
            for (let i = 0; i < this._queue.length; i++) {
                if (this._queue[i].type.equals(type))
                    return i;
            }
            return -1;
        }
        lastIndexOf(type) {
            for (let i = this._queue.length - 1; i >= 0; i--) {
                if (this._queue[i].type.equals(type))
                    return i;
            }
            return -1;
        }
        hasTokens() {
            return this._queue.length > 0;
        }
        canProcess() {
            return this._canProcess;
        }
        next() {
            while (true) {
                if (!this.hasTokens())
                    break;
                return this._queue.shift();
            }
            return new Token("", ini.EOF, this.line(), this.line(), this.position());
        }
        /**
         * Will be `undefined` if `process` is yet to be called
         * @inheritdoc
         */
        src;
        position() {
            return this._i;
        }
        line() {
            return 0;
        }
    }
    ini.JSONLexer = JSONLexer;
    /**Since this is a line oriented data-serialisation-format, strings are tokenised by lines and not individually */
    class StringLexer {
        #ln;
        #li;
        #queue;
        src;
        #esc; //number of escape characters found on a line
        #text;
        #escText;
        #qt = false; //check for quote start. true means the next quote will be a closing one
        #com = ""; //comments
        constructor() {
            this.#ln = 0;
            this.#li = 0;
            this.#queue = [new Token("", ini.INIT, -1, -1, -1)];
            this.src = "";
            this.#esc = 0;
            this.#text = "";
            this.#escText = "";
        }
        #eol = '\n'; //utility.eol;
        #isStart() {
            return this.#ln === 0 && this.#li === 0;
        }
        #escEven() {
            return this.#esc % 2 == 0;
        }
        #shiftSrc(distance) {
            if (distance > this.src.length)
                return undefined;
            const rv = this.src.substring(0, distance);
            this.src = this.src.substring(distance);
            return rv;
        }
        #manufacture(t) {
            this.#queue.push(t);
        }
        end(syntax, params) {
            if (this.canProcess())
                this.process("", syntax, params);
            if (this.#queue[this.#queue.length - 1] && !this.#queue[this.#queue.length - 1].type.equals(ini.EOL))
                this.process(this.#eol, syntax, params);
        }
        process(chunk = "", syntax, p) {
            this.src += chunk;
            while (this.src.length > 0) {
                const token = this.#shiftSrc(1);
                this.#li++;
                if (!this.#escEven()) {
                    if (this.#escText.length === 0) {
                        this.#escText += token;
                        if (!syntax.escape.unicode.indexOf(this.#escText[0])) {
                            this.#manufacture(new Token(this.#escText, ini.ESCAPED, this.#ln, this.#ln, this.#li));
                            this.#escText = "";
                            this.#esc = 0;
                        }
                    }
                    else if (/[A-Fa-f0-9]/.test(token)) {
                        this.#escText += token;
                        if (this.#escText.length === 4) {
                            this.#manufacture(new Token(this.#escText, ini.ESCAPED, this.#ln, this.#ln, this.#li));
                            this.#escText = "";
                            this.#esc = 0;
                        }
                    }
                    else {
                        this.#manufacture(new Token(this.#escText, ini.ESCAPED, this.#ln, this.#ln, this.#li));
                        this.#escText = "";
                        this.#esc = 0;
                        this.#text += token;
                    }
                    if (this.#escText.length === 0)
                        this.#escText += token;
                    /*If the escape sequence is not a unicode escape sequence, then a single character would suffice to be escaped */
                    if (!syntax.escape.unicode.indexOf(this.#escText[0])) {
                    }
                    else if (!/[A-Fa-f0-9]/.test(token)) {
                        this.#manufacture(new Token(this.#escText, ini.ESCAPED, this.#ln, this.#ln, this.#li));
                        this.#escText = "";
                        this.#esc = 0;
                    }
                }
                else if (token === this.#eol) {
                    if (this.#com.length > 0) {
                        this.#manufacture(new Token(this.#com, ini.COMMENT, this.#ln, this.#ln, this.#li - this.#com.length));
                        this.#com = "";
                    }
                    else if (this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, ini.TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, ini.EOL, this.#ln, this.#ln, this.#li - token.length));
                    this.#escText = "";
                    this.#esc = 0;
                }
                else if (syntax.comments.chars.indexOf(token) > -1 || this.#com.length > 0) {
                    if (this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, ini.TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#com += token;
                }
                else if (utility.isValid(syntax.escape) && syntax.escape.char === token) { //an escape character?
                    this.#esc++;
                    if (this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, ini.TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, ini.ESCAPE, this.#ln, this.#ln, this.#li - token.length));
                }
                else if (token === '[') {
                    if (this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, ini.TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, ini.SECTION_START, this.#ln, this.#ln, this.#li - token.length));
                    this.#escText = "";
                    this.#esc = 0;
                }
                else if (token === ']') {
                    if (this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, ini.TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, ini.SECTION_END, this.#ln, this.#ln, this.#li - token.length));
                    this.#escText = "";
                    this.#esc = 0;
                }
                else if (token === "'" && utility.isValid(syntax.escape) && syntax.escape.quoted) {
                    if (this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, ini.TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, this.#qt ? ini.QUOTE_END : ini.QUOTE, this.#ln, this.#ln, this.#li - token.length));
                    this.#qt = !this.#qt;
                    this.#escText = "";
                    this.#esc = 0;
                }
                else if (token === '"' && utility.isValid(syntax.escape) && syntax.escape.quoted) {
                    if (this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, ini.TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, this.#qt ? ini.D_QUOTE_END : ini.D_QUOTE, this.#ln, this.#ln, this.#li - token.length));
                    this.#qt = !this.#qt;
                    this.#escText = "";
                    this.#esc = 0;
                }
                else if (utility.isValid(syntax.nesting) && syntax.nesting.chars.indexOf(token) > -1) {
                    if (this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, ini.TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, ini.SUB_SECTION, this.#ln, this.#ln, this.#li - token.length));
                    this.#escText = "";
                    this.#esc = 0;
                }
                else if (syntax.delimiters.indexOf(token) > -1) {
                    if (this.#text.length > 0) {
                        this.#manufacture(new Token(this.#text, ini.TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text = "";
                    }
                    this.#manufacture(new Token(token, ini.ASSIGNMENT, this.#ln, this.#ln, this.#li - token.length));
                    this.#escText = "";
                    this.#esc = 0;
                }
                else if (utility.isWhitespace(token)) {
                    if (this.#text.length > 0) {
                        // this.#manufacture(new Token(this.#text, TEXT, this.#ln, this.#ln, this.#li - this.#text.length));
                        this.#text += token;
                    }
                    else {
                        this.#manufacture(new Token(token, ini.WHITESPACE, this.#ln, this.#ln, this.#li - token.length));
                        this.#escText = "";
                        this.#esc = 0;
                    }
                }
                else {
                    this.#text += token;
                }
            }
        }
        processed = () => this.#queue;
        unprocessed = () => this.src;
        frequency(type) {
            let frqy = 0;
            for (let i = 0; i < this.#queue.length; i++) {
                if (this.#queue[i].type.equals(type))
                    frqy++;
            }
            return frqy;
        }
        indexOf(type) {
            for (let i = 0; i < this.#queue.length; i++) {
                if (this.#queue[i].type.equals(type))
                    return i;
            }
            return -1;
        }
        lastIndexOf(type) {
            for (let i = this.#queue.length - 1; i >= 0; i--) {
                if (this.#queue[i].type.equals(type))
                    return i;
            }
            return -1;
        }
        hasTokens() {
            return this.#queue.length > 0;
        }
        canProcess() {
            return this.src.length > 0;
        }
        next() {
            while (true) {
                if (!this.hasTokens())
                    break;
                return this.#queue.shift();
            }
            return new Token("", ini.EOF, this.line(), this.line(), this.position());
        }
        position() {
            return this.#li;
        }
        line() {
            return this.#ln;
        }
    }
    ini.StringLexer = StringLexer;
    class LeftAndRight {
        direction;
        constructor(direction) {
            this.direction = direction;
        }
    }
    class ParseInitialEscape {
        parse(ap, yp, p, l, s, pa) {
            let escd = yp.value;
            if (s.escape.nonQuotedEsc) {
                escd = s.escape.parse(escd + p.consume(ini.ESCAPED, l, s, pa).value);
            }
            while (p.match(ini.ESCAPE, l, s, pa)) {
                const esc = p.consume(ini.ESCAPE, l, s, pa);
                const escaped = p.consume(ini.ESCAPED, l, s, pa);
                escd += s.escape.parse(esc.value + escaped.value);
            }
            if (p.match(ini.TEXT, l, s, pa)) {
                return s.getCommand(parser.Direction.PREFIX, ini.TEXT).parse(ap, new Token(escd, ini.TEXT, yp.lineStart, yp.lineEnd, yp.startPos), p, l, s, pa);
            }
            return new Text(escd);
        }
    }
    class ParseComment extends LeftAndRight {
        parse(ap, yp, p, l, s, pa) {
            switch (this.direction) {
                case parser.Direction.PREFIX: {
                    pa.block.push(yp.value);
                    while (!p.match(ini.EOL, l, s, pa)) {
                        const comment = p.consume(ini.COMMENT, l, s, pa).value;
                        if (s.comments.retain) {
                            pa.block.push(comment);
                        }
                    }
                }
                case parser.Direction.POSTFIX:
                case parser.Direction.INFIX:
                default: {
                    if (s.comments.retain)
                        pa.inline = yp.value;
                }
            }
            return ap;
        }
    }
    class Assign extends LeftAndRight {
        parse(ap, yp, p, l, s, pa) {
            if (pa.assigned)
                return s.getCommand(parser.Direction.INFIX, ini.TEXT).parse(ap, new Token(yp.value, ini.TEXT, yp.lineStart, yp.lineEnd, yp.startPos), p, l, s, pa);
            pa.assigned = true;
            switch (this.direction) {
                case parser.Direction.PREFIX: {
                    const rightExpr = p.parseWithPrecedence(yp.type.precedence, l, s, pa);
                    const right = isText(rightExpr) ? rightExpr.text : "";
                    const preceding = pa.block;
                    pa.block = [];
                    //parse inline comments
                    // if(p.match(COMMENT, l, s, pa!)) p.parse(l, s, pa);
                    return new KeyValue({ preceding: Object.freeze(preceding), inline: pa.inline }, "", right);
                }
                case parser.Direction.INFIX:
                case parser.Direction.POSTFIX:
                default: {
                    const left = isText(ap) ? ap.text : "";
                    const rightExpr = p.parseWithPrecedence(yp.type.precedence, l, s, pa);
                    if (!(rightExpr instanceof Text))
                        throw new parser.ParseError("Could not parse whatever was after the section nesting operator");
                    const right = isText(rightExpr) ? rightExpr.text : "";
                    const preceding = pa.block;
                    pa.block = [];
                    //parse inline comments
                    // if(p.match(COMMENT, l, s, pa!)) p.parse(l, s, pa);
                    return new KeyValue({ preceding: Object.freeze(preceding), inline: pa.inline }, left, right);
                }
            }
        }
    }
    class ParseSection {
        parse(ap, yp, p, l, s, pa) {
            pa.insideSecName = true;
            //create the section name
            if (utility.isValid(s.nesting) && s.nesting.relative && p.match(ini.SUB_SECTION, l, s, pa)) {
                do {
                    p.consume(ini.SUB_SECTION, l, s, pa);
                    const text = p.parseWithPrecedence(yp.type.precedence, l, s, pa);
                    if (text instanceof Text) {
                        pa.section.push(text.text);
                    }
                    else
                        throw new parser.ParseError("section name not found");
                } while (p.match(ini.SUB_SECTION, l, s, pa));
            }
            else {
                pa.section = [];
                while (true) {
                    const text = p.parseWithPrecedence(yp.type.precedence, l, s, pa);
                    if (text instanceof Text)
                        pa.section.push(text.text);
                    else
                        throw new parser.ParseError("section name not found");
                    if (p.match(ini.SUB_SECTION, l, s, pa))
                        p.consume(ini.SUB_SECTION, l, s, pa);
                    else {
                        p.consume(ini.SECTION_END, l, s, pa);
                        break;
                    }
                }
            }
            pa.insideSecName = false;
            //create and enforce section scope by parsing all properties in the scope
            const scope = new Section({ preceding: Object.freeze([...pa.block]), inline: pa.inline });
            pa.block = [];
            pa.inline = "";
            while ((!p.match(ini.SECTION_START, l, s, pa)) && !p.match(ini.EOF, l, s, pa)) {
                let prop = p.parse(l, s, pa);
                pa.assigned = false;
                if (!utility.isValid(prop)) { //a blank or comment line
                    continue;
                }
                else if (prop instanceof KeyValue || prop instanceof Text) { //see KeyValue class docs
                    if (prop instanceof Text) {
                        prop = new KeyValue({ preceding: Object.freeze([...pa.block]), inline: pa.inline }, prop.text, "");
                        pa.block = [];
                        pa.inline = "";
                    }
                    scope.add(s, [], prop);
                }
                else
                    throw new parser.ParseError(`Unexpected value found`);
            }
            //add this scope to the parent/global scope
            ap.add(s, pa.section, scope);
            return ap; //return the parent/global scope
        }
    }
    /**SUB_SECTION (.), ASSIGNMENT (=) and COMMENT (;) are all parsed as text when inside a quote or double quotes */
    class ParseText {
        parse(ap, yp, p, l, s, pa) {
            if (yp.type.equals(ini.QUOTE)) {
                const tokens = Array();
                while (true) {
                    if (p.match(ini.TEXT, l, s, pa))
                        tokens.push(p.consume(ini.TEXT, l, s, pa));
                    else if (p.match(ini.ESCAPE, l, s, pa)) {
                        const esc = p.consume(ini.ESCAPE, l, s, pa);
                        const escaped = p.consume(ini.ESCAPED, l, s, pa);
                        tokens.push(new Token(s.escape.parse(esc.value + escaped.value), ini.TEXT, escaped.lineStart, escaped.lineEnd, escaped.startPos));
                    }
                    else if (p.match(ini.SUB_SECTION, l, s, pa)) {
                        tokens.push(p.consume(ini.SUB_SECTION, l, s, pa));
                    }
                    else if (p.match(ini.ASSIGNMENT, l, s, pa)) {
                        tokens.push(p.consume(ini.ASSIGNMENT, l, s, pa));
                    }
                    else if (p.match(ini.COMMENT, l, s, pa)) {
                        tokens.push(p.consume(ini.COMMENT, l, s, pa));
                    }
                    else if (p.match(ini.SECTION_START, l, s, pa)) {
                        tokens.push(p.consume(ini.SECTION_START, l, s, pa));
                    }
                    else if (p.match(ini.SECTION_END, l, s, pa)) {
                        tokens.push(p.consume(ini.SECTION_END, l, s, pa));
                    }
                    else if (p.match(ini.WHITESPACE, l, s, pa)) {
                        tokens.push(p.consume(ini.WHITESPACE, l, s, pa));
                    }
                    else if (p.match(ini.D_QUOTE, l, s, pa))
                        tokens.push(p.consume(ini.D_QUOTE, l, s, pa));
                    else if (p.match(ini.D_QUOTE_END, l, s, pa))
                        tokens.push(p.consume(ini.D_QUOTE_END, l, s, pa));
                    else if (p.match(ini.QUOTE_END, l, s, pa)) {
                        p.consume(ini.QUOTE_END, l, s, pa);
                        break;
                    }
                }
                return new Text(mergeTokens(tokens));
            }
            else if (yp.type.equals(ini.D_QUOTE)) {
                const tokens = Array();
                while (true) {
                    if (p.match(ini.TEXT, l, s, pa))
                        tokens.push(p.consume(ini.TEXT, l, s, pa));
                    else if (p.match(ini.ESCAPE, l, s, pa)) {
                        const esc = p.consume(ini.ESCAPE, l, s, pa);
                        const escaped = p.consume(ini.ESCAPED, l, s, pa);
                        tokens.push(new Token(s.escape.parse(esc.value + escaped.value), ini.TEXT, escaped.lineStart, escaped.lineEnd, escaped.startPos));
                    }
                    else if (p.match(ini.SUB_SECTION, l, s, pa)) {
                        tokens.push(p.consume(ini.SUB_SECTION, l, s, pa));
                    }
                    else if (p.match(ini.ASSIGNMENT, l, s, pa)) {
                        tokens.push(p.consume(ini.ASSIGNMENT, l, s, pa));
                    }
                    else if (p.match(ini.COMMENT, l, s, pa)) {
                        tokens.push(p.consume(ini.COMMENT, l, s, pa));
                    }
                    else if (p.match(ini.SECTION_START, l, s, pa)) {
                        tokens.push(p.consume(ini.SECTION_START, l, s, pa));
                    }
                    else if (p.match(ini.SECTION_END, l, s, pa)) {
                        tokens.push(p.consume(ini.SECTION_END, l, s, pa));
                    }
                    else if (p.match(ini.WHITESPACE, l, s, pa)) {
                        tokens.push(p.consume(ini.WHITESPACE, l, s, pa));
                    }
                    else if (p.match(ini.QUOTE, l, s, pa))
                        tokens.push(p.consume(ini.QUOTE, l, s, pa));
                    else if (p.match(ini.QUOTE_END, l, s, pa))
                        tokens.push(p.consume(ini.QUOTE_END, l, s, pa));
                    else if (p.match(ini.D_QUOTE_END, l, s, pa)) {
                        p.consume(ini.D_QUOTE_END, l, s, pa);
                        break;
                    }
                }
                return new Text(mergeTokens(tokens));
            }
            let string = yp.value;
            while (true) {
                if (p.match(ini.TEXT, l, s, pa))
                    string += p.consume(ini.TEXT, l, s, pa);
                else if (p.match(ini.WHITESPACE, l, s, pa))
                    string += p.consume(ini.WHITESPACE, l, s, pa);
                else if (p.match(ini.SUB_SECTION, l, s, pa) && !pa.insideSecName)
                    string += p.consume(ini.SUB_SECTION, l, s, pa);
                else if (p.match(ini.ASSIGNMENT, l, s, pa) && pa.assigned)
                    string += p.consume(ini.ASSIGNMENT, l, s, pa).value;
                else if (p.match(ini.ESCAPE, l, s, pa) && utility.isValid(s.escape) && s.escape.nonQuotedEsc) {
                    const esc = p.consume(ini.ESCAPE, l, s, pa);
                    const escaped = p.consume(ini.ESCAPED, l, s, pa);
                    string += s.escape.parse(esc.value + escaped.value);
                }
                else
                    break;
            }
            return new Text(string.trim());
        }
    }
    class EndLine {
        parse(ap, yp, p, l, s, pa) {
            skipBlankLines(l, s, p, pa);
            pa.assigned = false;
            // if(p.match(SECTION_START, l, s, pa)) return s.getCommand(parser.Direction.PREFIX, SECTION_START)!.parse(ap, p.consume(SECTION_START, l, s, pa) as Token, p, l, s, pa);
            return ap;
        }
    }
    class Initializer {
        parse(ap, yp, p, l, s, pa) {
            ap = new Section(emptyComment());
            while (!p.match(ini.EOF, l, s, pa)) {
                p.parse(l, s, pa);
            }
            return ap;
        }
    }
    /**A command to parse prefix whitespace. Because of the way the lexer creates tokens, this will only be called if a whitespace is not a delimiter like {@link PROPERTIES `PROPERTIES`} */
    class ParseSpace {
        parse(ap, yp, p, l, s, pa) {
            while (p.match(ini.WHITESPACE, l, s, pa)) {
                p.consume(ini.WHITESPACE, l, s, pa);
            }
            return ap;
        }
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
    class KeyValue {
        comments;
        key;
        value;
        constructor(comments, key, value) {
            this.comments = comments;
            this.key = key;
            this.value = value;
        }
        format(format, syntax, params) {
            format.append(this, syntax, params);
        }
        debug() {
            return `${this.comments.preceding.length > 0 ? unwrapComments(this.comments) : ""}${this.key} = ${this.value} ${this.comments.inline ? ";" + this.comments.inline : ""}\n`;
        }
        compareTo(obj) {
            return utility.compare(this.hashCode32(), obj?.hashCode32());
        }
        equals(obj) {
            if (obj instanceof Section)
                return this.compareTo(obj) === 0;
            return false;
        }
        hashCode32() {
            return utility.hashCode32(false, utility.asHashable(this.key), utility.asHashable(this.value), utility.asHashable(this.comments));
        }
        toString() {
            return JSON.stringify(this);
        }
    }
    class Section {
        comments;
        _map;
        constructor(comments = emptyComment()) {
            this.comments = comments;
            this._map = {};
        }
        static _addProp(section, s, names, value) {
            if (names.length === 0) {
                const key = value.key; //Section._getProperKey(value);
                if (!utility.isValid(section._map[key]))
                    section._map[key] = new Property();
                else if (!(section._map[key] instanceof Property))
                    throw new expression.ExpressionError(`The property '${key}' is not of Property type. A name conflict was found`);
                section._map[key].add(s, value);
                return;
            }
            const name = names.shift();
            if (!utility.isValid(section._map[name]))
                section._map[name] = new Section();
            else if (!(section._map[name] instanceof Section))
                throw new expression.ExpressionError(`The section '${name}' is not of Section type. A name conflict was found`);
            return Section._addProp(section._map[name], s, names, value);
        }
        static _addSec(section, s, names, value) {
            if (names.length === 1) {
                const name = names.pop();
                switch (s.duplicateDirective.section) {
                    case DuplicateDirective.MERGE:
                    default: if (utility.isValid(section._map[name])) {
                        section._map[name] = value ? { ...value } : new Section();
                        return;
                    }
                    else
                        break;
                    case DuplicateDirective.OVERWRITE: if (utility.isValid(section._map[name]))
                        break;
                    case DuplicateDirective.DISCARD: if (utility.isValid(section._map[name]))
                        return;
                    case DuplicateDirective.THROW:
                }
                section._map[name] = value ?? new Section();
                return;
            }
            const name = names.shift();
            if (!utility.isValid(section._map[name]))
                section._map[name] = new Section();
            else if (!(section._map[name] instanceof Section))
                throw new expression.ExpressionError(`The section '${name}' is not of Section type. A name conflict was found`);
            return Section._addSec(section._map[name], s, names, value);
        }
        add(s, name, e) {
            if (Array.isArray(name)) {
                if (e instanceof KeyValue)
                    Section._addProp(this, s, name, e);
                else
                    Section._addSec(this, s, name, e);
            }
            else
                this.add(s, [name], e);
        }
        format(format, syntax, params) {
            format.append(this, syntax, params);
        }
        _debug(name = "", section = this) {
            let rv = "";
            for (const key in section._map) {
                if (section._map[key] instanceof Section) {
                    return section._debug(name.length > 0 ? `${name}.${key}` : `[${key}`, section._map[key]);
                }
                else if (section._map[key] instanceof Property) {
                    rv += `${name}]${this.comments.inline && this.comments.inline.length > 0 ? this.comments.inline : ""}\n${section._map[key].debug()}`;
                }
                else
                    throw new expression.ExpressionError(`Illegal value found at ${name}.${key}`);
            }
            return rv;
        }
        debug() {
            return (this.comments.preceding.length > 0 ? unwrapComments(this.comments) : "") + this._debug();
        }
        compareTo(obj) {
            return utility.compare(this.hashCode32(), obj?.hashCode32());
        }
        equals(obj) {
            if (obj instanceof Section)
                return this.compareTo(obj) === 0;
            return false;
        }
        hashCode32() {
            return utility.hashCode32(false, utility.asHashable(this._map), utility.asHashable(this.comments));
        }
        get(name) {
            return this._map[name];
        }
        remove(name) {
            delete this._map[name];
        }
        get map() {
            return Object.freeze(this._map);
        }
        toString() {
            return JSON.stringify(this);
        }
    }
    class Property {
        _values;
        comments;
        constructor(initialValue) {
            this.comments = emptyComment();
            this._values = [];
            if (utility.isValid(initialValue))
                this._values.push(initialValue);
        }
        add(s, param) {
            if (param instanceof KeyValue) {
                switch (s.duplicateDirective.property) {
                    case DuplicateDirective.MERGE:
                    default: break;
                    case DuplicateDirective.OVERWRITE: {
                        if (this._values.length > 0)
                            do {
                                this._values.pop();
                            } while (this._values.length > 0);
                        return;
                    }
                    case DuplicateDirective.DISCARD: if (this._values.length > 0)
                        return;
                    case DuplicateDirective.THROW: if (this._values.length > 0)
                        throw Error("Duplicate not supported");
                }
                this._values.push(param);
            }
            else if (param instanceof Text) {
                this.add(s, new KeyValue(emptyComment(), param.text, ""));
            }
            else if (typeof param === "string") {
                this.add(s, new KeyValue(emptyComment(), param, ""));
            }
        }
        get values() {
            return Object.freeze([...this._values]);
        }
        value(index = 0) {
            return this.values[index];
        }
        remove(index = 0) {
            this._values.splice(index, 1);
        }
        format(format, syntax, params) {
            format.append(this, syntax, params);
        }
        debug() {
            return `${this.comments.preceding.length > 0 ? unwrapComments(this.comments) : ""}${this._values.map(x => x.debug()).join("")}`;
        }
        compareTo(obj) {
            return utility.compare(this.hashCode32(), obj?.hashCode32());
        }
        equals(obj) {
            if (obj instanceof Property)
                return this.compareTo(obj) === 0;
            return false;
        }
        hashCode32() {
            return utility.hashCode32(false, utility.asHashable(this.comments), utility.asHashable(this._values));
        }
        toString() {
            return JSON.stringify(this);
        }
    }
    class Text {
        text;
        comments;
        constructor(text) {
            this.text = text;
            this.comments = { preceding: Object.freeze(Array()) };
        }
        format(format, syntax, params) {
            format.append(this.text, syntax, params);
        }
        debug() {
            return this.text;
        }
        compareTo(obj) {
            return utility.compare(this.hashCode32(), obj?.hashCode32());
        }
        equals(obj) {
            if (obj instanceof Text)
                return this.compareTo(obj) === 0;
            return false;
        }
        hashCode32() {
            return utility.hashCode32(true, utility.asHashable(this.comments), utility.asHashable(this.text));
        }
        toString() {
            return JSON.stringify(this);
        }
    }
    /**Convenience class to allow for proper return values using `parse` */
    class Parser extends parser.PrattParser {
    }
    ini.Parser = Parser;
    class StringFormat {
        _data = "";
        append(data, s, p) {
            if (typeof data === "string") {
                this._data += data;
                this.modifications++;
            }
            else if (data instanceof KeyValue) {
                this.append(data.comments.preceding.length > 0 ? unwrapComments(data.comments, s) : "", s, p);
                this.append(`${data.key} ${s.delimiters[0]} ${data.value}`, s, p);
                this.append(`${data.comments.inline ? s.comments.chars[0] + data.comments.inline : ""}\n`, s, p);
            }
            else if (data instanceof Property) {
                this.append(data.comments.preceding.length > 0 ? unwrapComments(data.comments, s) : "", s, p);
                for (let i = 0; i < data.values.length; i++) {
                    this.append(data.values[i], s, p);
                }
                this.append(`${data.comments.inline ? s.comments.chars[0] + data.comments.inline : ""}\n`, s, p);
            }
            else if (data instanceof Section) {
                this.append(data.comments.preceding.length > 0 ? unwrapComments(data.comments, s) : "", s, p);
                append(this, data, s, p);
            }
            else if (data instanceof Text) {
                this._data += data.text;
                this.modifications++;
            }
            else
                throw new expression.FormatError("format not supported");
        }
        data() {
            return this._data;
        }
        reverse() {
            this._data.split("").reverse().join("");
            return this;
        }
        equals(another) {
            if (another instanceof StringFormat)
                return this.compareTo(another) === 0;
            return false;
        }
        modifications = 0;
        bpc = 8;
        bpn = 32;
        hashCode32() {
            return utility.hashCode32(false, utility.asHashable(this.modifications), utility.asHashable(this.bpc), utility.asHashable(this.bpn), utility.asHashable(this._data));
        }
        toJSON() {
            return JSON.stringify(this);
        }
        compareTo(obj) {
            return utility.compare(this.hashCode32(), obj?.hashCode32());
        }
    }
    ini.StringFormat = StringFormat;
    class JSFormat {
        _data = null;
        _append(data, rv, s, p) {
            for (const key in data.map) {
                if (data.map[key] instanceof Section) {
                    rv[key] = {};
                    this._append(data.map[key], rv, s, p);
                }
                else if (data.map[key] instanceof Property) {
                    const prop = data.map[key];
                    if (prop.values.length < 2) {
                        rv[key] = prop.values.length === 0 ? null : s?.parse(prop.values[0].value);
                    }
                    else {
                        rv[key] = Array();
                        for (let i = 0; i < prop.values.length; i++) {
                            rv[key].push(s?.parse(prop.values[i].value));
                        }
                    }
                }
                else
                    throw new expression.ExpressionError(`Illegal value found at ${key}`);
            }
        }
        append(data, s, p) {
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
            } else */ if (data instanceof Section) {
                // const keys = Object.keys(data.map);
                if (!utility.isValid(this._data)) //{
                    this._data = {};
                //     this._append(data.map[s!.globalName] as Section, this._data, s, p);
                // } else
                this._append(data, this._data, s, p);
            } /* else if(data instanceof Text) {
                this._data[data.text] = null;
                this.modifications++;
            } */
            else
                throw new expression.FormatError("format not supported", data);
        }
        data() {
            return this._data;
        }
        reverse() {
            return this;
        }
        equals(another) {
            if (another instanceof StringFormat)
                return this.compareTo(another) === 0;
            return false;
        }
        modifications = 0;
        bpc = 8;
        bpn = 32;
        hashCode32() {
            return utility.hashCode32(false, utility.asHashable(this.modifications), utility.asHashable(this.bpc), utility.asHashable(this.bpn), utility.asHashable(this._data));
        }
        toJSON() {
            return JSON.stringify(this);
        }
        compareTo(obj) {
            return utility.compare(this.hashCode32(), obj?.hashCode32());
        }
    }
    ini.JSFormat = JSFormat;
    class FileFormat {
        _str;
        constructor(filename) {
            this._str = createWriteStream(filename, {
                autoClose: true,
                emitClose: false,
                encoding: "utf-8"
            });
        }
        endWrite() {
            this._str.end();
            this._str.close();
        }
        append(data, s, p) {
            if (typeof data === "string") {
                this._str.write(data);
                this.modifications++;
            }
            else if (data instanceof KeyValue) {
                this.append(data.comments.preceding.length > 0 ? unwrapComments(data.comments, s) : "", s, p);
                this.append(`${data.key} ${s.delimiters[0]} ${data.value}`, s, p);
                this.append(`${data.comments.inline ? s.comments.chars[0] + data.comments.inline : ""}\n`, s, p);
            }
            else if (data instanceof Property) {
                this.append(data.comments.preceding.length > 0 ? unwrapComments(data.comments, s) : "", s, p);
                for (let i = 0; i < data.values.length; i++) {
                    this.append(data.values[i], s, p);
                }
                this.append(`${data.comments.inline ? s.comments.chars[0] + data.comments.inline : ""}\n`, s, p);
            }
            else if (data instanceof Section) {
                this.append(data.comments.preceding.length > 0 ? unwrapComments(data.comments, s) : "", s, p);
                append(this, data, s, p);
            }
            else if (data instanceof Text) {
                this._str.write(data.text);
                this.modifications++;
            }
            else
                throw new expression.FormatError("format not supported");
        }
        data() {
            return createReadStream(this._str.path, {
                autoClose: true,
                encoding: "utf-8"
            });
        }
        reverse() {
            return this;
        }
        equals(another) {
            if (another instanceof FileFormat)
                return this.compareTo(another) === 0;
            return false;
        }
        modifications = 0;
        bpc = 8;
        bpn = 32;
        hashCode32() {
            return utility.hashCode32(false, utility.asHashable(this.modifications), utility.asHashable(this.bpc), utility.asHashable(this.bpn), utility.asHashable(this._str));
        }
        toJSON() {
            return JSON.stringify(this);
        }
        compareTo(obj) {
            return utility.compare(this.hashCode32(), obj?.hashCode32());
        }
    }
    ini.FileFormat = FileFormat;
    class Converter extends parser.Converter {
        _transform(chunk, encoding, callback) {
            if (!this.writableObjectMode) {
                chunk = Buffer.isBuffer(chunk)
                    ? iconv.decode(chunk, this.syntax.metadata.encoding)
                    : String(chunk);
            }
            try {
                this.lexer.process(chunk, this.syntax, this.params);
            }
            catch (e) {
                return callback(e);
            }
        }
        _flush(callback) {
            this.lexer.end(this.syntax, this.params);
            if (this.lexer.hasTokens()) {
                try {
                    return callback(null, this.parser.parse(this.lexer, this.syntax, this.params));
                }
                catch (e) {
                    return callback(e);
                }
            }
        }
    }
    ini.Converter = Converter;
    ini.UNIX = new SyntaxBuilder()
        .removeCommentChar(";")
        .retainComments(false)
        .removeDelimiter(':')
        .setDupDirective(DuplicateDirective.OVERWRITE, true)
        .setDupDirective(DuplicateDirective.MERGE, false)
        .build();
    ini.PROPERTIES = new SyntaxBuilder()
        .removeCommentChar(";")
        .addCommentChar("!")
        .supportInline(false)
        .retainComments(true) //Can't decide on this functionality
        .addDelimiter('\t')
        .addDelimiter('\f')
        .setDupDirective(DuplicateDirective.OVERWRITE, true)
        .setDupDirective(DuplicateDirective.THROW, false)
        .removeSupportForNesting()
        .supportQuotedText(false)
        .supportNonQuotedEscape(true)
        .removeUnicodeChar('x')
        .build();
    ini.WINAPI = new SyntaxBuilder()
        .removeCommentChar('#') //only ';' are supported
        .supportInline(false)
        .setDupDirective(DuplicateDirective.DISCARD, false) //for sections
        // .setDupDirective(DuplicateDirective.MERGE, true)//for props, already the default
        .retainComments(true) //Can't decide on this functionality
        .removeDelimiter(':') //only ";" will be used
        .removeSupportForNesting() //no nesting char needed
        // .supportRelativeNesting(true)// nesting already the default
        .removeUnicodeChar('x') // Donot support unicode escapes
        .removeUnicodeChar('u') // Donot support unicode escapes
        // .supportNonQuotedEscape(false)//already the default
        // .supportQuotedText(true)//already the default
        .setEscapeChar('\x00') //Prevent escapes. No need to set escape parser as it will never be needed by the parser or formatter as no escape is set
        .setEscapeParser(e => e) // Just for lols
        .build();
    // export const UNIX
})(ini || (ini = {}));
export default ini;
