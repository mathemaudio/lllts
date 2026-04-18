import type { Node } from "ts-morph"
import { SyntaxKind } from "ts-morph"
import { BaseRule } from "../../../core/BaseRule.lll"
import { Rule } from "../../../core/rulesEngine/Rule"
import { Spec } from "../../../public/lll.lll"

@Spec("Forbids explicit any type usage anywhere in supported source files.")
export class NoAnyRule {
	@Spec("Returns the rule configuration object.")
	public static getRule(): Rule {
		return {
			id: "R14",
			title: "No any",
			run(sourceFile) {
				const filePath = sourceFile.getFilePath()
				if (!filePath.endsWith(".ts") || filePath.endsWith(".d.ts")) {
					return []
				}

				const diagnostics: import("../../../core/DiagnosticObject").DiagnosticObject[] = []
				const anyKeywords = sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword)

				for (const anyKeyword of anyKeywords) {
					diagnostics.push(
						BaseRule.createError(
							filePath,
							NoAnyRule.buildMessage(anyKeyword),
							"no-any",
							anyKeyword.getStartLineNumber()
						)
					)
				}

				return diagnostics
			}
		}
	}

	@Spec("Builds a diagnostic message that describes the explicit any usage shape.")
	private static buildMessage(anyKeyword: Node): string {
		const parentKind = anyKeyword.getParentOrThrow().getKind()
		const context = parentKind === SyntaxKind.TypeReference
			? "type reference"
			: parentKind === SyntaxKind.TypeAssertionExpression
				? "type assertion"
				: parentKind === SyntaxKind.AsExpression
					? "'as any' cast"
					: parentKind === SyntaxKind.Parameter
						? "parameter type"
						: parentKind === SyntaxKind.FunctionType
							? "function type"
							: parentKind === SyntaxKind.PropertyDeclaration
								? "property type"
								: parentKind === SyntaxKind.VariableDeclaration
									? "variable type"
									: parentKind === SyntaxKind.TypeAliasDeclaration
										? "type alias"
										: "type annotation"
		return `Explicit 'any' is forbidden in ${context}. Use a concrete type, a generic constraint, or 'unknown' with narrowing.`
	}
}
