import { Rule } from "../../core/rulesEngine/Rule"
import { BaseRule } from "../../core/BaseRule.lll"
import { Out } from "../../public/lll.lll"
import { Spec } from "../../public/lll.lll"
import { Node, SyntaxKind } from "ts-morph"
import type { ConditionalExpression, DoStatement, Expression, ForStatement, IfStatement, SourceFile, Type, WhileStatement } from "ts-morph"

@Spec("Forbids implicit truthiness in supported condition positions unless the expression resolves to boolean.")
export class NoImplicitTruthinessRule {
	@Spec("Returns the rule configuration object.")
	@Out("rule", "Rule")
	public static getRule(): Rule {
		return {
			id: "R12",
			title: "No implicit truthiness",
			run(sourceFile) {
				const filePath = sourceFile.getFilePath()
				if (!filePath.endsWith(".ts") || filePath.endsWith(".d.ts")) {
					return []
				}

				const diagnostics: import("../../core/DiagnosticObject").DiagnosticObject[] = []
				const conditionContexts = NoImplicitTruthinessRule.collectConditionContexts(sourceFile)

				for (const conditionContext of conditionContexts) {
					if (NoImplicitTruthinessRule.isExplicitBooleanCondition(conditionContext.expression)) {
						continue
					}
					const conditionType = conditionContext.expression.getType()
					const conditionTypeText = conditionType.getText(conditionContext.expression)
					diagnostics.push(
						BaseRule.createError(
							filePath,
							`Condition must be explicit. ${conditionContext.kind} conditions cannot rely on truthiness from '${conditionTypeText}'. Compare against '', 0, null, undefined, or rewrite as a boolean expression.`,
							"no-implicit-truthiness",
							conditionContext.expression.getStartLineNumber()
						)
					)
				}

				return diagnostics
			}
		}
	}

	@Spec("Collects condition expressions from supported control-flow and ternary positions.")
	@Out("conditions", "object[]")
	private static collectConditionContexts(sourceFile: SourceFile) {
		const conditions: Array<{
			kind: "if" | "while" | "do while" | "for" | "ternary"
			expression: Expression
		}> = []

		for (const ifStatement of sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement)) {
			conditions.push(NoImplicitTruthinessRule.createConditionContext("if", ifStatement))
		}

		for (const whileStatement of sourceFile.getDescendantsOfKind(SyntaxKind.WhileStatement)) {
			conditions.push(NoImplicitTruthinessRule.createConditionContext("while", whileStatement))
		}

		for (const doStatement of sourceFile.getDescendantsOfKind(SyntaxKind.DoStatement)) {
			conditions.push(NoImplicitTruthinessRule.createConditionContext("do while", doStatement))
		}

		for (const forStatement of sourceFile.getDescendantsOfKind(SyntaxKind.ForStatement)) {
			const expression = forStatement.getCondition()
			if (expression !== undefined) {
				conditions.push({ kind: "for", expression })
			}
		}

		for (const conditionalExpression of sourceFile.getDescendantsOfKind(SyntaxKind.ConditionalExpression)) {
			conditions.push(NoImplicitTruthinessRule.createConditionContext("ternary", conditionalExpression))
		}

		return conditions
	}

	@Spec("Builds a condition context from a supported condition-bearing node.")
	@Out("condition", "object")
	private static createConditionContext(
		kind: "if" | "while" | "do while" | "for" | "ternary",
		node: IfStatement | WhileStatement | DoStatement | ConditionalExpression
	) {
		const expression = Node.isConditionalExpression(node) ? node.getCondition() : node.getExpression()
		return {
			kind,
			expression
		}
	}

	@Spec("Checks whether the condition expression is statically boolean after resolving union members.")
	@Out("explicitBoolean", "boolean")
	private static isExplicitBooleanCondition(expression: Expression) {
		return NoImplicitTruthinessRule.isBooleanLikeType(expression.getType())
	}

	@Spec("Returns true when the type is boolean, a boolean literal, or a union of boolean members only.")
	@Out("booleanLike", "boolean")
	private static isBooleanLikeType(type: Type) {
		if (type.isBoolean() || type.isBooleanLiteral()) {
			return true
		}
		if (!type.isUnion()) {
			return false
		}
		const unionTypes = type.getUnionTypes()
		return unionTypes.length > 0 && unionTypes.every(unionType => unionType.isBoolean() || unionType.isBooleanLiteral())
	}
}
