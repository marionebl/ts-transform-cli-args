export interface Positional {
  _: string[];
}

type WithPositional<T> = { [P in keyof T]?: T[P] } & Positional;

export const fromType = <T>(_: string[]): T extends Positional ? T | Error : WithPositional<T> | Error => {
  throw new Error("CliArgs.fromType called but should be removed via transformation.");
}