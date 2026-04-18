import { AssertFn, Scenario, Spec, WaitForFn, ScenarioParameter, SubjectFactory } from "../public/lll.lll"
import { DiagnosticObject } from "./DiagnosticObject"
import "./ResultReporter.lll"
import { ResultReporter } from "./ResultReporter.lll"

@Spec("Verifies formatting of diagnostics.")
export class ResultReporterTest {
	testType = "unit"

	@Scenario("Print errors")
	static async printErrors(subjectFactory: SubjectFactory<unknown>, scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
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

	@Scenario("Print breadth markers")
	static async printBreadthMarkers(subjectFactory: SubjectFactory<unknown>, scenario: ScenarioParameter) {
		const assert: AssertFn = scenario.assert
		const originalLog = console.log
		const logLines: string[] = []
		console.log = (...args: unknown[]) => {
			logLines.push(args.map(arg => String(arg)).join(" "))
		}

		const reporter = new ResultReporter("./tsconfig.json")
		const diagnostics: DiagnosticObject[] = [
			{ file: "src/core", message: "Folder 'core' contains 12 source files (max allowed: 8).", severity: "error", line: 1, ruleCode: "folder-too-many-files" }
		]
		try {
			reporter.print(diagnostics)
		} finally {
			console.log = originalLog
		}

		assert(
			logLines.some(line => line.includes("❌ ERROR: Folder contains too many source files [breadthSummary]")),
			"Reporter should mark breadth error summaries with a stable machine-readable tag"
		)
		assert(
			logLines.some(line => line.includes("src/core Folder 'core' contains 12 source files (max allowed: 8). [breadthDetail]")),
			"Reporter should still print the file path for breadth details"
		)
		assert(
			logLines.every(line => !line.includes("src/core:1 Found") && !line.includes("src/core:1 Folder")),
			"Reporter should hide synthetic line 1 prefixes for breadth diagnostics"
		)
	}
}
