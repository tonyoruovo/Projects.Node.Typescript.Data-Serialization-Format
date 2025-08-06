import utility from "../../utility";
import DataError, { DataErrorConstructor, DataError as DataErrorType } from "../DataError";

export type FormatError<C extends unknown = any> = DataErrorType<C>;
export type FormatErrorConstructor = DataErrorConstructor & {
  new <C extends unknown = any>(msg?: string, cause?: C): FormatError<C>;
  <C extends unknown = any>(msg?: string, cause?: C): FormatError<C>;
  prototype: DataErrorConstructor['prototype'] & FormatError & { constructor: FormatErrorConstructor; };
};
function ConcreteFormatError(this: FormatError, msg?: string, cause?: unknown) {
  if(new.target) {
    DataError.call(this, msg || '', cause)
    Error.captureStackTrace(this, ConcreteFormatError);
    Object.defineProperties(this, {
        name: utility.readonlyPropDescriptor('FormatError')
    })
  }
  else return new FormatError(msg, cause);
}
ConcreteFormatError.prototype = Object.create(Object.prototype);
ConcreteFormatError.prototype.constructor = ConcreteFormatError;

const FormatError = ConcreteFormatError as FormatErrorConstructor;
export default FormatError;
