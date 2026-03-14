import { AssertFn } from "../../public/lll.lll"
import { Scenario } from "../../public/lll.lll"
import { Spec } from "../../public/lll.lll"
import { MustHaveOutRule } from "./MustHaveOutRule.lll"

@Spec("Covers @Out decorator enforcement scenarios.")
export class MustHaveOutRuleTest {
	testType = "unit"

	@Scenario("Check for out decorator")
	static async checkOutDecorator(input: object = {}, assert: AssertFn) {
		const rule = MustHaveOutRule.getRule()
		console.log(`Rule ${rule.id}: ${rule.title}`)
		assert(rule.title.includes("out"), "Rule should mention @Out")
	}
}
