import { AssertFn, Scenario, Spec, WaitForFn, ScenarioParameter } from "../../public/lll.lll"
import "./MaxFileLengthRule.lll"
import { MaxFileLengthRule } from "./MaxFileLengthRule.lll"

@Spec("Covers MaxFileLengthRule enforcement scenarios.")
export class MaxFileLengthRuleTest {
	testType = "unit"

	@Scenario("Verify rule is registered with correct id")
	static async verifyRuleId(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const rule = MaxFileLengthRule.getRule()
		assert(rule.id === "R7", "Rule id should be R7")
	}

	@Scenario("Verify rule title is correct")
	static async verifyRuleTitle(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const rule = MaxFileLengthRule.getRule()
		assert(rule.title === "Max file length", "Rule title should be 'Max file length'")
	}
}
