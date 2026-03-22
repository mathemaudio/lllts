import type { NonNullExpression } from "ts-morph"
import { SyntaxKind } from "ts-morph"
import { BaseRule } from "../../core/BaseRule.lll"
import { Rule } from "../../core/rulesEngine/Rule"
import { Spec } from "../../public/lll.lll"

@Spec("Forbids postfix non-null assertions because they suppress unresolved nullability.")
export class NoNonNullAssertionRule {
	@Spec("Returns the rule configuration object.")
	public static getRule(): Rule {
		return {
			id: "R15",
			title: "No non-null assertion",
			run(sourceFile) {
				const filePath = sourceFile.getFilePath()
				if (!filePath.endsWith(".ts") || filePath.endsWith(".d.ts")) {
					return []
				}

				const diagnostics: import("../../core/DiagnosticObject").DiagnosticObject[] = []
				const nonNullExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.NonNullExpression)

				for (const nonNullExpression of nonNullExpressions) {
					diagnostics.push(
						BaseRule.createError(
							filePath,
							NoNonNullAssertionRule.buildMessage(nonNullExpression),
							"no-non-null-assertion",
							nonNullExpression.getStartLineNumber()
						)
					)
				}

				return diagnostics
			}
		}
	}

	@Spec("Builds a diagnostic message describing the banned non-null assertion.")
	private static buildMessage(nonNullExpression: NonNullExpression): string {
		const operandText = nonNullExpression.getExpression().getText()
		return `Non-null assertion '${operandText}!' is forbidden. Narrow the value with an explicit null check or redesign the type so the uncertainty is resolved.`
	}
}
