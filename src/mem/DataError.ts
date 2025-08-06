import utility from "../utility";

/**
 * @summary Custom error type for handling data-related errors in serialization/deserialization operations
 * @description
 * A specialized error type that extends the native Error class to provide enhanced error handling
 * capabilities for data processing operations. It includes support for:
 * - Cause tracking with generic type support
 * - Detailed stack trace concatenation
 * - Error chaining
 * 
 * @example
 * // Basic usage
 * throw new DataError("Failed to parse JSON");
 * 
 * @example
 * // With cause tracking
 * try {
 *   JSON.parse(invalidJson);
 * } catch (e) {
 *   throw new DataError("JSON parsing failed", e);
 * }
 * 
 * @example
 * // In a data processing pipeline
 * function processDataFile(path: string) {
 *   try {
 *     // Some processing logic
 *     if (error) {
 *       throw new DataError(
 *         `Failed to process file: ${path}`, 
 *         { code: 'FILE_PROCESS_ERROR', details: error }
 *       );
 *     }
 *   } catch (e) {
 *     throw new DataError("Data pipeline failed", e);
 *   }
 * }
 * 
 * @template C - The type of the cause object (defaults to any)
 */
export type DataError<C extends unknown = any> = Error & {
    name: string,
    message: string;
    cause?: C;
    stack?: string;
};

/**
 * @summary Constructor type for DataError
 * @description
 * Defines the constructor signature for creating new DataError instances.
 * Supports both constructor and function call patterns.
 * 
 * @template C - The type of the cause object (defaults to any)
 */
export type DataErrorConstructor<C extends unknown = any> = {
    new (msg: string, cause?: C): DataError<C>;
    (msg: string, cause?: C): DataError<C>;
    prototype: (typeof Error.prototype) & DataError<C>;
}

export function instanceOfDataError(o?: any): o is DataError {
    return !utility.isInvalid(o) && o instanceof DataError;
}

/**
 * @summary Internal implementation of DataError
 * @description
 * Concrete implementation of the DataError type that handles both constructor
 * and function call patterns. It properly sets up the error object with:
 * - Prototype chain
 * - Error name
 * - Message
 * - Cause tracking
 * - Stack trace concatenation
 * 
 * @template C - The type of the cause object (defaults to any)
 * @param {string} msg - The error message
 * @param {C} [cause] - Optional cause of the error
 * @returns {DataError<C>} A new DataError instance
 * @private
 */
function ConcreteDataError<C = any>(this: DataError<C>, msg: string, cause?: C) {
    if(new.target){
        Error.call(this, this.message, {cause})
        Error.captureStackTrace(this, this.constructor)
        this.name = "DataError"
    } else return new DataError(msg, cause);
}
ConcreteDataError.prototype = Object.create(Error.prototype)
ConcreteDataError.prototype.constructor = ConcreteDataError

/**
 * @summary Factory for creating DataError instances
 * @description
 * Exports the ConcreteDataError implementation as a constructor function.
 * This maintains proper typing while allowing both `new DataError()` and
 * `DataError()` calling patterns.
 */
const DataError = ConcreteDataError as DataErrorConstructor

export default DataError