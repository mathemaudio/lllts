import { Rule } from "../core/Rule"
import { BaseRule } from "../core/BaseRule.lll"
import { Out } from "../public/lll.lll"
import { Spec } from "../public/lll.lll"
import { Node, SyntaxKind } from "ts-morph"
import type { BinaryExpression, ConditionalExpression, DoStatement, Expression, ForStatement, IfStatement, SourceFile, WhileStatement } from "ts-morph"

@Spec("Forbids assignment expressions anywhere inside supported condition expressions.")
export class NoAssignmentInConditionsRule {
	@Spec("Returns the rule configuration object.")
	@Out("rule", "Rule")
	public static getRule(): Rule {
		return {
			id: "R10",
			title: "No assignments inside conditions",
			run(sourceFile) {
				const filePath = sourceFile.getFilePath()
				if (!filePath.endsWith(".ts") || filePath.endsWith(".d.ts")) {
					return []
				}

				const diagnostics: import("../core/DiagnosticObject").DiagnosticObject[] = []
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
	@Out("conditions", "object[]")
	private static collectConditionContexts(sourceFile: SourceFile) {
		const conditions: Array<{
			kind: "if" | "while" | "do while" | "for" | "ternary"
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

	@Spec("Returns assignment binary expressions contained in the condition subtree.")
	@Out("assignments", "BinaryExpression[]")
	private static findAssignmentsInCondition(condition: Expression) {
		const binaryExpressions = NoAssignmentInConditionsRule.collectBinaryExpressions(condition)
		return binaryExpressions.filter(binaryExpression => {
			const operatorKind = binaryExpression.getOperatorToken().getKind()
			return NoAssignmentInConditionsRule.isAssignmentOperator(operatorKind)
		})
	}

	@Spec("Collects the current expression when binary plus all nested binary expressions.")
	@Out("binaryExpressions", "BinaryExpression[]")
	private static collectBinaryExpressions(expression: Expression) {
		const binaryExpressions: BinaryExpression[] = []
		if (Node.isBinaryExpression(expression)) {
			binaryExpressions.push(expression)
		}
		binaryExpressions.push(...expression.getDescendantsOfKind(SyntaxKind.BinaryExpression))
		return binaryExpressions
	}

	@Spec("Checks whether a binary operator token is an assignment operator.")
	@Out("assignmentOperator", "boolean")
	private static isAssignmentOperator(kind: SyntaxKind) {
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
