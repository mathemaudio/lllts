import * as fs from "fs"
import * as path from "path"
import { Out, Spec } from "../../public/lll.lll"
import { MustHaveDescRule } from "../../rules/MustHaveDescRule.lll"
import { MustHaveOutRule } from "../../rules/MustHaveOutRule.lll"
import { MustHaveSpecHeaderRule } from "../../rules/MustHaveSpecHeaderRule.lll"
import { MustHaveTestRule } from "../../rules/MustHaveTestRule.lll"
import { MaxFileLengthRule } from "../../rules/MaxFileLengthRule.lll"
import { MaxMethodLengthRule } from "../../rules/MaxMethodLengthRule.lll"
import { MaxFolderBreadthRule } from "../../rules/MaxFolderBreadthRule.lll"
import { NoAnyRule } from "../../rules/NoAnyRule.lll"
import { NoAssignmentInConditionsRule } from "../../rules/NoAssignmentInConditionsRule.lll"
import { NoImplicitTruthinessRule } from "../../rules/NoImplicitTruthinessRule.lll"
import { NoImplicitPrimitiveCoercionRule } from "../../rules/coercion/NoImplicitPrimitiveCoercionRule.lll"
import { NoLooseEqualityRule } from "../../rules/NoLooseEqualityRule.lll"
import { NoRogueTopLevelRule } from "../../rules/NoRogueTopLevelRule.lll"
import { OneClassPerFileRule } from "../../rules/OneClassPerFileRule.lll"
import { BaseRule } from "../BaseRule.lll"
import { DiagnosticObject } from "../DiagnosticObject"
import { FileVariantSupport } from "../FileVariantSupport.lll"
import { ProjectInitiator } from "../ProjectInitiator.lll"

@Spec("Loads and executes all rules against project files.")
export class RulesEngine {
	constructor(private loader: ProjectInitiator) {
		Spec("Initializes the rules engine with a project loader.")
	}

	@Spec("Executes all registered rules and returns diagnostics.")
	@Out("diagnostics", "Diagnostic[]")
	public runAll(options: { skipTestRules?: boolean; skipTestCoverageDebt?: boolean } = {}) {
		const skipTestRules = options.skipTestRules === true
		const skipTestCoverageDebt = options.skipTestCoverageDebt === true
		const files = this.loader.getFiles()
		const rules = [
			OneClassPerFileRule.getRule(),
			NoRogueTopLevelRule.getRule(),
			MustHaveSpecHeaderRule.getRule(),
			MustHaveDescRule.getRule(),
			MaxFileLengthRule.getRule(),
			MaxMethodLengthRule.getRule(),
			MaxFolderBreadthRule.getRule(),
			NoAssignmentInConditionsRule.getRule(),
			NoLooseEqualityRule.getRule(),
			NoImplicitTruthinessRule.getRule(),
			NoImplicitPrimitiveCoercionRule.getRule(),
			NoAnyRule.getRule(),
		]
		if (!skipTestRules) {
			rules.push(MustHaveTestRule.getRule())
		}
		rules.push(MustHaveOutRule.getRule())

		const all: DiagnosticObject[] = []
		for (const file of files) {
			const filePath = file.getFilePath()
			if (filePath.endsWith(".old.ts") || filePath.endsWith(".d.old.ts") || filePath.endsWith("/lll.lll.ts")) {
				continue
			}
			for (const rule of rules) {
				try {
					all.push(...rule.run(file))
				} catch (err) {
					all.push({
						file: file.getBaseName(),
						message: `Rule ${rule.id} crashed: ${String(err)}`,
						severity: "error",
						ruleCode: "no-export" as any
					})
				}
			}
		}
		if (!skipTestCoverageDebt) {
			all.push(...this.computeTestCoverage())
		}
		return all
	}

	@Spec("Calculates project-wide test coverage debt and emits warning/error diagnostics.")
	@Out("diagnostics", "DiagnosticObject[]")
	private computeTestCoverage(): DiagnosticObject[] {
		const files = this.loader.getFiles()
		const fileByPath = new Map<string, import("ts-morph").SourceFile>()
		for (const f of files) {
			fileByPath.set(f.getFilePath(), f)
		}

		let totalClasses = 0
		let coveredClasses = 0
		const uncoveredClassFiles: string[] = []

		for (const file of files) {
			const filePath = file.getFilePath()
			if (this.shouldIgnore(filePath)) continue

			const variant = FileVariantSupport.getVariantForFile(filePath)
			if (!variant || variant.isTest) continue

			const exportedClass = BaseRule.getExportedClass(file)
			if (!exportedClass) continue

			totalClasses++
			let isCovered = false

			const testPath = FileVariantSupport.getTestFilePath(filePath, exportedClass.getName())
			if (!testPath || !fs.existsSync(testPath)) {
				uncoveredClassFiles.push(path.relative(process.cwd(), filePath))
				continue
			}

			const testFile = fileByPath.get(testPath)
			if (!testFile) {
				uncoveredClassFiles.push(path.relative(process.cwd(), filePath))
				continue
			}

			const testClass = BaseRule.getExportedClass(testFile)
			if (!testClass) {
				uncoveredClassFiles.push(path.relative(process.cwd(), filePath))
				continue
			}

			const hasScenario = testClass
				.getMethods()
				.some(method => method.isStatic() && BaseRule.hasDecorator(method, "Scenario"))

			if (hasScenario) {
				coveredClasses++
				isCovered = true
			}
			if (!isCovered) {
				uncoveredClassFiles.push(path.relative(process.cwd(), filePath))
			}
		}

		if (totalClasses === 0) {
			return []
		}

		const status = this.coverageStatus(totalClasses, coveredClasses)
		const round = (value: number) => Math.round(value * 10) / 10
		const currentCoverage = round(status.coveragePercent)
		const currentUncovered = round(status.uncoveredPercent)
		const currentDebt = round(status.displayDebtPercent)
		const action =
			status.band === "notice"
				? "Notice: keep coverage high and continue adding tests for new classes."
				: status.band === "warning"
					? "Warning: add more class companions to reduce test-coverage debt."
					: status.band === "alert"
						? "ALERT: coverage is close to the failure threshold; add tests."
						: "Error: uncovered classes reached the failure threshold (20% or more)."
		const message = `test coverage debt ${currentDebt}%: ${coveredClasses}/${totalClasses} primary classes are covered with scenario tests (${currentUncovered}% uncovered). ${action}`
		const showUncovered = status.severity === "warning" || status.severity === "error"
		if (showUncovered && uncoveredClassFiles.length > 0) {
			const preview = uncoveredClassFiles.slice(0, 10)
			const remaining = uncoveredClassFiles.length - preview.length
			const moreText = remaining > 0 ? ` And ${remaining} many more uncovered.` : ""
			const withList = `${message} Uncovered class files: ${preview.join(", ")}.${moreText}`
			if (status.severity === "error") {
				return [BaseRule.createError("project", withList, "test-coverage")]
			}
			return [BaseRule.createWarning("project", withList, "test-coverage")]
		}

		if (status.severity === "error") {
			return [BaseRule.createError("project", message, "test-coverage")]
		}
		if (status.severity === "notice") {
			return [BaseRule.createNotice("project", message, "test-coverage")]
		}
		return [BaseRule.createWarning("project", message, "test-coverage")]
	}

	@Spec("Determines whether a file should be skipped from coverage calculations.")
	@Out("ignore", "boolean")
	private shouldIgnore(filePath: string) {
		return filePath.endsWith(".old.ts")
			|| filePath.endsWith(".d.old.ts")
			|| filePath.endsWith("decorators.ts")
			|| filePath.endsWith("/lll.lll.ts")
	}

	@Spec("Builds linear test coverage debt status details from class/test counts.")
	@Out("status", "object")
	private coverageStatus(classCount: number, covered = 0) {
		const classes = Math.max(0, classCount)
		const effectiveCovered = Math.min(Math.max(0, covered), classes)
		const coveragePercent = classes === 0 ? 100 : (effectiveCovered / classes) * 100
		const uncoveredPercent = Math.max(0, 100 - coveragePercent)
		const displayDebt = (uncoveredPercent / 20) * 100
		const band =
			uncoveredPercent < 5
				? "notice"
				: uncoveredPercent < 15
					? "warning"
					: uncoveredPercent < 20
						? "alert"
						: "error"
		return {
			totalClasses: classes,
			coveredClasses: effectiveCovered,
			coveragePercent: Number(coveragePercent.toFixed(2)),
			uncoveredPercent: Number(uncoveredPercent.toFixed(2)),
			displayDebtPercent: Number(displayDebt.toFixed(2)),
			band,
			severity: band === "error" ? "error" : band === "notice" ? "notice" : "warning"
		}
	}
}
