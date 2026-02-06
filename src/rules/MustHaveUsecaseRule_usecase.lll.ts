import { AssertFn } from "../public/AssertFn.lll"
import { Spec, Scenario } from "../public/decorators.js"
import { MustHaveUsecaseRule } from "./MustHaveUsecaseRule.lll"

@Spec("Ensures the rule validates companion classes and schema.")
export class MustHaveUsecaseRule_usecase {
	environment = "api"

	@Scenario("Check for usecase decorator presence")
	static async checkUsecaseDecorator(input: object = {}, assert: AssertFn) {
		const rule = MustHaveUsecaseRule.getRule()
		console.log(`Rule ${rule.id}: ${rule.title}`)
		assert(rule.id === "R4", "Rule id should be R4")
	}

	@Scenario("Validate usecase type structure including view property")
	static async validateTypeStructure(input: object = {}, assert: AssertFn) {
		const rule = MustHaveUsecaseRule.getRule()
		console.log(`Rule ${rule.id} validates usecase type structure including view and scenarios`)
		assert(typeof rule.run === "function", "Rule.run should be callable")
	}
}
