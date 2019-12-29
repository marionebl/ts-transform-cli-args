
export type FromType = <Named = {}, Positional extends Array<unknown> = never[]>(_: string[]) => [Error, [Named, Positional]]