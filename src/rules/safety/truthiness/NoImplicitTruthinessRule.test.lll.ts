import { Project } from "ts-morph"
import { AssertFn, Scenario, Spec, WaitForFn, ScenarioParameter } from "../../../public/lll.lll"
import "./NoImplicitTruthinessRule.lll"
import { NoImplicitTruthinessRule } from "./NoImplicitTruthinessRule.lll"

@Spec("Validates the ban on implicit truthiness in condition positions.")
export class NoImplicitTruthinessRuleTest {
	testType = "unit"

	@Spec("Runs NoImplicitTruthinessRule on an in-memory source file.")
	private static runRuleOn(filePath: string, body: string): import('../../../core/DiagnosticObject').DiagnosticObject[] {
		const project = new Project({
			useInMemoryFileSystem: true,
			compilerOptions: {
				strict: true
			}
		})
		const sourceFile = project.createSourceFile(filePath, body)
		return NoImplicitTruthinessRule.getRule().run(sourceFile)
	}

	@Scenario("Verifies rule registration basics")
	static async verifyRuleRegistration(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const rule = NoImplicitTruthinessRule.getRule()
		assert(rule.id === "R12", "Rule id should be R12")
		assert(rule.title === "No implicit truthiness", "Rule title should be 'No implicit truthiness'")
	}

	@Scenario("Allows direct boolean conditions and explicit boolean expressions")
	static async allowsBooleanConditions(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoImplicitTruthinessRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main() {
		let ready = false
		const value = 2
		const result = ready || value > 0 ? 1 : 0
		if (ready) {
			return result
		}
		while (value > 0 && !ready) {
			ready = true
		}
		return result
	}
}`
		)
		assert(diagnostics.length === 0, "Expected boolean conditions and comparisons to pass")
	}

	@Scenario("Rejects direct string truthiness in if")
	static async rejectsDirectStringTruthinessInIf(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoImplicitTruthinessRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main() {
		const name = "worker" as string
		if (name) {
			return 1
		}
		return 0
	}
}`
		)
		assert(diagnostics.length === 1, `Expected one truthiness diagnostic, got ${diagnostics.length}`)
		assert(diagnostics[0].ruleCode === "no-implicit-truthiness", "Expected no-implicit-truthiness diagnostic code")
		assert(diagnostics[0].message.includes("string"), "Expected diagnostic message to mention string")
	}

	@Scenario("Rejects numeric truthiness in loops")
	static async rejectsNumericTruthinessInLoops(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoImplicitTruthinessRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main() {
		let itemsLength = 3
		while (itemsLength) {
			itemsLength = itemsLength - 1
		}
		do {
			itemsLength = itemsLength + 1
		} while (itemsLength)
		for (; itemsLength; itemsLength = itemsLength - 1) {
		}
	}
}`
		)
		assert(diagnostics.length === 3, `Expected three truthiness diagnostics, got ${diagnostics.length}`)
		assert(diagnostics.every(d => d.message.includes("number")), "Expected numeric truthiness diagnostics")
	}

	@Scenario("Rejects nullable references and ambiguous unions")
	static async rejectsNullableReferencesAndAmbiguousUnions(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoImplicitTruthinessRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class Box {}

export class MathObject {
	static main() {
		let ref = null as Box | null
		let state = 0 as 0 | 1
		if (ref) {
			return 1
		}
		const result = state ? 1 : 0
		return result
	}
}`
		)
		assert(diagnostics.length === 2, `Expected two truthiness diagnostics, got ${diagnostics.length}`)
		assert(diagnostics.some(d => d.message.includes("Box | null")), "Expected nullable object diagnostic")
		assert(diagnostics.some(d => d.message.includes("0 | 1")), "Expected ambiguous union diagnostic")
	}

	@Scenario("Rejects truthiness across all supported condition positions")
	static async rejectsTruthinessAcrossAllSupportedConditionPositions(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoImplicitTruthinessRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main() {
		const text = "x"
		let count = 1
		if (text) {
			count = count + 1
		}
		while (count) {
			count = count - 1
		}
		do {
			count = count + 1
		} while (count)
		for (; text; count = count + 1) {
		}
		const result = text ? count : 0
		return result
	}
}`
		)
		assert(diagnostics.length === 5, `Expected one diagnostic per supported condition position, got ${diagnostics.length}`)
	}
}
