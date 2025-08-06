import utility from "../../utility"

/**
 * Provided by a {@link Format formatter} to create specialized formats with the intention of increasing the readbility of the format.
 */
export type Prettyfier = {
  /**
   * The value that represents the whitespace character `\t`.
   * @type {string}
   * @readonly
   */
  readonly tab: string;
  /**
   * The value that represents the whitespace character `\x20`.
   * @type {string}
   * @readonly
   */
  readonly space: string;
  /**
   * The value that represents the whitespace character `\n` (`\r\n` in DOS).
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
   * A {@link utility.Messenger logger} used by formats to log info, errors and warnings during formatting. Note that the `isSealed` property will return `false` for this object when the formatting is yet to be completed and `true` when it is. Hence no logging may take place after the formatting is done.
   * @type {utility.Messenger}
   * @readonly
   */
  readonly logger?: utility.Messenger;

  /**
   * Parses the argument into a result and appends the result
   * to this object. This is a mutator.
   * @param {string|number|bigint|boolean|object|(string|number|bigint|boolean|object|undefined|null)[]|undefined|null} data the data in a compatible format
   * as this.
   * @returns {void}
   */
  (
    data:
      | string
      | number
      | bigint
      | boolean
      | object
      | (string | number | bigint | boolean | object | undefined | null)[]
      | undefined
      | null
  ): void;

  data(prev: any): any;
};
