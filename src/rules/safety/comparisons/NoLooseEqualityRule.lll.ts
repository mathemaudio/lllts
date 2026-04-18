import type { BinaryExpression } from "ts-morph"
import { SyntaxKind } from "ts-morph"
import { BaseRule } from "../../../core/BaseRule.lll"
import { Rule } from "../../../core/rulesEngine/Rule"
import { Spec } from "../../../public/lll.lll"

@Spec("Forbids loose equality operators anywhere in supported source files.")
export class NoLooseEqualityRule {
	@Spec("Returns the rule configuration object.")
	public static getRule(): Rule {
		return {
			id: "R11",
			title: "No loose equality",
			run(sourceFile) {
				const filePath = sourceFile.getFilePath()
				if (!filePath.endsWith(".ts") || filePath.endsWith(".d.ts")) {
					return []
				}

				const diagnostics: import("../../../core/DiagnosticObject").DiagnosticObject[] = []
				const binaryExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)

				for (const binaryExpression of binaryExpressions) {
					if (!NoLooseEqualityRule.isLooseEquality(binaryExpression)) {
						continue
					}
					const operator = binaryExpression.getOperatorToken().getText()
					diagnostics.push(
						BaseRule.createError(
							filePath,
							`Loose equality is forbidden. Found '${operator}'. Use '===' or '!==' and compare against the intended value explicitly.`,
							"no-loose-equality",
							binaryExpression.getStartLineNumber()
						)
					)
				}

				return diagnostics
			}
		}
	}

	@Spec("Checks whether a binary expression uses a loose equality operator.")
	private static isLooseEquality(binaryExpression: BinaryExpression): boolean {
		const operatorKind = binaryExpression.getOperatorToken().getKind()
		return operatorKind === SyntaxKind.EqualsEqualsToken
			|| operatorKind === SyntaxKind.ExclamationEqualsToken
	}
}
