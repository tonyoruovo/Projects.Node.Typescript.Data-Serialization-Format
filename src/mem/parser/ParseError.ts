import utility from "../../utility";
import DataError,{ DataErrorConstructor, DataError as DataErrorType } from "../DataError";

export type ParseError<C extends unknown = any> = DataErrorType<C> & {
  line?: number;
  pos?: number;
};
export type ParseErrorConstructor = {
  new <C extends unknown = any>(
    line?: number,
    pos?: number,
    cause?: C
  ): ParseError<C>;
  <C extends unknown = any>(
    line?: number,
    pos?: number,
    cause?: C
  ): ParseError<C>;
  prototype: DataErrorConstructor['prototype'] & ParseError & {constructor: ParseErrorConstructor};
};

function ConcreteParseError(this: ParseError, line?: number, pos?: number, cause?: unknown) {
    if(new.target) {
        DataError.call(this, `ParseError at ${this.line || 0}:${this.pos || 0}`, cause)
        Error.captureStackTrace(this, this.constructor)
        Object.defineProperties(this, {
            name: utility.readonlyPropDescriptor("ParseError"),
            line: utility.readonlyPropDescriptor(line),
            pos: utility.readonlyPropDescriptor(pos),
        })
    } else return new ParseError(line, pos, cause);
}
ConcreteParseError.prototype = Object.create(DataError.prototype);
ConcreteParseError.prototype.constructor = ConcreteParseError;

const ParseError = ConcreteParseError as ParseErrorConstructor;
export default ParseError;
