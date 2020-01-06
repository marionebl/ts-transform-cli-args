export interface Aliases<Named> {
  [alias: string]: keyof Named;
}

export type FromType = <
  Named = {},
  Positional extends Array<unknown> = never[],
  _Aliases extends Aliases<Named> = {}
>(
  _: string[]
) => [Error, [Readonly<Named>, Readonly<Positional>]];
