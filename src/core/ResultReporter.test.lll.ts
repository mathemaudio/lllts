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
		const originalLog = console.log
		const logLines: string[] = []
		console.log = (...args: unknown[]) => {
			logLines.push(args.map(arg => String(arg)).join(" "))
		}

		const reporter = new ResultReporter("./tsconfig.json")
		const diagnostics: DiagnosticObject[] = [
			{ file: "test.lll.ts", message: "Test error", severity: "error", line: 10, ruleCode: "missing-spec-class" }
		]
		try {
			reporter.print(diagnostics)
		} finally {
			console.log = originalLog
		}

		assert(
			logLines.some(line => line.includes("❌ ERROR: Missing @Spec on class")),
			"Reporter should prefix error headers with emoji instead of ANSI colors"
		)
		assert(
			logLines.every(line => !line.includes("\x1b[")),
			"Reporter output should not contain ANSI escape sequences"
		)
	}
}
