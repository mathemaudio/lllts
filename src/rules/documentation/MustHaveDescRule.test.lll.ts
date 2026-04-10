import { AssertFn, Scenario, Spec, WaitForFn } from "../../public/lll.lll.js"
import "./MustHaveDescRule.lll"
import { MustHaveDescRule } from "./MustHaveDescRule.lll"

@Spec("Validates description enforcement for @Spec decorators.")
export class MustHaveDescRuleTest {
	testType = "unit"

	@Scenario("Check for desc field")
	static async checkDescription(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const rule = MustHaveDescRule.getRule()
		console.log(`Rule ${rule.id}: ${rule.title}`)
		assert(rule.title.includes("description"), "Rule title should mention description")
	}
}
