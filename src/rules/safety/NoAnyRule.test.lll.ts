import { Project } from "ts-morph"
import { AssertFn, Out, Scenario, Spec } from "../../public/lll.lll"
import { NoAnyRule } from "./NoAnyRule.lll"
import "./NoAnyRule.lll"

@Spec("Validates the ban on explicit any usage.")
export class NoAnyRuleTest {
	testType = "unit"

	@Spec("Runs NoAnyRule on an in-memory source file.")
	@Out("diagnostics", "import('../../core/DiagnosticObject').DiagnosticObject[]")
	private static runRuleOn(filePath: string, body: string) {
		const project = new Project({
			useInMemoryFileSystem: true,
			compilerOptions: {
				strict: true
			}
		})
		const sourceFile = project.createSourceFile(filePath, body)
		return NoAnyRule.getRule().run(sourceFile)
	}

	@Scenario("Verifies rule registration basics")
	static async verifyRuleRegistration(input: object = {}, assert: AssertFn) {
		const rule = NoAnyRule.getRule()
		assert(rule.id === "R14", "Rule id should be R14")
		assert(rule.title === "No any", "Rule title should be 'No any'")
	}

	@Scenario("Rejects explicit any annotations and casts")
	static async rejectsExplicitAnyAnnotationsAndCasts(input: object = {}, assert: AssertFn) {
		const diagnostics = NoAnyRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main(value: any) {
		const copy = value as any
		return copy
	}
}`
		)
		assert(diagnostics.length === 2, `Expected two no-any diagnostics, got ${diagnostics.length}`)
		assert(diagnostics.every(diagnostic => diagnostic.ruleCode === "no-any"), "Expected no-any diagnostic code")
		assert(diagnostics.some(diagnostic => diagnostic.message.includes("parameter type")), "Expected parameter any diagnostic")
		assert(diagnostics.some(diagnostic => diagnostic.message.includes("'as any' cast")), "Expected cast any diagnostic")
	}

	@Scenario("Allows unknown and concrete types")
	static async allowsUnknownAndConcreteTypes(input: object = {}, assert: AssertFn) {
		const diagnostics = NoAnyRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main(value: unknown) {
		const total: number = 1
		return typeof value === "number" ? value + total : total
	}
}`
		)
		assert(diagnostics.length === 0, "Expected unknown and concrete types to pass")
	}

	@Scenario("Ignores the word any outside type syntax")
	static async ignoresAnyOutsideTypeSyntax(input: object = {}, assert: AssertFn) {
		const diagnostics = NoAnyRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main() {
		const text = "any value"
		return text.includes("any")
	}
}`
		)
		assert(diagnostics.length === 0, "Expected plain text uses of 'any' to pass")
	}
}
