import { Spec, Scenario } from "../public/decorators.js"
import { MustHaveDescRule } from "./MustHaveDescRule.lll"

@Spec("Validates description enforcement for @Spec decorators.")
export class MustHaveDescRule_usecase {
	environment = "api"

	@Scenario("Check for desc field")
	static async checkDescription(input: object = {}, assert: (condition: boolean, message?: string) => void) {
		const rule = MustHaveDescRule.getRule()
		console.log(`Rule ${rule.id}: ${rule.title}`)
		assert(rule.title.includes("description"), "Rule title should mention description")
	}
}
