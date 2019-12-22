import * as ts from 'typescript';
import { VisitorContext, PartialVisitorContext } from './visitor-context';
import { visitType, visitUndefinedOrType, visitShortCircuit } from './visitor-type-check';
import * as VisitorUtils from './visitor-utils';
import { sliceMapValues } from './utils';

export function createArrowFunction(type: ts.Type, optional: boolean, partialVisitorContext: PartialVisitorContext) {
    const functionMap: VisitorContext['functionMap'] = new Map();
    const functionNames: VisitorContext['functionNames'] = new Set();
    const visitorContext = { ...partialVisitorContext, functionNames, functionMap };
    const functionName = partialVisitorContext.options.shortCircuit
        ? visitShortCircuit(visitorContext)
        : (optional
            ? visitUndefinedOrType(type, visitorContext)
            : visitType(type, visitorContext)
        );

    const errorIdentifier = ts.createIdentifier('error');
    const declarations = sliceMapValues(functionMap);

    return ts.createArrowFunction(
        undefined,
        undefined,
        [
            ts.createParameter(
                undefined,
                undefined,
                undefined,
                VisitorUtils.objectIdentifier,
                undefined,
                ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)
            )
        ],
        undefined,
        undefined,
        ts.createBlock([
            ts.createVariableStatement(
                [ts.createModifier(ts.SyntaxKind.ConstKeyword)],
                [ts.createVariableDeclaration(VisitorUtils.pathIdentifier, undefined, ts.createArrayLiteral([]))]
            ),
            ...declarations,
            ts.createVariableStatement(
                [ts.createModifier(ts.SyntaxKind.ConstKeyword)],
                [ts.createVariableDeclaration(errorIdentifier, undefined, ts.createCall(ts.createIdentifier(functionName), undefined, [VisitorUtils.objectIdentifier]))]
            ),
            ts.createReturn(errorIdentifier)
        ])
    );
}
