import ts from "typescript";
import JSON5 from "json5";
import { createArrowFunction } from "./is/transform-node";
import {
  ErrorType,
  ErrorMessage,
  message,
  symbols
} from "./error-message";

export interface TransformerOptions {
  env: { [key: string]: string };
}

export const getTransformer = (program: ts.Program) => {
  const typeChecker = program.getTypeChecker();
  const host = ts.createCompilerHost(program.getCompilerOptions());

  function getVisitor(ctx: ts.TransformationContext, sf: ts.SourceFile) {
    const visitor: ts.Visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
      if (ts.isCallExpression(node)) {
        const signature = typeChecker.getResolvedSignature(node);
        const declaration = signature ? signature.getDeclaration() : undefined;

        if (signature !== undefined && declaration !== undefined) {
          const sourceName = declaration.getSourceFile().fileName;

          if (!sourceName.includes("ts-transform-cli-args")) {
            return ts.visitEachChild(node, visitor, ctx);
          }

          const [namedTypeArgument, positionalTypeArgument] =
            node.typeArguments || [];

          const check = typeChecker as any;

          const namedType = namedTypeArgument
            ? typeChecker.getTypeFromTypeNode(namedTypeArgument)
            : check.createAnonymousType(
                undefined,
                (ts as any).createSymbolTable(),
                (ts as any).emptyArray,
                (ts as any).emptyArray,
                undefined,
                undefined
              );

          const positionalType = positionalTypeArgument
            ? typeChecker.getTypeFromTypeNode(positionalTypeArgument)
            : check.createArrayType(check.getNeverType());

          const argNode = node.arguments[0];
          const options = argNode ? getOptions(argNode) : {};

          function createNamedErrorMessage(data: {
            type: ErrorType;
          }): ErrorMessage {
            switch (data.type) {
              case ErrorType.Never:
                return message`--${symbols.path} should never be specified. Received ${symbols.actualValue}`;
              case ErrorType.Missing:
                return message`--${symbols.path} is required but missing`;
              case ErrorType.Mismatch:
                return message`--${symbols.path} must be of type ${symbols.expectedType}. Received ${symbols.actualValue} of type ${symbols.actualType}`;
              case ErrorType.Length:
                return message`--${symbols.path} must be array of length ${symbols.expectedLength}. Received ${symbols.actualValue} of length ${symbols.actualLength}`;
              case ErrorType.Range:
                return message`--${symbols.path} must be array with a length from ${symbols.expectedMinLength} to ${symbols.expectedMaxLength}. Received ${symbols.actualValue} of length ${symbols.actualLength}`
            }
          }

          function createPositionalErrorMessage(data: {
            type: ErrorType;
          }): ErrorMessage {
            switch (data.type) {
              case ErrorType.Never:
                return message`argument at ${symbols.path} should never be specified. Received ${symbols.actualValue}`;
              case ErrorType.Missing:
                return message`argument at ${symbols.path} is required but missing`;
              case ErrorType.Mismatch:
                return message`argument at ${symbols.path} must be of type ${symbols.expectedType}. Received ${symbols.actualValue} of type ${symbols.actualType}`;
              case ErrorType.Length:
                return message`requires exactly ${symbols.expectedLength} arguments. Received ${symbols.actualValue} of length ${symbols.actualLength}`;
              case ErrorType.Range:
                return message`requires ${symbols.expectedMinLength} to ${symbols.expectedMaxLength} arguments. Received ${symbols.actualValue} of length ${symbols.actualLength}`
            }
          }

          return ts.createArrowFunction(
            undefined,
            undefined,
            [ts.createParameter(undefined, undefined, undefined, "input")],
            undefined,
            undefined,
            ts.createBlock(
              [
                // messageFn,
                ts.createVariableStatement(
                  undefined,
                  ts.createVariableDeclarationList(
                    [
                      ts.createVariableDeclaration(
                        "parse",
                        undefined,
                        ts.createCall(
                          ts.createIdentifier("require"),
                          undefined,
                          [ts.createStringLiteral("yargs-parser")]
                        )
                      ),
                      ts.createVariableDeclaration(
                        "validateNamed",
                        undefined,
                        createArrowFunction(namedType, false, {
                          program,
                          checker: typeChecker,
                          options: {
                            shortCircuit: false,
                            ignoreClasses: true,
                            ignoreMethods: true,
                            disallowSuperfluousObjectProperties: true
                          },
                          typeMapperStack: [],
                          previousTypeReference: null,
                          createErrorMessage: createNamedErrorMessage
                        })
                      ),
                      ts.createVariableDeclaration(
                        "validatePositional",
                        undefined,
                        createArrowFunction(positionalType, false, {
                          program,
                          checker: typeChecker,
                          options: {
                            shortCircuit: false,
                            ignoreClasses: true,
                            ignoreMethods: true,
                            disallowSuperfluousObjectProperties: true
                          },
                          typeMapperStack: [],
                          previousTypeReference: null,
                          createErrorMessage: createPositionalErrorMessage
                        })
                      ),
                      ts.createVariableDeclaration(
                        "rawFlags",
                        undefined,
                        ts.createCall(ts.createIdentifier("parse"), undefined, [
                          ts.createIdentifier("input")
                        ])
                      ),
                      ts.createVariableDeclaration(
                        "flags",
                        undefined,
                        ts.createObjectLiteral([
                          ts.createSpreadAssignment(
                            ts.createIdentifier("rawFlags")
                          )
                        ])
                      ),
                      ts.createVariableDeclaration(
                        "positional",
                        undefined,
                        ts.createPropertyAccess(
                          ts.createIdentifier("rawFlags"),
                          ts.createIdentifier("_")
                        )
                      )
                    ],
                    ts.NodeFlags.Const
                  )
                ),
                ts.createStatement(
                  ts.createDelete(
                    ts.createPropertyAccess(
                      ts.createIdentifier("flags"),
                      ts.createIdentifier("_")
                    )
                  )
                ),
                ts.createVariableStatement(
                  undefined,
                  ts.createVariableDeclarationList(
                    [
                      ts.createVariableDeclaration(
                        "namedValidationError",
                        undefined,
                        ts.createCall(
                          ts.createIdentifier("validateNamed"),
                          undefined,
                          [ts.createIdentifier("flags")]
                        )
                      ),
                      ts.createVariableDeclaration(
                        "positionalValidationError",
                        undefined,
                        ts.createCall(
                          ts.createIdentifier("validatePositional"),
                          undefined,
                          [ts.createIdentifier("positional")]
                        )
                      )
                    ],
                    ts.NodeFlags.Const
                  )
                ),
                ts.createReturn(
                  ts.createConditional(
                    ts.createLogicalOr(
                      ts.createStrictEquality(
                        ts.createTypeOf(
                          ts.createIdentifier("namedValidationError")
                        ),
                        ts.createStringLiteral("string")
                      ),
                      ts.createStrictEquality(
                        ts.createTypeOf(
                          ts.createIdentifier("positionalValidationError")
                        ),
                        ts.createStringLiteral("string")
                      )
                    ),
                    ts.createArrayLiteral([
                      ts.createNew(ts.createIdentifier("Error"), undefined, [
                        ts.createCall(
                          ts.createPropertyAccess(
                            ts.createCall(
                              ts.createPropertyAccess(
                                ts.createArrayLiteral([
                                  ts.createIdentifier("namedValidationError"),
                                  ts.createIdentifier(
                                    "positionalValidationError"
                                  )
                                ]),
                                ts.createIdentifier("filter")
                              ),
                              undefined,
                              [ts.createIdentifier("Boolean")]
                            ),
                            ts.createIdentifier("join")
                          ),
                          undefined,
                          [ts.createStringLiteral("\n")]
                        )
                      ]),
                      ts.createArrayLiteral([
                        ts.createIdentifier("flags"),
                        ts.createIdentifier("positional")
                      ])
                    ]),
                    ts.createArrayLiteral([
                      ts.createIdentifier("null"),
                      ts.createArrayLiteral([
                        ts.createIdentifier("flags"),
                        ts.createIdentifier("positional")
                      ])
                    ])
                  )
                )
              ],
              true
            )
          );

          return;
        }
      }

      if (ts.isImportDeclaration(node)) {
        const rawSpec = node.moduleSpecifier.getText();
        const spec = rawSpec.substring(1, rawSpec.length - 1);

        if (spec === "ts-transform-cli-args") {
          return;
        }
      }

      return ts.visitEachChild(node, visitor, ctx);
    };

    return visitor;
  }

  return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => (
    sf: ts.SourceFile
  ) => ts.visitNode(sf, getVisitor(ctx, sf));
};

function getOptions(node: ts.Node): unknown {
  try {
    return JSON5.parse(node.getText());
  } catch (err) {
    return;
  }
}
