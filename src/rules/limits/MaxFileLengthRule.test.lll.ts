import { AssertFn } from "../../public/lll.lll"
import { Scenario } from "../../public/lll.lll"
import { Spec } from "../../public/lll.lll"
import { MaxFileLengthRule } from "./MaxFileLengthRule.lll"
import "./MaxFileLengthRule.lll"

@Spec("Covers MaxFileLengthRule enforcement scenarios.")
export class MaxFileLengthRuleTest {
	testType = "unit"

	@Scenario("Verify rule is registered with correct id")
	static async verifyRuleId(input: object = {}, assert: AssertFn) {
		const rule = MaxFileLengthRule.getRule()
		assert(rule.id === "R7", "Rule id should be R7")
	}

	@Scenario("Verify rule title is correct")
	static async verifyRuleTitle(input: object = {}, assert: AssertFn) {
		const rule = MaxFileLengthRule.getRule()
		assert(rule.title === "Max file length", "Rule title should be 'Max file length'")
	}
}
