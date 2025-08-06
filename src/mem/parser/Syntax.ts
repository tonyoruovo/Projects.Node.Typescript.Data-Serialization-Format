import Direction from "./Parser";
import {Type} from "../token/Type";
import {Command} from "./Command"
import {Metadata} from "./Metadata"
import utility from "../../utility"

export type Syntax = {
  (direction: Direction, type: Type): Command | undefined;
  params(): {
    /**
     * A {@link utility.Messenger logger} used by parsers to log info, errors and warnings during parsing. Note that the `isSealed` property will return `false` for this object when the parsing is yet to be completed and `true` when it is. Hence no logging may take place after the parsing is done.
     * @type {utility.Messenger}
     * @readonly
     */
    readonly logger?: utility.Messenger;
  };
  metadata?: Metadata;
};
