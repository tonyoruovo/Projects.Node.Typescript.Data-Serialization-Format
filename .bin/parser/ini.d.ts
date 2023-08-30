/// <reference types="node" resolution-mode="require"/>
/// <reference types="node" resolution-mode="require"/>
/// <reference types="node" resolution-mode="require"/>
import { ReadStream } from "fs";
import { TransformCallback } from "node:stream";
import utility from "../utility.js";
import expression from "./expression.js";
import json from "./json.js";
import parser from "./parser.js";
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
declare namespace ini {
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
    export class SyntaxBuilder implements utility.Builder<Syntax> {
        private _com;
        private _del;
        private _dd;
        private _nes?;
        private _glo;
        private _esc?;
        private _md;
        private _p;
        /**the infix array that hold a 2-length tuple of `parser.GType<string>` and `Command`
         * the default is `[]`
         * @defaultValue `[]`*/
        private _infCmdlets;
        /**the prefix array that hold a 2-length tuple of `parser.GType<string>` and `Command`
         * the default is `[]`
         * @defaultValue `[]`*/
        private _preCmdlets;
        /**the postfix array that hold a 2-length tuple of `parser.GType<string>` and `Command`
         * the default is `[]`
         * @defaultValue `[]`*/
        private _posCmdlets;
        /**A function for getting the correct command based on the direction */
        private _getCmd;
        private _ensureUniqueness;
        constructor();
        removeSupportForNesting(): SyntaxBuilder;
        removeSupportForEscape(): SyntaxBuilder;
        removeCommentChar(char: string): SyntaxBuilder;
        removeDelimiter(delim: string): SyntaxBuilder;
        removeNestingChar(char: string): SyntaxBuilder;
        removeUnicodeChar(char: string): SyntaxBuilder;
        addCommentChar(char: string): SyntaxBuilder;
        addDelimiter(delim: string): SyntaxBuilder;
        addNestingChar(char: string): SyntaxBuilder;
        addUnicodeChar(char: string): SyntaxBuilder;
        retainComments(b: boolean): SyntaxBuilder;
        supportNonQuotedEscape(b: boolean): SyntaxBuilder;
        supportInline(b: boolean): SyntaxBuilder;
        supportRelativeNesting(b: boolean): SyntaxBuilder;
        setGlobalName(g: string): SyntaxBuilder;
        supportQuotedText(b: boolean): SyntaxBuilder;
        setEscapeChar(char: string): SyntaxBuilder;
        setEscapeParser(p: (e: string) => string): SyntaxBuilder;
        setFormatParser(p: (v: string) => json.Value): SyntaxBuilder;
        setDupDirective(dd: DuplicateDirective, forProperty?: boolean): SyntaxBuilder;
        private _pushOrOverite;
        addInfixCommand(type: parser.GType<string>, cmd: Command): SyntaxBuilder;
        removeInfixCommand(type: parser.GType<string>): SyntaxBuilder;
        addPrefixCommand(type: parser.GType<string>, cmd: Command): SyntaxBuilder;
        removePrefixCommand(type: parser.GType<string>): SyntaxBuilder;
        addPostfixCommand(type: parser.GType<string>, cmd: Command): SyntaxBuilder;
        removePostfixCommand(type: parser.GType<string>): SyntaxBuilder;
        /**
         * Sets the extension string associated with the syntax as specified by {@link `Syntax.metadata.fileExt`}
         * @remark
         * The default is `'ini'`.
         * @param {string} ext the file extension as a string. This should not have any trailing dot(s). An undefined or null value has no effect
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        setFileExt(ext: string): SyntaxBuilder;
        /**
         * Sets the {@link Syntax.metadata.isStandard isStandard property} in the syntax to be built.
         * @remark
         * The default is `false`.
         * @param {boolean} b `true` if the syntax is a web standard `false` if otherwise. A truthy value will be converted to a boolean.
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        setIsStandard(b: boolean): SyntaxBuilder;
        /**
         * Sets the {@link Syntax.metadata.mediaType media type} associated with the data for which the syntax is being built.
         * @remark
         * The default is `'text/plain, application/textedit, zz-application/zz-winassoc-ini'`
         * @param {string} mediaType the MIME type for the syntax
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        setMediaType(mediaType: string): SyntaxBuilder;
        /**
         * Sets the {@link Syntax.metadata.standard standard} associated with the data for which the syntax is being built.
         * The standard is a string associated with the media type, web specification, schema or syntax definition e.g a **R**equest **F**or **C**ommenid.t
         * @remark
         * The default is `''`
         * @param {string} standard a string representing the standard specification for the data that this syntax will be created for.
         * @returns {SyntaxBuilder} the same builder object for method chaining
         */
        setStandard(standard: string): SyntaxBuilder;
        clear(toDefault?: boolean): SyntaxBuilder;
        build(): Syntax;
        rebuild(from: Syntax): SyntaxBuilder;
    }
    /**
     * Duplicate properties merge values and duplicate sections merge their properties
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
            readonly retain: boolean;
            /**
             * The single characters that starts an inline comment. For example [pacman.conf](https://archlinux.org/pacman/pacman.conf.5.html) uses the `'#'` character, windows uses the `';'` character
             * and [apache commons configuration api](https://commons.apache.org/proper/commons-configuration/apidocs/org/apache/commons/configuration2/INIConfiguration.html) supports both
             */
            readonly chars: readonly string[];
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
            section: DuplicateDirective;
            /**FOr duplicate property names */
            property: DuplicateDirective;
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
            readonly chars: readonly string[];
            /**
             * Allows for a syntax that uses nesting chars at the start of a section name e.g `[.section]`. A `false`value will parse `[.section]` as a single
             * section name disregarding the "parent" section and will only assign a section as a child of another if it is written as `'[section.subsection]'`.
             * @type {boolean}
             * @readonly
             */
            readonly relative: boolean;
        };
        /**The name for default parent section
         * @type {string}
         * @readonly
         */
        readonly globalName: string;
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
            readonly unicode: readonly string[];
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
            readonly char: string;
            /**
             * Parses the 2-length string (and if the `unicode` property has at least 1 element, parses unicode escapes as well such as `\x20`) and returns an appropriate string for an escaped character
             * @param esc a 2-length string given as the escape character, and the character it escapes
             * @returns {string} a `string` which is defined as the in-memory representation of the argument
             */
            parse(esc: string): string;
        };
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
        section: string[];
        /**An array of strings representing consecutiveline of comments. This value is empty the moment a {@link Section} or {@link Property} is parsed. */
        block: string[];
        /**inline comments as a `string`. This value is reset every time */
        inline: string;
        /**Defines the state of the parser when parsing inside of a section name as a `boolean` */
        insideSecName: boolean;
        /**Specifies whether or not an assignment of a value to a key/name has been done */
        assigned: boolean;
    }
    /**
     * - `'['` section start
     * - `']'` section end
     * - `'='` assignment within a property
     * - `';'` `'#'` `'!'` comment start (comment may be retained by configuring the syntax so)
     * - **text** these are the names of sections, properties and the value of a property.
     */
    class Type implements parser.GType<string> {
        readonly id: string;
        readonly precedence: number;
        /**
         * Constructs a `Type` with an assigned unique id and precedence.
         * @param {string} id a unique id associated with this {@link parser.Type}
         * @param {number} precedence the precedence of this type. This determines how it will be evaluated in the evaluation hierarchy (per se)
         */
        constructor(id: string, precedence: number);
        /**
         * Test the equality of this `Type` to the given input
         * @param {(object|undefined)} obj any object to test against `this`
         * @returns {boolean} `true` if `this` is equal to the input and `false` if otherwise.
         */
        equals(obj?: object): boolean;
    }
    export const EOF: parser.GType<string>;
    export const EOL: parser.GType<string>;
    export const SECTION_START: parser.GType<string>;
    export const QUOTE: parser.GType<string>;
    export const D_QUOTE: parser.GType<string>;
    export const TEXT: parser.GType<string>;
    export const SUB_SECTION: parser.GType<string>;
    export const SECTION_END: parser.GType<string>;
    export const ASSIGNMENT: parser.GType<string>;
    export const COMMENT: parser.GType<string>;
    export const QUOTE_END: parser.GType<string>;
    export const D_QUOTE_END: parser.GType<string>;
    export const ESCAPE: parser.GType<string>;
    export const ESCAPED: parser.GType<string>;
    export const WHITESPACE: parser.GType<string>;
    class Token implements parser.GToken<string> {
        readonly value: string;
        readonly type: Type;
        readonly lineStart: number;
        readonly lineEnd: number;
        readonly startPos: number;
        readonly length: number;
        constructor(value: string, type: Type, lineStart: number, lineEnd: number, startPos: number);
        toString(): string;
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
        #private;
        private _queue;
        private _i;
        private _canProcess;
        constructor();
        private _processEscapables;
        private _process;
        end(): void;
        /**
         * Calling this method when {@link JSONLexer.canProcess `canProcess`} returns `false` puts this `JSONLexer` object in an undefined state.
         * @inheritdoc
         */
        process(chunk: json.Value, syntax: Syntax, p: any): void;
        processed: () => Token[];
        unprocessed: () => json.Value | undefined;
        frequency(type: parser.Type): number;
        indexOf(type: parser.Type): number;
        lastIndexOf(type: parser.Type): number;
        hasTokens(): boolean;
        canProcess(): boolean;
        next(): Token;
        /**
         * Will be `undefined` if `process` is yet to be called
         * @inheritdoc
         */
        src?: json.Value;
        position(): number;
        line(): 0;
    }
    /**Since this is a line oriented data-serialisation-format, strings are tokenised by lines and not individually */
    export class StringLexer implements MutableLexer {
        #private;
        src: string;
        constructor();
        end(syntax: Syntax, params: Params): void;
        process(chunk: string | undefined, syntax: Syntax, p: Params): void;
        processed: () => Token[];
        unprocessed: () => string;
        frequency(type: parser.Type): number;
        indexOf(type: parser.Type): number;
        lastIndexOf(type: parser.Type): number;
        hasTokens(): boolean;
        canProcess(): boolean;
        next(): Token;
        position(): number;
        line(): number;
    }
    export interface Command extends parser.GCommand<Token, Expression, Syntax, MutableLexer, Parser> {
        parse(ap: Expression, yp: Token, p: Parser, l: MutableLexer, s: Syntax, pa?: Params): Expression;
    }
    export interface Expression extends expression.GExpression<Format> {
        readonly comments: {
            readonly preceding: readonly string[];
            readonly inline?: string;
        };
        format(format: Format, syntax?: Syntax, params?: Params | any): void;
    }
    /**Convenience class to allow for proper return values using `parse` */
    export class Parser extends parser.PrattParser<Expression, Syntax> {
    }
    export type Appendage = string | Expression;
    /**A base ini format */
    export interface Format<T = any> extends expression.GFormat<Expression, T> {
        append(data: Appendage, s?: Syntax, p?: Params): void;
    }
    export class StringFormat implements Format<string> {
        private _data;
        append(data: Appendage, s?: Syntax | undefined, p?: Params | undefined): void;
        data(): string;
        reverse(): this;
        equals(another: expression.GFormat<Expression, string>): boolean;
        modifications: number;
        readonly bpc: number;
        readonly bpn: number;
        hashCode32(): number;
        toJSON(): string;
        compareTo(obj?: expression.GFormat<Expression, string> | undefined): utility.Compare;
    }
    export class JSFormat implements Format<json.Value> {
        private _data;
        private _append;
        append(data: Appendage, s?: Syntax | undefined, p?: Params | undefined): void;
        data(): json.Pair;
        reverse(): this;
        equals(another: expression.GFormat<Expression, json.Value>): boolean;
        modifications: number;
        readonly bpc: number;
        readonly bpn: number;
        hashCode32(): number;
        toJSON(): string;
        compareTo(obj?: expression.GFormat<Expression, json.Value> | undefined): utility.Compare;
    }
    export class FileFormat implements Format<ReadStream> {
        private _str;
        constructor(filename: string);
        endWrite(): void;
        append(data: Appendage, s?: Syntax | undefined, p?: Params | undefined): void;
        data(): ReadStream;
        reverse(): this;
        equals(another: expression.GFormat<Expression, ReadStream>): boolean;
        modifications: number;
        readonly bpc: number;
        readonly bpn: number;
        hashCode32(): number;
        toJSON(): string;
        compareTo(obj?: expression.GFormat<Expression, ReadStream> | undefined): utility.Compare;
    }
    export class Converter extends parser.Converter<parser.GToken<string>, Expression, Syntax, Parser, Params, MutableLexer, any> {
        _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void;
        _flush(callback: TransformCallback): void;
    }
    export const UNIX: Syntax;
    export const PROPERTIES: Syntax;
    export const WINAPI: Syntax;
    export {};
}
export default ini;
