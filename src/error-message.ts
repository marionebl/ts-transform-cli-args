import ts from "typescript";

export enum ErrorType {
  Never,
  Missing,
  TypeMismatch,
  Length,
  Range,
  LiteralMismatch
}

export const symbols = {
  path: Symbol(),
  actualValue: Symbol(),
  actualType: Symbol(),
  actualLength: Symbol(),
  expectedType: Symbol(),
  expectedLength: Symbol(),
  expectedValue: Symbol(),
  expectedMinLength: Symbol(),
  expectedMaxLength: Symbol()
};

export type ErrorSymbol =
  | typeof symbols.path
  | typeof symbols.actualValue
  | typeof symbols.actualType
  | typeof symbols.actualLength
  | typeof symbols.expectedType
  | typeof symbols.expectedLength
  | typeof symbols.expectedMinLength
  | typeof symbols.expectedMaxLength
  | typeof symbols.expectedValue;

export type ErrorMessage = (string | symbol)[];

export const message = (
  strings: TemplateStringsArray,
  ...args: symbol[]
): ErrorMessage => {
  return strings.reduce<ErrorMessage>(
    (acc, item, index) =>
      args[index] ? [...acc, item, args[index]] : [...acc, item],
    []
  );
};

function expressionFromSymbol(symbol: ErrorSymbol): ts.Expression {
  switch (symbol) {
    case symbols.path: 
      return ts.createCall(
        ts.createPropertyAccess(
          ts.createIdentifier("path"),
          ts.createIdentifier("join")
        ),
        undefined,
        [ts.createStringLiteral("")]
      );
    case symbols.actualType:
      return ts.createTypeOf(ts.createIdentifier("object"));
    case symbols.actualValue:
      return ts.createCall(
        ts.createPropertyAccess(
          ts.createIdentifier("JSON"),
          ts.createIdentifier("stringify")
        ),
        undefined,
        [ts.createIdentifier("object")]
      );
    case symbols.actualLength:
      return ts.createPropertyAccess(ts.createIdentifier("object"), "length")
    case symbols.expectedType:
      return ts.createIdentifier("expectedType");
    case symbols.expectedLength:
      return ts.createIdentifier("expectedLength");
    case symbols.expectedMinLength:
      return ts.createIdentifier("expectedMinLength");
    case symbols.expectedMaxLength:
      return ts.createIdentifier("expectedMaxLength");
    case symbols.expectedValue:
      return ts.createCall(
        ts.createPropertyAccess(
          ts.createIdentifier("JSON"),
          ts.createIdentifier("stringify")
        ),
        undefined,
        [ts.createIdentifier("expectedValue")]
      );
    default:
      throw new Error(`unknown symbol`);
  }
}

export function templateFromError(
  segments: ErrorMessage
): ts.TemplateExpression {
  const headCandidate = segments[0];
  const isStringHead = typeof headCandidate === "string";
  const head = ts.createTemplateHead(
    typeof headCandidate === "string" ? headCandidate : ""
  );
  const items = segments.slice(isStringHead ? 1 : 0);

  const spans = items
    .map((exp, index) => {
      if (typeof exp == "string") {
        return;
      }

      const text = (items[index + 1] || "") as string;

      const span =
        segments.lastIndexOf(text) === segments.length - 1
          ? ts.createTemplateTail(text)
          : ts.createTemplateMiddle(text);
      return ts.createTemplateSpan(expressionFromSymbol(exp), span);
    })
    .filter(item => typeof item !== "undefined");

  return ts.createTemplateExpression(
    (head as unknown) as ts.TemplateHead,
    spans as ts.TemplateSpan[]
  );
}
