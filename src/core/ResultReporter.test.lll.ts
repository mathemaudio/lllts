import { DiagnosticObject } from "./DiagnosticObject"
import { Scenario } from "../public/lll.lll"
import { Spec } from "../public/lll.lll"
import { AssertFn } from "../public/lll.lll"
import { ResultReporter } from "./ResultReporter.lll"

@Spec("Verifies formatting of diagnostics.")
export class ResultReporterTest {
	testType = "unit"

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
