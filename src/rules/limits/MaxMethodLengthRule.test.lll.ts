import { AssertFn, Scenario, Spec, WaitForFn, ScenarioParameter } from "../../public/lll.lll"
import "./MaxMethodLengthRule.lll"
import { MaxMethodLengthRule } from "./MaxMethodLengthRule.lll"

@Spec("Covers MaxMethodLengthRule enforcement scenarios.")
export class MaxMethodLengthRuleTest {
	testType = "unit"

	@Scenario("Verify rule is registered with correct id")
	static async verifyRuleId(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const rule = MaxMethodLengthRule.getRule()
		assert(rule.id === "R8", "Rule id should be R8")
	}

	@Scenario("Verify rule title is correct")
	static async verifyRuleTitle(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const rule = MaxMethodLengthRule.getRule()
		assert(rule.title === "Max method length", "Rule title should be 'Max method length'")
	}
}
