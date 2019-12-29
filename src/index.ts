import { FromType } from "./types";

const fromType: FromType = (_) => {
  throw new Error("CliArgs.fromType called but should be removed via transformation.");
}