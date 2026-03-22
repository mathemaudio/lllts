import type { FunctionDeclaration, MethodDeclaration, ReturnStatement } from "ts-morph"
import { Node, SyntaxKind } from "ts-morph"
import { BaseRule } from "../../core/BaseRule.lll"
import { DiagnosticObject } from "../../core/DiagnosticObject"
import { Rule } from "../../core/rulesEngine/Rule"
import { Spec } from "../../public/lll.lll"

@Spec("Verifies that value-returning declared methods and functions use explicit return type annotations.")
export class MustHaveExplicitReturnTypeRule {
	@Spec("Returns the rule configuration object.")
	public static getRule(): Rule {
		return {
			id: "R6",
			title: "Must declare explicit return types for value-returning declarations",
			run(sourceFile) {
				const diagnostics: DiagnosticObject[] = []
				const methods = sourceFile.getClasses().flatMap(classDeclaration => classDeclaration.getMethods())
				for (const method of methods) {
					MustHaveExplicitReturnTypeRule.addMissingTypeDiagnostic(sourceFile.getFilePath(), method.getName(), method, diagnostics)
				}
				for (const fn of sourceFile.getFunctions()) {
					const functionName = fn.getName() ?? "<anonymous>"
					MustHaveExplicitReturnTypeRule.addMissingTypeDiagnostic(sourceFile.getFilePath(), functionName, fn, diagnostics)
				}
				return diagnostics
			}
		}
	}

	@Spec("Adds a diagnostic when a value-returning declaration omits its explicit return type.")
	private static addMissingTypeDiagnostic(
		filePath: string,
		declarationName: string,
		declaration: MethodDeclaration | FunctionDeclaration,
		diagnostics: DiagnosticObject[]
	) {
		if (!MustHaveExplicitReturnTypeRule.returnsValue(declaration)) {
			return
		}
		if (declaration.getReturnTypeNode() !== undefined) {
			return
		}
		diagnostics.push(
			BaseRule.createError(
				filePath,
				`Declaration '${declarationName}' returns a value but does not declare an explicit return type. Add ': TypeName'.`,
				"missing-explicit-return-type",
				declaration.getStartLineNumber()
			)
		)
	}

	@Spec("Determines whether a declared method or function returns a value expression.")
	private static returnsValue(declaration: MethodDeclaration | FunctionDeclaration): boolean {
		const body = declaration.getBody()
		if (!body) {
			return false
		}
		const returnStatements = body.getDescendantsOfKind(SyntaxKind.ReturnStatement)
		for (const returnStatement of returnStatements) {
			if (!MustHaveExplicitReturnTypeRule.belongsToDeclaration(returnStatement, declaration)) {
				continue
			}
			if (returnStatement.getExpression() !== undefined) {
				return true
			}
		}
		return false
	}

	@Spec("Checks whether a return statement belongs to the current declaration rather than a nested callback.")
	private static belongsToDeclaration(
		returnStatement: ReturnStatement,
		declaration: MethodDeclaration | FunctionDeclaration
	): boolean {
		const nearestFunctionLike = returnStatement.getFirstAncestor(ancestor =>
			Node.isMethodDeclaration(ancestor)
			|| Node.isFunctionDeclaration(ancestor)
			|| Node.isFunctionExpression(ancestor)
			|| Node.isArrowFunction(ancestor)
		)
		return nearestFunctionLike === declaration
	}
}
