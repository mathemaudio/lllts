import { Rule } from "../core/Rule"
import { BaseRule } from "../core/BaseRule.lll"
import { FileVariantSupport } from "../core/FileVariantSupport.lll"
import { DiagnosticObject } from "../core/DiagnosticObject"
import { Out } from "../public/lll.lll"
import { Spec } from "../public/lll.lll"

@Spec("Enforces a maximum method body length in lines for all methods in LLLTS classes.")
export class MaxMethodLengthRule {
	static readonly MAX_LINES = 200

	@Spec("Returns the rule configuration object.")
	@Out("rule", "Rule")
	public static getRule(): Rule {
		return {
			id: "R8",
			title: "Max method length",
			run(sourceFile) {
				const filePath = sourceFile.getFilePath()

				// Only apply to .lll.ts files
				if (!filePath.endsWith(".lll.ts")) {
					return []
				}

				// Skip test files
				const variant = FileVariantSupport.getVariantForFile(filePath)
				if (variant && variant.isTest) {
					return []
				}

				const diagnostics: DiagnosticObject[] = []

				// Get all classes in the file
				const classes = sourceFile.getClasses()

				classes.forEach((classDecl) => {
					// Get all methods in the class
					const methods = classDecl.getMethods()

					methods.forEach((method) => {
						// Get the method body
						const body = method.getBody()

						if (body) {
							// Count lines in the method body
							const lineCount = body.getEndLineNumber() - body.getStartLineNumber() + 1

							if (lineCount > MaxMethodLengthRule.MAX_LINES) {
								diagnostics.push(
									BaseRule.createError(
										filePath,
										`Method '${method.getName()}' has ${lineCount} lines (max allowed: ${MaxMethodLengthRule.MAX_LINES}).`,
										"method-too-long",
										body.getStartLineNumber()
									)
								)
							}
						}
					})
				})

				return diagnostics
			}
		}
	}
}