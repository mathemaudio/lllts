import { AssertFn, Scenario, Spec, WaitForFn, ScenarioParameter } from "../../public/lll.lll.js"
import "./MustHaveDescRule.lll"
import { MustHaveDescRule } from "./MustHaveDescRule.lll"

@Spec("Validates description enforcement for @Spec decorators.")
export class MustHaveDescRuleTest {
	testType = "unit"

	@Scenario("Check for desc field")
	static async checkDescription(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const rule = MustHaveDescRule.getRule()
		console.log(`Rule ${rule.id}: ${rule.title}`)
		assert(rule.title.includes("description"), "Rule title should mention description")
	}
}
