import { Type } from "../token/Type";
import { Command } from "./Command";
import Direction from "./Parser";
import { Syntax } from "./Syntax";
import utility from "../../utility";

export type GSyntax<T extends Type, C extends Command> = Syntax & {
  (direction: Direction, type: T): C | undefined;
  params<
    P extends {
      /**
       * A {@link utility.Messenger logger} used by parsers to log info, errors and warnings during parsing. Note that the `isSealed` property will return `false` for this object when the parsing is yet to be completed and `true` when it is. Hence no logging may take place after the parsing is done.
       * @type {utility.Messenger}
       * @readonly
       */
      readonly logger?: utility.Messenger;
    }
  >(): P;
};
