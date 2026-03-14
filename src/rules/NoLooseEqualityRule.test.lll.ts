import { Project } from "ts-morph"
import { AssertFn, Out, Scenario, Spec } from "../public/lll.lll"
import { NoLooseEqualityRule } from "./NoLooseEqualityRule.lll"

@Spec("Validates the ban on loose equality operators.")
export class NoLooseEqualityRuleTest {
	testType = "unit"

	@Spec("Runs NoLooseEqualityRule on an in-memory source file.")
	@Out("diagnostics", "import('../core/DiagnosticObject').DiagnosticObject[]")
	private static runRuleOn(filePath: string, body: string) {
		const project = new Project({ useInMemoryFileSystem: true })
		const sourceFile = project.createSourceFile(filePath, body)
		return NoLooseEqualityRule.getRule().run(sourceFile)
	}

	@Scenario("Verifies rule registration basics")
	static async verifyRuleRegistration(input: object = {}, assert: AssertFn) {
		const rule = NoLooseEqualityRule.getRule()
		assert(rule.id === "R11", "Rule id should be R11")
		assert(rule.title === "No loose equality", "Rule title should be 'No loose equality'")
	}

	@Scenario("Allows strict equality operators")
	static async allowsStrictEqualityOperators(input: object = {}, assert: AssertFn) {
		const diagnostics = NoLooseEqualityRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main() {
		const value = 1
		const name = "x"
		if (value === 1 && name !== "") {
			return true
		}
		return false
	}
}`
		)
		assert(diagnostics.length === 0, "Expected strict equality operators to pass")
	}

	@Scenario("Rejects double equals")
	static async rejectsDoubleEquals(input: object = {}, assert: AssertFn) {
		const diagnostics = NoLooseEqualityRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main() {
		const value = 0
		if (value == 0) {
			return true
		}
		return false
	}
}`
		)
		assert(diagnostics.length === 1, `Expected one loose-equality diagnostic, got ${diagnostics.length}`)
		assert(diagnostics[0].ruleCode === "no-loose-equality", "Expected no-loose-equality diagnostic code")
		assert(diagnostics[0].message.includes("'=='"), "Expected diagnostic message to mention '=='")
	}

	@Scenario("Rejects not equals including null checks")
	static async rejectsNotEqualsIncludingNullChecks(input: object = {}, assert: AssertFn) {
		const diagnostics = NoLooseEqualityRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main() {
		const name = null as string | null
		if (name != null) {
			return name
		}
		return "none"
	}
}`
		)
		assert(diagnostics.length === 1, `Expected one loose-equality diagnostic, got ${diagnostics.length}`)
		assert(diagnostics[0].message.includes("'!='"), "Expected diagnostic message to mention '!='")
	}

	@Scenario("Rejects loose equality everywhere")
	static async rejectsLooseEqualityEverywhere(input: object = {}, assert: AssertFn) {
		const diagnostics = NoLooseEqualityRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main() {
		const a = 1
		const b = 2
		const first = a == b
		const second = a != b
		return first || second
	}
}`
		)
		assert(diagnostics.length === 2, `Expected two loose-equality diagnostics, got ${diagnostics.length}`)
	}
}
