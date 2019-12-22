import * as ts from "typescript";
import * as JSON5 from "json5";
import { createArrowFunction } from "./is/transform-node";

export interface TransformerOptions {
  env: { [key: string]: string };
}

export const getTransformer = (program: ts.Program) => {
  const typeChecker = program.getTypeChecker();

  function getVisitor(ctx: ts.TransformationContext, sf: ts.SourceFile) {
    const visitor: ts.Visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
      if (ts.isCallExpression(node)) {
        if (
          typeof node.typeArguments === "undefined" ||
          node.typeArguments.length === 0
        ) {
          return node;
        }

        const signature = typeChecker.getResolvedSignature(node);

        if (signature !== undefined && signature.declaration !== undefined) {
          const sourceName = signature.declaration.getSourceFile().fileName;

          if (!sourceName.includes("ts-transform-cli-args")) {
            return ts.visitEachChild(node, visitor, ctx);
          }

          const typeArgument = node.typeArguments[0];

          const type = typeChecker.getTypeFromTypeNode(typeArgument);
          const argNode = node.arguments[0];
          const options = argNode ? getOptions(argNode) : {};

          return ts.createArrowFunction(
            undefined,
            undefined,
            [ts.createParameter(undefined, undefined, undefined, "input")],
            undefined,
            undefined,
            ts.createBlock(
              [
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
                        "validate",
                        undefined,
                        createArrowFunction(type, false, {
                          program,
                          checker: typeChecker,
                          options: {
                            shortCircuit: false,
                            ignoreClasses: true,
                            ignoreMethods: true,
                            disallowSuperfluousObjectProperties: true
                          },
                          typeMapperStack: [],
                          previousTypeReference: null
                        })
                      ),
                      ts.createVariableDeclaration(
                        "flags",
                        undefined,
                        ts.createCall(ts.createIdentifier("parse"), undefined, [
                          ts.createIdentifier("input")
                        ])
                      ),
                      ts.createVariableDeclaration(
                        "validationError",
                        undefined,
                        ts.createCall(
                          ts.createIdentifier("validate"),
                          undefined,
                          [ts.createIdentifier("flags")]
                        )
                      )
                    ],
                    ts.NodeFlags.Const
                  )
                ),
                ts.createReturn(
                  ts.createConditional(
                    ts.createStrictEquality(
                      ts.createTypeOf(ts.createIdentifier("validationError")),
                      ts.createStringLiteral("string"),
                    ),
                    ts.createNew(ts.createIdentifier("Error"), undefined, [ts.createIdentifier("validationError")]),
                    ts.createIdentifier("flags")
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
