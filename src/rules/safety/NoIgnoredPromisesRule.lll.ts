import { Rule } from "../../core/rulesEngine/Rule"
import { BaseRule } from "../../core/BaseRule.lll"
import { Out } from "../../public/lll.lll"
import { Spec } from "../../public/lll.lll"
import { Node, SyntaxKind, ts } from "ts-morph"
import type { CallExpression, Expression, ExpressionStatement, PropertyAccessExpression, Type } from "ts-morph"

@Spec("Forbids promise-valued expression statements whose result is silently ignored.")
export class NoIgnoredPromisesRule {
	@Spec("Returns the rule configuration object.")
	@Out("rule", "Rule")
	public static getRule(): Rule {
		return {
			id: "R17",
			title: "No ignored promises",
			run(sourceFile) {
				const filePath = sourceFile.getFilePath()
				if (!filePath.endsWith(".ts") || filePath.endsWith(".d.ts")) {
					return []
				}

				const diagnostics: import("../../core/DiagnosticObject").DiagnosticObject[] = []
				const expressionStatements = sourceFile.getDescendantsOfKind(SyntaxKind.ExpressionStatement)

				for (const expressionStatement of expressionStatements) {
					if (!NoIgnoredPromisesRule.isIgnoredPromiseExpressionStatement(expressionStatement)) {
						continue
					}
					const expression = expressionStatement.getExpression()
					const typeText = expression.getType().getText(expression)
					diagnostics.push(
						BaseRule.createError(
							filePath,
							`Promise result is ignored. Expression statements of type '${typeText}' must be awaited, returned, assigned, or explicitly discarded with 'void'.`,
							"no-ignored-promises",
							expressionStatement.getStartLineNumber()
						)
					)
				}

				return diagnostics
			}
		}
	}

	@Spec("Checks whether an expression statement silently drops a promise-like result.")
	@Out("ignored", "boolean")
	private static isIgnoredPromiseExpressionStatement(expressionStatement: ExpressionStatement) {
		const expression = expressionStatement.getExpression()
		if (Node.isAwaitExpression(expression) || Node.isVoidExpression(expression)) {
			return false
		}
		if (!NoIgnoredPromisesRule.isPromiseLikeType(expression.getType(), expression)) {
			return false
		}
		return !NoIgnoredPromisesRule.hasExplicitPromiseHandling(expression)
	}

	@Spec("Checks whether the expression already includes an explicit rejection-handling promise chain.")
	@Out("handled", "boolean")
	private static hasExplicitPromiseHandling(expression: Expression): boolean {
		if (Node.isParenthesizedExpression(expression)) {
			return NoIgnoredPromisesRule.hasExplicitPromiseHandling(expression.getExpression())
		}
		if (!Node.isCallExpression(expression)) {
			return false
		}

		const propertyAccess = NoIgnoredPromisesRule.getPropertyAccess(expression)
		if (propertyAccess === undefined) {
			return false
		}

		const methodName = propertyAccess.getName()
		if (methodName === "catch" && expression.getArguments().length >= 1) {
			return true
		}
		if (methodName === "then" && expression.getArguments().length >= 2) {
			return true
		}
		return NoIgnoredPromisesRule.hasExplicitPromiseHandling(propertyAccess.getExpression())
	}

	@Spec("Returns the property access for method-style promise handling calls.")
	@Out("propertyAccess", "PropertyAccessExpression | undefined")
	private static getPropertyAccess(expression: CallExpression) {
		const callee = expression.getExpression()
		if (!Node.isPropertyAccessExpression(callee)) {
			return undefined
		}
		return callee
	}

	@Spec("Returns true when the resolved type is or includes a Promise or PromiseLike value.")
	@Out("promiseLike", "boolean")
	private static isPromiseLikeType(type: Type, expression: Expression) {
		const pending = [type]
		const visited = new Set<Type>()

		while (pending.length > 0) {
			const current = pending.pop()
			if (current === undefined) {
				continue
			}
			if (visited.has(current)) {
				continue
			}
			visited.add(current)

			if (NoIgnoredPromisesRule.hasPromiseLikeShape(current, expression)) {
				return true
			}
			if (current.isUnion()) {
				pending.push(...current.getUnionTypes())
				continue
			}
			if (current.isIntersection()) {
				pending.push(...current.getIntersectionTypes())
			}
		}

		return false
	}

	@Spec("Checks for Promise flags, symbols, or a callable then method on the apparent type.")
	@Out("promiseLike", "boolean")
	private static hasPromiseLikeShape(type: Type, expression: Expression) {
		const flags = type.getFlags()
		if ((flags & ts.TypeFlags.Any) !== 0 || (flags & ts.TypeFlags.Unknown) !== 0) {
			return false
		}

		const symbolName = type.getSymbol()?.getName() ?? type.getAliasSymbol()?.getName()
		if (symbolName === "Promise" || symbolName === "PromiseLike") {
			return true
		}

		const text = type.getText(expression)
		if (text === "Promise" || text.startsWith("Promise<") || text === "PromiseLike" || text.startsWith("PromiseLike<")) {
			return true
		}

		const thenProperty = type.getApparentType().getProperty("then")
		if (thenProperty === undefined) {
			return false
		}
		const declaration = thenProperty.getValueDeclaration()
		if (declaration === undefined) {
			return true
		}
		const thenType = declaration.getType()
		return thenType.getCallSignatures().length > 0
	}
}
