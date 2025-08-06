import utility from "../../utility";
import ParseError, { ParseErrorConstructor, ParseError as ParseErrorType } from "./ParseError";

export type SyntaxError = ParseErrorType & {
    readonly line: number,
    readonly pos: number
};
export type SyntaxErrorConstructor = {
    new <C extends unknown = any>(line: number, pos: number, cause?: C): ParseErrorType<C>;
    <C extends unknown = any>(line: number, pos: number, cause?: C): ParseErrorType<C>;
    prototype: ParseErrorConstructor['prototype'] & SyntaxError & {constructor: SyntaxErrorConstructor};
};
export function instanceOfSyntaxError(o: any) {
    return !utility.isInvalid(o) && (o instanceof SyntaxError)
}

function ConcreteSyntaxError(this: ParseErrorType, line: number, pos: number, cause: unknown) {
    if(new.target) {
        ParseError.call(this, line, pos, cause)
        Error.captureStackTrace(this, this.constructor)
        Object.defineProperties(this, {
            name: utility.readonlyPropDescriptor("ParseError"),
        })
    } else return new SyntaxError(line, pos, cause);
}
ConcreteSyntaxError.prototype = Object.create(ParseError.prototype);
ConcreteSyntaxError.prototype.constructor = ConcreteSyntaxError;

const SyntaxError = ConcreteSyntaxError as ParseErrorConstructor;
export default SyntaxError;
