import { DiagnosticObject } from "./DiagnosticObject"
import { Scenario } from "../public/lll"
import { Spec } from "../public/lll"
import { AssertFn } from "../public/lll"
import { ResultReporter } from "./ResultReporter.lll"

@Spec("Verifies formatting of diagnostics.")
export class ResultReporter_usecase {
	environment = "api"

	@Scenario("Print errors")
	static async printErrors(input = {}, assert: AssertFn) {
		const reporter = new ResultReporter("./tsconfig.json")
		const diagnostics: DiagnosticObject[] = [
			{ file: "test.lll.ts", message: "Test error", severity: "error", line: 10, ruleCode: "missing-spec-class" }
		]
		reporter.print(diagnostics)
		assert(true, "Reporter should print diagnostics without throwing")
	}
}
