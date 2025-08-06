import { Expression } from "./Expression";
import {Format} from "./Format"

export type GFormat<E extends Expression, D> = Format & {
  (
    data:
      | string
      | number
      | bigint
      | boolean
      | E
      | (string | number | bigint | boolean | E | undefined | null)[]
      | undefined
      | null
  ): void;
  data(prev: D): D;
};
