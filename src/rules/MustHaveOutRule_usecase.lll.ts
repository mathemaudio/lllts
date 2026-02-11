import { AssertFn } from "../public/lll"
import { Scenario } from "../public/lll"
import { Spec } from "../public/lll"
import { MustHaveOutRule } from "./MustHaveOutRule.lll"

@Spec("Covers @Out decorator enforcement scenarios.")
export class MustHaveOutRule_usecase {
	environment = "api"

	@Scenario("Check for out decorator")
	static async checkOutDecorator(input: object = {}, assert: AssertFn) {
		const rule = MustHaveOutRule.getRule()
		debugger
		console.log(`Rule ${rule.id}: ${rule.title}`)
		assert(rule.title.includes("out"), "Rule should mention @Out")
	}
}
