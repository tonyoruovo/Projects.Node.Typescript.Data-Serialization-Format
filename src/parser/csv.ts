import parser from "./parser.js";
import expression from "./expression.js";
import utility from "../utility.js";
import * as fs from "node:fs";
//import { EOL as lineTerm /*tmpdir*/ } from "node:os";
import { TransformCallback } from "node:stream";
import json from "./json.js";
import iconv from "iconv-lite";
// import { randomUUID } from "node:crypto";
// import { join } from "node:path";
// import {Buffer} from "node:buffer";
/**
 * @summary Defines the constituents of the csv pipeline.
 * @description The csv pipeline constitutes tokenisers (lexers) for tokenising text and json data; a parser which translates the
 * tokens into expressions; formatters which can create file, in-memory and simple string formats; a converter which binds several
 * of the aforementioned components so that the data contained within can be tranferred to other data languages seamlessly. \
 * \
 * While this pipeline can parse tsv and other delimited-separator-value type formats, it adhere to their individual specification
 * e.g there is no means for using proper escapes rather the quote character within a quoted string. This will be fixed in the future.
 * @remark ## Implementation note:
 * In the near future I hope to implement a feature where the delimiter can be read from the first line of a stream/file in the form `Sep=;`
 * This is case-insensitive ofcourse. \
 * \
 * I Also need a feature where a table can be transposed such that it's rows become the columns vice-versa.
 */
namespace csv {
  /**
   * Escapes all double quotes (consistent with csv expressions) in the given string and returns the escaped result
   * @param {string} s the value to be escaped
   * @returns {string} the escaped result
   */
  function escape(s: string, sy: Syntax): string {
    return s.replaceAll(
      new RegExp(sy.dQuotes, "g"),
      `${sy.dQuotes}${sy.dQuotes}`
    );
  }
  /**
   * Removes all escapes for double quotes
   * @param {string} s the value to be unescaped
   * @returns {string} the unescaped result
   */
  function unescape(s: string, sy: Syntax): string {
    return s.replaceAll(
      new RegExp(`${sy.dQuotes}${sy.dQuotes}`, "g"),
      sy.dQuotes
    );
  }
  /**
   * Checks if the `string` argument has trailing or leading whitespaces as defined by the function argument
   * @param {string} s the value  to be checked
   * @param {(val: string) => boolean} isWhitespace a function that is used to define what a 'whitespace' is
   * @returns {boolean} `true` if the `string` argument contains trailing and/or leading whitespace(s) (as defined by `isWhitespace`) or `false` if otherwise
   */
  function hasIllegalWhitespaces(
    s: string,
    isWhitespace: (val: string) => boolean
  ): boolean {
    return trim(s, isWhitespace).length !== s.length;
  }
  /**
   * A check that determines if the `string` argument is surrounded by quotes
   * @param {string} s the value to be checked
   * @param {(val: string) => boolean} isWhitespace a function that is used to define what a 'whitespace' is
   * @param {Syntax} sy a valid {@link Syntax} object that will specify the {@link Syntax.dQuotes double quote} character
   * @returns {boolean} `true` if the `string` input is quoted (surrounded by quotes) and `false` if otherwise
   */
  function isQuoted(
    s: string,
    isWhitespace: (val: string) => boolean,
    sy: Syntax
  ): boolean {
    const val = trim(s, isWhitespace);
    return val.startsWith(sy.dQuotes) && val.endsWith(sy.dQuotes);
  }
  /**
   * @summary trims the `string` argument
   * @description
   * Attempts to remove trailing and/or leading whitespaces in the given `string` whereby the meaning of a 'whitespace' is defined by the caller.
   * When no whitespace(s) is/are found, the `string` is returned as is.
   * @param {string} s the value to be trimmed
   * @param {(val: string) => boolean} f a function that is used to define what a 'whitespace' is
   * @param {boolean} trailing specifies the direction of the trimming; a `true` value trims only the *trailing* whitespace(s), a`false` value trims only the *leading*
   * whitespaces an `undefined` value trims both *trailing* and *leading* whitespaces.
   * @returns {string} the `string` argument after trimming is done.
   */
  function trim(
    s: string,
    f: (val: string) => boolean,
    trailing?: boolean
  ): string {
    if (trailing === undefined) {
      return trim(trim(s, f, true), f, false);
    } else if (trailing) {
      let index = 0;
      for (let i = 0; i < s.length; i++) {
        if (f(s[i])) index++;
        else break;
      }
      return s.substring(index);
    }
    let index = s.length;
    for (let i = s.length - 1; i >= 0; i--) {
      if (f(s[i])) index--;
      else break;
    }
    return s.substring(0, index);
  }
  /**
   * @summary returns the value of `n` as either a `number` or a `string`
   * @description
   * Detects whether the `string` argument (which is assumed to be part of a header value in a csv document) is a nested `number` or `string` and returns
   * the appropriate data type for it.
   * @param n the cell value to be fixed
   * @param s a valid {@link Syntax} object that has a valid {@link Syntax.nap nested-array-operator} and/or a valid {@link Syntax.nop nested-object-operator}
   * @returns {string | number} `n` as a `number` if the character at it's first index is the same as {@link Syntax.nap nested-array-operator} or else returns
   * `n` as a string.
   * @remark
   * If the character at the first index is a nested-array-operator, it is expected that all leading character(s) should be integers parsable by {@link Number.parseInt}
   * @see {@link Syntax.nop} and {@link Syntax.nap}
   */
  function fixFieldName(n: string, s: Syntax): string | number{
    if(n[0] === s.nap){
      return Number.parseInt(n.substring(1));
    } else if (n[0] === s.nop) return n.substring(1);
    return n;
  }
  /**
   * @summary splits `st` into `store`
   * @description
   * Recursively splits the `string` argument (which is assumed to be a csv header value) at indexes where nesting is detected and stores the results in `store`. Nesting is created when the `st` contains {@link Syntax.nap} or
   * {@link Syntax.nop} within the string. Note that when there is consecutive nesting operators, the behaviour of this function is undefined. If no operator
   * exists in `st`, then `store` contains `st` as it's only element.
   * @param {string} st the value to be split, cannot be `null` or `undefined`
   * @param {Syntax} s A valid {@link Syntax} object that identifies the nesting operators.
   * @param {string[]} store The result of the splitting. This will contain at least 1 element
   */
  function split(st: string, s: Syntax, store: string[]): void {
    if (st.length === 0) return;
    let i = 1;
    while (i < st.length) {
      if (st[i] === s.nop || st[i] === s.nap) break;
      i++;
    }
    store.push(st.substring(0, i));
    return split(st.substring(i), s, store);
  }
  /**
   * @summary formats header values
   * @description
   * Performs quick parsing and formatting on `h` (which is regarded as a row) into a proper csv row `string`. This function takes into account
   * cells that need quoting and escaping as well as the {@link Syntax.quotesType}.
   * @example
   * ```js
   * const h = ["c0", "c1", "c2", "c3"];
   * //this is only for use as an example.
   * //Do not construct a syntax by immediately calling
   * //build from a SyntaxBuilder as relevant properties will be missing
   * const s = new SyntaxBuilder().build();
   * const csv = fh(h, s);
   * console.log(csv);//logs: c0,c1,c2,c3
   * ```
   * @param {string[]} h a row from a csv document with each index representing a cell value. `undefined` and `null` values are not permitted.
   * @param {Syntax} s a valid {@link Syntax} which has a {@link Syntax.separator} and {@link Syntax.eol} string that is neither `null` nor `undefined`
   * @returns {string} a csv representation of the `string` array argument
   */
  function fh(h: string[], s: Syntax): string{//format header cells
    // let x = "";
    // for (let i = 0; i < h.length; i++) {
    //   x += possiblyEnquote(h[i], s);
    //   if(i < h.length - 1) x += s.separator;
    // }
    // x += s.eol;
    // return x;
    const k = h.length;
    return h.reduce((p, c, i) => p += i < k - 1 ? possiblyEnquote(c, s) + s.separator : possiblyEnquote(c, s), "") + s.eol;
  }
  /**
   * @summary Checks if `data` is the header row
   * @description
   * Checks if this is the first row and `data` (when formatted into a csv string) equals {@link Params.header} (when formatted into a csv string)
   * @param {RecordExpression} data the valid row as an {@link Expression}
   * @param {number} row the current with which `data` ia associated
   * @param {Syntax} s a valid {@link Syntax} as a secondary parameter internally
   * @param {Params} p the params object that contains a valid {@link Params.header header}
   */
  function isHeader(data: RecordExpression, row: number, s: Syntax, p: Params){
    if(row > 1) return false;
    const f = new StringFormat();
    data.left.format(f, s, p);
    // return f.data() === p.header!.join(",").concat(s.eol);
    return f.data() === fh(p.header!, s);
  }
  /**
   * @summary surround `s` with quotes if needed
   * @description Enquotes `s` if it contains escaped (or escapable) character(s) and the {@link Syntax.quotesType quote mode} allows it.
   * @param s the value to be treated with quotes
   * @param {Syntax} sy a valid {@link Syntax} which has a {@link Syntax.separator} and {@link Syntax.eol} string that is neither `null` nor `undefined` 
   * @returns {string} `s` after being analysed and possibly enquoted
   */
  function possiblyEnquote(s: string, sy: Syntax): string {//enquote if needed
    switch (sy.quotesType) {
      default:{
        const regex = RegExp(`(?:${sy.dQuotes}|${sy.separator}|${sy.eol})`);
        if (!regex.test(s)) return s;
        return `${sy.dQuotes}${escape(s, sy)}${sy.dQuotes}`;
      }
      case "none":
      case "n":
        return s;
      case "always":
      case "a":
        return `${sy.dQuotes}${escape(s, sy)}${sy.dQuotes}`;
    }
  }
  /**
   * The expected format in which the parser will parse double quotes (`\u0022`).
   * - `'always'` - All fields are required to be enclosed in quotes. This is a strict form and violation of this syntax will result in a {@link parser.SyntaxError} to be thrown
   * - `'a'` - Shorthand for `'always'`
   * - `'none'` - All fields are required to be without quotes. This is a strict form and violation of this syntax will result in a {@link parser.SyntaxError} to be thrown. This also places the greatest limitation on the input data as field names and values cannot contain the {@link Syntax.separator separator character} and the {@link Syntax.eol line terminator character}.
   * - `'n'` - Shorthand for `'none'`
   * - `undefined` - The parser makes it's own descision on what is escaped, and what is a field based on percieved syntax of the document. This is the most loose option.
   * @enum {"always" | "a" | "none" | "n" | undefined}
   */
  export type QuotesType = "always" | "a" | "none" | "n" | undefined;
  /**
   * @summary Builds {@link Syntax} objects.
   * @description
   * A {@link utility.Builder `Builder`} class that builds {@link Syntax} objects via it's {@link build `build`} method.
   * This is the recommended way to create a `Syntax` object as this class features a number of checks when setting the properties if the `Syntax` object.
   * For example:
   * - users cannot set the {@link Syntax.separator separator}, {@link Syntax.eol eol}, {@link Syntax.nop nested-object-operator}, {@link Syntax.nap nested-array-operator}
   * or {@link Syntax.dQuotes quotes} to the same string, none of them can match or else this class will throw
   * - users cannot set the {@link Syntax.separator separator}, {@link Syntax.eol eol}, {@link Syntax.nop nested-object-operator}, {@link Syntax.nap nested-array-operator}
   * or {@link Syntax.dQuotes quotes} to the a string identified by {@link Syntax.isWhitespace} as a whitespace
   * - {@link Syntax.isWhitespace} cannot be set to a value that will consider {@link Syntax.separator separator}, {@link Syntax.eol eol}, {@link Syntax.nop nested-object-operator},
   * {@link Syntax.nap nested-array-operator} or {@link Syntax.dQuotes quotes} as a whitespace
   * - {@link Syntax.isWhitespace} and {@link Syntax.parse} cannot be set to `null` or `undefined`
   * - The `Syntax` object returned by {@link build `build`} is immutable such that none of it's properties can be changed after it is built
   * 
   * All properties being built have default values, however there are not defaults for the {@link Syntax.getCommand} and without manually calling any of the
   * `setXxxCommand` methods, there will be no {@link Command} to be retrived from the built `Syntax`. \
   * \
   * This class can {@link rebuild assemble} a `Syntax` from the default of a different `Syntax` object, this is useful if a user only wants to change a single property from
   * an already configured `Syntax`, hence mutability of a `Syntax` object is done through this class by using the {@link rebuild} method in combination with
   * the {@link clear} method.
   * 
   */
  export class SyntaxBuilder implements utility.Builder<Syntax> {
    /**the line terminator
     * the default is platform specific
     * @defaultValue platform specific */
    #eol = utility.eol;
    /**the quotesType
     * the default is `undefined`
     * @defaultValue `undefined`*/
    #quotesType: QuotesType = undefined;
    /**the quote for quoted fields
     * the default is `"`
     * @defaultValue `,`*/
    #dQuote = '"';
    /**the separator
     * the default is `,`
     * @defaultValue `,`*/
    #separator = ",";
    /**option that specifies if leading whitespaces are to be deleted from a field
     * the default is `false`
     * @defaultValue `false`*/
    #trimLeadingSpaces = false;
    /**option that specifies if trailing whitespaces are to be deleted from a field
     * the default is `false`
     * @defaultValue `false`*/
    #trimTrailingSpaces = false;
    /**check for row symmetry
     * the default is `true`
     * @defaultValue `true`*/
    #rowSym = true;
    /**
     * Check for a bom in the document to be parsed. The default value is `false`
     * @default {false}
     * @defaultValue `false`
     */
    #bom = false;
    /**
     * Check for a bom in the document to be parsed. The default value in it's `encoding` field is `"utf-8"`
     * @default {"utf-8"}
     * @defaultValue `"utf-8"`
     */
    private _md = {encoding: "utf-8" as parser.Encoding, fileExt: "csv", isStandard: true, mediaType: "text/csv", standard: "Rfc 4180"};
    /**
     * The character that enables the syntax to identify nested object(s).
     * The default value is `.`.
     * @default {`.`}
     * @defaultValue `.`
     */
    #nop?: string = ".";
    /**
     * The character that enables the syntax to identify nested array(s).
     * The default value is `#`.
     * @default {`#`}
     * @defaultValue `#`
     */
    #nap?: string = "#";
    /**the infix array that hold a 2-length tuple of `parser.GType<string>` and `Command`
     * the default is `[]`
     * @defaultValue `[]`*/
    #infCmdlets: [parser.GType<string>, Command][] = [];
    /**the prefix array that hold a 2-length tuple of `parser.GType<string>` and `Command`
     * the default is `[]`
     * @defaultValue `[]`*/
    #preCmdlets: [parser.GType<string>, Command][] = [];
    /**the postfix array that hold a 2-length tuple of `parser.GType<string>` and `Command`
     * the default is `[]`
     * @defaultValue `[]`*/
    #posCmdlets: [parser.GType<string>, Command][] = [];
    /**A function for getting the correct command based on the direction */
    #getCmd = (d: parser.Direction, type: parser.GType<string>): Command | undefined => {
      switch (d) {
        case parser.Direction.PREFIX:
        default: {
          const x = this.#preCmdlets.filter((x) => x[0].equals(type))[0];
          return x ? x[1] : undefined;
        }
        case parser.Direction.INFIX: {
          const x = this.#infCmdlets.filter((x) => x[0].equals(type))[0];
          return x ? x[1] : undefined;
        }
        case parser.Direction.POSTFIX:
          const x = this.#posCmdlets.filter((x) => x[0].equals(type))[0];
          return x ? x[1] : undefined;
      }
    };
    /**Determines white spaces */
    #isWs = (s: string) => {
      if (s === this.#eol) return false;
      return utility.isWhitespace(s);
    };
    /**determines json data type of a cell. default returns the argument */
    #p = (s: string) => s.length > 0 ? s as json.Value : null;
    //May be added in later versions
    // public addValidType(type: parser.GType<string>): SyntaxBuilder {
    //     this.#validTypes.push(type);
    //     return this;
    // }
    #pushOrOverite(map: [parser.GType<string>, Command][], t: parser.GType<string>, cmd: Command){
      for (let i = 0; i < map.length; i++)
        if(map[i][0].equals(t)) {
          map[i] = [t, cmd];
          return;
        }
      map.push([t, cmd]);
    }
    #anyWhitespaces(f: (s: string) => boolean, props: string[]) {
      for (let i = 0; i < props.length; i++) {
        if(f(props[i])) throw new TypeError("A whitespace cannot include a token");
      }
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
     */
    public addInfixCommand(type: parser.GType<string>, cmd: Command): SyntaxBuilder {
      // this.#infCmdlets.push([type, cmd]);
      this.#pushOrOverite(this.#infCmdlets, type, cmd);
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
     */
    public addPrefixCommand(type: parser.GType<string>, cmd: Command): SyntaxBuilder {
      // this.#preCmdlets.push([type, cmd]);
      this.#pushOrOverite(this.#preCmdlets, type, cmd);
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
     */
    public addPostfixCommand(type: parser.GType<string>, cmd: Command): SyntaxBuilder {
      // this.#posCmdlets.push([type, cmd]);
      this.#pushOrOverite(this.#posCmdlets, type, cmd);
      return this;
    }
    /**
     * Sets the {@link Syntax.isWhitespace} determinant.
     * @remark
     * the default is {@link utility.isWhitespace} except {@link Syntax.eol} is not counted as a whitespace
     * @param {function(s: string): boolean} isWhitespace the funtion that determines which string is a white space. An undefined or null value is ignored.
     * @returns {SyntaxBuilder} the same builder object for method chaining
     * @throws {TypeError} if the argument evaluates {@link Syntax.separator separator}, {@link Syntax.eol eol}, {@link Syntax.nop nested-object-operator},
     * {@link Syntax.nap nested-array-operator} or {@link Syntax.dQuotes quotes} as a whitespace
     */
    public setIsWhiteSpace(
      isWhitespace: (s: string) => boolean
    ): SyntaxBuilder {
      if (!utility.isValid(isWhitespace)) return this;
      this.#anyWhitespaces(isWhitespace, [this.#eol, this.#separator, this.#dQuote, this.#nap??"", this.#nop??""]);
      this.#isWs = isWhitespace;
      return this;
    }
    /**
     * Sets the {@link Syntax.parse} function to determine how the user wants to parse a cell value to a json value.
     * @remark
     * the default returns the argument if it has a length greater than 0 else will return `null` if the length is 0 or else throws a `TypeError` for `undefined`
     * and `null` arguments.
     * @param {(text: string) => boolean} parse the funtion that determines the json data type of a given cell when converting a csv document to json.
     * An undefined value sets the parse function to return any argument it's given;
     * @returns {SyntaxBuilder} the same builder object for method chaining
     */
    public setParse(parse: (text: string) => json.Value): SyntaxBuilder {
      this.#p = parse ?? this.#p;
      return this;
    }
    /**
     * Sets the {@link Syntax} to enable parsing of hex and binary literals as numbers
     * @param {boolean} b `true` to allow parsing of binary and hex literals as numbers such as `0b100111`, `0xabba1c` otherwise set to `false`
     * @returns {SyntaxBuilder} the same builder object for method chaining
     */
    //should be used by formatters
    // public allowNonDecimalNum(b: boolean): SyntaxBuilder {
    //     this.#allowNonDecimalNum = b;
    //     return this;
    // }
    /**
     * Sets the {@link Syntax} to enable truncating of fields containing whitespaces to the right (end) of the field
     * @remark
     * the default is `false`
     * @param {boolean} b `true` to allow trimming otherwise set to `false`
     * @returns {SyntaxBuilder} the same builder object for method chaining
     */
    public trimLeadingSpaces(b: boolean): SyntaxBuilder {
      this.#trimLeadingSpaces = b;
      return this;
    }
    /**
     * Sets the {@link Syntax} to enable truncating of fields containing whitespaces to the left (start) of the field
     * @remark
     * the default is `false`
     * @param {boolean} b `true` to allow trimming otherwise set to `false`
     * @returns {SyntaxBuilder} the same builder object for method chaining
     */
    public trimTrailingSpaces(b: boolean): SyntaxBuilder {
      this.#trimTrailingSpaces = b;
      return this;
    }
    /**
     * Sets the {@link Syntax.eol line terminator} of the {@link Syntax} to the argument.
     * Note that providing a custom line terminator also calls for providing a {@link Syntax.isWhitespace whitespace determinant} via {@link setIsWhiteSpace here}
     * or else an unpredictable object may be built.
     * @remark
     * the default is the same value returned by `require("node:os").EOL`
     * @param {string} lt the value to be used as the official line terminator of this syntax
     * @returns {SyntaxBuilder} the same builder object for method chaining
     * @throws {TypeError} if the argument is the same as a {@link Syntax.separator separator}, {@link Syntax.nop nested-object-operator},
     * {@link Syntax.nap nested-array-operator}, {@link Syntax.dQuotes quotes} or a whitespace
     */
    public setEol(lt: string): SyntaxBuilder {
      const props = [this.#separator, this.#dQuote, this.#nap??"", this.#nop??""];
      for (let i = 0; i < props.length; i++) {
        if(props[i] === lt) throw new TypeError("line terminator conflicts with other properties");
      }
      if (this.#isWs(lt))
        throw new TypeError("line terminator cannot be a whitespace");
      this.#eol = lt;
      return this;
    }
    /**
     * Sets the {@link Syntax.separator separator} of the {@link Syntax} to the argument
     * @remark
     * the default is the `','`
     * @param {string} s the value to be used as the official separator of this syntax
     * @returns {SyntaxBuilder} the same builder object for method chaining
     * @throws {TypeError} if the argument is the same as a {@link Syntax.eol line terminator}, {@link Syntax.nop nested-object-operator},
     * {@link Syntax.nap nested-array-operator}, {@link Syntax.dQuotes quotes} or a whitespace
     */
    public setSeparator(s: string): SyntaxBuilder {
      const props = [this.#eol, this.#dQuote, this.#nap??"", this.#nop??""];
      for (let i = 0; i < props.length; i++) {
        if(props[i] === s) throw new TypeError("separator conflicts with other properties");
      }
      if (this.#isWs(s))
        throw new TypeError("separator cannot be a whitespace");
      this.#separator = s;
      return this;
    }
    /**
     * Sets the {@link Syntax.quotesType} of the {@link Syntax} to the argument
     * @remark
     * the default is the `undefined`
     * @param {QuotesType} qt a valid string or `undefined` to denote how quotes will be handled
     * @returns {SyntaxBuilder} the same builder object for method chaining
     */
    public setQuotesType(qt: QuotesType): SyntaxBuilder {
      this.#quotesType = qt;
      return this;
    }
    /**
     * Sets the {@link Syntax.enfSym} property on this builder.
     * @remark
     * the default is the `true`
     * @param {boolean} enfSym `true` to allow for row length checking and `false` if otherwise
     * @returns {SyntaxBuilder} the same builder object for method chaining
     */
    public setEnforceSymmetry(enfSym: boolean): SyntaxBuilder {
      this.#rowSym = enfSym;
      return this;
    }
    /**
     * Sets the {@link Syntax.encoding encoding} property of the syntax to be built
     * @remark
     * the default is the `'utf-8'`
     * @param {parser.Encoding} enc the encoding to be set. This value is not validated, so an invalid valid may cause propblems during formatting and converting
     * @returns {SyntaxBuilder} the same builder object for method chaining
     */
    public setEncoding(enc: parser.Encoding): SyntaxBuilder {
      this._md.encoding = enc??this._md.encoding;
      return this;
    }
    /**
     * Sets the {@link Syntax.bom byte-order-mark} property of the syntax to be built
     * @remark
     * the default is the `false`
     * @param {boolean} bom the bom to be set
     * @returns {SyntaxBuilder} the same builder object for method chaining
     */
    public setBom(bom: boolean): SyntaxBuilder {
      this.#bom = bom;
      return this;
    }
    /**
     * Sets the {@link Syntax.dQuotes string} identified as the "double quote" of the {@link Syntax} to the given argument
     * @remark
     * the default is the `'"'`
     * @param {string} dq a valid string or `undefined` to denote the double quote
     * @returns {SyntaxBuilder} the same builder object for method chaining
     * @throws {TypeError} if the argument is the same as a {@link Syntax.eol line terminator}, {@link Syntax.nop nested-object-operator},
     * {@link Syntax.nap nested-array-operator}, {@link Syntax.separator separator} or a whitespace
     */
    public setDQuotes(dq: string): SyntaxBuilder {
      const props = [this.#eol, this.#separator, this.#nap??"", this.#nop??""];
      for (let i = 0; i < props.length; i++) {
        if(props[i] === dq) throw new TypeError("quotes conflicts with other properties");
      }
      if(this.#isWs(dq))
      throw new TypeError("quotes cannot be a whitespace");
      this.#dQuote = dq;
      return this;
    }
    /**
     * Sets the {@link Syntax.nop character} that enables the {@link Syntax} identify nested object(s) to the given argument.
     * @remark
     * the default is the `'.'`
     * @param {string|undefined} nop a valid single character string or `undefined`
     * @returns {SyntaxBuilder} the same builder object for method chaining
     * @throws {TypeError} if the argument is the same as a {@link Syntax.eol line terminator}, {@link Syntax.dQuotes quotes},
     * {@link Syntax.nap nested-array-operator}, {@link Syntax.separator separator}, a whitespace or if the string length is not equal to 1
     */
    public setNop(nop?: string): SyntaxBuilder {
      if(nop){
        if (nop.length !== 1)
          throw new TypeError("Only a single character is supported here");
          const props = [this.#eol, this.#separator, this.#nap??"", this.#dQuote];
          for (let i = 0; i < props.length; i++) {
            if(props[i] === nop) throw new TypeError("quotes conflicts with other properties");
          }
          if(this.#isWs(nop))
          throw new TypeError("nop cannot be a whitespace");
      }
      this.#nop = nop;
      return this;
    }
    /**
     * Sets the {@link Syntax.nap character} that enables the {@link Syntax} identify nested array(s) to the given argument.
     * @remark
     * the default is the `'#'`
     * @param {string|undefined} nap a valid single character string or `undefined`
     * @returns {SyntaxBuilder} the same builder object for method chaining
     * @throws {TypeError} if the argument is the same as a {@link Syntax.eol line terminator}, {@link Syntax.dQuotes quotes},
     * {@link Syntax.nop nested-object-operator}, {@link Syntax.separator separator}, a whitespace or if the string length is not equal to 1
     */
    public setNap(nap?: string): SyntaxBuilder {
      if(nap){
        if (nap.length !== 1)
          throw new TypeError("Only a single character is supported here");
          const props = [this.#eol, this.#separator, this.#nop??"", this.#dQuote];
          for (let i = 0; i < props.length; i++) {
            if(props[i] === nap) throw new TypeError("quotes conflicts with other properties");
          }
          if(this.#isWs(nap))
          throw new TypeError("nap cannot be a whitespace");
      }
      this.#nap = nap;
      return this;
    }
    /**
     * Sets the {@link Syntax.metadata.fileExt extension string} associated with the syntax as specified by {@link Syntax.metadata.fileExt}
     * @remark
     * The default is `'csv'`.
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
     * The default is `true`.
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
     * The default is `'text/csv'`
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
     * The default is `'Rfc 4180'`
     * @param {string} standard a string representing the standard specification for the data that this syntax will be created for.
     * @returns {SyntaxBuilder} the same builder object for method chaining
     */
    public setStandard(standard: string) : SyntaxBuilder {
      this._md.standard = standard??this._md.standard;
      return this;
    }
    /**
     * @summary Builds a `Syntax` object and returns it given all the options that were set.
     * @description
     * Builds and returns an immutable `Syntax` object.
     * If any values apart from {@link Syntax.quotesType}, {@link Syntax.nap} and {@link Syntax.nop} is set to undefined (This may occur when {@link rebuild}
     * is called just before this method and an invalid `Syntax` object is passed to it), an invalid object will be built and the behaviour of the resulting
     * object will be undefined (unpredictable).
     * @returns {Syntax} an immutable `Syntax` object.
     */
    public build(): Syntax {
      // if (this.#eol === this.#separator)
      //   throw new TypeError("Only unique token type definitions allowed");
      // else if (
      //   this.#eol.startsWith(this.#separator) ||
      //   this.#separator.startsWith(this.#eol)
      // )
      //   throw new TypeError("Only unique token type definitions allowed");
      // else if (this.#isWs(this.#separator) || this.#isWs(this.#eol))
      //   throw new TypeError(
      //     "line terminator or separator cannot be a whitespace"
      //   );
      // if([this.#eol!, this.#separator!].reduce((p, c) => p.indexOf(c) >= 0 ? [...p, c] : p, new Array<string>()).length !== 2) throw new TypeError("Only unique token type definitions allowed");
      return Object.freeze({
        //May be added in later versions
        // validTypes: this.#validTypes,
        //should be used by formatters
        // allowNonDecimalNum: this.#allowNonDecimalNum,
        eol: this.#eol,
        quotesType: this.#quotesType,
        dQuotes: this.#dQuote!,
        separator: this.#separator,
        trimLeadingSpaces: this.#trimLeadingSpaces,
        trimTrailingSpaces: this.#trimTrailingSpaces,
        enfSym: this.#rowSym,
        metadata: this._md,
        bom: this.#bom,
        nop: this.#nop,
        nap: this.#nap,
        isWhitespace: this.#isWs,
        getCommand: this.#getCmd,
        parse: this.#p,
      });
    }
    /**
     * @summary
     * Overwrites every {@link Syntax} property in this builder with the properties of the argument
     * @remark
     * Please note that no check is done when rebuilding from a given syntax (this speeds up the rebuilding process) hence the caller must ensure that the argument is a valid `Syntax` object.
     * @inheritdoc
     */
    public rebuild(from: Syntax): SyntaxBuilder {
      // if (from.eol === from.separator)
      //   throw new TypeError("Only unique token type definitions allowed");
      // else if (
      //   from.eol.startsWith(from.separator) ||
      //   from.separator.startsWith(from.eol)
      // )
      //   throw new TypeError("Only unique token type definitions allowed");
      // else if (from.isWhitespace(from.separator) || from.isWhitespace(from.eol))
      //   throw new TypeError(
      //     "line terminator or separator cannot be a whitespace"
      //   );
      this.#eol = from.eol;
      this.#quotesType = from.quotesType;
      this.#separator = from.separator;
      this.#trimLeadingSpaces = from.trimLeadingSpaces;
      this.#trimTrailingSpaces = from.trimTrailingSpaces;
      this.#getCmd = from.getCommand;
      this.#isWs = from.isWhitespace;
      this.#rowSym = from.enfSym;
      this.#dQuote = from.dQuotes;
      this._md = from.metadata;
      this.#bom = from.bom;
      this.#nop = from.nop;
      this.#nap = from.nap;
      this.#p = from.parse;
      return this;
    }
    /**@inheritdoc */
    public clear(): SyntaxBuilder {
      //May be added in later versions
      // this.#validTypes = [];
      //should be used by formatters
      // this.#allowNonDecimalNum = false;
      this.#eol = utility.eol;
      this.#quotesType = undefined;
      this.#separator = ",";
      this.#trimLeadingSpaces = false;
      this.#trimTrailingSpaces = false;
      this.#rowSym = true;
      this.#infCmdlets = [];
      this.#preCmdlets = [];
      this.#posCmdlets = [];
      this.#dQuote = '"';
      this._md = {encoding: "utf-8" as parser.Encoding, fileExt: "csv", isStandard: true, mediaType: "text/csv", standard: "Rfc 4180"};
      this.#bom = false;
      this.#nop = ".";
      this.#nap = "#";
      this.#p = (s: string) => s.length > 0 ? s as json.Value : null;
      this.#getCmd = (d: parser.Direction, type: parser.GType<string>): Command | undefined => {
        switch (d) {
          case parser.Direction.PREFIX:
          default: {
            const x = this.#preCmdlets.filter((x) => x[0].equals(type))[0];
            return x ? x[1] : undefined;
          }
          case parser.Direction.INFIX: {
            const x = this.#infCmdlets.filter((x) => x[0].equals(type))[0];
            return x ? x[1] : undefined;
          }
          case parser.Direction.POSTFIX:
            const x = this.#posCmdlets.filter((x) => x[0].equals(type))[0];
            return x ? x[1] : undefined;
        }
      };
      this.#isWs = (s: string) => {
        if (s === this.#eol) return false;
        return utility.isWhitespace(s);
      };
      return this;
    }
  }
  /**
   * @summary Defines how a csv document is to be parsed
   * @description An immutable object that carries info about how the csv pipeline process inputs and outputs data. This object can be used to create
   * dsv (**D**ot **S**eparated **V**alues) syntax and tsv (**T**ab **S**eparated **V**alues) as well as setting line terminator string. Parsing can
   * be set to only accept quoted fields or no quotes at all. All these and more can be configured to parse different documents in the csv family. \
   * \
   * Because of the complex nature of the `Syntax` interface (and all it's responsibilities), it is recommended that users instantiate it through the
   * use of the {@link SyntaxBuilder} class, as there are checks that exist in `SyntaxBuilder` that may prevent instantiating an invalid `Syntax`
   * object.
   */
  export interface Syntax extends parser.GSyntax<parser.GType<string>, Command> {
    /**
     * Tells whether the input argument is a whitespace according to this syntax.
     * @param {string} text the value to be tested
     * @returns {boolean} `true` if the arg is a whitespace and `false` if otherwise
     */
    isWhitespace(text: string): boolean;
    /**
     * Formats the given text which is considered to be the field (or cell) value of a given row and column.
     * This used by formatters when converting to json, and aims to delegate 'cell interpretation' to the user.
     * @param {string} field the value of the field that will be formatted
     * @returns {json.Value} returns a json {@link json.Value data type}
     */
    parse(field: string): json.Value;
    /**
     * When `true`, enforces row symmetry on the parser whereby each row must be exactly the same number
     * of fields as the header (or the first row). When `false`, does not enforce row symmetry.
     * @type {boolean}
     * @readonly
     */
    readonly enfSym: boolean; //enforce symmetry
    /**
     * Value used by parsers to decide whether to trim leading spaces within records
     * @type {boolean}
     * @readonly
     */
    readonly trimLeadingSpaces: boolean;
    /**
     * Value used by parsers to decide whether to trim trailing spaces within records
     * @type {boolean}
     * @readonly
     */
    readonly trimTrailingSpaces: boolean;

    /**
     * Determines how the parser will parse quotes `"`.
     * @type {QuotesType}
     * @readonly
     */
    readonly quotesType: QuotesType;

    /**
     * Defines the string used as the de-facto separator. Although this is usually the comma character (`\u002c`), it can be any string and longer strings will impact performance.
     * It is expected that this value be different from the {@link eol end-of-line} string
     * @type {string}
     * @readonly
     */
    readonly separator: string;
    /**
     * Defines the string used as the de-facto line-terminator.
     * @readonly
     * @type {string}
     */
    readonly eol: string;
    /**
     * The string constant representing the value that encloses quoted fields in a csv expression and defines the string identified as the quote.
     * This is also the value that is used to escape quotes.
     * @type {string}
     * @readonly
     */
    readonly dQuotes: string;
    /**
     * Contains the encoding expected in the document. When {@link Syntax.bom} is provided. This value helps to read the bom it properly
     * @inheritdoc
     */
    readonly metadata: parser.Metadata;
    /**
     * Specifies whether the document carries a byte-order-mark
     * @type {boolean}
     */
    readonly bom: boolean;
    /**
     * **N**ested **O**bject o**P**erator. The character that is used (in the header) to identify properties in nested
     * objects in a csv document. For example if the operator is a `.` then:
     * ```csv
     * sibling1,sibling2,sibling3.child1,sibling3.child2.grandchild1,sibling4
     * "row1 column1","row1 column2","row1 column3",,"row1 column5"
     * "row2 column1",row2 column2,"row2 column3",row2 column4,"row2 column5"
     * row3 column1,row3 column2,"",row3 column4,"row3 column5"
     * ```
     * translates to:
     * ```json
     * [{
     *     "sibling1": "row1 column1",
     *     "sibling2": "row1 column2",
     *     "sibling3": {
     *         "child1": "row1 column3",
     *         "child2": null
     *     },
     *     "sibling4": "row1 column5"
     * }, {
     *     "sibling1": "row2 column1",
     *     "sibling2": "row2 column2",
     *     "sibling3": {
     *         "child1": "row2 column3",
     *         "child2": {
     *             "grandchild1": "row2 column4"
     *         }
     *     },
     *     "sibling4": "row2 column5"
     * }, {
     *     "sibling1": "row3 column1",
     *     "sibling2": "row3 column2",
     *     "sibling3": {
     *         "child1": null,
     *         "child2": {
     *             "grandchild1": "row3 column4"
     *         }
     *     },
     *     "sibling4": "row3 column5"
     * }]
     * ```
     * else if the operator is undefined, then this value is not used at all.
     * @type {string} a single character string. Classes and functions in this namespace only support a single chracter as this value.
     * @readonly
    */
    readonly nop?: string;
    /**
     * **N**ested **A**rray o**P**erator. The character that is used (in the header) to identify indexes in nested
     * arrays in a csv document. For example if the operator is a `#` then:
     * ```csv
     * sibling1,sibling2,sibling3#0,sibling3#1#0,sibling4
     * "row1 column1","row1 column2","row1 column3",,"row1 column5"
     * "row2 column1",row2 column2,"row2 column3",row2 column4,"row2 column5"
     * row3 column1,row3 column2,"",row3 column4,"row3 column5"
     * ```
     * translates to:
     * ```json
     * [{
     *     "sibling1": "row1 column1",
     *     "sibling2": "row1 column2",
     *     "sibling3": [ "row1 column3", null ],
     *     "sibling4": "row1 column5"
     * }, {
     *     "sibling1": "row2 column1",
     *     "sibling2": "row2 column2",
     *     "sibling3": [ "row2 column3", [ "row2 column4" ] ],
     *     "sibling4": "row2 column5"
     * }, {
     *     "sibling1": "row3 column1",
     *     "sibling2": "row3 column2",
     *     "sibling3": [ null, [ "row3 column4" ] ],
     *     "sibling4": "row3 column5"
     * }]
     * ```
     * else if the operator is undefined, then this value is not used at all.
     * Only integers are allowed for index specification.
     * @type {string} a single character string. Classes and functions in this namespace only support a single chracter as this value.
     * @readonly
     */
    readonly nap?: string;
  }
  /**
     * @summary An object that holds variables for the parsing process.
     * 
     * @description A mutable visitor object used by the {@linkcode Parser} as a container for variables,
     * 'a notice board' for the {@link Format formatter}. It is used by the formatter as a container object for
     * reading neccessary values that give information about the parsing process. For example,
     * during parsing, the number of fields-per-row is updated in this class by the parser and
     * during formatting that same number is read by the formatter.
   */
  export class Params {
    #header?: string[]; //a list of string naming the headers
    #dih?: boolean; //doc is headerless

    /**
     * The number of fields that have been read by the parser for the current line.
     * @type {number}
     */
    fieldCount: number = 0;

    /**
     * The number of rows that have been read by the parser for the current line.
     * @type {number}
     */
    rowCount: number = 0;

    /**
     * Meant to be set by the lexer to inform the {@link Format} to format the first line as the csv header
     * @param {boolean} b `true` if the first line is not to be formatted as the header or else `false`
     * @set
     * This can only be set once
     */
    public set headerless(b: boolean) {
      if(this.#dih === undefined) this.#dih = b;
    }

    /**
     * A check that informs the {@link Format} that a csv document may or may not require formatting of the first line i.e specifies whether the first line is the header or not.
     * @returns {boolean} `true` if the first line is the header and `false` if otherwise
     */
    public get headerless(): boolean {
      return this.#dih!;
    }

    /**
     * Sets the header value of the document being parsed.
     * @set
     * This can only be set once
     * @param {string[] | undefined} header the val to be assigned to this.
     */
    public set header(header: string[] | undefined) {
      if (!this.#header) this.#header = header;
    }
    /**
     * Any record whose number of fields are more than the length of the argument will cause an error to throw. This value can also be used by formatters
     * where headers will be useful e.g json formatters
     * @get
     * This will return the value that was the argument to `set` the first time `set` was called or will return an
     * empty array if `set` was never called.
     * @returns {string[]| undefined}
     */
    public get header(): string[] | undefined {
      return this.#header;
    }
  }
  /**A concrete {@link parser.GType<string>} that uses string types as ids */
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
    toString() {
      return JSON.stringify(
        { id: this.id, precedence: this.precedence },
        null,
        2
      );
    }
  }
  /**
   * @constant {parser.GType<string>} SEPARATOR the type representing the separator token of this csv document
   * @type {parser.GType<string>}
   * @readonly
   */
  export const SEPARATOR: parser.GType<string> = new Type("1", 2);
  /**
   * @constant {parser.GType<string>} EOL the type representing the line terminator (end-of-line) token of the csv document.
   * It's respective command ({@link ParseRow}) is going to be registered in the syntax object as an infix (not postfix) command and has a lower precedence than other
   * infix commands (such as the {@link ParseSeparator}), hence this token has to have a lower precedence to cause the {@link parser.PrattParser parser} to stop parsing
   * after this token has been parsed.
   * @type {parser.GType<string>}
   * @readonly
   */
  export const EOL: parser.GType<string> = new Type("2", 1);
  /**
   * @constant {parser.GType<string>} FIELD the type representing the field token of this csv document
   * @type {parser.GType<string>}
   * @readonly
   */
  export const FIELD: parser.GType<string> = new Type("3", 2);
  /**
   * @constant {parser.GType<string>} EOF A constant representing an end of file or an end of stream or an end of parsing (for strings)
   * @type {parser.GType<string>}
   * @readonly
   */
  export const EOF: parser.GType<string> = new Type("-1", Number.MIN_SAFE_INTEGER);
  /**
   * @summary a class that represents a string of characters that individually represent a logical portion of a csv document.
   * @description a csv implementation of the {@link parser.Token token interface} meant for conveying data about a sub-text. Although each {@link Token.value value} is unique,
   * there are expected to be 4 types of token namely:
   * - {@link FIELD fields}: these are tokens that can start an expression (depending on the syntax) and end an expression but cannot be subsequent in a record (same line).
   * - {@link SEPARATOR separator}: these are tokens that can be found between 2 fields.
   * - {@link EOL line terminator}: these are tokens that mark a complete record or an end of a line.
   * - {@link EOF end-of-file}: these are tokens that mark a complete document or the end of a file.
   */
  class Token extends Object implements parser.GToken<string> {
    public readonly length;
    /**
     * Constructs a `Token`
     * @param {string} value the intrinsic content of this token
     * @param {Type} type the type of this token
     */
    public constructor(
      public readonly value: string,
      public readonly type: Type,
      public readonly lineStart: number,
      public readonly lineEnd: number,
      public readonly startPos: number
    ) {
      super();
      this.length = value.length;
    }
    equals(obj?: object | undefined): boolean {
      if(obj instanceof Token)
      return (this.lineStart == obj.lineStart && this.lineEnd == obj.lineEnd && this.startPos === obj.startPos
      && this.type.equals(obj.type) && this.value === obj.value);
      return false;
    }
    hashCode32(): number {
      return utility.hashCode32(true, utility.asHashable(this.value), utility.asHashable(this.type.id), utility.asHashable(this.type.precedence), utility.asHashable(this.startPos), utility.asHashable(this.lineEnd), utility.asHashable(this.lineStart));
    }
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
    public override toString() {
      return JSON.stringify(
        { token: this.value, type: this.type.toString() },
        null,
        2
      );
    }
  }
  /**
   * @summary An interface that extends {@link parser.MutableLexer} for convenience and documentation purposes
   * @description
   * An object that creates `Token` objects from a `.csv` data format. It is a specialised implementation of the {@linkcode parser.MutableLexer} interface.
   * It allows new data to be added even after the initial one has been transformed into tokens. This enables the {@linkcode StringLexer} to be plugged
   * into a stream of characters and never fail.
   */
  export interface MutableLexer<CH = string> extends parser.MutableLexer<parser.GToken<string>, Syntax, CH> {
    end(syntax: Syntax, p: Params | any): void;
    process(chunk: CH, syntax: Syntax, p: Params | any): void;
    // processed(): readonly parser.GToken<string>[];
  }
  /**
   * @summary Creates tokens from a json value such as a `string`, `number`, `boolean`, `null`, arrays and objects. 
   * @description A {@linkcode MutableLexer} that processes json in-memory values into tokens that can be extracted
   * via {@linkcode next}. The tokens are ordered in the way the {@linkcode StringLexer} orders its tokens.\
   * \
   * This is the direct opposite of {@link JSFormat `JSFormat`}
   */
  export class JSONLexer implements MutableLexer<json.Value> {
    #queue;
    // #tmpdir;//used for incedibly large json
    #doc: string[][];
    #col;
    #row;
    #h;
    #src!: json.Value;
    constructor() {
      this.#queue = new Array<Token>();
      // this.#tmpdir = join(tmpdir(), randomUUID());
      this.#col = 0;
      this.#row = 0;
      this.#doc = [];
      this.#h = new Array<string>();
    }
    #extractHeaders({
      chunk,
      s,
      doc,
      h,
      row,
      col,
      from,
    }: {
      chunk: json.Value;
      s: Syntax;
      doc: string[][];
      h: string[];
      row: number;
      col: number;
      from?: string;
    }): void {
      if (json.isAtomic(chunk)) {
        // atomic row
        // if (!utility.isValid(row))
        //   return this.#extractHeaders({ chunk, s, doc, h, row: 0, col, from });
        if (!doc[row]) doc[row] = [];
        if (from) {
          if (h.indexOf(from) < 0) {
            h.splice(col, 0, from);
            doc.forEach(r => {
              if(r.length < h.length) r.splice(h.indexOf(from), 0, "");
            });

          }
          doc[row][h.indexOf(from)] = (chunk ?? "").toString();
          // doc[row].splice(h.indexOf(from), 0, (chunk ?? "").toString());
        } else {
          doc[row].push((chunk ?? "").toString());
        }
      } else if (Array.isArray(chunk)) {
        for (let i = 0; i < chunk.length; i++) {
          if (!from &&
            !json.isAtomic(chunk[i]) &&
            typeof chunk[i] === "object") this.#extractHeaders({ chunk: chunk[i], s, doc, h, row: i, col });
            else if (s.nap){
            // console.log({chunk, doc, h, row, col, from});
            this.#extractHeaders({
              chunk: chunk[i],
              s,
              doc,
              h,
              row: from ? row : i,
              col,
              from: `${from ?? ""}${from ? s.nap : ""}${i}`,
            });
          }
          else
            this.#extractHeaders({
              chunk:
                typeof chunk[i] !== "string"
                  ? JSON.stringify(chunk[i])
                  : chunk[i],
              s,
              doc,
              h,
              row: from ? row : i,
              col,
            });
        }
      } else if (typeof chunk === "object") {
        // col ??= 0;//col = (col === undefined || col === null) ? 0 : col
        if (!utility.isValid(col)) col = 0;
        for (const key in chunk) {
          if (s.nop)
            this.#extractHeaders({
              chunk: chunk[key],
              s,
              doc,
              h,
              row,
              col,
              from: `${from ?? ""}${from ? s.nop : ""}${key}`,
            });
          else
            this.#extractHeaders({
              chunk:
                typeof chunk[key] !== "string"
                  ? JSON.stringify(chunk[key])
                  : chunk[key],
              s,
              doc,
              h,
              row,
              col,
              from: key,
            });
          // this.#extractHeaders({chunk: chunk[key], s, doc, h, row, col, from: key});
          col!++;
        }
        col = 0;
      }
    }
    #applyHeaders(
      value: json.Value,
      s: Syntax,
      p: Params,
      tree: string | string[]
    ): void {
      if (typeof tree === "string") {
        /*
         * \u001C is a file separator in ascii
         * \u001D is a group separator in ascii
         * \u001E is a record separator in ascii
         * \u001F is a unit separator in ascii
         */
        // const us = "\u001F";
        // let chars =
        //   s.nop && s.nap
        //     ? `${s.nop}${us}${s.nap}`
        //     : `${s.nop ?? ""}${s.nap ?? ""}`;
        // chars = utility.escSRCh(chars);
        // chars = chars.replace(us, "|");
        // let rstr = RegExp(`(?:${chars})`);
        let store = Array<string>();
        split(tree, s, store);
        return this.#applyHeaders(value, s, p, store);
      } else if (Array.isArray(tree)) {
        if (tree.length === 0) {
          if (json.isAtomic(value)) return this.process(value ?? null, s, p);
          else return this.process(JSON.stringify(value ?? null), s, p);
        }
        let child: string | number = fixFieldName(tree.shift()!, s);
        // if (/^\d\d*\d$/.test(child)) child = Number.parseInt(child);
        value = utility.isValid(value)
          ? value
          : typeof child === "string"
          ? {}
          : [];
        return this.#applyHeaders((value as any)[child], s, p, tree);
      }
      throw new Error("Unrecognised value");
    }
    /**
     * This value is different before and after the initial call of {@link JSONLexer.process `process`}.
     * @inheritdoc
     */
    public get src() {
      return (!json.isAtomic) ? Object.freeze(this.#src) : this.#src;
    }
    end(): void {}
    process(chunk: json.Value, syntax: Syntax, p: Params): void {
      //chunk is a json value (null, boolean, number, string, object or array)
      p.headerless = true;
      if (chunk === null) {
        //null value
        this.#manufacture(
          new Token("", FIELD, this.line(), this.line(), this.position())
        );
        return;
      } else {
        // chunk is a boolean, number, string or object
        switch (typeof chunk) {
          case "boolean":
          case "number":
          case "string": {
            this.#manufacture(
              new Token(
                `${chunk}`,
                FIELD,
                this.line(),
                this.line(),
                this.position()
              )
            );
            return;
          }
          case "object": {
            if (Array.isArray(chunk)) break;
            if (!p.header) {
              this.#extractHeaders({
                chunk,
                s: syntax,
                doc: this.#doc,
                h: this.#h,
                row: 0,
                col: 0,
              });
              p.header = this.#h;
              for (this.#row = 0; this.#row < this.#doc.length; this.#row++) {
                const row = this.#doc[this.#row];
                // if (row.length < this.#h.length)
                //   this.fill(row, "", row.length, this.#h.length - row.length);
                for (this.#col = 0; this.#col < this.#h.length; this.#col++) {
                  this.#manufacture(
                    new Token(
                      row[this.#col] ?? "",
                      FIELD,
                      this.line(),
                      this.line(),
                      this.position()
                    )
                  );
                  if (this.#col < this.#h.length - 1)
                    this.#manufacture(
                      new Token(
                        syntax.separator,
                        SEPARATOR,
                        this.#row,
                        this.#row,
                        this.#col
                      )
                    );
                }
                this.#manufacture(
                  new Token(syntax.eol, EOL, this.#row, this.#row, this.#col)
                );
              }
            } else {
              const l = Object.keys(chunk).length;
              for (this.#row = 0; this.#row < l; this.#row++) {
                for (this.#col = 0; this.#col < p.header.length; this.#col++) {
                  this.#applyHeaders(chunk, syntax, p, p.header[this.#col]);
                  if (this.#col < p.header.length - 1)
                    this.#manufacture(
                      new Token(
                        syntax.separator,
                        SEPARATOR,
                        this.line(),
                        this.line(),
                        this.position()
                      )
                    );
                }
                this.#manufacture(
                  new Token(syntax.eol, EOL, this.#row, this.#row, this.#col)
                );
              }
            }
            return;
          }
          default: // chunk is an array or an object
        }
        if (!p.header) {
          this.#extractHeaders({
            chunk,
            s: syntax,
            doc: this.#doc,
            h: this.#h,
            row: 0,
            col: 0,
          });
          p.header = this.#h;
          for (this.#row = 0; this.#row < this.#doc.length; this.#row++) {
            const row = this.#doc[this.#row];
            // if (row.length < this.#h.length)
            //   this.fill(row, "", row.length, this.#h.length - row.length);
            for (this.#col = 0; this.#col < this.#h.length; this.#col++) {
              this.#manufacture(
                new Token(
                  row[this.#col] ?? "",
                  FIELD,
                  this.line(),
                  this.line(),
                  this.position()
                )
              );
              if (this.#col < this.#h.length - 1)
                this.#manufacture(
                  new Token(
                    syntax.separator,
                    SEPARATOR,
                    this.#row,
                    this.#row,
                    this.#col
                  )
                );
            }
            this.#manufacture(
              new Token(syntax.eol, EOL, this.#row, this.#row, this.#col)
            );
          }
        } else {
          for (
            this.#row = 0;
            this.#row < (chunk as json.List).length;
            this.#row++
          ) {
            for (this.#col = 0; this.#col < p.header.length; this.#col++) {
              this.#applyHeaders(
                chunk[this.#row],
                syntax,
                p,
                p.header[this.#col]
              );
              if (this.#col < p.header.length - 1)
                this.#manufacture(
                  new Token(
                    syntax.separator,
                    SEPARATOR,
                    this.line(),
                    this.line(),
                    this.position()
                  )
                );
            }
            this.#manufacture(
              new Token(
                syntax.eol,
                EOL,
                this.line(),
                this.line(),
                this.position()
              )
            );
          }
        }
      }
      this.#src = chunk;
    }
    #manufacture(token: Token) {
      this.#queue.push(token);
    }
    public indexOf(type: parser.Type) {
      for (let i = 0; i < this.#queue.length; i++) {
        if (this.#queue[i].type.equals(type)) return i;
      }
      return -1;
    }
    public lastIndexOf(type: parser.Type) {
      for (let i = this.#queue.length - 1; i >= 0; i--) {
        if (this.#queue[i].type.equals(type)) return i;
      }
      return -1;
    }
    unprocessed = () => this.src!;
    processed = () => this.#queue!;
    frequency(type: parser.Type): number {
      let frqy = 0;
      for (let i = 0; i < this.#queue.length; i++) {
        if (this.#queue[i].type.equals(type)) frqy++;
      }
      return frqy;
    }
    hasTokens(): boolean {
      return this.#queue.length > 0;
    }
    canProcess(): boolean {
      return !this.hasTokens() && this.#doc.length > 0;
    }
    next(): Token {
      while (true) {
        if (!this.hasTokens()) break;
        return this.#queue!.shift()!;
      }
      return new Token("", EOF, this.line(), this.line(), this.position());
    }
    position(): number {
      return this.#col;
    }
    line(): number {
      return this.#row;
    }
  }
  /**
   * @summary Creates tokens from updatable text recieved.
   * @description A {@linkcode MutableLexer} that processes strings (probably from a file or network) in the `.csv` format
   * into tokens meant to be parsed by a {@linkcode PrattParser}.
   */
  export class StringLexer implements MutableLexer {
    // #lqt?: Token;//last queried token
    #ln: number; //the current line being being read from. This value is reset each time a line terminator is encountered outside of a quoted string.
    #li: number; //the character's position in the line that is being analysed. This value is reset each time a new character is being analysed
    // #token?: string;//the text currently being analysed as a token
    #header?: string[]; //an array of the header columns
    public src: string; //an string characters read from a stream
    #field: string; //the current field value. When this prop's length at least 1, there a field is being read
    #op: string; //the current field value. When this prop's length at least 1, there a field is being read
    #queue: Token[]; //an array of already-made token objects
    constructor() {
      this.#ln = 1;
      this.#li = 0;
      this.#header = [];
      this.src = "";
      this.#field = "";
      this.#op = "";
      this.#queue = [];
    }
    #inQuote(field: string, s: Syntax) {
      // check to specify that the reader is in a quoted string and has not moved out of it
      const regex = RegExp(s.dQuotes + s.dQuotes, "g");
      const stripEscaped = field.replaceAll(regex, "");
      return (
        stripEscaped.startsWith(s.dQuotes) && !stripEscaped.endsWith(s.dQuotes)
      );
    }
    #shiftSrc(distance: number) {
        if(distance > this.src.length) return undefined;
        const rv = this.src.substring(0, distance);
        this.src = this.src.substring(distance);
        return rv;
    }
    #manufacture(token: Token) {
      // this.#queue.push(this.#lqt = token);
      this.#queue.push(token);
    }
    public indexOf(type: parser.Type) {
      for (let i = 0; i < this.#queue.length; i++) {
        if (this.#queue[i].type.equals(type)) return i;
      }
      return -1;
    }
    public lastIndexOf(type: parser.Type) {
      for (let i = this.#queue.length - 1; i >= 0; i--) {
        if (this.#queue[i].type.equals(type)) return i;
      }
      return -1;
    }
    // end(syntax: Syntax, params: unknown): void;
    public end(syntax: Syntax, params: Params): void {
      if(this.canProcess()) this.process("", syntax, params);
      // if(this.lastIndexOf(EOL) !== this.processed().length - 1)
      if(this.#queue[this.#queue.length - 1] && !this.#queue[this.#queue.length - 1].type.equals(EOL))
      this.process(syntax.eol, syntax, params);
    }
    unprocessed = () =>  Object.freeze(this.src!);
    /**
     * Returns an unmodifiable array of {@link parser.GToken<string>} objects
     * @returns {readonly parser.GToken<string>} an unmodifiable array of tokens
     */
    processed: () => parser.GToken<string>[] = () => Object.freeze(this.#queue!) as parser.GToken<string>[];
    frequency(type: parser.Type): number {
      let frqy = 0;
      for (let i = 0; i < this.#queue.length; i++) {
        if (this.#queue[i].type.equals(type)) frqy++;
      }
      return frqy;
    }
    hasTokens(): boolean {
      return this.#queue.length > 0;
    }
    canProcess(): boolean {
      return this.src.length > 0;
    }
    process(chunk: string, syntax: Syntax, params: unknown): void;
    process(chunk: string, syntax: Syntax, params: Params) {
      params.headerless = this.line() < 1 && utility.isValid(params.header);
      this.src += chunk;
      while (this.src.length > 0) {
        const token = this.#shiftSrc(1)!;
        this.#li++;
        if (
          syntax.eol.startsWith(this.#op + token) &&
          !this.#inQuote(this.#field, syntax)
        ) {
          this.#op += token;
          if (this.#op === syntax.eol) {
            this.#manufacture(
              new Token(
                this.#field,
                FIELD,
                this.line(),
                this.line(),
                this.position() - this.#field.length - this.#op.length
              )
            );
            if (!params.header) {
              this.#header!.push(this.#field);
              params.header = this.#header;
              this.#header = undefined;
            }
            this.#field = "";
            this.#manufacture(
              new Token(
                this.#op,
                EOL,
                this.line(),
                this.line(),
                this.position() - this.#op.length
              )
            );
            this.#li = 0;
            this.#ln++;
            this.#op = "";
          }
        } else if (
          syntax.separator.startsWith(this.#op + token) &&
          !this.#inQuote(this.#field, syntax)
        ) {
          this.#op += token;
          if (this.#op === syntax.separator) {
            if (!params.header) this.#header!.push(this.#field);
            this.#manufacture(
              new Token(
                this.#field,
                FIELD,
                this.line(),
                this.line(),
                this.position() - this.#field.length - this.#op.length
              )
            );
            this.#field = "";
            this.#manufacture(
              new Token(
                this.#op,
                SEPARATOR,
                this.line(),
                this.line(),
                this.position() - this.#op.length
              )
            );
            this.#op = "";
          }
        } else {
          this.#field += this.#op + token;
          this.#op = "";
        }
      }
    }
    position(): number {
      return this.#li;
    }
    line(): number {
      return this.#ln;
    }
    next(): Token {
      while (true) {
        if (!this.hasTokens()) break;
        return this.#queue!.shift()!;
      }
      return new Token("", EOF, this.line(), this.line(), this.position());
    }
  }
  /**
   * @summary A specialised mini-parser that is `.csv` syntax-specific.
   * @description An object that can parse {@link parser.GType type(s)} of `.csv` {@link parser.Token tokens} effectively in a way
   * that is specific to the `.csv` data format and produces an expression for the tokens it parsed.
   */
  export interface Command
    extends parser.GCommand<parser.GToken<string>, Expression, Syntax, MutableLexer, Parser> {
    parse(
      ap: Expression,
      yp: Token,
      p: Parser,
      l: MutableLexer,
      s: Syntax,
      pa?: Params
    ): Expression;
  }
  /**
   * A command to parse a field when the parse encounter one creating a {@linkcode FieldExpression} or {@linkcode QuotedExpression} in the process.
   */
  class ParseField implements Command {
    parse(
      ap: Expression,
      yp: Token,
      p: Parser,
      l: MutableLexer,
      s: Syntax,
      pa?: Params
    ): Expression {
      pa!.fieldCount++;
      if (
        s.quotesType !== "none" &&
        s.quotesType !== "n" &&
        isQuoted(yp.value, s.isWhitespace, s)
      ) {
        if (hasIllegalWhitespaces(yp.value, s.isWhitespace))
          throw new parser.SyntaxError(yp);
        let value = yp.value.substring(
          s.dQuotes.length,
          yp.value.length - s.dQuotes.length
        );
        value = s.trimTrailingSpaces
          ? trim(value, s.isWhitespace, true)
          : value;
        value = s.trimLeadingSpaces
          ? trim(value, s.isWhitespace, false)
          : value;
        return new QuotedExpression(
          s.dQuotes,
          new FieldExpression(unescape(value, s)),
          s.dQuotes
        );
      }
      return new FieldExpression(yp.value);
    }
  }
  /**
   * A command to parse a separator when the parser encounters one creating a {@linkcode SeparatorExpression} in the process.
   */
  class ParseSeparator implements Command {
    parse(
      ap: Expression,
      yp: Token,
      p: Parser,
      l: MutableLexer,
      s: Syntax,
      pa?: Params
    ): Expression {
      const precedence = yp.type.precedence;
      return new SeparatorExpression(
        ap,
        yp.value,
        p.parseWithPrecedence(precedence, l, s, pa)
      );
    }
  }
  /**
   * A command to parse an eol token (which completes a row) when the parser encounters one creating a {@linkcode RecordExpression} in the process.
   */
  class ParseRow implements Command {
    static #getString(ap: Expression, s: Syntax, p: Params) {
      const str = new StringFormat();
      ap.format(str, s, p);
      return str.data();
    }
    parse(
      ap: Expression,
      yp: Token,
      p: Parser,
      l: MutableLexer,
      s: Syntax,
      pa?: Params
    ): Expression {
      if (s.enfSym && pa?.fieldCount !== pa?.header?.length) {
        const affectedRow = ParseRow.#getString(ap, s, pa!);
        const msg = `Misaligned row. row must have exactly ${
          pa?.header?.length
        } field(s) but ${pa?.fieldCount} field(s) was found at row ${
          pa!.rowCount
        }, column ${pa!.fieldCount}.${
          s.eol
        }This is the affected data: ${affectedRow}${s.eol}`;
        throw new parser.ParseError(msg);
      }
      pa!.rowCount++;
      pa!.fieldCount = 0;
      return new RecordExpression(ap, yp.value);
    }
  }
  /**
   * @summary A representation of parsed `Token` objects.
   * @description The result after the parser has returned.
   */
  export interface Expression extends expression.GExpression<Format> {
    // format(format: Format, syntax?: Syntax, params?: any): void;
    format(format: Format, syntax?: Syntax, params?: Params | any): void;
  }
  /**
   * A representation of a cell value
   */
  class FieldExpression implements Expression {
    constructor(public readonly data: string) {}
    format(f: Format, s?: Syntax, p?: Params): void {
      f.append(this.data, s, p);
    }
    debug(): string {
      return this.data;
    }
    compareTo(obj?: expression.Expression | undefined): utility.Compare {
      return utility.compare(this.hashCode32(), obj?.hashCode32());
    }
    equals(obj?: object | undefined): boolean {
      if (obj instanceof FieldExpression) return this.data === obj.data;
      return false;
    }
    hashCode32(): number {
      //true because this is a terminal expr
      return utility.hashCode32(true, utility.asHashable(this.data));
    }
    toString(): string {
      return this.debug();
    }
  }
  /**
   * A representation of a cell value that is quoted
   */
  class QuotedExpression implements Expression {
    public constructor(
      public readonly open: string,
      public readonly content: FieldExpression,
      public readonly close: string
    ) {}
    format(f: Format, s?: Syntax, p?: Params): void {
      f.append(this, s, p);
      // f.append(this.open, p, s);
      // this.content.format(f, p, s);
      // f.append(this.close, p, s);
    }
    debug(): string {
      return this.open + this.content.debug() + this.close;
    }
    equals(obj?: object | undefined): boolean {
      if (obj instanceof QuotedExpression) return this.open === obj.open && this.content.equals(obj.content) && this.close === obj.close;
      return false;
    }
    hashCode32(): number {
      return utility.hashCode32(
        false,
        utility.asHashable(this.open),
        this.content,
        utility.asHashable(this.close)
      );
    }
    toString(): string {
      return this.debug();
    }
  }
  /**
   * A representation of a value within a row with it's left-adjacent sibling (cell values) which may also be a `SepararactorExpression`.
   */
  class SeparatorExpression implements Expression {
    constructor(
      public readonly pre: Expression,
      public readonly sep: string,
      public readonly post: Expression
    ) {}
    format(f: Format, s?: Syntax, p?: Params): void {
      f.append(this, s, p);
      // this.pre.format(f, p, s);
      // f.append(this.sep, p, s);
      // this.post.format(f, p, s);
    }
    debug(): string {
      return this.pre.debug() + this.sep + this.post.debug();
    }
    equals(obj?: object | undefined): boolean {
      if (obj instanceof SeparatorExpression)
        return this.pre.equals(obj.pre) && this.sep === obj.sep && this.post.equals(obj.post);
      return false;
    }
    hashCode32(): number {
      return utility.hashCode32(
        false,
        this.pre,
        utility.asHashable(this.sep),
        this.post
      );
    }
    toString(): string {
      return this.debug();
    }
  }
  /**
   * A representation of a row.
   */
  class RecordExpression implements Expression {
    constructor(
      public readonly left: Expression,
      public readonly eol: string
    ) {}
    format(f: Format, s?: Syntax, p?: Params): void {
      f.append(this, s, p);
      //     this.left.format(f, p, s);
      //     f.append(this.eol, p, s);
    }
    debug(): string {
      return this.left.debug().concat(this.eol);
    }
    equals(obj?: object | undefined): boolean {
      if (obj instanceof RecordExpression) return this.left.equals(obj.left) && this.eol === obj.eol;
      return false;
    }
    hashCode32(): number {
      return utility.hashCode32(false, this.left, utility.asHashable(this.eol));
    }
    toString(): string {
      return this.debug();
    }
  }
  /**
   * @summary Convenience class to allow for proper return values using `parse` and for namepsace documentation
   * @description The `.csv` variant of the {@link parser.PrattParser Vaughn Pratt's parser}
   */
  export class Parser extends parser.PrattParser<Expression, Syntax> {}
  /**
   * @summary The type of value accepted by the {@linkcode Format.append} method.
   * @description The value that will be sent to (and expected by) {@linkcode Format} objects
   */
  export type Appendage =
    | string
    | Expression;
    /**
     * @summary A base `.csv` format
     * @description Defines how the {@link Expression parsed expression(s)} is/are outputted.
     */
  export interface Format<T = any> extends expression.GFormat<Expression, T> {
    append(data: Appendage, s?: Syntax, p?: Params): void;
    get rows(): number;
    get columns(): number;
  }
  /**
   * @summary The {@linkcode Expression} output as a string.
   * @description
   * A csv format as a generic string, good for quick formatting and testing purposes */
  export class StringFormat implements Format<string> {
    #row = 0;
    #col = 0;
    #value;
    public constructor(initialValue?: string) {
      this.#value = initialValue || "";
      this.modifications = 0;
      this.bpc = 8;
      this.bpn = 32;
    }
    get rows() {
      return this.#row;
    }
    get columns() {
      return this.#col;
    }
    append(
      data: Appendage,
      s?: Syntax | undefined,
      p?: Params | undefined
    ): void {
      if(p?.headerless && this.#row <= 0){
        this.#value += fh(p!.header!, s!);
        this.#row++;
      }
      if (typeof data === "string") {
        this.#value += possiblyEnquote(data, s!);
        this.#col++;
        this.modifications++;
      } else if (data instanceof QuotedExpression) {
        this.#value += data.open;
        data.content.format(this, s, p);
        this.#value += data.close;
        this.modifications += 2;
      } else if (data instanceof SeparatorExpression) {
        data.pre.format(this, s, p);
        this.#value += data.sep;
        data.post.format(this, s, p);
        this.modifications++;
      } else if (data instanceof RecordExpression) {
        // if(this.#row < 1 && !p?.headerless) return;
        data.left.format(this, s, p);
        this.#value += data.eol;
        this.#row++;
        this.#col = 0;
        this.modifications++;
      }
    }
    data(): string {
      return this.#value;
    }
    reverse(): expression.GFormat<Expression, string> {
      return new StringFormat(this.#value.split("").reverse().join(""));
    }
    equals(another: expression.GFormat<Expression, string>): boolean {
      if (another instanceof StringFormat) return this.#value === another.#value;
      return false;
    }
    modifications: number;
    public readonly bpc: number;
    public readonly bpn: number;
    hashCode32(): number {
      return utility.hashCode32(
        false,
        utility.asHashable(this.#value),
        utility.asHashable(this.#row),
        utility.asHashable(this.#col),
        utility.asHashable(this.modifications),
        utility.asHashable(this.bpc),
        utility.asHashable(this.bpn)
      );
    }
    toJSON(): string {
      return JSON.stringify(
        {
          row: this.#row,
          col: this.#col,
          value: this.#value,
          modifications: this.modifications,
          bpc: this.bpc,
          bpn: this.bpn,
        },
        null,
        2
      );
    }
  }
  /**
   * @summary An in-memory representation of an {@link Expression} in json format.
   * 
   * @description A class that builds an an array objects (dictionaries) whereby the property names
   * correspond to full/partial header values of the csv document and the property values correspond
   * to either partial header values or to a cell value in a csv document.\
   * \
   * The in-memory json is built by repeatedly calling {@link JSFormat.append}, however, `append`
   * shoud never be called in isolation by a user, it is automatically called by {@link Expression} objects
   * when {@link Expression.format their own `format()`} method is called. Each call of `append` formats
   * a single row, hence to format an entire csv document, it will be called for each row. The resulting data
   * can then be retrieved using the method {@link JSFormat.data}.
   * 
   * @remark
   * The {@link Syntax.bom byte-order-mark} is not taken into account in this format. \
   * \
   * The order of the header value (for nested properties) is important and may cause values to
   * be overwritten if not properly placed. The general rule place the most nested values at the
   * begining of the header array and the least nested ones at the end of the header array. Nesting
   * can be done using the {@link Syntax.nop nested-object-operator} (for nested properties) and/or
   * {@link Syntax.nap nested-array-operator} (for nested array indexes/indices).
   * 
   * @privateRemark
   * In later versions it will support arbitrary json values (such as objects with 1m+
   * properties or arrays with 5m elements). This will be achieved by storing the data as a file and querying it using
   * the anticipated properties.
   */
  export class JSFormat implements Format<json.List> {
    /**
     * A json list of rows extracted from the {@link Expression} objects. This list represents the whole csv document, and each item in the list
     * is a of type {@link json.Pair} and it represents a row in the csv document. Each property name in the `Pair` object is a header value and
     * every property value is a cell in the csv document.
     * @type {json.List}
     * @private
     */
    #value: json.List;
    /**
     * A highly mutative object which will be mutated each time `append` is called, and when `append` returns, this value will be pushed into
     * `JSFormat.#value` and then this value will be reset to `{}`
     * @type {json.Pair}
     * @private
     */
    #o: json.Pair;
    /**
     * The number of column(s) that have been processed by this object in a given row
     * @type {number}
     * @private
     */
    #col: number;
    /**
     * The number of row(s) that have been processed by this object in a given document
     * @type {number}
     * @private
     */
    #row: number;
    /**
     * Creates a `JSFormat` object. This constructor should be regarded as parameterless as the parameter option is reserved for
     * internal state regulation i.e the appropriate argument for the parameter can only be provided by another method of this
     * object. Any attempt to manually provide the argument will cause this object to behave in an indefinite way.
     * @param {any} value an object which is used to initialise `JSFormat.#value`. This value is not required to be provided,
     * infact, providing this value may cause indefinite behaviour of this object. The default value is an empty array.
     */
    constructor(value: any = []) {
      this.#value = value;
      this.#col = 0;
      this.#row = 0;
      this.#o = {};
    }
    /**
     * @summary Applies column value and assign it
     * @description Searches through the `parent` parameter using the provided `col` parameter (which is expected to be a `string`)
     * and then assigns `v` to a value that is a child property of `parent`
     * @param {string} v the value -- which is assumed to be a csv cell value -- to be assigned to a member of `parent`
     * @param {Syntax} s the syntax which should contain an appropriate {@link Syntax.nap array operator} and/or {@link Syntax.nop object operator}
     * @param {json.List | json.Pair} parent the object that will be search, which is expected to contain an index (or property) specified by `col`
     * @param {string | string[]} col the current header value which is taken as the column name used for searching the provided `parent` object
     * @private
     */
    #av(
      v: string,
      s: Syntax,
      parent: json.List | json.Pair,
      col: string | string[]
    ): void {
      if (typeof col === "string") {
        let store = Array<string>();
        split(col, s, store);
        // console.log({/*parent, */col, store, v});
        return this.#av(v, s, parent, store);
      } else if (Array.isArray(col)) {
        let n = fixFieldName(col.shift()!, s);
        // console.log({parent, col, n, v});
        if(col.length > 0) {
          if(col[0][0] === s.nop && (parent as any)[n] === undefined){
            (parent as any)[n] = {};
          } else if(col[0][0] === s.nap && (parent as any)[n] === undefined){
            (parent as any)[n] = [];
          }
          return this.#av(v, s, (parent as any)[n], col);
        } else {
          //prevent overwrite
          if(!(parent as any)[n]) (parent as any)[n] = s.parse(v);
          return;
        }
      }
    }
    /**
     * @summary Appends `data` to the this object as an in-memory json.
     * @description Appends the given `data` to the internal document using the `header` from the provided {@link Params} object, the
     * {@link Syntax.nap array operator} and {@link Syntax.nop object operator} both from the given {@link Syntax} object to
     * properly build an in-memory json object from csv expressions.
     * @param {Appendage} data the value to be appended.
     * @param {Params} p a valid {@link Params} object. This is a required parameter, despite being marked as optional.
     * @param {Syntax} s a {@link Syntax} object which has it's array and object operator properly configured.
     * @throws {expression.FormatError} if the value is not defined as one of the {@link Appendage} value.
     */
    append(data: Appendage, s?: Syntax, p?: Params): void {
      //TODO remember to tackle null fields
      if (typeof data === "string") {
        this.#av(data, s!, this.#o, p!.header![this.#col]);
        this.#col++;
        this.modifications++;
      } else if (data instanceof QuotedExpression) {
        data.content.format(this, s, p);
        this.modifications++;
      } else if (data instanceof SeparatorExpression) {
        data.pre.format(this, s, p);
        // this.#value[this.#row][p!.header![this.#col]] += data.sep;
        data.post.format(this, s, p);
        // this.modifications++;
      } else if (data instanceof RecordExpression) {
        if(this.#row < 1 && !p?.headerless){
          this.#row++;
          return;
        }
        data.left.format(this, s, p);
        this.#value.push(this.#o);
        this.#row++;
        this.#col = 0;
        this.modifications++;
        this.#o = {};
      } else
        throw new expression.FormatError("unknown format for csv expression");
    }
    /**
     * The number of columns that have been formatted
     * @returns {number}
     */
    get columns(): number {
      return this.#col;
    }
    /**
     * The number of rows that have been formatted
     * @returns {number}
     */
    get rows(): number {
      return this.#row;
    }
    /**
     * Returns this object with all rows contained therein in reverse order
     * @returns {JSFormat} this with the rows in reverse order
     */
    reverse(): JSFormat {
      return new JSFormat(this.#value.reverse());
    }
    equals(another: expression.GFormat<Expression, json.List>): boolean {
      if(another instanceof JSFormat)
      return this.#value === another.#value;
      return false;
    }
    /**
     * @summary Returns the csv document that has been formatted as an in-memory json
     * 
     * @description Gets a json list of rows formatted from {@link Expression} objects. This list represents the whole csv document, and each item in the list
     * is a of type {@link json.Pair} and it represents a row in the csv document. Each property name in the `Pair` object is a header value and
     * every property value is a cell in the csv document.
     * 
     * @returns {json.List} an array of objects representing the csv document that was formatted.
     * @see {@link expression.Format.data} for details about this method
     */
    data(): json.List {
      return this.#value;
    }
    modifications: number = 0;
    readonly bpc: number = 8;
    readonly bpn: number = 32;
    hashCode32(): number {
      return utility.hashCode32(
        false,
        utility.asHashable(this.modifications),
        utility.asHashable(this.bpc),
        utility.asHashable(this.bpn),
        utility.asHashable(this.#col),
        utility.asHashable(this.#row),
        utility.asHashable(this.#value)
      );
    }
    toJSON(): string {
      return JSON.stringify(this, null, 2);
    }
  }
  /**
   * @summary The {@linkcode Expression} output written to a file system.
   * @description Writes the parsed `.ini` data to a file system whenevr {@linkcode append} is called.
   */
  export class FileFormat implements Format<fs.ReadStream> {
    /**
     * Constructs this `FileFormat` object
     * @param {string} [filename=] the name of the file that the internal {@link fs.WriteStream `fs.WriteStream`} will save the data to.
     * The default is `file.csv` in the current directory
     */
    constructor(filename: string) {
      this.bpc = 8; //8 bits per character
      this.bpn = 32; //32 bits floating point
      this.#fs = filename;
    }
    #writeBOM(ws: fs.WriteStream, s: Syntax) {
      switch (s.metadata.encoding) {
        case "utf8":
        case "utf-8":
          ws.write(Buffer.of(239, 187, 191));
          return;
        case "utf16":
        case "utf-16":
          ws.write(Buffer.of(0xFE, 0xFF));
          return;
        case "utf16le":
        case "utf-16le":
          ws.write(Buffer.of(0xFF, 0xFE));
          return;
        case "utf32":
        case "utf-32":
          ws.write(Buffer.of(0x0, 0x0, 0xFE, 0xFF));
          return;
        case "utf32le":
        case "utf-32le":
          ws.write(Buffer.of(0xFF, 0xFE, 0x0, 0x0));
          return;
        case "utf7":
        case "utf-7":
          ws.write(Buffer.of(0x2B, 0x2F, 0x76));
          return;
        case "utf1":
        case "utf-1":
          ws.write(Buffer.of(0xF7, 0x64, 0x4C));
          return;
        case "utfebcdic":
        case "utf-ebcdic":
          ws.write(Buffer.of(0xDD, 0x73, 0x66, 0x73));
          return;
        case "scsu":
          ws.write(Buffer.of(0x0E, 0xFE, 0xFF));
          return;
        case "bocu1":
        case "bocu-1":
          ws.write(Buffer.of(0xFB, 0xEE, 0x28));
          return;
        case "gb18030":
          ws.write(Buffer.of(0x84, 0x31, 0x95, 0x33));
          return;
      
        default:
          return;
      }
    }
    public endWrite() {
      this.#ws!.end();
      this.#ws!.close();
    }
    /**@todo Remember to write the bom */
    append(data: Appendage, s?: Syntax, p?: Params): void {
      if (!utility.isValid(this.#ws)) {
        this.#enc = s?.metadata.encoding;
        this.#ws = fs.createWriteStream(this.#fs, this.#enc as BufferEncoding);
        if(!this.#bw && s!.bom) {
          this.#writeBOM(this.#ws, s!);
          this.#bw = true;
        }
        if(p?.headerless && this.#row <= 0){
          this.#ws.write(fh(p!.header!, s!));
          this.#row++;
        }
      }
      if (typeof data === "string") {
        this.#ws!.write(possiblyEnquote(data, s!));
        this.#col++;
        this.modifications++;
      } else if (data instanceof QuotedExpression) {
        this.#ws!.write(data.open);
        data.content.format(this, s, p);
        this.#ws!.write(data.close);
        this.modifications += 2;
      } else if (data instanceof SeparatorExpression) {
        data.pre.format(this, s, p);
        this.#ws!.write(data.sep);
        data.post.format(this, s, p);
        this.modifications++;
      } else if (data instanceof RecordExpression) {
        data.left.format(this, s, p);
        this.#ws!.write(data.eol);
        this.#row++;
        this.#col = 0;
        this.modifications++;
      }
    }
    get rows() {
      return this.#row;
    }
    get columns() {
      return this.#col;
    }
    reverse(): this {
      return this;
    }
    equals(another: expression.GFormat<Expression, fs.ReadStream>): boolean {
      if(another instanceof FileFormat)
      return this.#ws!.path === another.#ws!.path;
      return false;
    }
    /**
     * @summary Gets all the data in this `Format` from a stream
     * @description
     * Creates a {@link fs.ReadStream} with the same path as was provided in the constructor and the same encoding that was used to save the data. If no data has been written
     * i.e if {@link append} has not been called then no data associated with this format will be found in this stream.
     * @remark
     * It is the duty of the caller to properly close all resources associated with the returned stream and also note that the `autoClose` property of the
     * {@link fs.createReadStream} `options` parameter is set to `true` in the stream.
     * @returns {fs.ReadStream} the path where this format is written to as a stream.
     */
    data(): fs.ReadStream {
      return fs.createReadStream(this.#fs, {
        autoClose: true,
        encoding: (this.#enc??"utf-8") as string as BufferEncoding,
      });
    }
    public modifications: number = 0;
    bpc: number;
    bpn: number;
    #fs; //file system
    #ws?: fs.WriteStream; //write stream
    #enc?: parser.Encoding;
    #row = 0;
    #col = 0;
    #bw = false;//bom written
    hashCode32(): number {
      return utility.hashCode32(
        false,
        utility.asHashable(this.modifications),
        utility.asHashable(this.bpc),
        utility.asHashable(this.bpn),
        utility.asHashable(this.#fs),
        utility.asHashable(this.#ws)
      );
    }
    toJSON(): string {
      return "";
    }
  }
  /**
   * @summary The `.csv` port of the converter class.
   */
  export class Converter extends parser.Converter<
    parser.GToken<string>,
    Expression,
    Syntax,
    Parser,
    Params,
    MutableLexer,
    any
  > {
    _transform(
      chunk: any,
      encoding: BufferEncoding,
      callback: TransformCallback
    ): void {
      if (!this.writableObjectMode) {
        chunk = Buffer.isBuffer(chunk)
          ? iconv.decode(chunk as Buffer, this.syntax.metadata.encoding)
          : String(chunk);
      }
      try {
        this.lexer.process(chunk, this.syntax, this.params);
      } catch (e) {
        return callback(e as Error);
      }
      if (this.lexer.hasTokens()) {
        while (this.lexer.indexOf(EOL) >= 0)
          try {
            const exp = this.parser.parse(this.lexer, this.syntax, this.params);
            this.push(exp);
          } catch (e) {
            // console.table(this.lexer.processed())
            return callback(e as Error);
          }
        return callback();
      }
    }
    _flush(callback: TransformCallback): void {
      // if (this.lexer.canProcess())
      //   try {
      //     this.lexer.process("", this.syntax, this.params);
      //   } catch (e) {
      //     return callback(e as Error);
      //   }
      // if (this.lexer.lastIndexOf(EOL) !== this.lexer.processed().length - 1) {
        // this.lexer.end(this.syntax, this.params);
      // }
      this.lexer.end(this.syntax, this.params);
      if (this.lexer.hasTokens()) {
        //only one line remains, so no need for a loop like in _flush
        try {
          const exp = this.parser.parse(this.lexer, this.syntax, this.params);
          return callback(null, exp);
        } catch (e) {
          return callback(e as Error);
        }
      }
    }
  }
  /**
   * A {@link Syntax `Syntax`} that embodies the Rfc 4180 specification found [here](https://www.rfc-editor.org/rfc/rfc4180). \
   * \
   * The following are the configuration of this object:
   * - A field may be quoted (enclosed in double quotes) or unquoted, however, if the field contains special characters such as {@link Syntax.eol line terminators}, {@link Syntax.separator separators}, and {@link Syntax.dQuotes quotes} then it must be quoted otherwise the parser becomes unpredictable.
   * - The {@link Syntax.eol line terminator} is the same as the default of the current operating system.
   * - The {@link Syntax.separator field separator} (delimiter) is the comma character `,`.
   * - The {@link Syntax.dQuotes quote} is the double quotes character `"`.
   * - The {@link Syntax.nop} is the period character `"."`
   * - The {@link Syntax.nap} is the number sign `"#"`
   * - Whitespaces include those found at {@link utility.whitespaces} excluding the {@link Syntax.eol line terminator}.
   * - All special characters such as {@link Syntax.eol}, {@link Syntax.separator}, quotes etc can be part of a string via quoted fields and quotes-escapes respectively.
   * - All white spaces are considered part of the field, except those that are outside quotes where quotes are explicitly present as such an error is thrown.
   * - All trailing and leading whitespaces are unclipped and are sent raw down the parsing pipeline.
   * - Double quotes may be part of a field by putting them inside a quoted field (as stated above) and escaping them with a double quote just before they appear.
   * - A new line may begin with a quoted or non-quoted field, which may be followed by a separator and/or a line terminator or nothing.
   * - All lines are ended when an unquoted line terminator is encountered
   * - When a document is ended, this is no need for a line terminator to end the line
   * - All quoted fields must be enclosed in quotes and quotes that are part of the field must be escaped by placing a quote before it i.e 2 double quotes `""` escapes one quote. There is no need to escape single quotes.
   * - Null fields (fields that contain no character) are supported. Having a separator before a line break will parse a null field before the line break.
   * - Row symmetry is enforced such that all rows must have the same number of fields as the first row (header) in the csv document.
   */
  export const RFC_4180 = new SyntaxBuilder()
    .addPrefixCommand(FIELD, new ParseField())
    // .addPrefixCommand(QUOTE, new QuotedCommand())
    .addInfixCommand(SEPARATOR, new ParseSeparator())
    .addInfixCommand(EOL, new ParseRow())
    // .addPostfixCommand(EOL, new ParseRow())
    .build();
  // export const dsv = new SyntaxBuilder().build();
  // export const tsv = new SyntaxBuilder().build();
}

export default csv;
