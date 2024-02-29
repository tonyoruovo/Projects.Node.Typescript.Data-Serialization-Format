import utility from "../utility.js";

/**
 * @summary in-**mem**ory
 * @description A module for reading, translating/converting and serializing in-memory data. All data read from the file are retained in memory,
 * This is the fastest method for converting between data/binary formats. However (unless one has infinite memory) it is not suited for large
 * data. If the size of a file is more than 80% of free memory, then the device will freeze.
 * @namespace mem
 */
namespace mem {
    export type DataError<C extends unknown = unknown> = Error & {
        name: string,
        message: string;
        cause?: C;
        stack?: string;
    };
    export namespace token {
        /**
         * Caused by providing an illegal/unrecognised token to the tokenizer/lexer
         */
        export type TokenError = DataError & {
            /**
             * The token that caused the error
             * @type {Token}
             */
            token: Token;
        };
        export type Type = utility.Predicatable & {
            readonly id: any;
            readonly precedence: number;
        };
        export type GType<T> = Type & {
            readonly id: T;
        };
        export type Token = {
            // readonly 
        }
    }
    export namespace parser {}
    export namespace expression {}
}
export default mem;