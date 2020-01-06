import ts from "typescript";
import { ErrorType, ErrorMessage } from "../error-message";

interface Options {
  shortCircuit: boolean;
  ignoreClasses: boolean;
  ignoreMethods: boolean;
  disallowSuperfluousObjectProperties: boolean;
}

export interface VisitorContext extends PartialVisitorContext {
  functionNames: Set<string>;
  functionMap: Map<string, ts.FunctionDeclaration>;
}

interface Coercion {
  array: (string | { key: string, boolean?: boolean, number?: boolean, string?: boolean })[];
  tuple: { key: string; members: { key: number, type: "boolean" | "string" | "number" | undefined}[] }[];
  length: { name: string; length: number; }[];
  boolean: string[];
  string: string[];
  number: string[];
}

export interface PartialVisitorContext {
  program: ts.Program;
  checker: ts.TypeChecker;
  options: Options;
  typeMapperStack: Map<ts.Type, ts.Type>[];
  previousTypeReference: ts.Type | null;
  coercion: Coercion;
  path: string[];
  createErrorMessage(data: { type: ErrorType }): ErrorMessage;
}
