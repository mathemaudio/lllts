import * as path from "path"
import type { ClassDeclaration, MethodDeclaration, SourceFile } from "ts-morph"
import { BaseRule } from "../../core/BaseRule.lll"
import { DiagnosticObject } from "../../core/DiagnosticObject"
import { FileVariantSupport } from "../../core/variants/FileVariantSupport.lll"
import { Rule } from "../../core/rulesEngine/Rule"
import { PairedHostSupport } from "../../core/testing/paired/PairedHostSupport.lll"
import type { TestType } from "../../core/testing/TestType"
import { Spec } from "../../public/lll.lll"

@Spec("Enforces dedicated '.test.lll.ts' and '.test2.lll.ts' test classes with valid structure and boundaries.")
export class MustHaveTestRule {
	@Spec("Returns the rule configuration object.")
	public static getRule(): Rule {
		return {
			id: "R4",
			title: "Must have test companion",
			run(sourceFile) {
				const filePath = sourceFile.getFilePath()
				const variantMatch = MustHaveTestRule.getVariantForFile(filePath)
				if (!variantMatch) {
					return []
				}

				if (variantMatch.isTest) {
					const exportedClass = BaseRule.getExportedClass(sourceFile)
					if (!exportedClass) {
						return MustHaveTestRule.validateMissingExportedTestClass(sourceFile)
					}
					return MustHaveTestRule.validateTestClass(sourceFile, exportedClass)
				}

				const exportedClass = BaseRule.getExportedClass(sourceFile)
				if (!exportedClass) return []

				return MustHaveTestRule.validatePrimaryClass(sourceFile, exportedClass)
			}
		}
	}

	@Spec("Ensures production classes keep scenarios in test files and do not import tests.")
	private static validatePrimaryClass(sourceFile: SourceFile, exportedClass: ClassDeclaration): DiagnosticObject[] {
		const diagnostics: DiagnosticObject[] = []
		const file = sourceFile.getFilePath()

		const illegalScenarios = exportedClass.getMethods().filter(method =>
			method.isStatic() && BaseRule.hasDecorator(method, "Scenario")
		)

		for (const method of illegalScenarios) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Scenario method '${method.getName()}' must live in a '.test.lll.ts' or '.test2.lll.ts' companion, not inside production class code.`,
					"missing-test",
					method.getStartLineNumber()
				)
			)
		}

		for (const importDecl of sourceFile.getImportDeclarations()) {
			const specifier = importDecl.getModuleSpecifierValue()
			const targetFile = importDecl.getModuleSpecifierSourceFile()?.getFilePath()
			const importsTestFile =
				specifier.includes(".test.lll")
				|| specifier.includes(".test2.lll")
				|| (targetFile !== undefined && FileVariantSupport.isTestFilePath(targetFile))
			if (!importsTestFile) {
				continue
			}

			diagnostics.push(
				BaseRule.createError(
					file,
					`Production file must not import test module '${specifier}'.`,
					"test-import-boundary",
					importDecl.getStartLineNumber()
				)
			)
		}

		return diagnostics
	}

	@Spec("Verifies test files use '<Base>Test' naming, valid testType, plain companion rules, host side-effect import, and scenario contract.")
	private static validateTestClass(sourceFile: SourceFile, exportedClass: ClassDeclaration): DiagnosticObject[] {
		const diagnostics: DiagnosticObject[] = []
		const file = sourceFile.getFilePath()
		const className = exportedClass.getName() ?? "(anonymous)"
		const expectedHostName = PairedHostSupport.getHostClassName(file) ?? MustHaveTestRule.getExpectedHostClassName(file)
		const expectedTestClassName = FileVariantSupport.getExpectedTestClassName(file) ?? `${expectedHostName}Test`

		if (className !== expectedTestClassName) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Test file must export class '${expectedTestClassName}'. Found '${className}'.`,
					"missing-test",
					exportedClass.getStartLineNumber()
				)
			)
		}

		MustHaveTestRule.validateTestType(exportedClass, diagnostics, file, className)
		MustHaveTestRule.validatePlainCompanionRestrictions(exportedClass, diagnostics, file, className)

		MustHaveTestRule.validateHostSideEffectImport(sourceFile, diagnostics, expectedHostName)

		const scenarioMethods = MustHaveTestRule.getScenarioMethods(exportedClass)
		if (scenarioMethods.length === 0) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Test class '${className}' must declare at least one static @Scenario method.`,
					"missing-test",
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
						"missing-test",
						method.method.getStartLineNumber()
					)
				)
			}
			MustHaveTestRule.validateScenarioSignature(sourceFile, method.method, diagnostics, file, className)
		}

		return diagnostics
	}

	@Spec("Requires scenario methods to use the paired-host scenario contract.")
	private static validateScenarioSignature(
		sourceFile: SourceFile,
		method: MethodDeclaration,
		diagnostics: DiagnosticObject[],
		file: string,
		className: string
	) {
		const hostKind = PairedHostSupport.getHostKind(sourceFile)
		const parameters = method.getParameters()
		if (hostKind === "static-only") {
			if (parameters.length !== 1) {
				diagnostics.push(
					BaseRule.createError(
						file,
						`Scenario method '${className}.${method.getName()}' must declare exactly one parameter for static-only host '${PairedHostSupport.getHostClassName(file) ?? "Host"}': (scenario: ScenarioParameter).`,
						"missing-test",
						method.getStartLineNumber()
					)
				)
				return
			}

			const [scenarioParam] = parameters
			const scenarioType = scenarioParam.getTypeNode()?.getText().trim() ?? ""
			if (scenarioParam.getName() !== "scenario" || scenarioType !== "ScenarioParameter") {
				diagnostics.push(
					BaseRule.createError(
						file,
						`Scenario method '${className}.${method.getName()}' must declare parameters exactly as (scenario: ScenarioParameter) for static-only host '${PairedHostSupport.getHostClassName(file) ?? "Host"}'.`,
						"missing-test",
						method.getStartLineNumber()
					)
				)
			}
			return
		}

		if (parameters.length !== 2) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Scenario method '${className}.${method.getName()}' must declare exactly two parameters for instantiable host '${PairedHostSupport.getHostClassName(file) ?? "Host"}': (subjectFactory: SubjectFactory<Subject>, scenario: ScenarioParameter).`,
					"missing-test",
					method.getStartLineNumber()
				)
			)
			return
		}

		const [subjectFactoryParam, scenarioParam] = parameters
		const subjectFactoryType = subjectFactoryParam.getTypeNode()?.getText().trim() ?? ""
		const scenarioType = scenarioParam.getTypeNode()?.getText().trim() ?? ""
		const hasValidContract =
			subjectFactoryParam.getName() === "subjectFactory"
			&& MustHaveTestRule.isValidSubjectFactoryType(subjectFactoryType)
			&& scenarioParam.getName() === "scenario"
			&& scenarioType === "ScenarioParameter"

		if (!hasValidContract) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Scenario method '${className}.${method.getName()}' must declare parameters exactly as (subjectFactory: SubjectFactory<Subject>, scenario: ScenarioParameter) for instantiable host '${PairedHostSupport.getHostClassName(file) ?? "Host"}'.`,
					"missing-test",
					method.getStartLineNumber()
				)
			)
		}
	}

	@Spec("Rejects test companion files that fail to export a class at all.")
	private static validateMissingExportedTestClass(sourceFile: SourceFile): DiagnosticObject[] {
		const file = sourceFile.getFilePath()
		const expectedTestClassName = FileVariantSupport.getExpectedTestClassName(file) ?? "(unknown)"
		return [
			BaseRule.createError(
				file,
				`Test file must export class '${expectedTestClassName}'. No exported class was found.`,
				"missing-test",
				sourceFile.getStartLineNumber()
			)
		]
	}

	@Spec("Rejects component-style companion behaviors so companions remain plain orchestration classes.")
	private static validatePlainCompanionRestrictions(
		exportedClass: ClassDeclaration,
		diagnostics: DiagnosticObject[],
		file: string,
		className: string
	) {
		const extendsClause = exportedClass.getExtends()
		if (extendsClause !== undefined) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Test companion class '${className}' must not extend any base class.`,
					"missing-test",
					extendsClause.getStartLineNumber()
				)
			)
		}

		const stylesProp = exportedClass.getStaticProperty("styles")
		if (stylesProp !== undefined) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Test companion class '${className}' must not declare static styles.`,
					"missing-test",
					stylesProp.getStartLineNumber()
				)
			)
		}

		const renderMethod = exportedClass.getInstanceMethod("render")
		const staticRenderMethod = exportedClass.getStaticMethod("render")
		const forbiddenRenderMethod = renderMethod ?? staticRenderMethod
		if (forbiddenRenderMethod !== undefined) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Test companion class '${className}' must not declare render().`,
					"missing-test",
					forbiddenRenderMethod.getStartLineNumber()
				)
			)
		}

		const connectedCallback = exportedClass.getInstanceMethod("connectedCallback") ?? exportedClass.getStaticMethod("connectedCallback")
		if (connectedCallback !== undefined) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Test companion class '${className}' must not declare connectedCallback().`,
					"missing-test",
					connectedCallback.getStartLineNumber()
				)
			)
		}

		const disconnectedCallback = exportedClass.getInstanceMethod("disconnectedCallback") ?? exportedClass.getStaticMethod("disconnectedCallback")
		if (disconnectedCallback !== undefined) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Test companion class '${className}' must not declare disconnectedCallback().`,
					"missing-test",
					disconnectedCallback.getStartLineNumber()
				)
			)
		}

		const customElementDecorator = BaseRule.findDecorator(exportedClass, "customElement")
		if (customElementDecorator !== undefined) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Test companion class '${className}' must not use @customElement(...).`,
					"missing-test",
					customElementDecorator.getStartLineNumber()
				)
			)
		}
	}

	@Spec("Ensures testType literal is present on test classes.")
	private static validateTestType(
		exportedClass: ClassDeclaration,
		diagnostics: DiagnosticObject[],
		file: string,
		className: string
	): TestType | null {
		const testTypeProp = exportedClass.getProperties().find(prop =>
			!prop.isStatic() && prop.getName() === "testType"
		)

		if (!testTypeProp) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Test class '${className}' must declare 'testType' with value 'unit' or 'behavioral'.`,
					"missing-test-type",
					exportedClass.getStartLineNumber()
				)
			)
			return null
		}

		const init = testTypeProp.getInitializer()
		const text = init?.getText().trim()
		const match = text !== undefined && text.length > 0 ? /^['"`](unit|behavioral)['"`]$/.exec(text) : null
		const testType = match?.[1] as TestType | undefined
		if (!testType) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Property '${className}.testType' must be initialized to literal 'unit' or 'behavioral'.`,
					"bad-test-type",
					testTypeProp.getStartLineNumber()
				)
			)
		}
		return testType ?? null
	}

	@Spec("Checks that test imports its host production module via side-effect import.")
	private static validateHostSideEffectImport(sourceFile: SourceFile, diagnostics: DiagnosticObject[], hostClassName: string) {
		const file = sourceFile.getFilePath()
		const hostPath = MustHaveTestRule.getHostPathFromTestPath(file)
		const expectedImportSpecifier = `./${hostClassName}.lll`
		let hasHostSideEffectImport = false

		for (const importDecl of sourceFile.getImportDeclarations()) {
			const specifier = importDecl.getModuleSpecifierValue()
			const resolvedPath = importDecl.getModuleSpecifierSourceFile()?.getFilePath()
			const isHostByPath = resolvedPath === hostPath
			const isHostBySpecifier = specifier === expectedImportSpecifier || specifier === `${expectedImportSpecifier}.ts`
			if (!isHostByPath && !isHostBySpecifier) {
				continue
			}

			const hasBindings =
				importDecl.getDefaultImport() !== undefined ||
				importDecl.getNamespaceImport() !== undefined ||
				importDecl.getNamedImports().length > 0
			if (!hasBindings) {
				hasHostSideEffectImport = true
				break
			}
		}

		if (!hasHostSideEffectImport) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Test file must side-effect import host module './${hostClassName}.lll' via 'import "./${hostClassName}.lll"'.`,
					"missing-test",
					sourceFile.getStartLineNumber()
				)
			)
		}
	}

	@Spec("Builds the host file path from a test file path.")
	private static getHostPathFromTestPath(testFilePath: string): string {
		return FileVariantSupport.getPrimaryFilePath(testFilePath) ?? testFilePath
	}

	@Spec("Extracts expected host class name from a supported companion test file path.")
	private static getExpectedHostClassName(filePath: string): string {
		return FileVariantSupport.getHostClassNameFromTestPath(filePath) ?? path.parse(filePath).name
	}

	@Spec("Returns true when a subjectFactory type node matches the supported async-capable factory contract.")
	private static isValidSubjectFactoryType(typeText: string): boolean {
		const trimmed = typeText.trim()
		if (trimmed.length === 0) {
			return false
		}
		if (/^SubjectFactory<.+>$/.test(trimmed)) {
			return true
		}
		return /^\(\s*\)\s*=>\s*.+$/.test(trimmed)
	}

	@Spec("Determines if a file is a supported primary or test variant.")
	private static getVariantForFile(filePath: string): { variant: { primarySuffix: string; testSuffix: string; testClassSuffix: string }; isTest: boolean } | null {
		return FileVariantSupport.getVariantForFile(filePath)
	}

	@Spec("Returns static methods decorated with @Scenario.")
	private static getScenarioMethods(classDecl: ClassDeclaration): Array<{ method: MethodDeclaration }> {
		return classDecl.getMethods()
			.filter(method => method.isStatic() && BaseRule.hasDecorator(method, "Scenario"))
			.map(method => ({ method }))
	}
}
