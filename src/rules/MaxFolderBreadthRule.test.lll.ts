import { AssertFn } from "../public/lll.lll"
import { Scenario } from "../public/lll.lll"
import { Spec } from "../public/lll.lll"
import { MaxFolderBreadthRule } from "./MaxFolderBreadthRule.lll"

@Spec("Covers MaxFolderBreadthRule registration basics.")
export class MaxFolderBreadthRuleTest {
	testType = "unit"

	@Scenario("Verify rule is registered with correct id")
	static async verifyRuleId(input: object = {}, assert: AssertFn) {
		const rule = MaxFolderBreadthRule.getRule()
		assert(rule.id === "R9", "Rule id should be R9")
	}

	@Scenario("Verify rule title is correct")
	static async verifyRuleTitle(input: object = {}, assert: AssertFn) {
		const rule = MaxFolderBreadthRule.getRule()
		assert(rule.title === "Max folder breadth", "Rule title should be 'Max folder breadth'")
	}
}
