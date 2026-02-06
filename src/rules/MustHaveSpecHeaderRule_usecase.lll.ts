import { AssertFn } from "../public/AssertFn.lll"
import { Spec, Scenario } from "../public/decorators.js"
import { MustHaveSpecHeaderRule } from "./MustHaveSpecHeaderRule.lll"

@Spec("Ensures @Spec decorators exist on classes and methods.")
export class MustHaveSpecHeaderRule_usecase {
	environment = "api"

	@Scenario("Check for spec header")
	static async checkSpecHeader(input: object = {}, assert: AssertFn) {
		const rule = MustHaveSpecHeaderRule.getRule()
		console.log(`Rule ${rule.id}: ${rule.title}`)
		assert(rule.title.includes("spec"), "Rule title should mention spec")
	}
}
