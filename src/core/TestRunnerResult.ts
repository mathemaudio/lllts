import type { DiagnosticObject } from "./DiagnosticObject"
import type { TestReport } from "./TestReport"

export type TestRunnerResult = {
	diagnostics: DiagnosticObject[]
	reports: TestReport[]
}
