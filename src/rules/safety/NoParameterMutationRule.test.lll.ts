import { Project } from "ts-morph"
import { AssertFn, Scenario, Spec, WaitForFn, ScenarioParameter } from "../../public/lll.lll"
import "./NoParameterMutationRule.lll"
import { NoParameterMutationRule } from "./NoParameterMutationRule.lll"

@Spec("Validates the ban on parameter mutation.")
export class NoParameterMutationRuleTest {
	testType = "unit"

	@Spec("Runs NoParameterMutationRule on an in-memory source file.")
	private static runRuleOn(filePath: string, body: string): import('../../core/DiagnosticObject').DiagnosticObject[] {
		const project = new Project({ useInMemoryFileSystem: true })
		const sourceFile = project.createSourceFile(filePath, body)
		return NoParameterMutationRule.getRule().run(sourceFile)
	}

	@Scenario("Verifies rule registration basics")
	static async verifyRuleRegistration(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const rule = NoParameterMutationRule.getRule()
		assert(rule.id === "R19", "Rule id should be R19")
		assert(rule.title === "No parameter mutation", "Rule title should be 'No parameter mutation'")
	}

	@Scenario("Rejects direct reassignment and update of parameters")
	static async rejectsDirectParameterMutation(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoParameterMutationRuleTest.runRuleOn(
			"/src/Normalizer.lll.ts",
			`export class Normalizer {
	static main(user: string, count: number) {
		user = user.trim()
		count += 1
		count++
		return user + count
	}
}`
		)
		assert(diagnostics.length === 3, `Expected three no-parameter-mutation diagnostics, got ${diagnostics.length}`)
		assert(diagnostics.every(diagnostic => diagnostic.ruleCode === "no-parameter-mutation"), "Expected no-parameter-mutation diagnostic code")
		assert(diagnostics.some(diagnostic => diagnostic.message.includes("Parameter 'user'")), "Expected user reassignment diagnostic")
		assert(diagnostics.filter(diagnostic => diagnostic.message.includes("Parameter 'count'")).length === 2, "Expected two count mutation diagnostics")
	}

	@Scenario("Allows local rewrites and property updates")
	static async allowsLocalRewritePatterns(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoParameterMutationRuleTest.runRuleOn(
			"/src/Normalizer.lll.ts",
			`type User = {
	name: string
}

export class Normalizer {
	static main(user: User, count: number) {
		const processedUser = { ...user, name: user.name.trim() }
		const nextCount = count + 1
		user.name = processedUser.name
		return nextCount + user.name.length
	}
}`
		)
		assert(diagnostics.length === 0, "Expected local rewrites and property updates to pass")
	}

	@Scenario("Ignores shadowed parameter names in nested functions")
	static async ignoresShadowedNestedParameters(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoParameterMutationRuleTest.runRuleOn(
			"/src/Normalizer.lll.ts",
			`export class Normalizer {
	static main(value: number) {
		const transform = (value: number) => {
			value += 1
			return value
		}
		return transform(value)
	}
}`
		)
		assert(diagnostics.length === 1, `Expected one nested-parameter diagnostic, got ${diagnostics.length}`)
		assert(diagnostics[0].message.includes("Parameter 'value'"), "Expected nested parameter mutation diagnostic")
	}

	@Scenario("Rejects destructured parameter rebinding")
	static async rejectsDestructuredParameterMutation(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoParameterMutationRuleTest.runRuleOn(
			"/src/Normalizer.lll.ts",
			`export class Normalizer {
	static main({ value }: { value: number }) {
		value = value + 1
		return value
	}
}`
		)
		assert(diagnostics.length === 1, `Expected one destructured-parameter diagnostic, got ${diagnostics.length}`)
		assert(diagnostics[0].message.includes("Parameter 'value'"), "Expected destructured parameter mutation diagnostic")
	}
}
