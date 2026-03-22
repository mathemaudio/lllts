import { AssertFn, Scenario, Spec } from "../../public/lll.lll"
import "./MaxMethodLengthRule.lll"
import { MaxMethodLengthRule } from "./MaxMethodLengthRule.lll"

@Spec("Covers MaxMethodLengthRule enforcement scenarios.")
export class MaxMethodLengthRuleTest {
	testType = "unit"

	@Scenario("Verify rule is registered with correct id")
	static async verifyRuleId(input: object = {}, assert: AssertFn) {
		const rule = MaxMethodLengthRule.getRule()
		assert(rule.id === "R8", "Rule id should be R8")
	}

	@Scenario("Verify rule title is correct")
	static async verifyRuleTitle(input: object = {}, assert: AssertFn) {
		const rule = MaxMethodLengthRule.getRule()
		assert(rule.title === "Max method length", "Rule title should be 'Max method length'")
	}
}
