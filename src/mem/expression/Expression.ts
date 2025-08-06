import utility from "../../utility";
import { Syntax } from "../parser/Syntax";
import { Format } from "./Format";

export type Expression = utility.Predicatable &
  utility.Hashable & {
    (format: Format, syntax?: Syntax): void;
    /**
     * The value in-memory. Used by formatters and serializers.
     */
    (syntax?: Syntax): any;
    /**
     * for debugging
     * @throws {ExpressionError} if there is any issue encountered
     */
    (previous: string): string;
    (e: Expression): any; //decompose to primitive value such as boolean, null, undefined, object, number, string or array
  };
export type ExpressionConstructor = {
  translate(e: Expression): Expression; //static function, calls e() to retrieve the primitive value of e and then parses that primitive value into an expression it can understand
};
