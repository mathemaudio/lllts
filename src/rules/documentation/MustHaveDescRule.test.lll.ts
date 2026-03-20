import { Scenario } from "../../public/lll.lll.js"
import { Spec } from "../../public/lll.lll.js"
import { MustHaveDescRule } from "./MustHaveDescRule.lll"
import "./MustHaveDescRule.lll"

@Spec("Validates description enforcement for @Spec decorators.")
export class MustHaveDescRuleTest {
	testType = "unit"

	@Scenario("Check for desc field")
	static async checkDescription(input: object = {}, assert: (condition: boolean, message?: string) => void) {
		const rule = MustHaveDescRule.getRule()
		console.log(`Rule ${rule.id}: ${rule.title}`)
		assert(rule.title.includes("description"), "Rule title should mention description")
	}
}
