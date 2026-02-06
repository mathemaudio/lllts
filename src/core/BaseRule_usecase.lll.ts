import { Spec, Scenario } from "../public/decorators.js"
import { AssertFn } from "../public/AssertFn.lll"
import { BaseRule } from "./BaseRule.lll"

@Spec("Exercises diagnostic helper utilities.")
export class BaseRule_usecase {
	environment = "api"

	@Scenario("Create and filter diagnostics")
	static async createAndFilter(input = {}, assert: AssertFn) {
		const diag = BaseRule.createDiagnostic("test.ts", "Test error", "error", "missing-spec-class", 10)
		assert(diag.file === "test.ts", "File should match")
		assert(diag.severity === "error", "Severity should match")

		const diagnostics = [
			BaseRule.createDiagnostic("a.ts", "Error 1", "error", "missing-spec-class"),
			BaseRule.createDiagnostic("b.ts", "Warning 1", "warning", "missing-spec-method")
		]
		const errors = BaseRule.filterBySeverity(diagnostics, "error")
		assert(errors.length === 1, "Should have lll error")
	}
}
