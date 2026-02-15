import * as path from "path"
import { Rule } from "../core/Rule"
import { DiagnosticObject } from "../core/DiagnosticObject"
import { BaseRule } from "../core/BaseRule.lll"
import { FileVariantSupport } from "../core/FileVariantSupport.lll"
import { Out } from "../public/lll.lll"
import { Spec } from "../public/lll.lll"
import { SyntaxKind } from "ts-morph"
import type { SourceFile, ClassDeclaration, MethodDeclaration } from "ts-morph"

type TestType = "unit" | "behavioral"

@Spec("Enforces dedicated '.test.lll.ts' test classes with valid test structure and boundaries.")
export class MustHaveTestRule {
	@Spec("Returns the rule configuration object.")
	@Out("rule", "Rule")
	public static getRule(): Rule {
		return {
			id: "R4",
			title: "Must have test companion",
			run(sourceFile) {
				const exportedClass = BaseRule.getExportedClass(sourceFile)
				if (!exportedClass) return []

				const filePath = sourceFile.getFilePath()
				const variantMatch = MustHaveTestRule.getVariantForFile(filePath)
				if (!variantMatch) {
					return []
				}

				if (variantMatch.isTest) {
					return MustHaveTestRule.validateTestClass(sourceFile, exportedClass)
				}

				return MustHaveTestRule.validatePrimaryClass(sourceFile, exportedClass)
			}
		}
	}

	@Spec("Ensures production classes keep scenarios in test files and do not import tests.")
	@Out("diagnostics", "DiagnosticObject[]")
	private static validatePrimaryClass(sourceFile: SourceFile, exportedClass: ClassDeclaration) {
		const diagnostics: DiagnosticObject[] = []
		const file = sourceFile.getFilePath()

		const illegalScenarios = exportedClass.getMethods().filter(method =>
			method.isStatic() && BaseRule.hasDecorator(method, "Scenario")
		)

		for (const method of illegalScenarios) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Scenario method '${method.getName()}' must live in a '.test.lll.ts' companion, not inside production class code.`,
					"missing-test",
					method.getStartLineNumber()
				)
			)
		}

		for (const importDecl of sourceFile.getImportDeclarations()) {
			const specifier = importDecl.getModuleSpecifierValue()
			const targetFile = importDecl.getModuleSpecifierSourceFile()?.getFilePath()
			const importsTestFile = specifier.includes(".test.lll") || !!targetFile?.endsWith(".test.lll.ts")
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

	@Spec("Verifies test files use '<Base>Test' naming, valid testType, host import/use, and scenario contract.")
	@Out("diagnostics", "DiagnosticObject[]")
	private static validateTestClass(sourceFile: SourceFile, exportedClass: ClassDeclaration) {
		const diagnostics: DiagnosticObject[] = []
		const file = sourceFile.getFilePath()
		const className = exportedClass.getName() ?? "(anonymous)"
		const expectedHostName = MustHaveTestRule.getExpectedHostClassName(file)
		const expectedTestClassName = `${expectedHostName}Test`

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

		const testType = MustHaveTestRule.validateTestType(exportedClass, diagnostics, file, className)

		if (testType === "behavioral") {
			MustHaveTestRule.validateBehavioralRenderContract(exportedClass, diagnostics, file, className)
		} else if (testType === "unit") {
			const renderMethod = exportedClass.getInstanceMethod("render")
			const staticRenderMethod = exportedClass.getStaticMethod("render")
			const forbiddenMethod = renderMethod ?? staticRenderMethod
			if (forbiddenMethod) {
				diagnostics.push(
					BaseRule.createError(
						file,
						`Test class '${className}' must not declare render() when testType is 'unit'.`,
						"bad-test-type",
						forbiddenMethod.getStartLineNumber()
					)
				)
			}
		}

		MustHaveTestRule.validateHostImportAndUsage(sourceFile, diagnostics, expectedHostName)

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
		}

		return diagnostics
	}

	@Spec("Enforces behavioral test render() requirements.")
	private static validateBehavioralRenderContract(
		exportedClass: ClassDeclaration,
		diagnostics: DiagnosticObject[],
		file: string,
		className: string
	) {
		const extendsClause = exportedClass.getExtends()
		const extendsName = extendsClause?.getExpression().getText().trim()
		if (extendsName !== "LitElement") {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Behavioral test class '${className}' must extend LitElement.`,
					"missing-test",
					exportedClass.getStartLineNumber()
				)
			)
		}

		const stylesProp = exportedClass.getStaticProperty("styles")
		if (!stylesProp) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Behavioral test class '${className}' must declare static styles with string or CSSResult type.`,
					"missing-test",
					exportedClass.getStartLineNumber()
				)
			)
		} else {
			const declaredTypeText =
				"getTypeNode" in stylesProp ? (stylesProp.getTypeNode()?.getText() ?? "") : ""
			const resolvedTypeText = stylesProp.getType().getText(stylesProp)
			const hasAllowedType =
				MustHaveTestRule.isAllowedStylesType(declaredTypeText) ||
				MustHaveTestRule.isAllowedStylesType(resolvedTypeText)
			if (!hasAllowedType) {
				diagnostics.push(
					BaseRule.createError(
						file,
						`Property '${className}.styles' must be typed as string or CSSResult.`,
						"missing-test",
						stylesProp.getStartLineNumber()
					)
				)
			}
		}

		const renderMethod = exportedClass.getInstanceMethod("render")
		const staticRenderMethod = exportedClass.getStaticMethod("render")
		if (staticRenderMethod) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Method '${className}.render' must be an instance method, not static.`,
					"missing-test",
					staticRenderMethod.getStartLineNumber()
				)
			)
		}
		if (!renderMethod) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Behavioral test class '${className}' must declare render(): string or TemplateResult.`,
					"missing-test",
					exportedClass.getStartLineNumber()
				)
			)
			return
		}

		if (renderMethod.isAsync()) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Method '${className}.render' must not be async.`,
					"missing-test",
					renderMethod.getStartLineNumber()
				)
			)
		}

		if (renderMethod.getParameters().length !== 0) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Method '${className}.render' must not accept parameters.`,
					"missing-test",
					renderMethod.getStartLineNumber()
				)
			)
		}

		const declaredReturnTypeText = renderMethod.getReturnTypeNode()?.getText() ?? ""
		const resolvedReturnTypeText = renderMethod.getReturnType().getText(renderMethod)
		const hasAllowedReturnType =
			MustHaveTestRule.isAllowedRenderType(declaredReturnTypeText) ||
			MustHaveTestRule.isAllowedRenderType(resolvedReturnTypeText)
		if (!hasAllowedReturnType) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Method '${className}.render' must return string or TemplateResult.`,
					"missing-test",
					renderMethod.getStartLineNumber()
				)
			)
		}
	}

	@Spec("Returns true when a styles type matches the supported behavioral contract.")
	@Out("allowed", "boolean")
	private static isAllowedStylesType(typeText: string) {
		return /\bstring\b/.test(typeText) || /\bCSSResult\b/.test(typeText)
	}

	@Spec("Returns true when a render return type matches the supported behavioral contract.")
	@Out("allowed", "boolean")
	private static isAllowedRenderType(typeText: string) {
		return /\bstring\b/.test(typeText) || /\bTemplateResult\b/.test(typeText)
	}

	@Spec("Ensures testType literal is present on test classes.")
	@Out("testType", "'unit' | 'behavioral' | null")
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
		const match = text ? /^['"`](unit|behavioral)['"`]$/.exec(text) : null
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

	@Spec("Checks that test imports and uses its host production class.")
	private static validateHostImportAndUsage(sourceFile: SourceFile, diagnostics: DiagnosticObject[], hostClassName: string) {
		const file = sourceFile.getFilePath()
		const hostPath = MustHaveTestRule.getHostPathFromTestPath(file)
		const expectedImportSpecifier = `./${hostClassName}.lll`
		const importedHostAliases = new Set<string>()

		for (const importDecl of sourceFile.getImportDeclarations()) {
			const specifier = importDecl.getModuleSpecifierValue()
			const resolvedPath = importDecl.getModuleSpecifierSourceFile()?.getFilePath()
			const isHostByPath = resolvedPath === hostPath
			const isHostBySpecifier = specifier === expectedImportSpecifier || specifier === `${expectedImportSpecifier}.ts`
			if (!isHostByPath && !isHostBySpecifier) {
				continue
			}

			const defaultImport = importDecl.getDefaultImport()?.getText()
			if (defaultImport && defaultImport === hostClassName) {
				importedHostAliases.add(defaultImport)
			}

			for (const named of importDecl.getNamedImports()) {
				if (named.getName() !== hostClassName) {
					continue
				}
				importedHostAliases.add(named.getAliasNode()?.getText() ?? named.getName())
			}
		}

		if (importedHostAliases.size === 0) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Test file must import host class '${hostClassName}' from './${hostClassName}.lll'.`,
					"missing-test",
					sourceFile.getStartLineNumber()
				)
			)
			return
		}

		const usedAliases = new Set<string>()
		for (const identifier of sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)) {
			const name = identifier.getText()
			if (!importedHostAliases.has(name)) {
				continue
			}
			if (identifier.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)) {
				continue
			}
			usedAliases.add(name)
		}

		if (usedAliases.size === 0) {
			diagnostics.push(
				BaseRule.createError(
					file,
					`Test file must use imported host class '${hostClassName}' in scenario code.`,
					"missing-test",
					sourceFile.getStartLineNumber()
				)
			)
		}
	}

	@Spec("Builds the host file path from a test file path.")
	@Out("hostPath", "string")
	private static getHostPathFromTestPath(testFilePath: string) {
		return testFilePath.replace(/\.test\.lll\.ts$/, ".lll.ts")
	}

	@Spec("Extracts expected host class name from a '.test.lll.ts' file path.")
	@Out("className", "string")
	private static getExpectedHostClassName(filePath: string) {
		const baseName = path.basename(filePath)
		if (baseName.endsWith(".test.lll.ts")) {
			return baseName.slice(0, -".test.lll.ts".length)
		}
		return path.parse(filePath).name
	}

	@Spec("Determines if a file is a supported primary or test variant.")
	@Out("variantMatch", "{ variant: { primarySuffix: string; testSuffix: string }; isTest: boolean } | null")
	private static getVariantForFile(filePath: string) {
		return FileVariantSupport.getVariantForFile(filePath)
	}

	@Spec("Returns static methods decorated with @Scenario.")
	@Out("scenarioMethods", "Array<{ method: MethodDeclaration }>")
	private static getScenarioMethods(classDecl: ClassDeclaration) {
		return classDecl.getMethods()
			.filter(method => method.isStatic() && BaseRule.hasDecorator(method, "Scenario"))
			.map(method => ({ method }))
	}
}
