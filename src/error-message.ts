export enum ErrorType {
  Never,
  Missing,
  Mismatch
}

export const ErrorPathSymbol = Symbol();
export const ErrorValueSymbol = Symbol();
export const ErrorTypeSymbol = Symbol();
export const ErrorExptectedTypeSymbol = Symbol();

export type ErrorSymbol =
  | typeof ErrorPathSymbol
  | typeof ErrorValueSymbol
  | typeof ErrorTypeSymbol
  | typeof ErrorExptectedTypeSymbol;

export type ErrorMessage = (string | ErrorSymbol)[];

export const message = (
  strings: TemplateStringsArray,
  ...args: ErrorSymbol[]
): ErrorMessage => {
  return strings.reduce<ErrorMessage>(
    (acc, item, index) =>
      args[index] ? [...acc, item, args[index]] : [...acc, item],
    []
  );
};
