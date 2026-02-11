
import { DiagnosticObject } from "../core/DiagnosticObject"
import { Rule } from "../core/Rule"
import { BaseRule } from "../core/BaseRule.lll"
import { Out } from "../public/lll"
import { Spec } from "../public/lll"
import { SyntaxKind } from "ts-morph"
import type { MethodDeclaration } from "ts-morph"

@Spec("Verifies that methods have @Out decorator if and only if they return a value.")

export class MustHaveOutRule {
	@Spec("Returns the rule configuration object.")

	@Out("rule", "Rule")
	public static getRule(): Rule {
		return {
			id: "R6",
			title: "Must have out decorator when returning values",
			run(sourceFile) {
				const exportedClass = BaseRule.getExportedClass(sourceFile)
				if (!exportedClass) return []

				const diagnostics: DiagnosticObject[] = []
				const methods = exportedClass.getMethods()
				const className = exportedClass.getName()
				const isUsecaseClass = !!className && className.endsWith("_usecase")

				for (const method of methods) {
					const methodName = method.getName()
					const isStaticViewMethod = typeof method.isStatic === "function" && method.isStatic() && methodName === "view"
					if (isUsecaseClass && isStaticViewMethod) {
						continue
					}

					const outDecorator = BaseRule.findDecorator(method, "Out")
					const hasOut = outDecorator !== undefined
					const returnsValue = MustHaveOutRule.methodReturnsValue(method)

					// Case 1: Method returns a value but doesn't have @Out
					if (returnsValue && !hasOut) {
						diagnostics.push(
							BaseRule.createError(
								sourceFile.getFilePath(),
								`Method '${methodName}' returns a value but is missing @Out decorator. Add @Out("name", "type").`,
								"missing-out",
								method.getStartLineNumber()
							)
						)
					}

					// Case 2: Method doesn't return a value but has @Out
					if (!returnsValue && hasOut) {
						diagnostics.push(
							BaseRule.createError(
								sourceFile.getFilePath(),
								`Method '${methodName}' has @Out decorator but doesn't return a value. Remove @Out or add a return statement.`,
								"extra-out",
								method.getStartLineNumber()
							)
						)
					}

					// Case 3: If method has @Out, verify it has the required parameters
					if (hasOut && outDecorator) {
						const args = outDecorator.getArguments()
						if (args.length < 2) {
							diagnostics.push(
								BaseRule.createError(
									sourceFile.getFilePath(),
									`Method '${methodName}' has @Out decorator but is missing required parameters. @Out should have two arguments: name and type.`,
									"bad-out",
									method.getStartLineNumber()
								)
							)
						}
					}
				}

				return diagnostics
			}
		}
	}

	@Spec("Determines if a method returns a value or void.")

	@Out("returnsValue", "boolean")
	private static methodReturnsValue(method: MethodDeclaration) {
		// Check the return type annotation
		const returnType = method.getReturnType()
		const returnTypeText = returnType.getText()

		// Explicit void return type
		if (returnTypeText === 'void') {
			return false
		}

		// Check if method body has return statements with values
		const methodBody = method.getBody()
		if (!methodBody) {
			// No body means it's likely abstract or interface method
			// In this case, check if return type is void
			return returnTypeText !== 'void'
		}

		// Look for return statements in the method body
		const returnStatements = methodBody.getDescendantsOfKind(SyntaxKind.ReturnStatement)

		// If there are no return statements, it's void
		if (returnStatements.length === 0) {
			return false
		}

		// Check if any return statement has a value
		for (const returnStmt of returnStatements) {
			const expression = returnStmt.getExpression()
			if (expression) {
				// Has a return value
				return true
			}
		}

		// All returns are empty (just "return;")
		return false
	}
}
