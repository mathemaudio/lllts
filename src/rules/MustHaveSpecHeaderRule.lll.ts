
import { Rule } from "../core/Rule"
import { BaseRule } from "../core/BaseRule.lll"
import { DiagnosticObject } from "../core/DiagnosticObject"
import { Out } from "../public/lll.lll"
import { Spec } from "../public/lll.lll"
import { Node } from "ts-morph"

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
				const isTestFile = sourceFile.getFilePath().endsWith(".test.lll.ts")
				const constructorDeclaration = exportedClass.getConstructors()[0]

				if (constructorDeclaration) {
					const body = constructorDeclaration.getBody()
					const statements = body && Node.isBlock(body) ? body.getStatements() : []
					const firstStatement = statements[0]
					const hasParameters = constructorDeclaration.getParameters().length > 0
					const hasBodyStatements = statements.length > 0
					const requiresConstructorSpec = hasParameters || hasBodyStatements
					let hasLeadingSpecCall = false

					if (firstStatement && Node.isExpressionStatement(firstStatement)) {
						const expression = firstStatement.getExpression()
						if (Node.isCallExpression(expression)) {
							const callee = expression.getExpression()
							hasLeadingSpecCall = Node.isIdentifier(callee) && ["Spec", "spec"].includes(callee.getText())
						}
					}

					if (requiresConstructorSpec && !hasLeadingSpecCall) {
						diagnostics.push(
							BaseRule.createError(
								sourceFile.getFilePath(),
								"Constructor must call Spec(\"...\") as its first statement when it has parameters or executable body statements. All other methods must use @Spec as a decorator, but constructor is an exception.",
								"missing-spec-method",
								constructorDeclaration.getStartLineNumber()
							)
						)
					}
				}

				for (const method of methods) {
					const methodName = method.getName()
					const isRenderMethod = typeof method.isStatic === "function" && !method.isStatic() && methodName === "render"

					if (isTestFile && isRenderMethod) {
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
