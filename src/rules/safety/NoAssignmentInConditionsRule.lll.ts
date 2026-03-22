import type { BinaryExpression, ConditionalExpression, DoStatement, Expression, IfStatement, SourceFile, WhileStatement } from "ts-morph"
import { Node, SyntaxKind } from "ts-morph"
import { BaseRule } from "../../core/BaseRule.lll"
import { Rule } from "../../core/rulesEngine/Rule"
import { Spec } from "../../public/lll.lll"

@Spec("Forbids assignment expressions anywhere inside supported condition expressions.")
export class NoAssignmentInConditionsRule {
	private static readonly condition_kind_values = ["if", "while", "do while", "for", "ternary"] as const

	@Spec("Returns the rule configuration object.")
	public static getRule(): Rule {
		return {
			id: "R10",
			title: "No assignments inside conditions",
			run(sourceFile) {
				const filePath = sourceFile.getFilePath()
				if (!filePath.endsWith(".ts") || filePath.endsWith(".d.ts")) {
					return []
				}

				const diagnostics: import("../../core/DiagnosticObject").DiagnosticObject[] = []
				const conditionContexts = NoAssignmentInConditionsRule.collectConditionContexts(sourceFile)

				for (const conditionContext of conditionContexts) {
					const assignments = NoAssignmentInConditionsRule.findAssignmentsInCondition(conditionContext.expression)
					for (const assignment of assignments) {
						const operator = assignment.getOperatorToken().getText()
						diagnostics.push(
							BaseRule.createError(
								filePath,
								`Assignments are forbidden inside ${conditionContext.kind} conditions. Found '${operator}'. Move the assignment before the condition and keep the condition as a pure boolean check.`,
								"assignment-in-conditions",
								assignment.getStartLineNumber()
							)
						)
					}
				}

				return diagnostics
			}
		}
	}

	@Spec("Collects condition expressions from supported control-flow and ternary positions.")
	private static collectConditionContexts(sourceFile: SourceFile): Array<{
		kind: (typeof NoAssignmentInConditionsRule.condition_kind_values)[number]
		expression: Expression
	}> {
		const conditions: Array<{
			kind: (typeof NoAssignmentInConditionsRule.condition_kind_values)[number]
			expression: Expression
		}> = []

		for (const ifStatement of sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement)) {
			conditions.push(NoAssignmentInConditionsRule.createConditionContext("if", ifStatement))
		}

		for (const whileStatement of sourceFile.getDescendantsOfKind(SyntaxKind.WhileStatement)) {
			conditions.push(NoAssignmentInConditionsRule.createConditionContext("while", whileStatement))
		}

		for (const doStatement of sourceFile.getDescendantsOfKind(SyntaxKind.DoStatement)) {
			conditions.push(NoAssignmentInConditionsRule.createConditionContext("do while", doStatement))
		}

		for (const forStatement of sourceFile.getDescendantsOfKind(SyntaxKind.ForStatement)) {
			const expression = forStatement.getCondition()
			if (expression !== undefined) {
				conditions.push({ kind: "for", expression })
			}
		}

		for (const conditionalExpression of sourceFile.getDescendantsOfKind(SyntaxKind.ConditionalExpression)) {
			conditions.push(NoAssignmentInConditionsRule.createConditionContext("ternary", conditionalExpression))
		}

		return conditions
	}

	@Spec("Builds a condition context from a supported condition-bearing node.")
	private static createConditionContext(
		kind: (typeof NoAssignmentInConditionsRule.condition_kind_values)[number],
		node: IfStatement | WhileStatement | DoStatement | ConditionalExpression
	): {
		kind: (typeof NoAssignmentInConditionsRule.condition_kind_values)[number]
		expression: Expression
	} {
		const expression = Node.isConditionalExpression(node) ? node.getCondition() : node.getExpression()
		return {
			kind,
			expression
		}
	}

	@Spec("Returns assignment binary expressions contained in the condition subtree.")
	private static findAssignmentsInCondition(condition: Expression): BinaryExpression[] {
		const binaryExpressions = NoAssignmentInConditionsRule.collectBinaryExpressions(condition)
		return binaryExpressions.filter(binaryExpression => {
			const operatorKind = binaryExpression.getOperatorToken().getKind()
			return NoAssignmentInConditionsRule.isAssignmentOperator(operatorKind)
		})
	}

	@Spec("Collects the current expression when binary plus all nested binary expressions.")
	private static collectBinaryExpressions(expression: Expression): BinaryExpression[] {
		const binaryExpressions: BinaryExpression[] = []
		if (Node.isBinaryExpression(expression)) {
			binaryExpressions.push(expression)
		}
		binaryExpressions.push(...expression.getDescendantsOfKind(SyntaxKind.BinaryExpression))
		return binaryExpressions
	}

	@Spec("Checks whether a binary operator token is an assignment operator.")
	private static isAssignmentOperator(kind: SyntaxKind): boolean {
		return kind === SyntaxKind.EqualsToken
			|| kind === SyntaxKind.PlusEqualsToken
			|| kind === SyntaxKind.MinusEqualsToken
			|| kind === SyntaxKind.AsteriskEqualsToken
			|| kind === SyntaxKind.AsteriskAsteriskEqualsToken
			|| kind === SyntaxKind.SlashEqualsToken
			|| kind === SyntaxKind.PercentEqualsToken
			|| kind === SyntaxKind.LessThanLessThanEqualsToken
			|| kind === SyntaxKind.GreaterThanGreaterThanEqualsToken
			|| kind === SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken
			|| kind === SyntaxKind.AmpersandEqualsToken
			|| kind === SyntaxKind.BarEqualsToken
			|| kind === SyntaxKind.CaretEqualsToken
			|| kind === SyntaxKind.BarBarEqualsToken
			|| kind === SyntaxKind.AmpersandAmpersandEqualsToken
			|| kind === SyntaxKind.QuestionQuestionEqualsToken
	}
}
