import ts, { Expression } from "typescript";
import * as tsutils from "tsutils/typeguard/3.0";
import { VisitorContext } from "./visitor-context";
import { ErrorMessage, ErrorType, templateFromError } from "../error-message";

export const objectIdentifier = ts.createIdentifier("object");
export const pathIdentifier = ts.createIdentifier("path");

export function checkIsClass(
  type: ts.ObjectType,
  visitorContext: VisitorContext
) {
  // Hacky: using internal TypeScript API.
  if (
    "isArrayType" in visitorContext.checker &&
    (visitorContext.checker as any).isArrayType(type)
  ) {
    return false;
  }
  if (
    "isArrayLikeType" in visitorContext.checker &&
    (visitorContext.checker as any).isArrayLikeType(type)
  ) {
    return false;
  }

  let hasConstructSignatures = false;
  if (
    type.symbol !== undefined &&
    type.symbol.valueDeclaration !== undefined &&
    ts.isVariableDeclaration(type.symbol.valueDeclaration) &&
    type.symbol.valueDeclaration.type
  ) {
    const variableDeclarationType = visitorContext.checker.getTypeAtLocation(
      type.symbol.valueDeclaration.type
    );
    const constructSignatures = variableDeclarationType.getConstructSignatures();
    hasConstructSignatures = constructSignatures.length >= 1;
  }

  return type.isClass() || hasConstructSignatures;
}

export function setFunctionIfNotExists(
  name: string,
  visitorContext: VisitorContext,
  factory: () => ts.FunctionDeclaration
) {
  if (!visitorContext.functionNames.has(name)) {
    visitorContext.functionNames.add(name);
    visitorContext.functionMap.set(name, factory());
  }
  return name;
}

export function getPropertyInfo(
  symbol: ts.Symbol,
  visitorContext: VisitorContext
) {
  const name: string | undefined = symbol.name;
  if (name === undefined) {
    throw new Error("Missing name in property symbol.");
  }
  if ("valueDeclaration" in symbol) {
    const valueDeclaration = symbol.valueDeclaration;
    if (
      !ts.isPropertySignature(valueDeclaration) &&
      !ts.isMethodSignature(valueDeclaration)
    ) {
      throw new Error("Unsupported declaration kind: " + valueDeclaration.kind);
    }
    const isMethod =
      ts.isMethodSignature(valueDeclaration) ||
      (valueDeclaration.type !== undefined &&
        ts.isFunctionTypeNode(valueDeclaration.type));
    if (isMethod && !visitorContext.options.ignoreMethods) {
      throw new Error(
        "Encountered a method declaration, but methods are not supported. Issue: https://github.com/woutervh-/typescript-is/issues/5"
      );
    }
    let propertyType: ts.Type | undefined = undefined;
    if (valueDeclaration.type === undefined) {
      if (!isMethod) {
        throw new Error("Found property without type.");
      }
    } else {
      propertyType = visitorContext.checker.getTypeFromTypeNode(
        valueDeclaration.type
      );
    }
    return {
      name,
      type: propertyType,
      isMethod,
      isSymbol: name.startsWith("__@"),
      optional: !!valueDeclaration.questionToken
    };
  } else {
    const propertyType = (symbol as { type?: ts.Type }).type;
    const optional =
      ((symbol as ts.Symbol).flags & ts.SymbolFlags.Optional) !== 0;
    if (propertyType !== undefined) {
      return {
        name,
        type: propertyType,
        isMethod: false,
        isSymbol: name.startsWith("__@"),
        optional
      };
    } else {
      throw new Error("Expected a valueDeclaration or a property type.");
    }
  }
}

export function getTypeReferenceMapping(
  type: ts.TypeReference,
  visitorContext: VisitorContext
) {
  const mapping: Map<ts.Type, ts.Type> = new Map();
  (function checkBaseTypes(type: ts.TypeReference) {
    if (tsutils.isInterfaceType(type.target)) {
      const baseTypes = visitorContext.checker.getBaseTypes(type.target);
      for (const baseType of baseTypes) {
        if (
          tsutils.isTypeReference(baseType) &&
          baseType.target.typeParameters !== undefined &&
          baseType.typeArguments !== undefined
        ) {
          const typeParameters = baseType.target.typeParameters;
          const typeArguments = baseType.typeArguments;
          for (let i = 0; i < typeParameters.length; i++) {
            if (typeParameters[i] !== typeArguments[i]) {
              mapping.set(typeParameters[i], typeArguments[i]);
            }
          }
          checkBaseTypes(baseType);
        }
      }
    }
  })(type);
  if (
    type.target.typeParameters !== undefined &&
    type.typeArguments !== undefined
  ) {
    const typeParameters = type.target.typeParameters;
    const typeArguments = type.typeArguments;
    for (let i = 0; i < typeParameters.length; i++) {
      if (typeParameters[i] !== typeArguments[i]) {
        mapping.set(typeParameters[i], typeArguments[i]);
      }
    }
  }
  return mapping;
}

export function getResolvedTypeParameter(
  type: ts.Type,
  visitorContext: VisitorContext
) {
  let mappedType: ts.Type | undefined;
  for (let i = visitorContext.typeMapperStack.length - 1; i >= 0; i--) {
    mappedType = visitorContext.typeMapperStack[i].get(type);
    if (mappedType !== undefined) {
      break;
    }
  }
  return mappedType || type.getDefault();
}

export function getStringFunction(visitorContext: VisitorContext) {
  return createTypeAssertionFunction("string", visitorContext);
}

export function getBooleanFunction(visitorContext: VisitorContext) {
  return createTypeAssertionFunction("boolean", visitorContext);
}

export function getBigintFunction(visitorContext: VisitorContext) {
  return createTypeAssertionFunction("bigint", visitorContext);
}

export function getNumberFunction(visitorContext: VisitorContext) {
  return createTypeAssertionFunction("number", visitorContext);
}

export function getUndefinedFunction(visitorContext: VisitorContext) {
  return createTypeAssertionFunction("undefined", visitorContext);
}

export function getNullFunction(visitorContext: VisitorContext) {
  return createTypeAssertionFunction("null", visitorContext);
}

export function getNeverFunction(visitorContext: VisitorContext) {
  const name = "_never";
  return setFunctionIfNotExists(name, visitorContext, () => {
    return createRejectingFunction(name, visitorContext.createErrorMessage);
  });
}

export function getUnknownFunction(visitorContext: VisitorContext) {
  const name = "_unknown";
  return setFunctionIfNotExists(name, visitorContext, () => {
    return createAcceptingFunction(name);
  });
}

export function getAnyFunction(visitorContext: VisitorContext) {
  const name = "_any";
  return setFunctionIfNotExists(name, visitorContext, () => {
    return createAcceptingFunction(name);
  });
}

export function getIgnoredTypeFunction(visitorContext: VisitorContext) {
  const name = "_ignore";
  return setFunctionIfNotExists(name, visitorContext, () => {
    return createAcceptingFunction(name);
  });
}

export function createBinaries(
  expressions: ts.Expression[],
  operator: ts.BinaryOperator,
  baseExpression?: ts.Expression
) {
  if (expressions.length >= 1 || baseExpression === undefined) {
    return expressions.reduce((previous, expression) =>
      ts.createBinary(previous, operator, expression)
    );
  } else {
    return baseExpression;
  }
}

export function createAcceptingFunction(functionName: string) {
  return ts.createFunctionDeclaration(
    undefined,
    undefined,
    undefined,
    functionName,
    undefined,
    [],
    undefined,
    ts.createBlock([ts.createReturn(ts.createNull())])
  );
}

export function createRejectingFunction(
  functionName: string,
  createErrorMessage: (data: { type: ErrorType }) => ErrorMessage
) {
  // const messageParts = createErrorMessage({ type: ErrorType.Never });
  // const headIndex = messageParts.findIndex(part => typeof part !== 'string');
  // const head = messageParts.slice(0, headIndex).join('');
  return ts.createFunctionDeclaration(
    undefined,
    undefined,
    undefined,
    functionName,
    undefined,
    [
      ts.createParameter(
        undefined,
        undefined,
        undefined,
        objectIdentifier,
        undefined,
        undefined,
        undefined
      )
    ],
    undefined,
    ts.createBlock([
      ts.createReturn(
        templateFromError(createErrorMessage({ type: ErrorType.Never }))
      )
    ])
  );
}

export function createConjunctionFunction(
  functionNames: string[],
  functionName: string,
  extraStatements?: ts.Statement[]
) {
  const conditionsIdentifier = ts.createIdentifier("conditions");
  const conditionIdentifier = ts.createIdentifier("condition");
  const errorIdentifier = ts.createIdentifier("error");
  return ts.createFunctionDeclaration(
    undefined,
    undefined,
    undefined,
    functionName,
    undefined,
    [
      ts.createParameter(
        undefined,
        undefined,
        undefined,
        objectIdentifier,
        undefined,
        undefined,
        undefined
      )
    ],
    undefined,
    ts.createBlock([
      ts.createVariableStatement(
        [ts.createModifier(ts.SyntaxKind.ConstKeyword)],
        [
          ts.createVariableDeclaration(
            conditionsIdentifier,
            undefined,
            ts.createArrayLiteral(
              functionNames.map(functionName =>
                ts.createIdentifier(functionName)
              )
            )
          )
        ]
      ),
      ts.createForOf(
        undefined,
        ts.createVariableDeclarationList(
          [
            ts.createVariableDeclaration(
              conditionIdentifier,
              undefined,
              undefined
            )
          ],
          ts.NodeFlags.Const
        ),
        conditionsIdentifier,
        ts.createBlock([
          ts.createVariableStatement(
            [ts.createModifier(ts.SyntaxKind.ConstKeyword)],
            [
              ts.createVariableDeclaration(
                errorIdentifier,
                undefined,
                ts.createCall(conditionIdentifier, undefined, [
                  objectIdentifier
                ])
              )
            ]
          ),
          ts.createIf(errorIdentifier, ts.createReturn(errorIdentifier))
        ])
      ),
      ...(extraStatements || []),
      ts.createReturn(ts.createNull())
    ])
  );
}

export function createDisjunctionFunction(
  functionNames: string[],
  functionName: string
) {
  const conditionsIdentifier = ts.createIdentifier("conditions");
  const conditionIdentifier = ts.createIdentifier("condition");
  const errorIdentifier = ts.createIdentifier("error");
  return ts.createFunctionDeclaration(
    undefined,
    undefined,
    undefined,
    functionName,
    undefined,
    [
      ts.createParameter(
        undefined,
        undefined,
        undefined,
        objectIdentifier,
        undefined,
        undefined,
        undefined
      )
    ],
    undefined,
    ts.createBlock([
      ts.createVariableStatement(
        [ts.createModifier(ts.SyntaxKind.ConstKeyword)],
        [
          ts.createVariableDeclaration(
            conditionsIdentifier,
            undefined,
            ts.createArrayLiteral(
              functionNames.map(functionName =>
                ts.createIdentifier(functionName)
              )
            )
          )
        ]
      ),
      ts.createForOf(
        undefined,
        ts.createVariableDeclarationList(
          [
            ts.createVariableDeclaration(
              conditionIdentifier,
              undefined,
              undefined
            )
          ],
          ts.NodeFlags.Const
        ),
        conditionsIdentifier,
        ts.createBlock([
          ts.createVariableStatement(
            [ts.createModifier(ts.SyntaxKind.ConstKeyword)],
            [
              ts.createVariableDeclaration(
                errorIdentifier,
                undefined,
                ts.createCall(conditionIdentifier, undefined, [
                  objectIdentifier
                ])
              )
            ]
          ),
          ts.createIf(
            ts.createLogicalNot(errorIdentifier),
            ts.createReturn(ts.createNull())
          )
        ])
      ),
      ts.createReturn(
        createBinaries(
          [
            ts.createStringLiteral("--"),
            ts.createCall(
              ts.createPropertyAccess(pathIdentifier, "join"),
              undefined,
              [ts.createStringLiteral(".")]
            ),
            ts.createStringLiteral(`: there are no valid alternatives`)
          ],
          ts.SyntaxKind.PlusToken
        )
      )
    ])
  );
}

export function createTypeAssertionFunction(
  expectedType: string,
  visitorContext: VisitorContext
) {
  return setFunctionIfNotExists(`_${expectedType}`, visitorContext, () => {
    return createAssertionFunctionWithMessage({
      failureCondition: ts.createStrictInequality(
        ts.createTypeOf(objectIdentifier),
        ts.createStringLiteral(expectedType)
      ),
      functionName: `_${expectedType}`,
      expectedType,
      message: visitorContext.createErrorMessage({
        type: ErrorType.TypeMismatch
      })
    });
  });
}

export function createAssertionFunctionWithMessage(init: {
  failureCondition: ts.Expression;
  functionName: string;
  expectedType: string;
  expectedValue?: string | number | boolean; 
  message: ErrorMessage;
}) {
  const createOptionalValueLiteral = (expectedValue?: string | number | boolean): Expression => {
    switch (typeof expectedValue) {
      case "undefined":
        return ts.createIdentifier("undefined");
      case "number":
        return ts.createNumericLiteral(expectedValue.toString());
      case "string":
        return ts.createStringLiteral(expectedValue);
      case "boolean":
        return expectedValue ? ts.createTrue() : ts.createFalse()
    }
  }

  return ts.createFunctionDeclaration(
    undefined,
    undefined,
    undefined,
    init.functionName,
    undefined,
    [
      ts.createParameter(
        undefined,
        undefined,
        undefined,
        objectIdentifier,
        undefined,
        undefined,
        undefined
      )
    ],
    undefined,
    ts.createBlock([
      ts.createVariableStatement(undefined, [
        ts.createVariableDeclaration(
          ts.createIdentifier("expectedType"),
          undefined,
          ts.createStringLiteral(init.expectedType)
        ),
        ts.createVariableDeclaration(
          ts.createIdentifier("expectedValue"),
          undefined,
          createOptionalValueLiteral(init.expectedValue)
        )
      ]),
      ts.createIf(
        init.failureCondition,
        ts.createReturn(templateFromError(init.message)),
        ts.createReturn(ts.createNull())
      )
    ])
  );
}

export function createAssertionFunction(
  failureCondition: ts.Expression,
  reason: string,
  functionName: string
) {
  return ts.createFunctionDeclaration(
    undefined,
    undefined,
    undefined,
    functionName,
    undefined,
    [
      ts.createParameter(
        undefined,
        undefined,
        undefined,
        objectIdentifier,
        undefined,
        undefined,
        undefined
      )
    ],
    undefined,
    ts.createBlock([
      ts.createIf(
        failureCondition,
        ts.createReturn(
          createBinaries(
            [
              ts.createStringLiteral("--"),
              ts.createCall(
                ts.createPropertyAccess(pathIdentifier, "join"),
                undefined,
                [ts.createStringLiteral(".")]
              ),
              ts.createStringLiteral(` ${reason}`)
            ],
            ts.SyntaxKind.PlusToken
          )
        ),
        ts.createReturn(ts.createNull())
      )
    ])
  );
}

export function createSuperfluousPropertiesLoop(propertyNames: string[]) {
  const keyIdentifier = ts.createIdentifier("key");
  return ts.createForOf(
    undefined,
    ts.createVariableDeclarationList(
      [ts.createVariableDeclaration(keyIdentifier, undefined, undefined)],
      ts.NodeFlags.Const
    ),
    ts.createCall(
      ts.createPropertyAccess(ts.createIdentifier("Object"), "keys"),
      undefined,
      [objectIdentifier]
    ),
    ts.createBlock([
      ts.createIf(
        createBinaries(
          propertyNames.map(propertyName =>
            ts.createStrictInequality(
              keyIdentifier,
              ts.createStringLiteral(propertyName)
            )
          ),
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.createTrue()
        ),
        ts.createReturn(
          createBinaries(
            [
              ts.createStringLiteral(`unknown flag --`),
              keyIdentifier,
              ts.createStringLiteral(` is not allowed`)
            ],
            ts.SyntaxKind.PlusToken
          )
        )
      )
    ])
  );
}

export function isBigIntType(type: ts.Type) {
  if ("BigInt" in ts.TypeFlags) {
    return (ts.TypeFlags as any).BigInt & type.flags;
  } else {
    return false;
  }
}
