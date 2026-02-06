import { AssertFn } from "../public/AssertFn.lll"
import { Spec, Scenario } from "../public/decorators.js"
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
