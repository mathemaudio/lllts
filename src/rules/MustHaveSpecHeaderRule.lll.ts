
import { Rule } from "../core/Rule"
import { BaseRule } from "../core/BaseRule.lll"
import { DiagnosticObject } from "../core/DiagnosticObject"
import { Out } from "../public/lll"
import { Spec } from "../public/lll"

@Spec("Verifies that each class and method has a @Spec decorator.")

export class MustHaveSpecHeaderRule {
	@Spec("Returns the rule configuration object.")

	@Out("rule", "Rule")
	public static getRule(): Rule {
		return {
			id: "R2",
			title: "Must have spec decorator",
			run(sourceFile) {
				const exportedClass = BaseRule.getExportedClass(sourceFile)
				if (!exportedClass) return []

				const diagnostics: DiagnosticObject[] = []

				// Check class-level @Spec decorator
				const hasClassSpec = BaseRule.hasDecorator(exportedClass, "Spec")
				if (!hasClassSpec) {
					diagnostics.push(
						BaseRule.createError(
							sourceFile.getFilePath(),
							"Missing @Spec decorator on class. @Spec expects lll string parameter: description.",
							"missing-spec-class"
						)
					)
				}

				// Check method-level @Spec decorators
				const methods = exportedClass.getMethods()
				const className = exportedClass.getName()
				const isUsecaseClass = !!className && className.endsWith("_usecase")

				for (const method of methods) {
					const methodName = method.getName()
					const isRenderMethod = typeof method.isStatic === "function" && !method.isStatic() && methodName === "render"

					if (isUsecaseClass && isRenderMethod) {
						continue
					}

					const hasMethodSpec = BaseRule.hasDecorator(method, "Spec")
					const hasScenarioDecorator = BaseRule.hasDecorator(method, "Scenario")
					if (!hasMethodSpec && !hasScenarioDecorator) {
						diagnostics.push(
							BaseRule.createError(
								sourceFile.getFilePath(),
								`Missing @Spec decorator on method '${methodName}'. @Spec expects lll parameter description.`,
								"missing-spec-method",
								method.getStartLineNumber()
							)
						)
					}
				}

				return diagnostics
			}
		}
	}
}
