
import { DiagnosticObject } from "../core/DiagnosticObject"
import { Rule } from "../core/Rule"
import { BaseRule } from "../core/BaseRule.lll"
import { Out } from "../public/lll.lll"
import { Spec } from "../public/lll.lll"

@Spec("Verifies that each class has a description in @Spec decorator.")

export class MustHaveDescRule {
	@Spec("Returns the rule configuration object.")

	@Out("rule", "Rule")
	public static getRule(): Rule {
		return {
			id: "R3",
			title: "Must have description in spec",
			run(sourceFile) {
				const exportedClass = BaseRule.getExportedClass(sourceFile)
				if (!exportedClass) return []

				const diagnostics: DiagnosticObject[] = []

				// Check class-level Spec decorator
				const classSpecDecorator = BaseRule.findDecorator(exportedClass, "Spec")
					if (classSpecDecorator !== undefined) {
						const args = classSpecDecorator.getArguments()
						const hasDescription = args.length >= 1 && args[0] !== undefined && args[0].getText().trim().length > 0

					if (!hasDescription) {
						diagnostics.push(
							BaseRule.createError(
								sourceFile.getFilePath(),
								"Missing description in class @Spec decorator. Provide a description string for @Spec.",
								"missing-desc-class"
							)
						)
					}
				}

				// Check method-level Spec decorators
				const methods = exportedClass.getMethods()
				for (const method of methods) {
					const methodSpecDecorator = BaseRule.findDecorator(method, "Spec")
						if (methodSpecDecorator !== undefined) {
							const args = methodSpecDecorator.getArguments()
							const hasDescription = args.length >= 1 && args[0] !== undefined && args[0].getText().trim().length > 0

						if (!hasDescription) {
							diagnostics.push(
								BaseRule.createError(
									sourceFile.getFilePath(),
									`Missing description in method @Spec decorator for '${method.getName()}'. Provide a description string for @Spec.`,
									"missing-desc-method",
									method.getStartLineNumber()
								)
							)
						}
					}
				}

				return diagnostics
			}
		}
	}
}
