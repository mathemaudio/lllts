import { Rule } from "../core/rulesEngine/Rule"
import { BaseRule } from "../core/BaseRule.lll"
import { Out } from "../public/lll.lll"
import { Spec } from "../public/lll.lll"
import { SyntaxKind } from "ts-morph"
import type { BinaryExpression, SourceFile } from "ts-morph"

@Spec("Forbids loose equality operators anywhere in supported source files.")
export class NoLooseEqualityRule {
	@Spec("Returns the rule configuration object.")
	@Out("rule", "Rule")
	public static getRule(): Rule {
		return {
			id: "R11",
			title: "No loose equality",
			run(sourceFile) {
				const filePath = sourceFile.getFilePath()
				if (!filePath.endsWith(".ts") || filePath.endsWith(".d.ts")) {
					return []
				}

				const diagnostics: import("../core/DiagnosticObject").DiagnosticObject[] = []
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
	@Out("looseEquality", "boolean")
	private static isLooseEquality(binaryExpression: BinaryExpression) {
		const operatorKind = binaryExpression.getOperatorToken().getKind()
		return operatorKind === SyntaxKind.EqualsEqualsToken
			|| operatorKind === SyntaxKind.ExclamationEqualsToken
	}
}
