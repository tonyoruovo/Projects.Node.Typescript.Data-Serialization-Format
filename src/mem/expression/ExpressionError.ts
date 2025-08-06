import utility from "../../utility";
import DataError, { DataError as DataErrorType, DataErrorConstructor } from "../DataError";

/**
 * Generic expression error that may be thrown after the parsing is completed without error(s) when the user attempt to perform an illegal operation
 * in the expression (such as using `null`/`undefined`).
 */
export type ExpressionError<C extends unknown = any> = DataErrorType<C>;
export type ExpressionErrorConstructor = {
  new <C extends unknown = any>(msg?: string, cause?: C): ExpressionError<C>;
  <C extends unknown = any>(msg?: string, cause?: C): ExpressionError<C>;
  prototype: DataErrorConstructor['prototype'] & ExpressionError & { constructor: ExpressionErrorConstructor; };
};

function ConcreteExpressionError(this: ExpressionError, msg?: string, cause?: unknown) {
  if(new.target) {
    DataError.call(this, msg || '', cause)
    Error.captureStackTrace(this, ConcreteExpressionError);
    Object.defineProperties(this, {
        name: utility.readonlyPropDescriptor('ExpressionError')
    })
  }
  else return new ExpressionError(msg, cause);
}
ConcreteExpressionError.prototype = Object.create(Object.prototype);
ConcreteExpressionError.prototype.constructor = ConcreteExpressionError;

const ExpressionError = ConcreteExpressionError as ExpressionErrorConstructor;
export default ExpressionError;
