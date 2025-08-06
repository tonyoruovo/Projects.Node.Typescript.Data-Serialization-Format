import { Encoding } from "./Parser";

/**
 * Represents data info of a given source or syntax
 */
export type Metadata = {
  /**
   * The expected encoding in the document to be parsed
   * @type {Encoding}
   * @readonly
   */
  readonly encoding: Encoding;
  /**
   * The file extension of the data, if it has one. This should not have any trailing dot(s)
   * @type {string}
   * @readonly
   */
  readonly fileExt: string;
  /**
   * The MIME type of the data parsed with this syntax.
   * @type {string}
   * @readonly
   */
  readonly mediaType: string;
  /**
   * Checks if the data parsed by this syntax is part of a web standard. Return `true` if it is and `false` otherwise.
   * @type {string}
   * @readonly
   */
  readonly isStandard: boolean;
  /**
   * A url to a resource such as an rfc webpage or a schema
   * @type {string}
   * @readonly
   */
  readonly standard: string;
};
