import { Project } from "ts-morph"
import { AssertFn, Out, Scenario, Spec } from "../../public/lll.lll"
import { NoSwitchFallthroughRule } from "./NoSwitchFallthroughRule.lll"

@Spec("Validates the ban on implicit switch fallthrough.")
export class NoSwitchFallthroughRuleTest {
	testType = "unit"

	@Spec("Runs NoSwitchFallthroughRule on an in-memory source file.")
	@Out("diagnostics", "import('../../core/DiagnosticObject').DiagnosticObject[]")
	private static runRuleOn(filePath: string, body: string) {
		const project = new Project({ useInMemoryFileSystem: true })
		const sourceFile = project.createSourceFile(filePath, body)
		return NoSwitchFallthroughRule.getRule().run(sourceFile)
	}

	@Scenario("Verifies rule registration basics")
	static async verifyRuleRegistration(input: object = {}, assert: AssertFn) {
		const rule = NoSwitchFallthroughRule.getRule()
		assert(rule.id === "R16", "Rule id should be R16")
		assert(rule.title === "No switch fallthrough", "Rule title should be 'No switch fallthrough'")
	}

	@Scenario("Allows terminated switch clauses")
	static async allowsTerminatedSwitchClauses(input: object = {}, assert: AssertFn) {
		const diagnostics = NoSwitchFallthroughRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main(value: number) {
		switch (value) {
			case 1:
				return "one"
			case 2:
				break
			default:
				throw new Error("bad")
		}
		return "done"
	}
}`
		)
		assert(diagnostics.length === 0, "Expected terminated switch clauses to pass")
	}

	@Scenario("Rejects implicit fallthrough between non-final clauses")
	static async rejectsImplicitFallthrough(input: object = {}, assert: AssertFn) {
		const diagnostics = NoSwitchFallthroughRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main(value: number) {
		switch (value) {
			case 1:
				value = value + 1
			case 2:
				return value
			default:
				return 0
		}
	}
}`
		)
		assert(diagnostics.length === 1, `Expected one switch-fallthrough diagnostic, got ${diagnostics.length}`)
		assert(diagnostics[0].ruleCode === "switch-fallthrough", "Expected switch-fallthrough diagnostic code")
		assert(diagnostics[0].message.includes("case 1"), "Expected diagnostic message to identify the offending clause")
	}

	@Scenario("Rejects fallthrough even when marked by comment")
	static async rejectsFallthroughMarkers(input: object = {}, assert: AssertFn) {
		const diagnostics = NoSwitchFallthroughRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main(value: number) {
		switch (value) {
			case 1:
				value = value + 1
				// fallthrough
			case 2:
				return value
			default:
				return 0
		}
	}
}`
		)
		assert(diagnostics.length === 1, `Expected one switch-fallthrough diagnostic, got ${diagnostics.length}`)
		assert(diagnostics[0].ruleCode === "switch-fallthrough", "Expected switch-fallthrough diagnostic code")
	}

	@Scenario("Allows grouped empty clauses without markers")
	static async allowsGroupedEmptyClausesWithoutMarkers(input: object = {}, assert: AssertFn) {
		const diagnostics = NoSwitchFallthroughRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main(value: number) {
		switch (value) {
			case 1:
			case 2:
				return "small"
			default:
				return "other"
		}
	}
}`
		)
		assert(diagnostics.length === 0, "Expected grouped empty clauses to pass without markers")
	}

	@Scenario("Allows grouped empty clauses even with marker comments")
	static async allowsGroupedEmptyClausesWithMarkerComments(input: object = {}, assert: AssertFn) {
		const diagnostics = NoSwitchFallthroughRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main(value: number) {
		switch (value) {
			case 1:
				// falls through
			case 2:
				return "small"
			default:
				return "other"
		}
	}
}`
		)
		assert(diagnostics.length === 0, "Expected grouped empty clause with marker to pass")
	}

	@Scenario("Allows clauses whose terminal if statement closes both branches")
	static async allowsIfBranchesThatBothTerminate(input: object = {}, assert: AssertFn) {
		const diagnostics = NoSwitchFallthroughRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main(value: number) {
		switch (value) {
			case 1:
				if (value > 0) {
					return "positive"
				} else {
					throw new Error("negative")
				}
			case 2:
				return "two"
			default:
				return "other"
		}
	}
}`
		)
		assert(diagnostics.length === 0, "Expected if statement with terminating branches to pass")
	}
}
