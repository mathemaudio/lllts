import { AssertFn, Scenario, Spec } from "../../public/lll.lll"
import { RulesEngine } from "./RulesEngine.lll"
//
type CoverageStatus = {
	totalClasses: number
	coveredClasses: number
	coveragePercent: number
	uncoveredPercent: number
	displayDebtPercent: number
	band: "notice" | "warning" | "alert" | "error"
	severity: "notice" | "warning" | "error"
}

@Spec("Validates linear test-coverage debt thresholds and mapping.")
export class RulesEngineCoverageDebtTest {
	testType = "unit"

	@Spec("Returns computed coverage status by invoking the engine's internal calculator.")
	private static getStatus(totalClasses: number, coveredClasses: number): CoverageStatus {
		const fakeLoader = { getFiles: () => [] } as unknown
		const engine = new RulesEngine(fakeLoader as never)
		return (engine as unknown as { coverageStatus: (classCount: number, covered: number) => CoverageStatus })
			.coverageStatus(totalClasses, coveredClasses)
	}

	@Scenario("100% coverage maps to notice with 0 debt")
	static async fullCoverageMapsToZeroDebt(input: object = {}, assert: AssertFn) {
		const status = this.getStatus(100, 100)
		assert(status.severity === "notice", "100% coverage should remain notice-level informational debt")
		assert(status.displayDebtPercent === 0, "100% coverage should map to 0% displayed debt")
	}

	@Scenario("96% coverage stays notice and maps debt to 20")
	static async ninetySixCoverageNotice(input: object = {}, assert: AssertFn) {
		const status = this.getStatus(100, 96)
		assert(status.severity === "notice", "96% coverage should still be notice")
		assert(status.displayDebtPercent === 20, "96% coverage should map to 20% debt")
	}

	@Scenario("95% coverage is warning boundary and maps debt to 25")
	static async ninetyFiveCoverageWarningBoundary(input: object = {}, assert: AssertFn) {
		const status = this.getStatus(100, 95)
		assert(status.severity === "warning", "95% coverage should be warning boundary")
		assert(status.band === "warning", "95% coverage should be in warning band")
		assert(status.displayDebtPercent === 25, "95% coverage should map to 25% debt")
	}

	@Scenario("90% coverage maps debt to 50 warning")
	static async ninetyCoverageWarning(input: object = {}, assert: AssertFn) {
		const status = this.getStatus(100, 90)
		assert(status.severity === "warning", "90% coverage should be warning")
		assert(status.displayDebtPercent === 50, "90% coverage should map to 50% debt")
	}

	@Scenario("85% coverage is alert band and maps debt to 75")
	static async eightyFiveCoverageAlertBand(input: object = {}, assert: AssertFn) {
		const status = this.getStatus(100, 85)
		assert(status.severity === "warning", "85% coverage should remain warning severity")
		assert(status.band === "alert", "85% coverage should be in alert band for wording")
		assert(status.displayDebtPercent === 75, "85% coverage should map to 75% debt")
	}

	@Scenario("80% coverage is error boundary and maps debt to 100")
	static async eightyCoverageErrorBoundary(input: object = {}, assert: AssertFn) {
		const status = this.getStatus(100, 80)
		assert(status.severity === "error", "80% coverage should be error boundary")
		assert(status.displayDebtPercent === 100, "80% coverage should map to 100% debt")
	}

	@Scenario("70% coverage exceeds 100 debt and remains error")
	static async seventyCoverageOverHundredDebt(input: object = {}, assert: AssertFn) {
		const status = this.getStatus(100, 70)
		assert(status.severity === "error", "70% coverage should be error")
		assert(status.displayDebtPercent === 150, "70% coverage should map to 150% debt")
	}

	@Scenario("Zero classes produce implicit 100 coverage and no debt")
	static async zeroClassesStatus(input: object = {}, assert: AssertFn) {
		const status = this.getStatus(0, 0)
		assert(status.coveragePercent === 100, "0 classes should compute as 100% coverage")
		assert(status.uncoveredPercent === 0, "0 classes should compute as 0% uncovered")
		assert(status.displayDebtPercent === 0, "0 classes should compute as 0% debt")
	}
}
