import util from "../utility.js";
/**
 * contains interfaces that may be mapped/represented as
 * partial or full expressions in a syntax
 */
var expression;
(function (expression) {
    const isValid = util.isValid;
    /**
     * Thrown when an error is detected in the {@link Expression}
     * interface
     */
    class ExpressionError extends TypeError {
        /**
         * Constructor the `ExpressionError` class
         * @param {string} msg a string detailing the reason for the error
         * @param {Error | undefined} cause this is the initial error that caused this
         * error to be trown
         */
        constructor(msg = "", cause) {
            super(msg + "\r\n" + cause?.stack);
        }
        equals(obj) {
            let exprErr = obj;
            return isValid(exprErr) && exprErr.message === this.message;
        }
    }
    expression.ExpressionError = ExpressionError;
    /**
     * Thrown by the implementors of the {@link Format} interface
     * to indicate an error in the format or in one of the methods.
     */
    class FormatError extends TypeError {
        /**
         * Constructor the `FormatError` class
         * @param {string} msg a string detailing the reason for the error
         * @param {Error|undefined} cause this is the initial error that caused this
         * error to be trown
         */
        constructor(msg = "", cause) {
            super(msg + "\r\n" + cause?.stack);
        }
        equals(obj) {
            let forErr = obj;
            return isValid(forErr) && forErr.message === this.message;
        }
    }
    expression.FormatError = FormatError;
})(expression || (expression = {}));
export default expression;
