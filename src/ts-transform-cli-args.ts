import ts from "typescript";
import JSON5 from "json5";
import { createArrowFunction } from "./is/transform-node";
import { ErrorType, ErrorMessage, message, symbols } from "./error-message";
import { Coercion } from "./is/visitor-context";

export interface TransformerOptions {
  env: { [key: string]: string };
}

export const getTransformer = (program: ts.Program) => {
  const typeChecker = program.getTypeChecker();

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

          const namedType: ts.Type = namedTypeArgument
            ? typeChecker.getTypeFromTypeNode(namedTypeArgument)
            : // HACK: internal API :'(
              check.createAnonymousType(
                undefined,
                (ts as any).createSymbolTable(),
                (ts as any).emptyArray,
                (ts as any).emptyArray,
                undefined,
                undefined
              );

          const positionalType: ts.Type = positionalTypeArgument
            ? typeChecker.getTypeFromTypeNode(positionalTypeArgument)
            : check.createArrayType(check.getNeverType());

          const argNode = node.arguments[0];
          const options = argNode ? getOptions(argNode) : {};

          const namedCoercion: Coercion = {
            array: [],
            tuple: [],
            length: [],
            boolean: [],
            string: [],
            number: []
          };

          const positionalCoercion: Coercion = {
            array: [],
            tuple: [],
            length: [],
            boolean: [],
            string: [],
            number: []
          };

          const validateNamed = createArrowFunction(namedType, false, {
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
            path: [],
            createErrorMessage: createNamedErrorMessage,
            coercion: namedCoercion
          });

          const validatePositional = createArrowFunction(
            positionalType,
            false,
            {
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
              path: [],
              createErrorMessage: createPositionalErrorMessage,
              coercion: positionalCoercion
            }
          );

          const posCo = positionalCoercion.array[0];
          const posType =
            typeof posCo === "object"
              ? posCo.boolean
                ? "boolean"
                : posCo.number
                ? "number"
                : posCo.string
                ? "string"
                : undefined
              : undefined;

          const posTupleCoercion = positionalCoercion.tuple[0];

          function createNamedErrorMessage(data: {
            type: ErrorType;
          }): ErrorMessage {
            switch (data.type) {
              case ErrorType.Never:
                return message`--${symbols.path} should never be specified. Received ${symbols.actualValue}`;
              case ErrorType.Missing:
                return message`--${symbols.path} is required but missing`;
              case ErrorType.TypeMismatch:
                return message`--${symbols.path} must be of type ${symbols.expectedType}. Received ${symbols.actualValue} of type ${symbols.actualType}`;
              case ErrorType.Length:
                return message`--${symbols.path} must be array of length ${symbols.expectedLength}. Received ${symbols.actualValue} of length ${symbols.actualLength}`;
              case ErrorType.Range:
                return message`--${symbols.path} must be array with a length from ${symbols.expectedMinLength} to ${symbols.expectedMaxLength}. Received ${symbols.actualValue} of length ${symbols.actualLength}`;
              case ErrorType.LiteralMismatch:
                return message`--${symbols.path} must be ${symbols.expectedValue}, received ${symbols.actualValue}`;
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
              case ErrorType.TypeMismatch:
                return message`argument at ${symbols.path} must be of type ${symbols.expectedType}. Received ${symbols.actualValue} of type ${symbols.actualType}`;
              case ErrorType.Length:
                return message`requires exactly ${symbols.expectedLength} arguments. Received ${symbols.actualValue} of length ${symbols.actualLength}`;
              case ErrorType.Range:
                return message`requires ${symbols.expectedMinLength} to ${symbols.expectedMaxLength} arguments. Received ${symbols.actualValue} of length ${symbols.actualLength}`;
              case ErrorType.LiteralMismatch:
                return message`argument at ${symbols.path} must be ${symbols.expectedValue}, received ${symbols.actualValue}`;
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
                        "coerceString",
                        undefined,
                        ts.createArrowFunction(
                          undefined,
                          undefined,
                          [
                            ts.createParameter(
                              undefined,
                              undefined,
                              undefined,
                              "item"
                            )
                          ],
                          undefined,
                          undefined,
                          ts.createBlock([
                            ts.createIf(
                              ts.createStrictEquality(
                                ts.createTypeOf(ts.createIdentifier("item")),
                                ts.createLiteral("undefined")
                              ),
                              ts.createBlock([
                                ts.createReturn(
                                  ts.createIdentifier("undefined")
                                )
                              ]),
                              ts.createBlock([
                                ts.createReturn(
                                  ts.createCall(
                                    ts.createIdentifier("String"),
                                    undefined,
                                    [ts.createIdentifier("item")]
                                  )
                                )
                              ])
                            )
                          ])
                        )
                      ),
                      ts.createVariableDeclaration(
                        "coerceBoolean",
                        undefined,
                        ts.createArrowFunction(
                          undefined,
                          undefined,
                          [
                            ts.createParameter(
                              undefined,
                              undefined,
                              undefined,
                              "item"
                            )
                          ],
                          undefined,
                          undefined,
                          ts.createBlock([
                            ts.createSwitch(
                              ts.createIdentifier("item"),
                              ts.createCaseBlock([
                                ts.createCaseClause(
                                  ts.createStringLiteral("true"),
                                  [ts.createReturn(ts.createTrue())]
                                ),
                                ts.createCaseClause(
                                  ts.createStringLiteral("false"),
                                  [ts.createReturn(ts.createFalse())]
                                ),
                                ts.createDefaultClause([
                                  ts.createReturn(ts.createIdentifier("item"))
                                ])
                              ])
                            )
                          ])
                        )
                      ),
                      ts.createVariableDeclaration(
                        "coerceNumber",
                        undefined,
                        ts.createArrowFunction(
                          undefined,
                          undefined,
                          [
                            ts.createParameter(
                              undefined,
                              undefined,
                              undefined,
                              ts.createIdentifier("item")
                            )
                          ],
                          undefined,
                          undefined,
                          ts.createBlock([
                            ts.createVariableStatement(
                              undefined,
                              ts.createVariableDeclarationList([
                                ts.createVariableDeclaration(
                                  ts.createIdentifier("coerced"),
                                  undefined,
                                  ts.createCall(
                                    ts.createIdentifier("parseInt"),
                                    undefined,
                                    [ts.createIdentifier("item")]
                                  )
                                )
                              ])
                            ),
                            ts.createReturn(
                              ts.createConditional(
                                ts.createCall(
                                  ts.createPropertyAccess(
                                    ts.createIdentifier("Number"),
                                    ts.createIdentifier("isNaN")
                                  ),
                                  undefined,
                                  [ts.createIdentifier("coerced")]
                                ),
                                ts.createIdentifier("item"),
                                ts.createIdentifier("coerced")
                              )
                            )
                          ])
                        )
                      ),
                      ts.createVariableDeclaration(
                        "coerceArray",
                        undefined,
                        ts.createArrowFunction(
                          undefined,
                          undefined,
                          [
                            ts.createParameter(
                              undefined,
                              undefined,
                              undefined,
                              "input",
                              undefined,
                              ts.createArrayTypeNode(
                                ts.createKeywordTypeNode(
                                  ts.SyntaxKind.UnknownKeyword
                                )
                              )
                            )
                          ],
                          undefined,
                          undefined,
                          ts.createBlock(
                            [
                              ...(typeof posType === "undefined"
                                ? [
                                    ts.createReturn(
                                      ts.createIdentifier("input")
                                    )
                                  ]
                                : []),
                              ...(posType === "string"
                                ? [
                                    ts.createReturn(
                                      ts.createCall(
                                        ts.createPropertyAccess(
                                          ts.createIdentifier("input"),
                                          ts.createIdentifier("map")
                                        ),
                                        undefined,
                                        [ts.createIdentifier("coerceString")]
                                      )
                                    )
                                  ]
                                : []),
                              ...(posType === "boolean"
                                ? [
                                    ts.createReturn(
                                      ts.createCall(
                                        ts.createPropertyAccess(
                                          ts.createIdentifier("input"),
                                          ts.createIdentifier("map")
                                        ),
                                        undefined,
                                        [ts.createIdentifier("coerceBoolean")]
                                      )
                                    )
                                  ]
                                : []),
                              ...(posType === "number"
                                ? [
                                    ts.createReturn(
                                      ts.createCall(
                                        ts.createPropertyAccess(
                                          ts.createIdentifier("input"),
                                          ts.createIdentifier("map")
                                        ),
                                        undefined,
                                        [ts.createIdentifier("coerceNumber")]
                                      )
                                    )
                                  ]
                                : [])
                            ],
                            true
                          )
                        )
                      ),
                      ts.createVariableDeclaration(
                        "coerceTuple",
                        undefined,
                        ts.createArrowFunction(
                          undefined,
                          undefined,
                          [
                            ts.createParameter(
                              undefined,
                              undefined,
                              undefined,
                              "input"
                            )
                          ],
                          undefined,
                          undefined,
                          ts.createBlock(
                            posTupleCoercion
                              ? [
                                  ts.createVariableStatement(undefined, [
                                    ts.createVariableDeclaration(
                                      ts.createIdentifier("members"),
                                      undefined,
                                      ts.createArrayLiteral(
                                        posTupleCoercion.members.map(member =>
                                          ts.createObjectLiteral([
                                            ts.createPropertyAssignment(
                                              "key",
                                              ts.createNumericLiteral(
                                                member.key.toString()
                                              )
                                            ),
                                            ts.createPropertyAssignment(
                                              "type",
                                              typeof member.type === "undefined"
                                                ? ts.createIdentifier(
                                                    "undefined"
                                                  )
                                                : ts.createStringLiteral(
                                                    member.type
                                                  )
                                            )
                                          ])
                                        )
                                      )
                                    )
                                  ]),
                                  ts.createReturn(
                                    ts.createCall(
                                      ts.createPropertyAccess(
                                        ts.createIdentifier("input"),
                                        ts.createIdentifier("map")
                                      ),
                                      undefined,
                                      [
                                        ts.createArrowFunction(
                                          undefined,
                                          undefined,
                                          [
                                            ts.createParameter(
                                              undefined,
                                              undefined,
                                              undefined,
                                              "item"
                                            ),
                                            ts.createParameter(
                                              undefined,
                                              undefined,
                                              undefined,
                                              "index"
                                            )
                                          ],
                                          undefined,
                                          undefined,
                                          ts.createBlock([
                                            ts.createVariableStatement(
                                              undefined,
                                              [
                                                ts.createVariableDeclaration(
                                                  "element",
                                                  undefined,
                                                  ts.createCall(
                                                    ts.createPropertyAccess(
                                                      ts.createIdentifier(
                                                        "members"
                                                      ),
                                                      ts.createIdentifier(
                                                        "find"
                                                      )
                                                    ),
                                                    undefined,
                                                    [
                                                      ts.createArrowFunction(
                                                        undefined,
                                                        undefined,
                                                        [
                                                          ts.createParameter(
                                                            undefined,
                                                            undefined,
                                                            undefined,
                                                            "member"
                                                          )
                                                        ],
                                                        undefined,
                                                        undefined,
                                                        ts.createStrictEquality(
                                                          ts.createPropertyAccess(
                                                            ts.createIdentifier(
                                                              "member"
                                                            ),
                                                            ts.createIdentifier(
                                                              "key"
                                                            )
                                                          ),
                                                          ts.createIdentifier(
                                                            "index"
                                                          )
                                                        )
                                                      )
                                                    ]
                                                  )
                                                )
                                              ]
                                            ),
                                            ts.createReturn(
                                              ts.createConditional(
                                                ts.createStrictEquality(
                                                  ts.createTypeOf(
                                                    ts.createIdentifier(
                                                      "element"
                                                    )
                                                  ),
                                                  ts.createStringLiteral(
                                                    "undefined"
                                                  )
                                                ),
                                                ts.createIdentifier("item"),
                                                ts.createConditional(
                                                  ts.createStrictEquality(
                                                    ts.createTypeOf(
                                                      ts.createPropertyAccess(
                                                        ts.createIdentifier(
                                                          "element"
                                                        ),
                                                        ts.createIdentifier(
                                                          "type"
                                                        )
                                                      )
                                                    ),
                                                    ts.createStringLiteral(
                                                      "undefined"
                                                    )
                                                  ),
                                                  ts.createIdentifier("item"),
                                                  ts.createConditional(
                                                    ts.createStrictEquality(
                                                      ts.createPropertyAccess(
                                                        ts.createIdentifier(
                                                          "element"
                                                        ),
                                                        ts.createIdentifier(
                                                          "type"
                                                        )
                                                      ),
                                                      ts.createStringLiteral(
                                                        "string"
                                                      )
                                                    ),
                                                    ts.createCall(
                                                      ts.createIdentifier(
                                                        "coerceString"
                                                      ),
                                                      undefined,
                                                      [
                                                        ts.createIdentifier(
                                                          "item"
                                                        )
                                                      ]
                                                    ),
                                                    ts.createConditional(
                                                      ts.createStrictEquality(
                                                        ts.createPropertyAccess(
                                                          ts.createIdentifier(
                                                            "element"
                                                          ),
                                                          ts.createIdentifier(
                                                            "type"
                                                          )
                                                        ),
                                                        ts.createStringLiteral(
                                                          "boolean"
                                                        )
                                                      ),
                                                      ts.createCall(
                                                        ts.createIdentifier(
                                                          "coerceBoolean"
                                                        ),
                                                        undefined,
                                                        [
                                                          ts.createIdentifier(
                                                            "item"
                                                          )
                                                        ]
                                                      ),
                                                      ts.createConditional(
                                                        ts.createStrictEquality(
                                                          ts.createPropertyAccess(
                                                            ts.createIdentifier(
                                                              "element"
                                                            ),
                                                            ts.createIdentifier(
                                                              "type"
                                                            )
                                                          ),
                                                          ts.createStringLiteral(
                                                            "number"
                                                          )
                                                        ),
                                                        ts.createCall(
                                                          ts.createIdentifier(
                                                            "coerceNumber"
                                                          ),
                                                          undefined,
                                                          [
                                                            ts.createIdentifier(
                                                              "item"
                                                            )
                                                          ]
                                                        ),
                                                        ts.createIdentifier(
                                                          "item"
                                                        )
                                                      )
                                                    )
                                                  )
                                                )
                                              )
                                            )
                                          ])
                                        )
                                      ]
                                    )
                                  )
                                ]
                              : [ts.createReturn(ts.createIdentifier("input"))]
                          )
                        )
                      ),
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
                        validateNamed
                      ),
                      ts.createVariableDeclaration(
                        "validatePositional",
                        undefined,
                        validatePositional
                      ),
                      ts.createVariableDeclaration(
                        "rawFlags",
                        undefined,
                        ts.createCall(ts.createIdentifier("parse"), undefined, [
                          ts.createIdentifier("input"),
                          ts.createObjectLiteral([
                            ts.createPropertyAssignment(
                              ts.createIdentifier("alias"),
                              ts.createObjectLiteral([])
                            ),
                            ts.createPropertyAssignment(
                              ts.createIdentifier("array"),
                              ts.createArrayLiteral(
                                namedCoercion.array.map(name =>
                                  typeof name === "string"
                                    ? ts.createStringLiteral(name)
                                    : ts.createObjectLiteral([
                                        ts.createPropertyAssignment(
                                          ts.createIdentifier("key"),
                                          ts.createStringLiteral(name.key)
                                        ),
                                        ...(name.string
                                          ? [
                                              ts.createPropertyAssignment(
                                                "string",
                                                ts.createTrue()
                                              )
                                            ]
                                          : []),
                                        ...(name.number
                                          ? [
                                              ts.createPropertyAssignment(
                                                "number",
                                                ts.createTrue()
                                              )
                                            ]
                                          : []),
                                        ...(name.boolean
                                          ? [
                                              ts.createPropertyAssignment(
                                                "boolean",
                                                ts.createTrue()
                                              )
                                            ]
                                          : [])
                                      ])
                                )
                              )
                            ),
                            ts.createPropertyAssignment(
                              ts.createIdentifier("boolean"),
                              ts.createArrayLiteral([])
                            ),
                            ts.createPropertyAssignment(
                              ts.createIdentifier("configuration"),
                              ts.createObjectLiteral([
                                ts.createPropertyAssignment(
                                  ts.createStringLiteral(
                                    "camel-case-expansion"
                                  ),
                                  ts.createFalse()
                                ),
                                ts.createPropertyAssignment(
                                  ts.createStringLiteral("strip-aliased"),
                                  ts.createTrue()
                                )
                              ])
                            ),
                            ts.createPropertyAssignment(
                              "default",
                              ts.createObjectLiteral()
                            ),
                            ts.createPropertyAssignment(
                              "envPrefix",
                              ts.createIdentifier("undefined")
                            ),
                            ts.createPropertyAssignment(
                              "narg",
                              ts.createObjectLiteral(
                                namedCoercion.length.map(({ name, length }) =>
                                  ts.createPropertyAssignment(
                                    ts.createStringLiteral(name),
                                    ts.createNumericLiteral(length.toString())
                                  )
                                )
                              )
                            ),
                            ts.createPropertyAssignment(
                              ts.createIdentifier("number"),
                              ts.createArrayLiteral([])
                            ),
                            ts.createPropertyAssignment(
                              ts.createIdentifier("string"),
                              ts.createArrayLiteral([])
                            )
                          ])
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
                        ts.createCall(
                          ts.createIdentifier("coerceTuple"),
                          undefined,
                          [
                            ts.createCall(
                              ts.createIdentifier("coerceArray"),
                              undefined,
                              [
                                ts.createPropertyAccess(
                                  ts.createIdentifier("rawFlags"),
                                  ts.createIdentifier("_")
                                )
                              ]
                            )
                          ]
                        )
                      )
                    ],
                    ts.NodeFlags.Const
                  )
                ),
                // ts.createStatement(
                //   ts.createCall(
                //     ts.createPropertyAccess(
                //       ts.createIdentifier("console"),
                //       ts.createIdentifier("log"),
                //     ),
                //     undefined,
                //     [ts.createIdentifier("positional")]
                //   )
                // ),
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
