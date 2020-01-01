import { FromType } from "./types";

export const fromType: FromType = (_) => {
  throw new Error("CliArgs.fromType called but should be removed via transformation.");
}
