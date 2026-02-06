import * as path from "path"
import * as fs from "fs"
import { Rule } from "../core/Rule"
import { DiagnosticObject } from "../core/DiagnosticObject"
import { BaseRule } from "../core/BaseRule.lll"
import { Spec, Out } from "../public/decorators.js"
import type { SourceFile, ClassDeclaration, MethodDeclaration } from "ts-morph"

const FILE_VARIANTS = [
	{ primarySuffix: ".lll.ts", usecaseSuffix: "_usecase.lll.ts" },
	{ primarySuffix: ".ts", usecaseSuffix: "_usecase.ts" }
] as const
type FileVariant = (typeof FILE_VARIANTS)[number]
type VariantMatch = { variant: FileVariant; isUsecase: boolean }

@Spec("Enforces dedicated `_usecase` companion classes with a single view renderer and @Scenario methods.")

export class MustHaveUsecaseRule {
	@Spec("Returns the rule configuration object.")

	@Out("rule", "Rule")
	public static getRule(): Rule {
		return {
			id: "R4",
			title: "Must have usecase companion",
			run(sourceFile) {
				const exportedClass = BaseRule.getExportedClass(sourceFile)
				if (!exportedClass) return []

				const filePath = sourceFile.getFilePath()
				const variantMatch = MustHaveUsecaseRule.getVariantForFile(filePath)
				if (!variantMatch) {
					return []
				}

				if (variantMatch.isUsecase) {
					return MustHaveUsecaseRule.validateUsecaseClass(sourceFile, exportedClass)
				}

				return MustHaveUsecaseRule.validatePrimaryClass(sourceFile, exportedClass)
			}
		}
	}

	@Spec("Ensures production classes point to valid `_usecase` companions.")

	@Out("diagnostics", "DiagnosticObject[]")
	private static validatePrimaryClass(sourceFile: SourceFile, exportedClass: ClassDeclaration) {
		const diagnostics: DiagnosticObject[] = []
		const file = sourceFile.getFilePath()
		const className = exportedClass.getName()

		const illegalScenarios = exportedClass.getMethods().filter(method =>
			method.isStatic() && BaseRule.hasDecorator(method, "Scenario")
		)

		for (const method of illegalScenarios) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Scenario method '${method.getName()}' must live in the companion *_usecase class, not inside the primary class.`,
					"missing-usecase",
					method.getStartLineNumber()
				)
			)
		}
		return diagnostics
	}

	@Spec("Verifies `_usecase` companions expose view() and @Scenario methods.")

	@Out("diagnostics", "DiagnosticObject[]")
	private static validateUsecaseClass(sourceFile: SourceFile, exportedClass: ClassDeclaration) {
		const diagnostics: DiagnosticObject[] = []
		const file = sourceFile.getFilePath()
		const className = exportedClass.getName() ?? "(anonymous)"

		if (!className.endsWith("_usecase")) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Usecase companion classes must be suffixed with '_usecase'. Found '${className}'.`,
					"missing-usecase",
					exportedClass.getStartLineNumber()
				)
			)
		}

		const environment = MustHaveUsecaseRule.validateEnvironment(exportedClass, diagnostics, file, className)

		const viewMethod = exportedClass.getStaticMethod("view")
		if (environment === "browser") {
			if (!viewMethod) {
				diagnostics.push(
					BaseRule.createError(
						file,
						`Companion class '${className}' must declare a static async view(): Promise<string> renderer for browser environment.`,
						"missing-usecase",
						exportedClass.getStartLineNumber()
					)
				)
			} else {
				if (!viewMethod.isAsync()) {
					diagnostics.push(
						BaseRule.createError(
							file,
							`Method '${className}.view' must be async.`,
							"missing-usecase",
							viewMethod.getStartLineNumber()
						)
					)
				}

				if (viewMethod.getParameters().length !== 0) {
					diagnostics.push(
						BaseRule.createError(
							file,
							`Method '${className}.view' must not accept parameters.`,
							"missing-usecase",
							viewMethod.getStartLineNumber()
						)
					)
				}

				const returnType = viewMethod.getReturnType()
				if (!returnType.getText().includes("string")) {
					diagnostics.push(
						BaseRule.createError(
							file,
							`Method '${className}.view' must return a string or Promise<string>.`,
							"missing-usecase",
							viewMethod.getStartLineNumber()
						)
					)
				}
			}
		} else if (environment === "api") {
			if (viewMethod) {
				diagnostics.push(
					BaseRule.createError(
						file,
						`Companion class '${className}' must not declare view() when environment is 'api'.`,
						"bad-environment",
						viewMethod.getStartLineNumber()
					)
				)
			}
		} else {
			// If environment could not be validated, we still check for a view and warn if missing to keep previous coverage.
			if (!viewMethod) {
				diagnostics.push(
					BaseRule.createError(
						file,
						`Companion class '${className}' must declare a static async view(): Promise<string> renderer.`,
						"missing-usecase",
						exportedClass.getStartLineNumber()
					)
				)
			}
		}

		const scenarioMethods = MustHaveUsecaseRule.getScenarioMethods(exportedClass)
		if (scenarioMethods.length === 0) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Companion class '${className}' must declare at least lll static @Scenario method.`,
					"missing-usecase",
					exportedClass.getStartLineNumber()
				)
			)
			return diagnostics
		}

		for (const method of scenarioMethods) {
			if (!method.method.isAsync()) {
				diagnostics.push(
					BaseRule.createError(
						file,
						`Scenario method '${method.method.getName()}' must be async.`,
						"missing-usecase",
						method.method.getStartLineNumber()
					)
				)
			}
		}

		return diagnostics
	}

	@Spec("Ensures usecase declares an explicit environment literal.")
	@Out("environment", "'api' | 'browser' | null")
	private static validateEnvironment(
		exportedClass: ClassDeclaration,
		diagnostics: DiagnosticObject[],
		file: string,
		className: string
	): "api" | "browser" | null {
		const environmentProp = exportedClass.getProperties().find(prop =>
			!prop.isStatic() && prop.getName() === "environment"
		)

		if (!environmentProp) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Companion class '${className}' must declare an 'environment' property set to 'api' or 'browser'.`,
					"missing-environment",
					exportedClass.getStartLineNumber()
				)
			)
			return null
		}

		const init = environmentProp.getInitializer()
		const text = init?.getText().trim()
		const match = text ? /^['"`](api|browser)['"`]$/.exec(text) : null
		const env = match?.[1] as "api" | "browser" | undefined

		if (!env) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Property '${className}.environment' must be initialized to the literal 'api' or 'browser'.`,
					"bad-environment",
					environmentProp.getStartLineNumber()
				)
			)
		}

		return env ?? null
	}

	@Spec("Builds the companion file path from the primary file.")

	@Out("companionPath", "string | null")
	private static getCompanionFilePath(filePath: string, className?: string) {
		const variantMatch = MustHaveUsecaseRule.getVariantForFile(filePath)
		if (!variantMatch || variantMatch.isUsecase) {
			return null
		}
		const parsed = path.parse(filePath)
		const baseName =
			className ??
			(parsed.name.endsWith(".lll") ? parsed.name.slice(0, -".lll".length) : parsed.name)

		return path.join(parsed.dir, `${baseName}_usecase${variantMatch.variant.primarySuffix}`)
	}

	@Spec("Determines if a file is a supported primary or `_usecase` companion variant.")

	@Out("variantMatch", "VariantMatch | null")
	private static getVariantForFile(filePath: string): VariantMatch | null {
		for (const variant of FILE_VARIANTS) {
			if (filePath.endsWith(variant.usecaseSuffix)) {
				return { variant, isUsecase: true }
			}

			if (filePath.endsWith(variant.primarySuffix)) {
				if (variant.primarySuffix === ".ts" && filePath.endsWith(".d.ts")) {
					continue
				}

				return { variant, isUsecase: false }
			}
		}

		return null
	}

	@Spec("Returns static methods decorated with @Scenario.")

	@Out("scenarioMethods", "Array<{ method: MethodDeclaration }>")
	private static getScenarioMethods(classDecl: ClassDeclaration) {
		return classDecl.getMethods()
			.filter(method => method.isStatic() && BaseRule.hasDecorator(method, "Scenario"))
			.map(method => ({ method }))
	}
}
