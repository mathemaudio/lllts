import { Scenario } from "../public/lll.lll.js"
import { Spec } from "../public/lll.lll.js"
import { AssertFn } from "../public/lll.lll.js"
import { BaseRule } from "./BaseRule.lll"
import "./BaseRule.lll"

@Spec("Exercises diagnostic helper utilities.")
export class BaseRuleTest {
	testType = "unit"

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
