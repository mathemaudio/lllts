import { AssertFn } from "../public/lll"
import { Scenario } from "../public/lll"
import { Spec } from "../public/lll"
import { OneClassPerFileRule } from "./OneClassPerFileRule.lll"

@Spec("Demonstrates validation of single-export requirement.")

export class OneClassPerFileRule_usecase {
	environment = "api"

	@Scenario("Check single export file")
	static async checkSingleExport(input: object = {}, assert: AssertFn) {
		const rule = OneClassPerFileRule.getRule()
		assert(rule.id === "R1", "Rule id should be R1")
		console.log(`Rule ${rule.id}: ${rule.title}`);
	}
}
