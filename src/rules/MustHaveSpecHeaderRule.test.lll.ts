import { AssertFn } from "../public/lll.lll"
import { Scenario } from "../public/lll.lll"
import { Spec } from "../public/lll.lll"
import { MustHaveSpecHeaderRule } from "./MustHaveSpecHeaderRule.lll"

@Spec("Ensures @Spec decorators exist on classes and methods.")
export class MustHaveSpecHeaderRuleTest {
	testType = "unit"

	@Scenario("Check for spec header")
	static async checkSpecHeader(input: object = {}, assert: AssertFn) {
		const rule = MustHaveSpecHeaderRule.getRule()
		console.log(`Rule ${rule.id}: ${rule.title}`)
		assert(rule.title.includes("spec"), "Rule title should mention spec")
	}
}
