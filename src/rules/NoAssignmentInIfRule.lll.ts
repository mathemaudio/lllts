import { Rule } from "../core/Rule"
import { BaseRule } from "../core/BaseRule.lll"
import { Out } from "../public/lll.lll"
import { Spec } from "../public/lll.lll"
import { Node, SyntaxKind } from "ts-morph"
import type { BinaryExpression, Expression, IfStatement } from "ts-morph"

@Spec("Forbids assignment expressions anywhere inside if conditions.")
export class NoAssignmentInIfRule {
	@Spec("Returns the rule configuration object.")
	@Out("rule", "Rule")
	public static getRule(): Rule {
		return {
			id: "R10",
			title: "No assignments inside if conditions",
			run(sourceFile) {
				const filePath = sourceFile.getFilePath()
				if (!filePath.endsWith(".ts") || filePath.endsWith(".d.ts")) {
					return []
				}

				const diagnostics: import("../core/DiagnosticObject").DiagnosticObject[] = []
				const ifStatements = sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement)

				for (const ifStatement of ifStatements) {
					const assignments = NoAssignmentInIfRule.findAssignmentsInCondition(ifStatement)
					for (const assignment of assignments) {
						const operator = assignment.getOperatorToken().getText()
						diagnostics.push(
							BaseRule.createError(
								filePath,
								`Assignments are forbidden inside if conditions. Found '${operator}'. Move the assignment before the if and keep the condition as a pure boolean check.`,
								"assignment-in-if",
								assignment.getStartLineNumber()
							)
						)
					}
				}

				return diagnostics
			}
		}
	}

	@Spec("Returns assignment binary expressions contained in the if condition subtree.")
	@Out("assignments", "BinaryExpression[]")
	private static findAssignmentsInCondition(ifStatement: IfStatement) {
		const condition = ifStatement.getExpression()
		const binaryExpressions = NoAssignmentInIfRule.collectBinaryExpressions(condition)
		return binaryExpressions.filter(binaryExpression => {
			const operatorKind = binaryExpression.getOperatorToken().getKind()
			return NoAssignmentInIfRule.isAssignmentOperator(operatorKind)
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
