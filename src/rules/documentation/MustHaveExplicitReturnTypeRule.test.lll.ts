import { Project } from "ts-morph"
import { AssertFn, Scenario, Spec, WaitForFn } from "../../public/lll.lll"
import "./MustHaveExplicitReturnTypeRule.lll"
import { MustHaveExplicitReturnTypeRule } from "./MustHaveExplicitReturnTypeRule.lll"

@Spec("Covers explicit return type enforcement scenarios.")
export class MustHaveExplicitReturnTypeRuleTest {
	testType = "unit"

	@Spec("Runs MustHaveExplicitReturnTypeRule on an in-memory source file.")
	private static runRuleOn(filePath: string, body: string): import('../../core/DiagnosticObject').DiagnosticObject[] {
		const project = new Project({
			useInMemoryFileSystem: true,
			compilerOptions: {
				strict: true
			}
		})
		const sourceFile = project.createSourceFile(filePath, body)
		return MustHaveExplicitReturnTypeRule.getRule().run(sourceFile)
	}

	@Scenario("Verifies rule registration basics")
	static async verifyRuleRegistration(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const rule = MustHaveExplicitReturnTypeRule.getRule()
		assert(rule.id === "R6", "Rule id should remain R6")
		assert(rule.title.includes("explicit return types"), "Rule title should mention explicit return types")
	}

	@Scenario("Rejects methods that return values without explicit return types")
	static async rejectsImplicitMethodReturnTypes(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const diagnostics = MustHaveExplicitReturnTypeRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static add(left: number, right: number) {
		return left + right
	}
}`
		)
		assert(diagnostics.length === 1, `Expected one diagnostic, got ${diagnostics.length}`)
		assert(diagnostics[0]?.ruleCode === "missing-explicit-return-type", "Expected missing-explicit-return-type diagnostic code")
		assert(diagnostics[0]?.message.includes("add"), "Expected method name in diagnostic")
	}

	@Scenario("Rejects named functions that return values without explicit return types")
	static async rejectsImplicitFunctionReturnTypes(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const diagnostics = MustHaveExplicitReturnTypeRuleTest.runRuleOn(
			"/src/legacy.ts",
			`export function sum(left: number, right: number) {
	return left + right
}`
		)
		assert(diagnostics.length === 1, `Expected one diagnostic, got ${diagnostics.length}`)
		assert(diagnostics[0]?.ruleCode === "missing-explicit-return-type", "Expected missing-explicit-return-type diagnostic code")
		assert(diagnostics[0]?.message.includes("sum"), "Expected function name in diagnostic")
	}

	@Scenario("Allows value-returning declarations with explicit return types")
	static async allowsExplicitReturnTypes(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const diagnostics = MustHaveExplicitReturnTypeRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static add(left: number, right: number): number {
		return left + right
	}
}`
		)
		assert(diagnostics.length === 0, "Expected explicit return type annotation to pass")
	}

	@Scenario("Allows declarations that do not return values")
	static async allowsVoidDeclarationsWithoutAnnotation(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const diagnostics = MustHaveExplicitReturnTypeRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static logValue(value: number) {
		console.log(value)
	}
}`
		)
		assert(diagnostics.length === 0, "Expected declaration without returned value to pass")
	}

	@Scenario("Ignores returns that belong to nested callbacks instead of the outer declaration")
	static async ignoresNestedCallbackReturns(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const diagnostics = MustHaveExplicitReturnTypeRuleTest.runRuleOn(
			"/src/Bridge.lll.ts",
			`export class Bridge {
	static typedEndpoint(app: { post(path: string, handler: () => void): void }, path: string) {
		app.post(path, () => {
			return 1
		})
	}
}`
		)
		assert(diagnostics.length === 0, "Expected nested callback returns not to count as outer declaration returns")
	}
}
